export const RESERVED = new Set([
  "index",
  "admin",
  "api",
  "auth",
  "login",
  "logout",
  "support",
  "dashboard",
  "privacy",
  "terms",
  "report",
  "about",
  "assets",
  "favicon",
  "robots",
  "sitemap",
  "donate",
  "www",
]);
export function addMonths(timestamp: number, months: number): number {
  // Perform calendar arithmetic in Vietnam (UTC+7), including the day clamp.
  const d = new Date(timestamp + 7 * 3600_000);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime() - 7 * 3600_000;
}
export function slugValue(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,64}$/.test(value))
    throw new Error(
      "Mã link cần từ 3 đến 64 ký tự: chữ, số, dấu gạch ngang hoặc gạch dưới.",
    );
  const slug = value.toLowerCase();
  if (RESERVED.has(slug)) throw new Error("Mã này được dành cho hệ thống.");
  return slug;
}
export const canonicalHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.+$/, "");

// A fragment is handled by the browser, not the destination HTTP server.
// Ignore it only for moderation comparisons; ordinary links keep their fragment.
export function blockTargetValue(url: URL): string {
  const target = new URL(url);
  target.hostname = canonicalHostname(target.hostname);
  target.hash = "";
  return target.toString();
}
export function targetValue(value: unknown, origin = "https://oh.io.vn"): URL {
  if (typeof value !== "string" || value.length > 4096)
    throw new Error("Địa chỉ tối đa 4.096 ký tự.");
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    throw new Error("Nhập địa chỉ web đầy đủ.");
  }
  if (!["http:", "https:"].includes(u.protocol))
    throw new Error("Chỉ hỗ trợ link bắt đầu bằng http:// hoặc https://.");
  if (u.username || u.password)
    throw new Error("Địa chỉ web không được chứa thông tin đăng nhập.");
  const h = canonicalHostname(u.hostname);
  if (
    h === canonicalHostname(new URL(origin).hostname) ||
    h === "oh.io.vn" ||
    h.endsWith(".oh.io.vn")
  )
    throw new Error("Không rút gọn lại link của oh.io.vn.");
  if (
    !h.includes(".") ||
    h.endsWith(".local") ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h.includes(":") ||
    h.startsWith("[")
  )
    throw new Error("Không hỗ trợ địa chỉ mạng nội bộ.");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    )
      throw new Error("Không hỗ trợ địa chỉ mạng nội bộ.");
  }
  u.hostname = h;
  return u;
}
export function fixedExpiry(value: unknown, now: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(date) || date <= now)
    throw new Error("Ngày hết hạn cố định phải ở tương lai.");
  return date;
}
export function sourceGroup(referrer: string | null): string {
  if (!referrer) return "Không xác định";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "Không xác định";
  }
  const groups: [string, string[]][] = [
    ["Google", ["google.com", "google.com.vn"]],
    ["Facebook", ["facebook.com", "fb.com"]],
    ["Zalo", ["zalo.me", "zalo.vn"]],
    ["YouTube", ["youtube.com", "youtu.be"]],
    ["TikTok", ["tiktok.com"]],
    ["Instagram", ["instagram.com"]],
    ["Bing", ["bing.com"]],
  ];
  return (
    groups.find(([, domains]) =>
      domains.some((d) => host === d || host.endsWith("." + d)),
    )?.[0] ?? "Khác"
  );
}
export const deviceGroup = (ua: string) =>
  /mobile|android|iphone|ipad/i.test(ua)
    ? "Điện thoại"
    : /windows|macintosh|linux|x11/i.test(ua)
      ? "Máy tính"
      : "Khác";
export const knownBot = (ua: string) =>
  /bot|crawler|spider|preview|facebookexternalhit|slack|discord|whatsapp|telegram|headless|curl|wget/i.test(
    ua,
  );
export const vietnamDay = (now: number) =>
  new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
