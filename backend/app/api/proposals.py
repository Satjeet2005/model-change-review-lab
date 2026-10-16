import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DemoSession
from app.schemas import (
    AcceptProposalRequest,
    AcceptProposalResponse,
    CloseWorkspaceResponse,
    DuplicateVariantRequest,
    EditVariantOperationRequest,
    GenerateProposalRequest,
    GenerateProposalResponse,
    ProposalWorkspaceSchema,
    UpdateSelectionRequest,
)
from app.security import get_current_session
from app.services.idempotency import get_idempotency_key
from app.services.model_service import accept_proposal
from app.services.proposal_service import (
    close_workspace,
    duplicate_variant,
    edit_variant_operation,
    generate_proposal_workspace,
    get_active_workspace,
    get_workspace_by_id,
    list_archived_workspaces,
    remove_variant,
    reset_variant,
    update_selection,
)

router = APIRouter(prefix="/api/v1/proposals", tags=["proposals"])


@router.post("", response_model=GenerateProposalResponse)
def create_proposal(
    payload: GenerateProposalRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> GenerateProposalResponse:
    return generate_proposal_workspace(
        db=db,
        session_id=session.id,
        template_id=payload.template_id,
        expected_revision=payload.expected_revision,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )


@router.get("/active", response_model=ProposalWorkspaceSchema | None)
def read_active_proposal(
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> ProposalWorkspaceSchema | None:
    return get_active_workspace(db, session)


@router.get("", response_model=list[ProposalWorkspaceSchema])
def list_proposals(
    status: str = Query("archived"),
    limit: int = Query(20, ge=1, le=100),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> list[ProposalWorkspaceSchema]:
    if status != "archived":
        return []
    return list_archived_workspaces(db, session, limit=limit)


@router.get("/{workspace_id}", response_model=ProposalWorkspaceSchema)
def read_proposal_by_id(
    workspace_id: uuid.UUID,
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> ProposalWorkspaceSchema:
    return get_workspace_by_id(db, session, workspace_id)


@router.post("/{workspace_id}/variants", response_model=ProposalWorkspaceSchema)
def create_duplicate_variant(
    workspace_id: uuid.UUID,
    payload: DuplicateVariantRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> ProposalWorkspaceSchema:
    return duplicate_variant(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        source_variant_id=uuid.UUID(payload.source_variant_id),
        label=payload.label,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )


@router.patch("/{workspace_id}/variants/{variant_id}", response_model=ProposalWorkspaceSchema)
def update_variant_operation(
    workspace_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: EditVariantOperationRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> ProposalWorkspaceSchema:
    return edit_variant_operation(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        variant_id=variant_id,
        target_cell_id=payload.target_cell_id,
        proposed_value=payload.proposed_value,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )


@router.post("/{workspace_id}/variants/{variant_id}/reset", response_model=ProposalWorkspaceSchema)
def reset_variant_operations(
    workspace_id: uuid.UUID,
    variant_id: uuid.UUID,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> ProposalWorkspaceSchema:
    return reset_variant(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        variant_id=variant_id,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data={},
    )


@router.delete("/{workspace_id}/variants/{variant_id}", response_model=ProposalWorkspaceSchema)
def delete_variant(
    workspace_id: uuid.UUID,
    variant_id: uuid.UUID,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> ProposalWorkspaceSchema:
    return remove_variant(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        variant_id=variant_id,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data={},
    )


@router.patch("/{workspace_id}/selection", response_model=ProposalWorkspaceSchema)
def update_variant_selection(
    workspace_id: uuid.UUID,
    payload: UpdateSelectionRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> ProposalWorkspaceSchema:
    return update_selection(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        selected_variant_id=payload.selected_variant_id,
        comparison_variant_ids=payload.comparison_variant_ids,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )


@router.post("/{workspace_id}/reject", response_model=CloseWorkspaceResponse)
def reject_proposal_workspace(
    workspace_id: uuid.UUID,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> CloseWorkspaceResponse:
    return close_workspace(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        target_status="rejected",
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data={},
    )


@router.post("/{workspace_id}/archive", response_model=CloseWorkspaceResponse)
def archive_proposal_workspace(
    workspace_id: uuid.UUID,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> CloseWorkspaceResponse:
    return close_workspace(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        target_status="archived",
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data={},
    )


@router.post("/{workspace_id}/dismiss", response_model=CloseWorkspaceResponse)
def dismiss_proposal_workspace(
    workspace_id: uuid.UUID,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> CloseWorkspaceResponse:
    return close_workspace(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        target_status="dismissed",
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data={},
    )


@router.post("/{workspace_id}/accept", response_model=AcceptProposalResponse)
def accept_proposal_route(
    workspace_id: uuid.UUID,
    payload: AcceptProposalRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> AcceptProposalResponse:
    return accept_proposal(
        db=db,
        session_id=session.id,
        workspace_id=workspace_id,
        variant_id=uuid.UUID(payload.variant_id),
        expected_revision=payload.expected_revision,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )
