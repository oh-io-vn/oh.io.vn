import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { App, Env, User } from "./types";
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
export const randomSlug = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (v) => "23456789abcdefghjkmnpqrstuvwxyz01"[v & 31],
  ).join("");
export async function hash(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export const sessionName = (env: Env) =>
  env.ENVIRONMENT === "production" ? "__Host-oh_session" : "oh_session";
export async function currentUser(c: Context<App>): Promise<User | null> {
  const token = getCookie(c, sessionName(c.env));
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return c.env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.blocked FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?",
  )
    .bind(await hash(token), Date.now())
    .first<User>();
}
export async function csrf(c: Context<App>) {
  const token = getCookie(c, sessionName(c.env));
  return token ? hmac(c.env.HMAC_SECRET, "csrf:" + token) : null;
}
export async function checkWrite(c: Context<App>) {
  if (
    c.req.header("Origin") !== c.env.APP_ORIGIN ||
    !c.req.header("Content-Type")?.startsWith("application/json")
  )
    return false;
  if (c.get("user")) return c.req.header("X-CSRF-Token") === (await csrf(c));
  return true;
}
export async function networkKey(c: Context<App>): Promise<string> {
  const ip =
    c.req.header("CF-Connecting-IP") ??
    (c.env.ENVIRONMENT === "development" ? "local" : "unknown");
  return hmac(c.env.HMAC_SECRET, "network:" + ip);
}
export async function verifyTurnstile(
  c: Context<App>,
  token: unknown,
): Promise<boolean> {
  if (typeof token !== "string" || token.length > 2048 || !token) return false;
  // Test keys are valid only for local development. Never accept them on production.
  if (
    c.env.ENVIRONMENT === "production" &&
    c.env.TURNSTILE_SECRET_KEY?.startsWith("1x000")
  )
    return false;
  let data: {
    success?: boolean;
    hostname?: string;
    action?: string;
    "error-codes"?: string[];
  };
  try {
    const result = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret: c.env.TURNSTILE_SECRET_KEY,
          response: token,
          ...(c.req.header("CF-Connecting-IP")
            ? { remoteip: c.req.header("CF-Connecting-IP")! }
            : {}),
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!result.ok) throw new Error("Siteverify unavailable");
    data = await result.json();
    if (!data || typeof data.success !== "boolean")
      throw new Error("Invalid Siteverify response");
  } catch {
    console.warn("verification_service_failed", {
      reason: "network_or_response",
    });
    throw new HTTPException(503, {
      message: "Dịch vụ xác minh đang bận. Vui lòng thử lại sau ít phút.",
    });
  }
  if (
    data["error-codes"]?.some((code) =>
      [
        "internal-error",
        "missing-input-secret",
        "invalid-input-secret",
      ].includes(code),
    )
  ) {
    console.warn("verification_service_failed", {
      reason: "provider_or_configuration",
    });
    throw new HTTPException(503, {
      message: "Dịch vụ xác minh đang bận. Vui lòng thử lại sau ít phút.",
    });
  }
  return (
    data.success &&
    (c.env.ENVIRONMENT === "development" ||
      (data.hostname === new URL(c.env.APP_ORIGIN).hostname &&
        data.action === "create"))
  );
}
export async function readBody(
  c: Context<App>,
): Promise<Record<string, unknown>> {
  const reader = c.req.raw.body?.getReader();
  if (!reader) throw new HTTPException(400, { message: "Thiếu dữ liệu." });
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw new HTTPException(413, { message: "Dữ liệu quá lớn." });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let p = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, p);
    p += chunk.length;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HTTPException(400, { message: "Dữ liệu JSON không hợp lệ." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HTTPException(400, { message: "Dữ liệu không hợp lệ." });
  return body as Record<string, unknown>;
}
