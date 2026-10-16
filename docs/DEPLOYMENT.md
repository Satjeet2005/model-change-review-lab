# Model Change Review Lab — Production Deployment Guide
## Target: Microsoft Azure Linux VM + Self-Hosted Coolify

This guide details the complete production deployment procedure for **Model Change Review Lab v1.0** on a dedicated **Microsoft Azure Linux Virtual Machine (Ubuntu 24.04 LTS)** using **self-hosted Coolify**.

---

## 1. Production Architecture & TLS Termination Boundary

```
                                  Internet
                                     │
                   HTTPS (443) / HTTP (80 for ACME)
                                     ▼
                    ┌─────────────────────────────────┐
                    │  Azure VM: Network Security     │
                    │  Group (NSG) Firewall           │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
     ┌───────────────────────────────────────────────────────────────┐
     │  Azure Linux VM (Ubuntu 24.04 LTS)                            │
     │                                                               │
     │   ┌───────────────────────────────────────────────────────┐   │
     │   │ Coolify Reverse Proxy (Traefik v3)                    │   │
     │   │ - Binds Ports 80 & 443                                │   │
     │   │ - Automatic Let's Encrypt TLS Provisioning & Renewal  │   │
     │   │ - Routes Host Headers to Internal Docker Containers   │   │
     │   └───────────────┬───────────────────────┬───────────────┘   │
     │                   │                       │                   │
     │   Internal Docker │ (Docker Network)      │ (Docker Network)  │
     │   Bridge Network  ▼                       ▼                   │
     │       ┌──────────────────────┐  ┌──────────────────────┐      │
     │       │ Frontend SPA         │  │ FastAPI Backend      │      │
     │       │ (Vite static build)  │  │ (backend/Dockerfile) │      │
     │       │ [app.yourdomain.com] │  │ [api.yourdomain.com] │      │
     │       └──────────────────────┘  └──────────┬───────────┘      │
     │                                            │                  │
     │                         Internal DB Traffic│ (Port 5432)      │
     │                         (NO Host Exposure) ▼                  │
     │                                 ┌──────────────────────┐      │
     │                                 │ PostgreSQL 16 DB     │      │
     │                                 │ Volume: mcrl_pgdata  │      │
     │                                 └──────────────────────┘      │
     └───────────────────────────────────────────────────────────────┘
```

### Authoritative TLS Termination
- **Coolify's built-in Traefik reverse proxy terminates all TLS connections** and routes HTTP/HTTPS requests internally.
- **Do NOT install a secondary reverse proxy** (such as standalone Nginx, Caddy, or Apache) directly on the host VM. Doing so will cause port-binding conflicts on ports 80 and 443 with Coolify.
- Traefik automatically handles Let's Encrypt SSL certificates (HTTP-01 ACME challenge) and redirects HTTP (`80`) to HTTPS (`443`).

---

## 2. Azure Virtual Machine Sizing & Provisioning

### 2.1 Hardware Requirements vs Azure Sizing
Coolify's official documentation defines the following hardware criteria:
- **Minimum:** 2 vCPUs, 2 GB RAM (with swap), 30+ GB storage.
- **Recommended for Production Stacks:** 2+ vCPUs, 4–8 GB RAM (to comfortably support container builds, Traefik, PostgreSQL, and runtime services without OOM), 40–60+ GB SSD storage.

Based on these verified requirements:
- **`Standard_B2s` (2 vCPUs, 4 GiB RAM, burstable):** Meets the operational baseline for lightweight demo traffic. If chosen, configure a **2–4 GiB swapfile** on Ubuntu to prevent out-of-memory errors during `npm run build` or Docker image compilation.
- **`Standard_B2ms` (2 vCPUs, 8 GiB RAM) or `Standard_D2s_v5` (2 vCPUs, 8 GiB RAM):** Recommended for dependable production operation, smooth concurrent builds, and predictable database latency without CPU credit depletion.
- **OS Disk:** Provision at least **40–64 GiB** (Standard SSD or Premium SSD) to provide ample room for Docker layer caching, PostgreSQL volume storage, and system logs.

### 2.2 Provisioning via Azure CLI

```bash
# 1. Create a dedicated Resource Group
az group create \
  --name rg-mcrl-prod \
  --location eastus

# 2. Create a Static Public IP (Standard SKU)
# Standard SKU with Static allocation ensures the IP does not change upon VM deallocation
az network public-ip create \
  --resource-group rg-mcrl-prod \
  --name pip-mcrl-prod \
  --sku Standard \
  --allocation-method Static

# 3. Create a Virtual Network and Subnet
az network vnet create \
  --resource-group rg-mcrl-prod \
  --name vnet-mcrl \
  --address-prefix 10.0.0.0/16 \
  --subnet-name snet-mcrl \
  --subnet-prefix 10.0.1.0/24

# 4. Create the Network Security Group (NSG)
az network nsg create \
  --resource-group rg-mcrl-prod \
  --name nsg-mcrl-prod

# 5. Create Network Interface attached to Static IP and NSG
az network nic create \
  --resource-group rg-mcrl-prod \
  --name nic-mcrl-prod \
  --vnet-name vnet-mcrl \
  --subnet snet-mcrl \
  --network-security-group nsg-mcrl-prod \
  --public-ip-address pip-mcrl-prod

# 6. Deploy Ubuntu 24.04 LTS Virtual Machine with SSH Key (Password Auth Disabled)
az vm create \
  --resource-group rg-mcrl-prod \
  --name vm-mcrl-prod \
  --nics nic-mcrl-prod \
  --image Canonical:ubuntu-24_04-lts:server:latest \
  --size Standard_B2s \
  --admin-username azureuser \
  --ssh-key-values ~/.ssh/id_ed25519.pub \
  --os-disk-size-gb 48 \
  --storage-sku StandardSSD_LRS
```

### 2.3 DNS Records Setup
At your DNS registrar, create `A` records pointing to your Azure Static Public IP (`pip-mcrl-prod`):
- `app.yourdomain.com` ➔ `<AZURE_STATIC_PUBLIC_IP>`
- `api.yourdomain.com` ➔ `<AZURE_STATIC_PUBLIC_IP>`
- `panel.yourdomain.com` ➔ `<AZURE_STATIC_PUBLIC_IP>` *(Optional: for Coolify dashboard domain)*

Ensure DNS propagation completes before configuring domains in Coolify so that Let's Encrypt ACME challenges succeed.

---

## 3. Azure Network Security Group (NSG) & Dashboard Access Strategy

### 3.1 Coolify Dashboard Port Strategy (Ports 8000, 6001, 6002)
Coolify utilizes multiple ports for direct administrative communication:
- **Port 8000:** Web Dashboard (HTTP/WS).
- **Port 6001:** Real-time event websocket (push updates and live logs).
- **Port 6002:** Terminal websocket daemon (in-browser container terminal).
- **Ports 80 & 443:** Coolify reverse proxy (Traefik).

#### Direct-IP Setup vs Recommended Custom Domain

1. **Phase 1: Initial Setup via Secure SSH Tunnel (No Exposed Admin Ports):**
   Do not expose ports 8000, 6001, or 6002 to the public internet. Connect from your workstation using SSH port forwarding:
   ```bash
   ssh -N -L 8000:localhost:8000 -L 6001:localhost:6001 -i ~/.ssh/id_ed25519 azureuser@<AZURE_STATIC_PUBLIC_IP>
   ```
   Open `http://localhost:8000` in your local browser to complete initial registration.

2. **Phase 2: Transition to Dashboard Domain (Recommended Production Strategy):**
   - In Coolify ➔ **Settings** ➔ **General**, set **Instance's Domain** to `https://panel.yourdomain.com`.
   - Coolify's Traefik proxy automatically issues a Let's Encrypt TLS certificate for `panel.yourdomain.com` and securely terminates TLS on port 443 for the dashboard, websocket, and terminal.
   - Once verified, **close ports 8000, 6001, and 6002 entirely on the Azure NSG and host UFW**. All administrative traffic then flows over standard HTTPS (Port 443).

### 3.2 Inbound Security Rules on `nsg-mcrl-prod`

