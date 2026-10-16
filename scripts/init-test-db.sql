SELECT 'CREATE DATABASE mcrl_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mcrl_test')\gexec
