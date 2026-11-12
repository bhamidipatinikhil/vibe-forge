-- migrate:up
-- better-auth core schema (users, sessions, accounts, verifications), mapped to plural snake_case names in
-- src/infra/auth.ts. Expand-only (.claude/rules/migrations.md): a later change adds, never drops or renames.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE users (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified boolean NOT NULL DEFAULT false,
    image text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE accounts (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scope text,
    password text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_id_idx ON accounts (user_id);

CREATE TABLE verifications (
    id text PRIMARY KEY,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verifications_identifier_idx ON verifications (identifier);

-- migrate:down
-- Intentionally empty: rollbacks are forward fixes (docs/runbooks/rollback.md).