| Priority | Rule Name | Port(s) | Protocol | Source | Destination | Action | Rationale |
|---|---|---|---|---|---|---|---|
| **100** | `Allow-SSH-Admin` | `22` | TCP | `<ADMIN_IP>/32` | Any | **Allow** | Restricted to administrator's IP/VPN. Prevents automated brute-force scans. |
| **110** | `Allow-HTTP-Public` | `80` | TCP | `Internet` | Any | **Allow** | Required for ACME HTTP-01 challenge and automatic HTTPS redirection. |
| **120** | `Allow-HTTPS-Public` | `443` | TCP | `Internet` | Any | **Allow** | Public web traffic for frontend SPA, API, and Coolify panel (when domain-configured). |
| **130** | `Allow-Coolify-Direct-Admin` *(Optional/Temp)* | `8000, 6001, 6002` | TCP | `<ADMIN_IP>/32` | Any | **Allow** | If direct-IP access is required prior to domain setup. Remove or disable once `panel.yourdomain.com` is active. |
| **4096** | `Deny-All-Inbound` | `*` | Any | `*` | Any | **Deny** | Azure default: all unlisted ports (including `5432`) are blocked from external access. |

```bash
# Allow SSH only from admin workstation IP
ADMIN_IP=$(curl -s https://api.ipify.org)
az network nsg rule create \
  --resource-group rg-mcrl-prod \
  --nsg-name nsg-mcrl-prod \
  --name Allow-SSH-Admin \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes "$ADMIN_IP/32" \
  --source-port-ranges "*" \
  --destination-address-prefixes "*" \
  --destination-port-ranges 22

# Allow Public HTTP & HTTPS (Ports 80, 443)
az network nsg rule create \
  --resource-group rg-mcrl-prod \
  --nsg-name nsg-mcrl-prod \
  --name Allow-HTTP-Public \
  --priority 110 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes "*" \
  --source-port-ranges "*" \
  --destination-address-prefixes "*" \
  --destination-port-ranges 80

az network nsg rule create \
  --resource-group rg-mcrl-prod \
  --nsg-name nsg-mcrl-prod \
  --name Allow-HTTPS-Public \
  --priority 120 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes "*" \
  --source-port-ranges "*" \
  --destination-address-prefixes "*" \
  --destination-port-ranges 443
```

> [!IMPORTANT]
> **PostgreSQL (Port 5432) Boundary:** PostgreSQL is **never** added to the NSG. It must remain accessible only within the internal Docker network, with zero public host port exposure.

---

## 4. Azure Cost-Verification Checklist

Before deploying, review your Azure subscription pricing to verify the cost footprint of this configuration. Do not assume or promise a free deployment:

- [ ] **VM Compute SKU:**
  - Verify hourly and estimated monthly cost for the selected VM size (e.g. `Standard_B2s` vs `Standard_D2s_v5`) in your target Azure Region (e.g. `eastus`, `westeurope`).
  - Note: Burstable B-series machines consume CPU credits; verify whether credit accrual matches expected continuous workloads.
- [ ] **OS Disk Storage:**
  - Verify the storage tier: `Standard SSD (E-series)` vs `Premium SSD (P-series)` vs `Standard HDD`.
  - Confirm the disk size allocation (40–64 GiB). Azure charges monthly for the provisioned disk capacity regardless of consumption.
- [ ] **Managed Data Disks (Optional):**
  - If attaching a dedicated data disk for `/var/lib/docker/volumes` or database storage, confirm the provisioned size, IOPS tier, and redundancy (LRS vs ZRS).
- [ ] **Static Public IPv4 Address:**
  - Standard SKU public IPs incur an hourly charge when assigned to a running VM, and a higher hourly charge if left unassociated.
- [ ] **Outbound Data Transfer (Egress Bandwidth):**
  - Azure provides a limited initial tier of free outbound internet bandwidth per month; review per-GB rates for egress beyond that limit. Inbound data transfer is free.
- [ ] **Ancillary Network Resources:**
  - Ensure paid Azure services such as **Azure Bastion**, **NAT Gateway**, or **Azure Firewall** are **not** provisioned unless explicitly budgeted. Direct NSG rules on the NIC incur no additional resource fee.
- [ ] **Taxes and Currency Conversion:**
  - Verify applicable value-added tax (VAT), Goods and Services Tax (GST), or state sales tax based on your organization's legal registration and billing country.
