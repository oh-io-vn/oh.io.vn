ALTER TABLE policy ADD COLUMN automatic_level INTEGER NOT NULL DEFAULT 90;
ALTER TABLE policy ADD COLUMN metrics_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE policy ADD COLUMN last_backup_at INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER operating_guards BEFORE INSERT ON links BEGIN
 SELECT CASE WHEN (SELECT automatic_level FROM policy WHERE id=1)>=90 THEN RAISE(ABORT,'quota:paused') END;
 SELECT CASE WHEN NEW.owner_id IS NULL AND (SELECT automatic_level FROM policy WHERE id=1)>=80 THEN RAISE(ABORT,'quota:guest_paused') END;
 SELECT CASE WHEN (SELECT metrics_at FROM policy WHERE id=1)<NEW.created_at-7200000 THEN RAISE(ABORT,'quota:paused') END;
 SELECT CASE WHEN (SELECT last_backup_at FROM policy WHERE id=1)<NEW.created_at-129600000 THEN RAISE(ABORT,'quota:paused') END;
END;
