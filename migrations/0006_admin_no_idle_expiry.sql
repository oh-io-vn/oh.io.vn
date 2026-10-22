-- Admins may exempt an active link from inactivity expiry. Fixed expiry still applies.
ALTER TABLE links ADD COLUMN no_idle_expiry INTEGER NOT NULL DEFAULT 0
  CHECK(no_idle_expiry IN (0,1));

-- Permanent links still consume the owner's active-link quota.
DROP TRIGGER enforce_creation;
CREATE TRIGGER enforce_creation BEFORE INSERT ON links WHEN NEW.status='active' BEGIN
 SELECT CASE WHEN (SELECT create_enabled FROM policy WHERE id=1)=0 THEN RAISE(ABORT,'quota:paused') END;
 SELECT CASE WHEN NEW.owner_id IS NULL AND (SELECT guest_enabled FROM policy WHERE id=1)=0 THEN RAISE(ABORT,'quota:guest_paused') END;
 SELECT CASE WHEN NEW.owner_id IS NOT NULL AND (SELECT blocked FROM users WHERE id=NEW.owner_id)=1 THEN RAISE(ABORT,'quota:blocked') END;
 SELECT CASE WHEN (SELECT count(*) FROM creation_events WHERE created_at>NEW.created_at-86400000)>=(SELECT global_limit FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:global') END;
 SELECT CASE WHEN (SELECT count(*) FROM creation_events WHERE actor=COALESCE(NEW.owner_id,NEW.creator_key) AND created_at>NEW.created_at-86400000)>=
   (SELECT CASE WHEN NEW.owner_id IS NULL THEN guest_limit ELSE user_limit END FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:actor') END;
 SELECT CASE WHEN NEW.owner_id IS NOT NULL AND (SELECT count(*) FROM links WHERE owner_id=NEW.owner_id AND status='active' AND (no_idle_expiry=1 OR idle_expires_at>NEW.created_at OR (SELECT expiry_hold FROM policy WHERE id=1)=1 OR (SELECT heartbeat FROM policy WHERE id=1)<NEW.created_at-7200000) AND (fixed_expires_at IS NULL OR fixed_expires_at>NEW.created_at)) >= (SELECT active_limit FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:active') END;
END;