- [ ] **Budget Alerts in Azure Cost Management:**
  - Configure a Budget in **Cost Management + Billing** for Resource Group `rg-mcrl-prod` with email threshold alerts at **50%**, **80%**, and **100%** of expected monthly spend.

---

## 5. Installing Self-Hosted Coolify on Ubuntu 24.04 LTS

### 5.1 System Preparation & Swapfile
Connect to your Azure VM via SSH:
```bash
ssh -i ~/.ssh/id_ed25519 azureuser@<AZURE_STATIC_PUBLIC_IP>
```

Update system packages and configure a 2 GiB swapfile (essential if using `Standard_B2s`):
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl ufw

# Set up 2 GiB swapfile to prevent out-of-memory during builds
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5.2 Host Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 5.3 Install Coolify
Execute the official Coolify installation script from the authoritative URL:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

The script will automatically:
1. Install Docker Engine and the Docker Compose plugin.
2. Pull and launch the Coolify core containers (`coolify`, `coolify-proxy` / Traefik, `coolify-db`).
3. Create the default Docker network (`coolify`).

---

## 6. Production Networking Topologies & Service Deployment

You can deploy Model Change Review Lab using either of two unambiguous networking topologies. **Option A (Docker Compose Stack)** is recommended for unified lifecycle management and deterministic DNS resolution.

---

### Option A (Recommended): Unified Docker Compose Stack in Coolify

This topology runs all three tiers—the frontend SPA, FastAPI backend, and PostgreSQL—within a single Compose project using [`compose.prod.yaml`](../compose.prod.yaml). All services share the internal Compose bridge network, and **zero host ports are published to the VM host or internet**.

#### 1. Configuration in Coolify
1. In Coolify, click **+ New Resource** ➔ **Docker Compose**.
2. Select Git Source (`https://github.com/Satjeet2005/model-change-review-lab.git`, Branch: `master`).
3. Set **Compose File Path** to `compose.prod.yaml`.
4. Configure Environment Variables in the Coolify Compose UI:
   ```env
   POSTGRES_DB=mcrl
   POSTGRES_USER=mcrl
   POSTGRES_PASSWORD=<STRONG_RANDOM_PASSWORD>
   CORS_ORIGINS=https://app.yourdomain.com
   ENVIRONMENT=production
   SESSION_TTL_DAYS=30
   VITE_API_BASE_URL=https://api.yourdomain.com
   ```

   > [!IMPORTANT]
   > **`VITE_API_BASE_URL` is mandatory at build time:**
   > `compose.prod.yaml` defines `args: VITE_API_BASE_URL: ${VITE_API_BASE_URL:?...}` with no localhost fallback. Because Vite statically inlines API endpoints into the SPA bundle during `npm run build`, `VITE_API_BASE_URL` **must** be set in Coolify to your public backend HTTPS origin (e.g. `https://api.yourdomain.com`). If omitted, `docker compose config` and the build process will fail with an explicit configuration error.
5. Configure Traefik Proxy Domains for Services:
   Coolify allows setting the public domain for each Compose service directly in the UI:
   - **`frontend` service:** Domain: `https://app.yourdomain.com` ➔ Coolify routes traffic to internal container port `80`.
   - **`backend` service:** Domain: `https://api.yourdomain.com` ➔ Coolify routes traffic to internal container port `8000`.
   - **`db` service:** Has **no domain and no host ports**. It remains isolated inside the private Compose network.

#### 2. Coolify Proxy Network Integration
For Coolify's Traefik reverse proxy to route traffic to containers in a Compose stack without publishing host ports:
- Coolify automatically connects its proxy container to the Compose network upon deployment.
- Alternatively, if using Coolify's custom Docker network mode, you can declare the `coolify` external network in the compose file and attach `frontend` and `backend`. In standard Coolify Compose management, Coolify handles proxy network bridging natively using the container internal listening ports (`80` and `8000`).

#### 3. Service-Name Resolution & `DATABASE_URL`
In `compose.prod.yaml`:
```yaml
DATABASE_URL=postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
```
- The database hostname is `db` (the service name).
- Docker's embedded DNS resolves `db` directly to the PostgreSQL container's internal IP.
- **Verification Command:**
  ```bash
  docker exec -it mcrl-backend-prod python3 -c "import socket; print('Resolved db IP:', socket.gethostbyname('db'))"
  ```

