-- Bumped on every password change (own change, admin edit, emailed reset):
-- the session JWT carries the value it was signed with, and a mismatch makes
-- the session invalid — signing out every other device. See lib/auth.ts.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
