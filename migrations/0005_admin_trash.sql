-- Admin deletion is reversible for 30 days. Existing tombstones stay permanent.
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
ALTER TABLE links ADD COLUMN deleted_at INTEGER;
ALTER TABLE links ADD COLUMN deletion_previous_status TEXT CHECK(deletion_previous_status IN ('active','blocked','expired'));
ALTER TABLE links ADD COLUMN deletion_user_id TEXT;
CREATE INDEX users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX links_deleted ON links(deleted_at) WHERE deleted_at IS NOT NULL;

-- Account and link transitions are atomic, including session revocation.
-- Independently trashed links keep their original deadline and are not restored
-- by undoing account deletion.
CREATE TRIGGER trash_user_links AFTER UPDATE OF deleted_at ON users
WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL BEGIN
 DELETE FROM sessions WHERE user_id=NEW.id;
 UPDATE links SET deletion_previous_status=status,status='deleted',
   deleted_at=NEW.deleted_at,deletion_user_id=NEW.id
 WHERE owner_id=NEW.id AND deleted_at IS NULL AND status<>'deleted';
END;
CREATE TRIGGER restore_user_links AFTER UPDATE OF deleted_at ON users
WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL BEGIN
 UPDATE links SET status=deletion_previous_status,deleted_at=NULL,
   deletion_previous_status=NULL,deletion_user_id=NULL
 WHERE owner_id=NEW.id AND deletion_user_id=NEW.id AND deleted_at=OLD.deleted_at;
END;
CREATE TRIGGER prevent_deleted_user_session BEFORE INSERT ON sessions
WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND deleted_at IS NOT NULL) BEGIN
 SELECT RAISE(ABORT,'account:deleted');
END;
CREATE TRIGGER prevent_deleted_user_link BEFORE INSERT ON links
WHEN NEW.status='active' AND EXISTS(SELECT 1 FROM users WHERE id=NEW.owner_id AND deleted_at IS NOT NULL) BEGIN
 SELECT RAISE(ABORT,'account:deleted');
END;