---

### Option B: Separate Coolify Resources (Standalone Services)

If you prefer deploying the database, backend, and frontend as distinct Coolify resources:

#### 1. Database Resource
1. Click **+ New Resource** ➔ **PostgreSQL 16**.
2. Settings: DB Name `mcrl`, User `mcrl`, secure password.
3. **Make Publicly Available:** **UNCHECKED**.
4. In Coolify, open the database resource and locate the **Internal Database URL** or **Internal Hostname** (e.g. `postgresql-mcrl` or container name `<uuid>`).

#### 2. Backend Application
1. Click **+ New Resource** ➔ **Git Repository** (Branch: `master`).
2. Build Pack: **Dockerfile**.
3. Dockerfile path: `backend/Dockerfile` (Build Context: `/`).
4. Domain: `https://api.yourdomain.com` (Port: `8000`).
5. Network Configuration: Ensure the application is connected to the same Coolify Docker network (`coolify`) as the database.
6. Environment Variables:
   ```env
   DATABASE_URL=postgresql+psycopg://mcrl:<DB_PASSWORD>@<COOLIFY_INTERNAL_DB_HOSTNAME>:5432/mcrl
   CORS_ORIGINS=https://app.yourdomain.com
   ENVIRONMENT=production
   SESSION_TTL_DAYS=30
   ```
7. **Verification Command:**
   ```bash
   # Confirm backend can resolve and ping the standalone database hostname:
   docker exec -it <backend_container_name> getent hosts <COOLIFY_INTERNAL_DB_HOSTNAME>
   ```

#### 3. Frontend Application
1. Click **+ New Resource** ➔ **Git Repository** (Branch: `master`).
2. Build Pack: **Dockerfile**.
3. Dockerfile path: `Dockerfile.frontend` (Build Context: `/`).
4. Domain: `https://app.yourdomain.com` (Port: `80`).
5. Build Arguments / Environment Variables:
   - In Coolify, under **Environment Variables**, configure `VITE_API_BASE_URL` and ensure it is marked as a **Build Variable** (or added to Docker Build Arguments):
     ```env
     VITE_API_BASE_URL=https://api.yourdomain.com
     ```
   - Notice that `Dockerfile.frontend` requires `VITE_API_BASE_URL` to be present at build time and has no fallback. Omitting it will halt the build with an error.

---

## 7. Database Persistence, Migrations, Backup & Recovery

### 7.1 Persistent Storage
PostgreSQL stores all tables in the named volume `mcrl_pgdata`. Data persists across container restarts, rebuilds, and Coolify updates.

### 7.2 Database Migrations
Migrations are managed with Alembic. The backend container entrypoint automatically executes `alembic upgrade head` before spawning Uvicorn workers on container start.

---

### 7.3 Backup Strategies (S3-Compatible vs Azure-Native)

> [!NOTE]
> Coolify's built-in automated backup scheduler natively communicates with **S3-compatible object storage APIs**. Azure Blob Storage does not provide native direct S3 API parity without specialized gateways.

#### Method 1: S3-Compatible Provider for Coolify Automated Backups (Recommended)
Use an S3-compatible object storage service for native Coolify automated backups:
- **Cloudflare R2 (Recommended):** Full S3 API compatibility, zero egress bandwidth fees.
- **AWS S3, Wasabi, or MinIO:** Standard S3 API targets.
- **Configuration in Coolify:** Under PostgreSQL ➔ **Backups**, enter S3 Endpoint, Access Key, Secret Key, and Bucket name. Set schedule to daily (`0 2 * * *`).

#### Method 2: Azure Blob Storage via Scheduled Cron Script
If your organization mandates storing backups directly in Azure Blob Storage:
1. Create an Azure Storage Account and Blob Container:
   ```bash
   az storage account create --name stmcrlprod --resource-group rg-mcrl-prod --sku Standard_LRS
   az storage container create --account-name stmcrlprod --name db-backups --auth-mode login
   ```
