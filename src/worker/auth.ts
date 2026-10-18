import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  EncryptJWT,
  jwtDecrypt,
  jwtVerify,
  createRemoteJWKSet,
  base64url,
} from "jose";
import { randomToken, hash, sessionName, networkKey } from "./security";
import type { App } from "./types";
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const key = async (secret: string) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
  );
export const auth = new Hono<App>();
auth.use("*", async (c, next) => {
  const limit = await c.env.BURST.limit({
    key: "auth:" + (await networkKey(c)),
  });
  if (!limit.success)
    return c.text(
      "Bạn đang đăng nhập quá nhanh. Vui lòng thử lại sau một phút.",
      429,
    );
  await next();
});
auth.get("/login", async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET)
    return c.text("Đăng nhập chưa sẵn sàng. Vui lòng quay lại sau.", 503);
  const state = randomToken(),
    nonce = randomToken(),
    verifier = randomToken();
  const challenge = base64url.encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  const cookie = await new EncryptJWT({ state, nonce, verifier })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .encrypt(await key(c.env.HMAC_SECRET));
  setCookie(c, "oh_oauth", cookie, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
    path: "/auth",
    maxAge: 600,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.APP_ORIGIN + "/auth/callback",
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return c.redirect(url.toString());
});
auth.get("/callback", async (c) => {
  const cookie = getCookie(c, "oh_oauth");
  deleteCookie(c, "oh_oauth", { path: "/auth" });
  try {
    if (!cookie || c.req.query("error")) throw new Error("cancel");
    const { payload } = await jwtDecrypt(cookie, await key(c.env.HMAC_SECRET));
    if (c.req.query("state") !== payload.state || !c.req.query("code"))
      throw new Error("state");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        code: c.req.query("code")!,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: c.env.APP_ORIGIN + "/auth/callback",
        grant_type: "authorization_code",
        code_verifier: String(payload.verifier),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("exchange");
    const tokens = (await response.json()) as { id_token: string };
    const { payload: identity } = await jwtVerify(tokens.id_token, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: c.env.GOOGLE_CLIENT_ID,
      algorithms: ["RS256"],
    });
    if (
      identity.nonce !== payload.nonce ||
      identity.email_verified !== true ||
      typeof identity.sub !== "string" ||
      typeof identity.email !== "string"
    )
      throw new Error("identity");
    const now = Date.now();
    await c.env.DB.prepare(
      "INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name WHERE users.deleted_at IS NULL",
    )
      .bind(
        identity.sub,
        identity.email,
        String(identity.name || "Bạn").slice(0, 120),
        now,
      )
      .run();
    const user = await c.env.DB.prepare(
      "SELECT blocked,deleted_at FROM users WHERE id=?",
    )
      .bind(identity.sub)
      .first<{ blocked: number; deleted_at: number | null }>();
    if (user?.blocked || user?.deleted_at != null)
      return c.redirect("/?error=account");
    if (
      c.env.ADMIN_BOOTSTRAP_EMAIL &&
      identity.email === c.env.ADMIN_BOOTSTRAP_EMAIL
    )
      await c.env.DB.prepare(
        "UPDATE policy SET admin_sub=? WHERE id=1 AND admin_sub IS NULL",
      )
        .bind(identity.sub)
        .run();
    const token = randomToken();
    await c.env.DB.prepare(
      "INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
    )
      .bind(await hash(token), identity.sub, now + 7 * 86400000)
      .run();
    setCookie(c, sessionName(c.env), token, {
      httpOnly: true,
      secure: c.env.ENVIRONMENT === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 7 * 86400,
    });
    return c.redirect("/dashboard/");
  } catch {
    return c.redirect("/?error=login");
  }
});
