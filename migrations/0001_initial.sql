PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE policy (
 id INTEGER PRIMARY KEY CHECK(id=1), create_enabled INTEGER NOT NULL DEFAULT 1,
 guest_enabled INTEGER NOT NULL DEFAULT 1, analytics_enabled INTEGER NOT NULL DEFAULT 1,
 guest_limit INTEGER NOT NULL DEFAULT 3, user_limit INTEGER NOT NULL DEFAULT 20,
 active_limit INTEGER NOT NULL DEFAULT 100, global_limit INTEGER NOT NULL DEFAULT 200,
 expiry_hold INTEGER NOT NULL DEFAULT 0, heartbeat INTEGER NOT NULL DEFAULT 0,
 admin_sub TEXT, monitoring TEXT, updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO policy(id) VALUES(1);
CREATE TABLE links (
 slug TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), target TEXT, host TEXT, label TEXT,
 created_at INTEGER NOT NULL, last_access_at INTEGER NOT NULL, idle_expires_at INTEGER NOT NULL,
 fixed_expires_at INTEGER, months INTEGER NOT NULL CHECK(months IN (3,12)),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleted','expired','blocked')),
 creator_key TEXT
);
CREATE INDEX links_owner ON links(owner_id,created_at DESC);
CREATE TABLE creation_events (actor TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX creation_actor_time ON creation_events(actor,created_at);
CREATE INDEX creation_time ON creation_events(created_at);
CREATE TRIGGER enforce_creation BEFORE INSERT ON links BEGIN
 SELECT CASE WHEN (SELECT create_enabled FROM policy WHERE id=1)=0 THEN RAISE(ABORT,'quota:paused') END;
 SELECT CASE WHEN NEW.owner_id IS NULL AND (SELECT guest_enabled FROM policy WHERE id=1)=0 THEN RAISE(ABORT,'quota:guest_paused') END;
 SELECT CASE WHEN NEW.owner_id IS NOT NULL AND (SELECT blocked FROM users WHERE id=NEW.owner_id)=1 THEN RAISE(ABORT,'quota:blocked') END;
 SELECT CASE WHEN (SELECT count(*) FROM creation_events WHERE created_at>NEW.created_at-86400000)>=(SELECT global_limit FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:global') END;
 SELECT CASE WHEN (SELECT count(*) FROM creation_events WHERE actor=COALESCE(NEW.owner_id,NEW.creator_key) AND created_at>NEW.created_at-86400000)>=
   (SELECT CASE WHEN NEW.owner_id IS NULL THEN guest_limit ELSE user_limit END FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:actor') END;
 SELECT CASE WHEN NEW.owner_id IS NOT NULL AND (SELECT count(*) FROM links WHERE owner_id=NEW.owner_id AND status='active' AND (idle_expires_at>NEW.created_at OR (SELECT expiry_hold FROM policy WHERE id=1)=1 OR (SELECT heartbeat FROM policy WHERE id=1)<NEW.created_at-7200000) AND (fixed_expires_at IS NULL OR fixed_expires_at>NEW.created_at)) >= (SELECT active_limit FROM policy WHERE id=1) THEN RAISE(ABORT,'quota:active') END;
END;
CREATE TRIGGER record_creation AFTER INSERT ON links BEGIN
 INSERT INTO creation_events(actor,created_at) VALUES(COALESCE(NEW.owner_id,NEW.creator_key),NEW.created_at);
END;
CREATE TABLE analytics (slug TEXT NOT NULL REFERENCES links(slug), day TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(slug,day,source,device));
CREATE INDEX analytics_day ON analytics(day);
CREATE TABLE analytics_gaps (started_at INTEGER PRIMARY KEY, ended_at INTEGER, reason TEXT NOT NULL);
CREATE TABLE blocked_targets (kind TEXT NOT NULL CHECK(kind IN ('host','url')), value TEXT NOT NULL, PRIMARY KEY(kind,value));
CREATE TABLE admin_audit (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, subject TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX audit_time ON admin_audit(created_at);