2. Set up an automated daily cron job script on the VM (`/opt/scripts/backup-to-azure.sh`):
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   BACKUP_NAME="mcrl_$(date +%Y%m%d_%H%M%S).sql.gz"
   BACKUP_PATH="/tmp/${BACKUP_NAME}"

   # Dump and compress database
   docker exec -t mcrl-db-prod pg_dump -U mcrl -d mcrl | gzip > "$BACKUP_PATH"

   # Upload to Azure Blob Storage using Azure CLI / Managed Identity
   az storage blob upload \
     --account-name stmcrlprod \
     --container-name db-backups \
     --file "$BACKUP_PATH" \
     --name "$BACKUP_NAME" \
     --auth-mode key

   # Remove local temporary file
   rm -f "$BACKUP_PATH"
   ```

---

### 7.4 Backup Restoration & Integrity Test Procedure

Always test backups by restoring them into an isolated test database. **Never test restore operations against the live production database.**

```bash
# Step 1: Download or locate the backup file
gunzip -k /var/backups/mcrl_backup_20261015.sql.gz

# Step 2: Create a temporary test database
docker exec -i mcrl-db-prod psql -U mcrl -d postgres -c "CREATE DATABASE mcrl_restore_test;"

# Step 3: Stream the backup SQL into the test database
cat /var/backups/mcrl_backup_20261015.sql | docker exec -i mcrl-db-prod psql -U mcrl -d mcrl_restore_test

# Step 4: Verify schema, tables, and row counts in the restored database
docker exec -i mcrl-db-prod psql -U mcrl -d mcrl_restore_test -c "
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
  SELECT count(*) AS session_count FROM demo_sessions;
  SELECT count(*) AS transaction_count FROM change_transactions;
"

# Step 5: Clean up the test database
docker exec -i mcrl-db-prod psql -U mcrl -d postgres -c "DROP DATABASE mcrl_restore_test;"
```

---

## 8. Local Development Path (Preserved)

Docker Compose remains the primary workflow for local development:

```bash
# 1. Start local PostgreSQL 16 (securely bound to 127.0.0.1:5432)
docker compose up -d

# 2. Run backend migrations & local API server
cd backend
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000

# 3. Start frontend dev server
npm run dev
```

---

## 9. Pre-Flight Production Verification Checklist

Run these checks against your live Azure deployment before directing production traffic:

- [ ] **DNS Resolution:**
  - `dig +short app.yourdomain.com` matches `<AZURE_STATIC_PUBLIC_IP>`.
  - `dig +short api.yourdomain.com` matches `<AZURE_STATIC_PUBLIC_IP>`.
- [ ] **HTTPS Certificates:**
  - `curl -Iv https://app.yourdomain.com` returns `HTTP 200` with valid Let's Encrypt certificate.
  - `curl -Iv https://api.yourdomain.com/api/v1/health` returns `HTTP 200` with valid Let's Encrypt certificate.
- [ ] **Backend Health Endpoint:**
  ```bash
  curl -s https://api.yourdomain.com/api/v1/health
  # Expected output: {"status":"ok","database":"ok"}
  ```
- [ ] **CORS Verification:**
  ```bash
  curl -s -I -X OPTIONS https://api.yourdomain.com/api/v1/model/assumptions \
    -H "Origin: https://app.yourdomain.com" \
    -H "Access-Control-Request-Method: PATCH"
  # Expected headers:
  # access-control-allow-origin: https://app.yourdomain.com
  # access-control-allow-methods: GET, POST, PATCH, DELETE, OPTIONS
  ```
- [ ] **Origin Whitelist Enforcement on Mutations:**
  ```bash
  curl -s -X POST https://api.yourdomain.com/api/v1/session \
    -H "Origin: https://malicious-site.com"
  # Expected response: HTTP 403 Forbidden ("forbidden_origin")
  ```
- [ ] **Database Network Isolation:**
  From your local machine, run:
  ```bash
  nc -zv -w 3 <AZURE_STATIC_PUBLIC_IP> 5432
  # Must timeout or fail to connect (port 5432 is not open to the internet)
  ```
- [ ] **End-to-End User Flow:**
  - Open `https://app.yourdomain.com` in a clean browser profile.
  - Verify model assumptions load from server snapshot (`POST /api/v1/session`).
  - Generate a scenario proposal (e.g. "Conservative Staffing").
  - Review diff, edit draft cells, and accept proposal.
  - Hard refresh (`Ctrl+F5`) to confirm model persistence via stored `X-Workspace-Token`.
