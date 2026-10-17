-- Renaming moves analytics through the foreign key and reserves the old code
-- in the existing tombstone format. It is not a new link or a quota event.
CREATE TABLE analytics_next (
 slug TEXT NOT NULL REFERENCES links(slug) ON UPDATE CASCADE,
 day TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL,
 clicks INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(slug,day,source,device)
);
INSERT INTO analytics_next SELECT slug,day,source,device,clicks FROM analytics;
DROP TABLE analytics;
ALTER TABLE analytics_next RENAME TO analytics;
CREATE INDEX analytics_day ON analytics(day);

DROP TRIGGER enforce_creation;
DROP TRIGGER record_creation;
DROP TRIGGER operating_guards;
CREATE TRIGGER enforce_creation BEFORE INSERT ON links WHEN NEW.status='active' BEGIN
 SELECT CASE WHEN (SELECT create_enabled FROM policy WHERE id=1)=0 THEN RAISE(ABORT,'quota:paused') END;
 SELECT CASE WHEN NEW.owner_id IS NULL AND (SELECT guest_enabled FROM policy WHERE id=1)=0 THEN RAISE(ABORT,'quota:guest_paused') END;
 SELECT CASE WHEN NEW.owner_id IS NOT NULL AND (SELECT blocked FROM users WHERE id=NEW.owner_id)=1 THEN RAISE(ABORT,'quota:blocked') END;
 SELECT CASE WHEN (SELECT count(*) FROM creation_events WHERE created_at>NEW.created_at-86400000)>=(SELECT global_limit FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:global') END;
 SELECT CASE WHEN (SELECT count(*) FROM creation_events WHERE actor=COALESCE(NEW.owner_id,NEW.creator_key) AND created_at>NEW.created_at-86400000)>=
   (SELECT CASE WHEN NEW.owner_id IS NULL THEN guest_limit ELSE user_limit END FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:actor') END;
 SELECT CASE WHEN NEW.owner_id IS NOT NULL AND (SELECT count(*) FROM links WHERE owner_id=NEW.owner_id AND status='active' AND (idle_expires_at>NEW.created_at OR (SELECT expiry_hold FROM policy WHERE id=1)=1 OR (SELECT heartbeat FROM policy WHERE id=1)<NEW.created_at-7200000) AND (fixed_expires_at IS NULL OR fixed_expires_at>NEW.created_at)) >= (SELECT active_limit FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:active') END;
END;
CREATE TRIGGER record_creation AFTER INSERT ON links WHEN NEW.status='active' BEGIN
 INSERT INTO creation_events(actor,created_at) VALUES(COALESCE(NEW.owner_id,NEW.creator_key),NEW.created_at);
END;
CREATE TRIGGER operating_guards BEFORE INSERT ON links WHEN NEW.status='active' BEGIN
 SELECT CASE WHEN (SELECT automatic_level FROM policy WHERE id=1)>=90 THEN RAISE(ABORT,'quota:paused') END;
 SELECT CASE WHEN NEW.owner_id IS NULL AND (SELECT automatic_level FROM policy WHERE id=1)>=80 THEN RAISE(ABORT,'quota:guest_paused') END;
 SELECT CASE WHEN (SELECT metrics_at FROM policy WHERE id=1)<NEW.created_at-7200000 THEN RAISE(ABORT,'quota:paused') END;
 SELECT CASE WHEN (SELECT last_backup_at FROM policy WHERE id=1)<NEW.created_at-129600000 THEN RAISE(ABORT,'quota:paused') END;
END;

CREATE TRIGGER reserve_renamed_slug AFTER UPDATE OF slug ON links
WHEN NEW.slug <> OLD.slug BEGIN
 INSERT INTO links(slug,created_at,last_access_at,idle_expires_at,months,status)
 VALUES(OLD.slug,OLD.created_at,OLD.last_access_at,OLD.idle_expires_at,OLD.months,'deleted');
END;
