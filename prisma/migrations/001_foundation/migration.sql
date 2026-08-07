CREATE TYPE "UserRole" AS ENUM ('GENERAL_ADMIN', 'FINANCE', 'INVENTORY_VOLUNTEER');
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');
CREATE TYPE "LoginAttemptResult" AS ENUM ('SUCCESS', 'INVALID_CREDENTIALS', 'PENDING', 'INACTIVE', 'BLOCKED');
CREATE TYPE "AccessLinkPurpose" AS ENUM ('INVITE', 'PASSWORD_RESET', 'DONOR_ACCOUNT');
CREATE TYPE "AuditActorKind" AS ENUM ('USER', 'DONOR_LINK', 'PUBLIC', 'SYSTEM');
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILED');
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  "password_hash" TEXT,
  "failed_login_count" SMALLINT NOT NULL DEFAULT 0,
  "last_login_at" TIMESTAMPTZ(6),
  "blocked_at" TIMESTAMPTZ(6),
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_failed_login_count_check" CHECK ("failed_login_count" BETWEEN 0 AND 5),
  CONSTRAINT "users_blocked_state_check" CHECK (("status" = 'BLOCKED') = ("blocked_at" IS NOT NULL)),
  CONSTRAINT "users_password_state_check" CHECK ("status" = 'PENDING' OR "password_hash" IS NOT NULL),
  CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "users_email_normalized_key" ON "users" (LOWER("email"));

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" INET,
  "user_agent" VARCHAR(512),
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "sessions_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "sessions_revocation_check" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions" ("user_id", "expires_at");

CREATE TABLE "login_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "attempted_email" VARCHAR(254) NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" INET,
  "user_agent" VARCHAR(512),
  "result" "LoginAttemptResult" NOT NULL,
  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "login_attempts_attempted_email_occurred_at_idx" ON "login_attempts" ("attempted_email", "occurred_at");
CREATE INDEX "login_attempts_user_id_occurred_at_idx" ON "login_attempts" ("user_id", "occurred_at");

CREATE TABLE "access_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purpose" "AccessLinkPurpose" NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "user_id" UUID,
  "donor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_by" UUID,
  CONSTRAINT "access_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_links_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "access_links_owner_check" CHECK (
    (("purpose" IN ('INVITE', 'PASSWORD_RESET')) AND "user_id" IS NOT NULL AND "donor_id" IS NULL)
    OR ("purpose" = 'DONOR_ACCOUNT' AND "user_id" IS NULL AND "donor_id" IS NOT NULL)
  ),
  CONSTRAINT "access_links_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "access_links_revocation_check" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at"),
  CONSTRAINT "access_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "access_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "access_links_user_id_purpose_idx" ON "access_links" ("user_id", "purpose");
CREATE INDEX "access_links_donor_id_purpose_idx" ON "access_links" ("donor_id", "purpose");

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "actor_kind" "AuditActorKind" NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(80),
  "entity_id" UUID,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "outcome" "AuditOutcome" NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_entity_check" CHECK (("entity_type" IS NULL) = ("entity_id" IS NULL)),
  CONSTRAINT "audit_events_actor_check" CHECK (
    ("actor_kind" = 'USER' AND "actor_user_id" IS NOT NULL)
    OR ("actor_kind" <> 'USER' AND "actor_user_id" IS NULL)
  ),
  CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "audit_events_actor_user_id_occurred_at_idx" ON "audit_events" ("actor_user_id", "occurred_at");
CREATE INDEX "audit_events_entity_type_entity_id_occurred_at_idx" ON "audit_events" ("entity_type", "entity_id", "occurred_at");
CREATE INDEX "audit_events_action_occurred_at_idx" ON "audit_events" ("action", "occurred_at");

CREATE TABLE "projects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_status_name_idx" ON "projects" ("status", "name");
CREATE UNIQUE INDEX "projects_active_name_key" ON "projects" (LOWER("name")) WHERE "status" = 'ACTIVE';

CREATE FUNCTION prevent_audit_event_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_changes();
