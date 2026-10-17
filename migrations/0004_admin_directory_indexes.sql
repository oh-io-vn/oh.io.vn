-- Stable, bounded pages for the admin link and account directories.
CREATE INDEX links_created_slug ON links(created_at DESC, slug);
CREATE INDEX users_created_id ON users(created_at DESC, id);
