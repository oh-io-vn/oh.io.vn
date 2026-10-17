export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BURST: RateLimit;
  EXPIRY_GUARD: DurableObjectNamespace;
  ENVIRONMENT: string;
  APP_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  HMAC_SECRET: string;
  ADMIN_GOOGLE_SUBS: string;
  ADMIN_BOOTSTRAP_EMAIL?: string;
  BACKUP_TOKEN: string;
  CF_ACCOUNT_ID?: string;
  CF_DATABASE_ID?: string;
  CF_METRICS_TOKEN?: string;
}
export interface User {
  id: string;
  email: string;
  name: string;
  blocked: number;
}
export interface Policy {
  create_enabled: number;
  guest_enabled: number;
  analytics_enabled: number;
  guest_limit: number;
  user_limit: number;
  active_limit: number;
  global_limit: number;
  expiry_hold: number;
  heartbeat: number;
  admin_sub: string | null;
  monitoring: string | null;
  updated_at: number;
  automatic_level: number;
  metrics_at: number;
  last_backup_at: number;
}
export interface Link {
  slug: string;
  owner_id: string | null;
  target: string | null;
  host: string | null;
  label: string | null;
  created_at: number;
  last_access_at: number;
  idle_expires_at: number;
  fixed_expires_at: number | null;
  months: number;
  status: string;
}
export type App = {
  Bindings: Env;
  Variables: { user: User | null; admin: boolean };
};
