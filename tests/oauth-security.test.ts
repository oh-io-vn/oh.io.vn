import { env, createExecutionContext } from "cloudflare:test";
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  jwtDecrypt,
  base64url,
} from "jose";
import worker from "../src/worker/index";
import { hash } from "../src/worker/security";

// Production cookie settings, but local execution, synthetic keys and mocked Google.
const bindings = {
  ...env,
  ENVIRONMENT: "production",
  APP_ORIGIN: "https://oh.io.vn",
  GOOGLE_CLIENT_ID: "security-test-client",
  GOOGLE_CLIENT_SECRET: "synthetic-client-secret",
  HMAC_SECRET: "synthetic-oauth-cookie-encryption-key",
  ADMIN_GOOGLE_SUBS: "",
  ADMIN_BOOTSTRAP_EMAIL: "",
  BURST: { limit: async () => ({ success: true }) },
};
let signingKey: CryptoKey, jwk: Record<string, unknown>;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "local-security-key",
    alg: "RS256",
    use: "sig",
  };
});
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM users WHERE id='synthetic-google-user'"),
    env.DB.prepare("UPDATE policy SET admin_sub=NULL"),
  ]);
});
afterEach(() => vi.restoreAllMocks());
const call = (path: string, cookie?: string) =>
  worker.fetch(
    new Request(bindings.APP_ORIGIN + path, {
      headers: cookie ? { Cookie: cookie } : {},
    }),
    bindings,
    createExecutionContext(),
  );
async function start() {
  const login = await call("/auth/login");
  expect(login.status).toBe(302);
  const setCookie = login.headers.get("Set-Cookie")!;
  expect(setCookie).toMatch(/HttpOnly/);
  expect(setCookie).toMatch(/Secure/);
  expect(setCookie).toMatch(/SameSite=Lax/);
  const cookie = setCookie.split(";")[0];
  const url = new URL(login.headers.get("Location")!);
  const key = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(bindings.HMAC_SECRET),
    ),
  );
  const { payload } = await jwtDecrypt(
    cookie.slice(cookie.indexOf("=") + 1),
    key,
  );
  return { cookie, url, payload };
}
describe("OAuth boundaries with local signed tokens", () => {
  it("binds the login to random state, nonce and PKCE S256", async () => {
    const { url, payload } = await start();
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(
      bindings.APP_ORIGIN + "/auth/callback",
    );
    expect(url.searchParams.get("state")).toBe(payload.state);
    expect(url.searchParams.get("nonce")).toBe(payload.nonce);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      base64url.encode(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(String(payload.verifier)),
          ),
        ),
      ),
    );
    const another = await start();
    expect(another.payload.state).not.toBe(payload.state);
    expect(another.payload.nonce).not.toBe(payload.nonce);
  });
  it("rejects a mismatched state before contacting the identity provider", async () => {
    const { cookie } = await start();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No external network"));
    const response = await call(
      "/auth/callback?state=wrong&code=local-code",
      cookie,
    );
    expect(response.headers.get("Location")).toBe("/?error=login");
    expect(fetch).not.toHaveBeenCalled();
    expect(await env.DB.prepare("SELECT * FROM sessions").first()).toBeNull();
  });
  it.each([
    "valid",
    "nonce",
    "issuer",
    "audience",
    "expired",
    "unverified-email",
    "signature",
    "blocked",
    "deleted",
  ])(
    "validates %s identity and only issues a session for an accepted identity",
    async (variant) => {
      const { cookie, payload } = await start();
      if (variant === "blocked")
        await env.DB.prepare(
          "INSERT INTO users(id,email,name,blocked,created_at) VALUES('synthetic-google-user','test@example.com','Local user',1,?)",
        )
          .bind(Date.now())
          .run();
      if (variant === "deleted")
        await env.DB.prepare(
          "INSERT INTO users(id,email,name,created_at,deleted_at) VALUES('synthetic-google-user','test@example.com','Original name',?,?)",
        )
          .bind(Date.now(), Date.now())
          .run();
      const signer =
        variant === "signature"
          ? (await generateKeyPair("RS256")).privateKey
          : signingKey;
      const token = await new SignJWT({
        nonce: variant === "nonce" ? "wrong" : payload.nonce,
        email: "test@example.com",
        email_verified: variant !== "unverified-email",
        name: "Local user",
      })
        .setProtectedHeader({ alg: "RS256", kid: "local-security-key" })
        .setSubject("synthetic-google-user")
        .setIssuer(
          variant === "issuer"
            ? "https://attacker.example"
            : "https://accounts.google.com",
        )
        .setAudience(
          variant === "audience" ? "other-client" : bindings.GOOGLE_CLIENT_ID,
        )
        .setIssuedAt()
        .setExpirationTime(variant === "expired" ? "-1m" : "5m")
        .sign(signer);
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url === "https://www.googleapis.com/oauth2/v3/certs")
            return Response.json({ keys: [jwk] });
          if (url === "https://oauth2.googleapis.com/token") {
            const body = new URLSearchParams(init?.body as string);
            expect(body.get("code_verifier")).toBe(payload.verifier);
            return Response.json({ id_token: token });
          }
          throw new Error("Unexpected external request");
        });
      const response = await call(
        `/auth/callback?state=${payload.state}&code=local-code`,
        cookie,
      );
      expect(fetch).toHaveBeenCalled();
      if (variant === "valid") {
        expect(response.headers.get("Location")).toBe("/dashboard/");
        const session = response.headers
          .get("Set-Cookie")!
          .match(/__Host-oh_session=([a-f0-9]{64})/)!;
        expect(session).not.toBeNull();
        const row = await env.DB.prepare(
          "SELECT hash,user_id,expires_at FROM sessions",
        ).first<{ hash: string; user_id: string; expires_at: number }>();
        expect(row?.hash).toBe(await hash(session[1]));
        expect(row?.user_id).toBe("synthetic-google-user");
        expect(row!.expires_at).toBeGreaterThan(Date.now());
        for (const attribute of [
          "Secure",
          "HttpOnly",
          "Path=/",
          "SameSite=Lax",
        ])
          expect(response.headers.get("Set-Cookie")).toContain(attribute);
      } else {
        expect(response.headers.get("Location")).toBe(
          ["blocked", "deleted"].includes(variant)
            ? "/?error=account"
            : "/?error=login",
        );
        expect(
          await env.DB.prepare("SELECT hash FROM sessions").first(),
        ).toBeNull();
        expect(response.headers.get("Set-Cookie")).not.toContain(
          "__Host-oh_session",
        );
      }
    },
  );
});
