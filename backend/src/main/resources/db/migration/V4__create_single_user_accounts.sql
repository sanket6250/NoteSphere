CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  account_slot SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_account_slot UNIQUE (account_slot),
  CONSTRAINT ck_users_username_normalized CHECK (username = lower(username)),
  CONSTRAINT ck_users_email_normalized CHECK (email = lower(email)),
  CONSTRAINT ck_users_single_account_slot CHECK (account_slot = 1)
);
