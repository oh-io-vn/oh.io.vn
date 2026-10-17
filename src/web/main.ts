import "./styles.css";
import { icon } from "./icons.js";
import { skeleton } from "./loading.js";
import { VerificationGate } from "./verification";
import { requestJson } from "./request";
import { canEditLink } from "./link-state";
import { copyText } from "./clipboard";
import { dailySeries } from "./stats-chart";
type LinkData = {
  slug: string;
  label: string | null;
  target: string | null;
  status: string;
  created_at: number;
  expires_at: number;
  fixed_expires_at: number | null;
  owner_id?: string;
};
type Stats = {
  rows: { day: string; source: string; device: string; clicks: number }[];
  gaps: { started_at: number; ended_at: number | null; reason: string }[];
  since: string;
  enabled: boolean;
};
type Me = {
  user: { name: string; email: string; blocked: boolean } | null;
  admin: boolean;
  csrf: string | null;
};
declare global {
  interface Window {
    turnstile?: {
      render: (node: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id: string) => void;
      execute: (id: string) => void;
    };
  }
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const date = (n: number) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(n);
const localDate = (n: number | null) =>
  n
    ? new Date(n - new Date(n).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const calendarDate = (day: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day));
const linkStatus = (status: string) =>
  ({
    active: "Đang hoạt động",
    blocked: "Đã khóa",
    expired: "Hết hạn",
    deleted: "Đã xóa",
  })[status] ?? status;
const blockKind = (kind: string) =>
  ({ host: "Tên miền", url: "Địa chỉ web" })[kind] ?? kind;
const adminAction = (action: string) =>
  ({
    policy: "Đổi cấu hình",
    block_link: "Khóa link",
    block_user: "Đổi trạng thái tài khoản",
    block_user_links: "Khóa link của tài khoản",
    add_block: "Thêm địa chỉ bị chặn",
    remove_block: "Gỡ địa chỉ bị chặn",
  })[action] ?? action;
let me: Me = { user: null, admin: false, csrf: null };
async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return requestJson<T>(path, options, me.csrf);
}
type IconName = Parameters<typeof icon>[0];
function setControlLabel(control: HTMLElement, label: string, name: IconName) {
  const text = document.createElement("span");
  text.textContent = label;
  control.innerHTML = icon(name);
  control.append(text);
}
function message(selector: string, value: string, error = false) {
  const el = $(selector);
  if (el) {
    el.textContent = value;
    if (value && el.classList.contains("notice")) {
      const text = document.createElement("span");
      text.textContent = value;
      el.innerHTML = icon(error ? "error" : "info");
      el.append(text);
      el.classList.add("icon-notice");
    }
    el.classList.toggle("error", error);
  }
}
const copyFeedback = new WeakMap<
  HTMLButtonElement,
  { html: string; label: string | null; timer?: ReturnType<typeof setTimeout> }
>();
async function copy(
  value: string,
  button: HTMLButtonElement,
  errorSelector?: string,
) {
  try {
    await copyText(value);
    const previous = copyFeedback.get(button) ?? {
      html: button.innerHTML,
      label: button.getAttribute("aria-label"),
    };
    clearTimeout(previous.timer);
    setControlLabel(button, "Đã sao chép", "check");
    button.setAttribute("aria-label", "Đã sao chép");
    previous.timer = setTimeout(() => {
      button.innerHTML = previous.html;
      if (previous.label === null) button.removeAttribute("aria-label");
      else button.setAttribute("aria-label", previous.label);
      copyFeedback.delete(button);
    }, 1800);
    copyFeedback.set(button, previous);
  } catch {
    message(
      errorSelector ??
        ($("#link-list") ? "#dashboard-notice" : "#form-message"),
      errorSelector === "#report-message"
        ? "Không sao chép được. Hãy chọn và sao chép địa chỉ email trên trang."
        : "Không sao chép được. Hãy chọn và sao chép link thủ công.",
      true,
    );
  }
}
function configureDialogs() {
  const busy = (dialog: HTMLDialogElement) =>
    !!dialog.querySelector('form[aria-busy="true"], button[aria-busy="true"]');
  document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
    dialog.addEventListener("cancel", (event) => {
      if (busy(dialog)) event.preventDefault();
    });
  });
  document.querySelectorAll("[data-donate]").forEach((el) =>
    el.addEventListener("click", (event) => {
      event.preventDefault();
      $("#donate-dialog")?.closest<HTMLDialogElement>("dialog")?.showModal();
    }),
  );
  document.addEventListener("click", (event) => {
    const el = (event.target as HTMLElement).closest("[data-close]");
    const dialog = el?.closest<HTMLDialogElement>("dialog");
    if (dialog && !busy(dialog)) dialog.close();
  });
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("click", (e) => {
      if (e.target === d && !busy(d)) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    }),
  );
}
async function account() {
  me = await api<Me>("/api/me");
  $("#account .loading-placeholder")?.remove();
  $("#login-link").hidden = false;
  if (me.user) {
    $("#nav-dashboard").hidden = false;
    $("#account").innerHTML =
      `${me.admin ? `<a href="/admin/" class="quiet"${location.pathname === "/admin/" ? ' aria-current="page"' : ""}>${icon("admin")}<span>Quản trị</span></a>` : ""}<button class="quiet danger" id="logout">${icon("logout")}<span>Đăng xuất</span></button>`;
    $("#logout").addEventListener("click", async () => {
      const button = $<HTMLButtonElement>("#logout");
      button.disabled = true;
      try {
        await api("/api/logout", { method: "POST", body: "{}" });
        location.href = "/";
      } catch (error) {
        message("#global-notice", (error as Error).message, true);
        button.disabled = false;
      }
    });
  }
}
async function home() {
  const form = $<HTMLFormElement>("#shorten-form");
  if (!form) return;
  const target = $<HTMLInputElement>("#target");
  const slug = $<HTMLInputElement>("#slug");
  const options = $<HTMLDetailsElement>("#custom-options");
  const submit = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;
  const resultBox = $("#result");
  const setTargetError = (text: string) => {
    message("#target-error", text, !!text);
    if (text) target.setAttribute("aria-invalid", "true");
    else target.removeAttribute("aria-invalid");
  };
  const validateForm = () => {
    const value = target.value.trim();
    let error = "";
    if (!value) error = "Nhập địa chỉ cần rút gọn.";
    else if (target.validity.typeMismatch)
      error = "Nhập địa chỉ đầy đủ, bắt đầu bằng http:// hoặc https://.";
    else {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol))
          error = "Chỉ hỗ trợ link bắt đầu bằng http:// hoặc https://.";
        else if (url.username || url.password)
          error = "Địa chỉ web không được chứa thông tin đăng nhập.";
      } catch {
        error = "Nhập địa chỉ đầy đủ, bắt đầu bằng http:// hoặc https://.";
      }
    }
    setTargetError(error);
    if (error) {
      target.focus();
      return false;
    }
    if (slug.value && !/^[a-zA-Z0-9_-]{3,64}$/.test(slug.value)) {
      options.open = true;
      message(
        "#slug-error",
        slug.value.length < 3
          ? "Mã link cần ít nhất 3 ký tự."
          : "Chỉ dùng chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.",
      );
      slug.setAttribute("aria-invalid", "true");
      slug.focus();
      return false;
    }
    if (!form.checkValidity()) {
      options.open = true;
      message(
        "#form-message",
        "Kiểm tra trường được đánh dấu rồi thử lại.",
        true,
      );
      form.reportValidity();
      return false;
    }
    return true;
  };
  target.addEventListener("input", () => {
    setTargetError("");
    resultBox.hidden = true;
  });
  slug.addEventListener("input", () => {
    message("#slug-error", "");
    slug.removeAttribute("aria-invalid");
  });
  const verification = new VerificationGate();
  let widget: string | undefined;
  let scriptLoad: Promise<void> | null = null;
  let restartNeeded = false;
  let challengeRunning = false;
  let verificationFailures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const retry = $<HTMLButtonElement>("#retry-verification");
  const verificationError = (text: string) => {
    clearTimeout(retryTimer);
    challengeRunning = false;
    verification.fail(text);
    retry.hidden = false;
    message("#verification-message", text, true);
  };
  function loadVerificationScript(): Promise<void> {
    if (typeof window.turnstile?.render === "function")
      return Promise.resolve();
    if (scriptLoad) return scriptLoad;
    scriptLoad = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        script.remove();
        scriptLoad = null;
        reject(
          new Error(
            "Không tải được xác minh. Hãy kiểm tra kết nối rồi thử lại.",
          ),
        );
      }, 15000);
      const finish = (error?: Error) => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) {
          script.remove();
          scriptLoad = null;
          reject(error);
        } else resolve();
      };
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () =>
        finish(
          typeof window.turnstile?.render === "function"
            ? undefined
            : new Error("Không mở được xác minh. Hãy thử lại."),
        );
      script.onerror = () =>
        finish(
          new Error(
            "Không tải được xác minh. Hãy kiểm tra kết nối rồi thử lại.",
          ),
        );
      document.head.append(script);
    });
    return scriptLoad;
  }
  if (me.user) {
    $("#custom-options").hidden = false;
    $("#guest-hint").hidden = true;
  }
  const config = await api("/api/config");
  $("#home-loading")?.remove();
  $("#guest-hint").hidden = !!me.user;
  setControlLabel(submit, "Rút gọn link", "link");
  async function initializeWidget() {
    if (widget !== undefined) return;
    await loadVerificationScript();
    if (widget !== undefined) return;
    widget = window.turnstile!.render($("#verification-widget"), {
      sitekey: config.siteKey,
      action: "create",
      appearance: "execute",
      execution: "execute",
      size:
        $("#verification-widget").clientWidth < 300 ? "compact" : "flexible",
      theme: "light",
      language: "vi",
      retry: "never",
      "refresh-expired": "auto",
      "refresh-timeout": "auto",
      callback: (token: string) => {
        challengeRunning = false;
        clearTimeout(retryTimer);
        verificationFailures = 0;
        verification.accept(token);
        restartNeeded = false;
        retry.hidden = true;
        message("#verification-message", "");
      },
      "expired-callback": () => {
        verification.invalidate();
        message("#verification-message", "Đang làm mới xác minh…");
      },
      "timeout-callback": () =>
        verificationError("Xác minh đã hết thời gian. Hãy thử xác minh lại."),
      "error-callback": (code: string) => {
        // Only the public error code is logged, never a token or visitor details.
        console.warn("verification_failed", code);
        // One recovery attempt handles transient failures without an endless loop.
        // Configuration errors need an operator, not repeated challenges.
        if (++verificationFailures === 1 && /^(300|600|200500)/.test(code)) {
          message(
            "#verification-message",
            "Xác minh bị gián đoạn. Đang thử lại…",
          );
          retryTimer = setTimeout(() => {
            if (widget !== undefined) {
              window.turnstile!.reset(widget);
              window.turnstile!.execute(widget);
            }
          }, 2000);
          return;
        }
        verificationError("Chưa xác minh được. Hãy thử lại.");
      },
    });
  }
  async function startVerification() {
    clearTimeout(retryTimer);
    verificationFailures = 0;
    verification.invalidate();
    restartNeeded = false;
    challengeRunning = true;
    retry.hidden = true;
    message("#verification-message", "Đang xác minh trình duyệt…");
    await initializeWidget();
    window.turnstile!.reset(widget!);
    window.turnstile!.execute(widget!);
  }
  retry.onclick = () => {
    message("#form-message", "");
    void startVerification().catch((error: Error) =>
      verificationError(error.message),
    );
  };
  if (!config.createEnabled || (!me.user && !config.guestEnabled)) {
    message(
      "#service-notice",
      !config.createEnabled
        ? "Tạm ngừng tạo link mới. Hãy quay lại sau."
        : "Tạm ngừng tạo link khách. Bạn có thể đăng nhập để thử lại.",
    );
    form.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled =
      true;
  } else if (!config.siteKey) {
    message(
      "#service-notice",
      "Chưa thể tạo link vì chức năng xác minh chưa sẵn sàng. Hãy quay lại sau.",
    );
    form.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled =
      true;
  } else {
    submit.disabled = false;
    void initializeWidget().catch((error: Error) =>
      verificationError(error.message),
    );
  }
  if (new URLSearchParams(location.search).has("error"))
    message(
      "#form-message",
      "Không đăng nhập được. Hãy thử lại. Nếu vẫn gặp lỗi, liên hệ hi@oh.io.vn.",
      true,
    );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>(
      "button[type=submit]",
    )!;
    if (button.disabled) return;
    message("#form-message", "");
    resultBox.hidden = true;
    if (!validateForm()) return;
    button.disabled = true;
    setControlLabel(
      button,
      verification.ready ? "Đang tạo link…" : "Đang xác minh…",
      "loading",
    );
    form.setAttribute("aria-busy", "true");
    try {
      if (!verification.ready && !challengeRunning) await startVerification();
      const token = await verification.take();
      restartNeeded = true;
      setControlLabel(button, "Đang tạo link…", "loading");
      const values = new FormData(form);
      const fixed = String(values.get("fixed_expires_at") ?? "");
      const result = await api("/api/links", {
        method: "POST",
        body: JSON.stringify({
          target: values.get("target"),
          slug: values.get("slug") || undefined,
          label: values.get("label") || undefined,
          fixed_expires_at: fixed ? new Date(fixed).toISOString() : null,
          turnstile: token,
        }),
      });
      const link = $<HTMLAnchorElement>("#result-url");
      link.href = result.url;
      link.textContent = result.url;
      resultBox.hidden = false;
      $("#result-expiry").textContent =
        `Hết hạn ${date(result.expires_at)}.${me.user ? "" : " Hãy sao chép và lưu link trước khi rời trang. Link khách không có trong danh sách quản lý."}`;
      $("#copy-result").onclick = () =>
        copy(result.url, $<HTMLButtonElement>("#copy-result"));
      resultBox.focus({ preventScroll: true });
      resultBox.scrollIntoView({ block: "nearest" });
    } catch (e) {
      if (!restartNeeded) verificationError((e as Error).message);
      else {
        const error = (e as Error).message;
        if (
          /^(Nhập địa chỉ|Chỉ hỗ trợ link|Địa chỉ web không|Không rút gọn lại link|Không hỗ trợ địa chỉ mạng nội bộ)/.test(
            error,
          )
        ) {
          setTargetError(error);
          target.focus();
        } else if (/^Mã (link |này )/.test(error)) {
          options.open = true;
          message("#slug-error", error);
          slug.setAttribute("aria-invalid", "true");
          slug.focus();
        } else {
          if (error.startsWith("Ngày hết hạn")) options.open = true;
          message("#form-message", error, true);
        }
      }
    } finally {
      button.disabled = false;
      setControlLabel(button, "Rút gọn link", "link");
      form.removeAttribute("aria-busy");
    }
  });
}
let links: LinkData[] = [],
  next: string | null = null,
  selected: LinkData | null = null,
  stats: Stats | null = null;
let detailRequest = 0;
let listRequest = 0;
let expiryHold = false;
const expiryHoldNotice =
  "Link tạm thời không hết hạn vì lâu không có lượt mở. Ngày hết hạn do bạn tự đặt vẫn áp dụng.";
function card(l: LinkData) {
  const active = canEditLink(l, expiryHold);
  return `<article class="link-card"><div><h2 class="link-title">${esc(l.label || "Link chưa đặt tên")} ${!active ? `<span class="badge">${l.status === "blocked" ? "Đã khóa" : l.status === "deleted" ? "Đã xóa" : "Hết hạn"}</span>` : ""}</h2><a href="/${esc(l.slug)}" target="_blank" rel="noopener" translate="no">oh.io.vn/${esc(l.slug)}</a><div class="link-target" translate="no">${esc(l.target ?? "Địa chỉ đích đã được xóa")}</div><div class="link-meta">${!active && l.status !== "active" && l.status !== "expired" ? esc(linkStatus(l.status)) : `${active ? "Hết hạn" : "Đã hết hạn"} ${date(l.expires_at)}`}</div></div><div class="actions"><button class="action-button" data-action="copy" data-slug="${esc(l.slug)}" aria-label="Sao chép link ${esc(l.slug)}">${icon("copy")}<span>Sao chép</span></button>${active ? `<button class="action-button" data-action="edit" data-slug="${esc(l.slug)}" aria-label="Sửa link ${esc(l.slug)}">${icon("edit")}<span>Sửa</span></button>` : ""}<button class="action-button" data-action="stats" data-slug="${esc(l.slug)}" aria-label="Thống kê link ${esc(l.slug)}">${icon("stats")}<span>Thống kê</span></button><button class="action-button danger" data-action="delete" data-slug="${esc(l.slug)}" aria-label="Xóa link ${esc(l.slug)}">${icon("delete")}<span>Xóa</span></button></div></article>`;
}
async function loadLinks(append = false) {
  const more = $<HTMLButtonElement>("#load-more");
  if (append && more.disabled) return false;
  const request = ++listRequest;
  more.disabled = true;
  more.textContent = append ? "Đang tải…" : "Xem thêm";
  $("#link-list").setAttribute("aria-busy", "true");
  if (!append) $("#link-list").innerHTML = skeleton("links");
  message("#list-status", append ? "Đang tải thêm link…" : "Đang tìm link…");
  try {
    const q = $<HTMLInputElement>("#search").value;
    $("#clear-search").hidden = !q;
    const data = await api(
      `/api/links?q=${encodeURIComponent(q)}${append && next ? "&cursor=" + next : ""}`,
    );
    if (request !== listRequest) return false;
    links = append ? [...links, ...data.links] : data.links;
    expiryHold = !!data.expiryHeld;
    next = data.next;
    $("#load-more").hidden = !next;
    $("#link-search").hidden = !links.length && !q.trim();
    $("#link-list").innerHTML = links.length
      ? links.map(card).join("")
      : q.trim()
        ? `<div class="empty">${icon("search-empty")}<h2>Không tìm thấy link</h2><p>Thử tìm theo tên hoặc mã link khác.</p></div>`
        : `<div class="empty">${icon("link")}<h2>Chưa có link nào</h2><p>Tạo link để xem và quản lý tại đây.</p><a class="secondary" href="/">${icon("plus")}<span>Tạo link đầu tiên</span></a></div>`;
    message(
      "#list-status",
      links.length
        ? `Đang hiển thị ${links.length.toLocaleString("vi-VN")} link${next ? ". Chọn Xem thêm để tải tiếp." : "."}`
        : q.trim()
          ? "Không có link khớp với tìm kiếm."
          : "",
    );
    message("#dashboard-notice", expiryHold ? expiryHoldNotice : "");
    return true;
  } catch (e) {
    if (request === listRequest) {
      message("#dashboard-notice", (e as Error).message, true);
      message(
        "#list-status",
        links.length
          ? "Chưa tải được kết quả mới. Danh sách bên dưới vẫn là kết quả trước đó."
          : "",
      );
      if (!append && links.length)
        $("#link-list").innerHTML = links.map(card).join("");
      if (!append && !links.length) {
        $("#link-list").innerHTML =
          `<div class="empty" role="status">${icon("error")}<h2>Không tải được link</h2><p>Kiểm tra mạng rồi tải lại danh sách.</p><button id="retry-links" class="secondary" type="button">${icon("retry")}<span>Tải lại danh sách</span></button></div>`;
        $("#retry-links").addEventListener("click", () => void loadLinks());
      }
    }
    return false;
  } finally {
    if (request === listRequest) {
      more.disabled = false;
      more.textContent = "Xem thêm";
      $("#link-list").removeAttribute("aria-busy");
    }
  }
}
async function dashboard() {
  if (!$("#link-list")) return;
  if (!me.user) {
    $("#link-list").removeAttribute("aria-busy");
    $("#link-list").innerHTML =
      `<div class="empty"><h2>Đăng nhập để quản lý link</h2><p>Bạn có thể sửa link đã tạo bằng tài khoản và xem thống kê.</p><a class="primary" href="/auth/login">${icon("login")}<span>Đăng nhập Google</span></a></div>`;
    $("#link-search").hidden = true;
    return;
  }
  const search = $<HTMLInputElement>("#search");
  search.value = new URLSearchParams(location.search).get("q") ?? "";
  const searchLinks = () => {
    const url = new URL(location.href);
    if (search.value) url.searchParams.set("q", search.value);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
    void loadLinks();
  };
  $("#link-search").addEventListener("submit", (e) => {
    e.preventDefault();
    searchLinks();
  });
  $("#clear-search").onclick = () => {
    search.value = "";
    search.focus();
    searchLinks();
  };
  $("#load-more").onclick = () => loadLinks(true);
  $("#link-list").addEventListener("click", async (event) => {
    const b = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
    if (!b) return;
    const link = links.find((l) => l.slug === b.dataset.slug);
    if (!link) return;
    if (b.dataset.action === "copy") {
      await copy(location.origin + "/" + link.slug, b);
      return;
    }
    const request = ++detailRequest;
    if (b.dataset.action === "edit") {
      selected = link;
      const form = $<HTMLFormElement>("#edit-form");
      (form.elements.namedItem("target") as HTMLInputElement).value =
        selected.target ?? "";
      (form.elements.namedItem("label") as HTMLInputElement).value =
        selected.label ?? "";
      (form.elements.namedItem("fixed_expires_at") as HTMLInputElement).value =
        localDate(selected.fixed_expires_at);
      $("#edit-slug").textContent = `oh.io.vn/${selected.slug}`;
      $<HTMLInputElement>("#edit-code").value = selected.slug;
      $<HTMLInputElement>('#edit-form [name="confirm_rename"]').checked = false;
      updateRenameWarning();
      message("#edit-message", "");
      $<HTMLDialogElement>("#edit-dialog").showModal();
    }
    if (b.dataset.action === "delete") {
      selected = link;
      $("#delete-context").textContent =
        `oh.io.vn/${link.slug}${link.label ? ` — ${link.label}` : ""}`;
      message("#delete-message", "");
      $<HTMLDialogElement>("#delete-dialog").showModal();
    }
    if (b.dataset.action === "stats") {
      const dialog = $<HTMLDialogElement>("#stats-dialog");
      selected = link;
      stats = null;
      $("#stats-context").textContent = `oh.io.vn/${link.slug}`;
      $("#stats-content").innerHTML = skeleton("stats");
      $("#stats-content").setAttribute("aria-busy", "true");
      $<HTMLButtonElement>("#export-excel").disabled = true;
      message("#stats-message", "");
      dialog.showModal();
      $("#stats-dialog .dialog-body").scrollTop = 0;
      try {
        const data = await api<Stats>(`/api/links/${link.slug}/stats`);
        if (request !== detailRequest || !dialog.open) return;
        stats = data;
        renderStats(stats);
        $<HTMLButtonElement>("#export-excel").disabled = false;
      } catch (e) {
        if (request === detailRequest && dialog.open) {
          $("#stats-content").replaceChildren();
          message(
            "#stats-message",
            `${(e as Error).message} Đóng hộp này rồi mở thống kê để thử lại.`,
            true,
          );
        }
      } finally {
        if (request === detailRequest)
          $("#stats-content").removeAttribute("aria-busy");
      }
    }
  });
  const updateRenameWarning = () => {
    const changed =
      $<HTMLInputElement>("#edit-code").value.toLowerCase() !== selected?.slug;
    $("#rename-warning").hidden = !changed;
    const confirmation = $<HTMLInputElement>(
      '#edit-form [name="confirm_rename"]',
    );
    confirmation.required = changed;
    confirmation.checked = false;
    const save = $('#edit-form button[type="submit"]');
    save.classList.toggle("danger-button", changed);
    setControlLabel(save, changed ? "Đổi mã và lưu" : "Lưu thay đổi", "save");
    message("#edit-message", "");
  };
  $("#edit-code").addEventListener("input", updateRenameWarning);
  $('#edit-form [name="confirm_rename"]').addEventListener("change", () =>
    message("#edit-message", ""),
  );
  $("#edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    if (form.getAttribute("aria-busy") === "true") return;
    const button = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    const f = new FormData(form);
    const editedSlug = selected!.slug;
    const newSlug = String(f.get("slug") ?? editedSlug).toLowerCase();
    if (newSlug !== editedSlug && !f.get("confirm_rename")) {
      message(
        "#edit-message",
        "Xác nhận rằng địa chỉ cũ sẽ ngừng hoạt động trước khi lưu.",
        true,
      );
      $('#edit-form [name="confirm_rename"]').focus();
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const fixed = String(f.get("fixed_expires_at") ?? "");
    button.disabled = true;
    setControlLabel(button, "Đang lưu…", "loading");
    form.setAttribute("aria-busy", "true");
    message("#edit-message", "");
    try {
      await api(`/api/links/${editedSlug}/edit`, {
        method: "PATCH",
        body: JSON.stringify({
          target: f.get("target"),
          slug: newSlug,
          label: f.get("label"),
          fixed_expires_at: fixed ? new Date(fixed).toISOString() : null,
        }),
      });
      $<HTMLDialogElement>("#edit-dialog").close();
      const reloaded = await loadLinks();
      message(
        "#dashboard-notice",
        `Đã lưu thay đổi cho oh.io.vn/${newSlug}.${newSlug !== editedSlug ? " Địa chỉ cũ đã ngừng hoạt động." : ""}${reloaded ? (expiryHold ? ` ${expiryHoldNotice}` : "") : " Chưa tải được danh sách mới. Hãy tải lại trang để kiểm tra."}`,
        !reloaded,
      );
      const nextFocus =
        document.querySelector<HTMLButtonElement>(
          `[data-action="edit"][data-slug="${CSS.escape(newSlug)}"]`,
        ) ??
        ($("#link-search").hidden ? $(".page-head .primary") : $("#search"));
      nextFocus?.focus();
    } catch (e) {
      message("#edit-message", (e as Error).message, true);
    } finally {
      button.disabled = false;
      setControlLabel(
        button,
        $("#rename-warning").hidden ? "Lưu thay đổi" : "Đổi mã và lưu",
        "save",
      );
      form.removeAttribute("aria-busy");
    }
  });
  $("#confirm-delete").onclick = async () => {
    const button = $<HTMLButtonElement>("#confirm-delete");
    if (button.disabled) return;
    const deletedSlug = selected!.slug;
    button.disabled = true;
    setControlLabel(button, "Đang xóa…", "loading");
    button.setAttribute("aria-busy", "true");
    message("#delete-message", "");
    try {
      await api(`/api/links/${deletedSlug}/delete`, {
        method: "DELETE",
        body: "{}",
      });
      $<HTMLDialogElement>("#delete-dialog").close();
      const reloaded = await loadLinks();
      message(
        "#dashboard-notice",
        `Đã xóa oh.io.vn/${deletedSlug}. Link này không còn hoạt động.${reloaded ? (expiryHold ? ` ${expiryHoldNotice}` : "") : " Chưa tải được danh sách mới. Hãy tải lại trang để kiểm tra."}`,
        !reloaded,
      );
      const focusTarget = document.querySelector<HTMLElement>(
        "#link-list button, #link-list a",
      );
      focusTarget?.focus();
    } catch (e) {
      message("#delete-message", (e as Error).message, true);
    } finally {
      button.disabled = false;
      setControlLabel(button, "Xóa link", "delete");
      button.removeAttribute("aria-busy");
    }
  };
  $("#export-excel").onclick = async () => {
    if (!stats || !selected) return;
    const data = stats;
    const slug = selected.slug;
    const button = $<HTMLButtonElement>("#export-excel");
    button.disabled = true;
    setControlLabel(button, "Đang xuất…", "loading");
    message("#stats-message", "");
    try {
      const { default: writeXlsxFile } =
        await import("write-excel-file/browser");
      const rows = [
        [
          { value: "Mã link", type: String },
          { value: "Ngày (Việt Nam)", type: String },
          { value: "Nhóm nguồn", type: String },
          { value: "Nhóm thiết bị", type: String },
          { value: "Lượt truy cập", type: String },
        ],
        ...data.rows.map((r) => [
          { value: slug, type: String },
          { value: r.day, type: String },
          { value: r.source, type: String },
          { value: r.device, type: String },
          { value: r.clicks, type: Number },
        ]),
      ];
      const notes = [
        [{ value: "Thông tin phạm vi", type: String }],
        [
          {
            value: `Dữ liệu từ ${data.since}. Số lượt không phải số người duy nhất.`,
            type: String,
          },
        ],
        ...data.gaps.map((g) => [
          {
            value: `Thiếu dữ liệu: ${date(g.started_at)} đến ${g.ended_at ? date(g.ended_at) : "đang tiếp diễn"}: ${g.reason}`,
            type: String,
          },
        ]),
      ];
      await writeXlsxFile([
        { data: rows, sheet: "Thống kê" },
        { data: notes, sheet: "Phạm vi" },
      ]).toFile(`oh-${slug}-${data.since}.xlsx`);
    } catch {
      message("#stats-message", "Không xuất được Excel. Hãy thử lại.", true);
    } finally {
      button.disabled = false;
      setControlLabel(button, "Xuất Excel", "download");
    }
  };
  await loadLinks();
}
function renderStats(data: Stats) {
  const total = data.rows.reduce((n, r) => n + r.clicks, 0);
  const groups = (key: "source" | "device") => {
    const map = new Map<string, number>();
    data.rows.forEach((r) =>
      map.set(r[key], (map.get(r[key]) ?? 0) + r.clicks),
    );
    return [...map].sort((a, b) => b[1] - a[1]);
  };
  const render = (items: [string, number][]) =>
    items
      .map(
        ([k, v]) =>
          `<div class="stat-row"><span>${esc(k)}</span><strong>${v}</strong></div>`,
      )
      .join("");
  const days = dailySeries(data.rows, data.since);
  const max = Math.max(...days.map(([, n]) => n), 1);
  const chart = `<figure class="daily-chart"><figcaption class="small">Lượt ghi nhận mỗi ngày</figcaption>
    <div class="chart-frame" aria-hidden="true"><div class="chart-scale small"><span>${max.toLocaleString("vi-VN")}</span><span>0</span></div>
    <div class="chart">${days.map(([day, n]) => `<span class="chart-bar" title="${calendarDate(day)}: ${n} lượt" style="height:${(n / max) * 100}%"></span>`).join("")}</div></div>
    <div class="chart-axis small"><time datetime="${days[0][0]}">${days[0][0].split("-").reverse().join("/")}</time><time datetime="${days[29][0]}">${days[29][0].split("-").reverse().join("/")}</time></div></figure>`;
  $("#stats-content").innerHTML =
    `<p class="small">Dữ liệu từ ngày ${calendarDate(data.since)}.</p><div class="stats-total">${total.toLocaleString("vi-VN")} <span class="small">lượt được ghi nhận</span></div>${data.gaps.length || !data.enabled ? `<div class="notice icon-notice">${icon("info")}<div>Thống kê có thời gian bị thiếu. Tổng chỉ gồm lượt đã ghi nhận.${data.gaps.map((g) => `<div class="small">${date(g.started_at)} đến ${g.ended_at ? date(g.ended_at) : "đang tiếp diễn"}: ${esc(g.reason)}</div>`).join("")}</div></div>` : ""}${total ? `${chart}<div class="stats-grid"><div><h3 class="small">Nguồn truy cập</h3>${render(groups("source"))}</div><div><h3 class="small">Thiết bị</h3>${render(groups("device"))}</div></div><details class="optional"><summary>Xem số liệu từng ngày</summary>${render(days.map(([day, count]) => [calendarDate(day), count]))}</details>` : '<p class="small">Chưa có lượt truy cập.</p>'}<details class="optional"><summary>Cách tính lượt truy cập</summary><p class="small">Số lượt có thể gồm bot và lượt xem trước. Nguồn thiếu thông tin được ghi là “Không xác định”. Thời gian theo giờ Việt Nam.</p></details>`;
}
async function admin() {
  if (!$("#admin-content")) return;
  if (!me.admin) {
    message(
      "#admin-message",
      "Bạn cần đăng nhập bằng tài khoản quản trị để xem trang này.",
      true,
    );
    return;
  }
  message("#admin-message", "Đang tải cấu hình và số liệu…");
  const refresh = async () => {
    const data = await api("/api/admin/overview");
    const form = $<HTMLFormElement>("#policy-form");
    Object.entries(data.policy).forEach(([k, v]) => {
      const el = form.elements.namedItem(k) as HTMLInputElement | null;
      if (el) {
        if (el.type === "checkbox") el.checked = !!v;
        else el.value = String(v);
      }
    });
    let usage =
      '<p class="small">Chưa có số liệu sử dụng. Hãy kiểm tra kết nối giám sát.</p>';
    try {
      const m = JSON.parse(data.policy.monitoring);
      if (m) {
        const resources: [string, number, number][] = [
          ["Yêu cầu hôm nay", m.requests, 100000],
          ["Dòng dữ liệu đã đọc", m.reads, 5000000],
          ["Dòng dữ liệu đã ghi", m.writes, 100000],
          ["Dung lượng cơ sở dữ liệu (byte)", m.databaseBytes, 500000000],
        ];
        usage =
          resources
            .map(
              ([name, value, limit]) =>
                `<div class="stat-row"><span>${name}</span><strong>${Number(value).toLocaleString("vi-VN")} trên ${limit.toLocaleString("vi-VN")} (${((value / limit) * 100).toFixed(1)}%)</strong></div>`,
            )
            .join("") +
          `<p class="small">Cập nhật lúc ${date(m.at)}. Bộ đếm tính theo giờ UTC và có thể cập nhật chậm. Chế độ bảo vệ tài nguyên: ${m.level ? `mức ${m.level}` : "bình thường"}.</p>`;
      }
    } catch {
      /* Missing or incomplete snapshots are shown explicitly. */
    }
    $("#usage").innerHTML =
      `<p class="small">Tác vụ định kỳ chạy gần nhất: ${data.policy.heartbeat ? date(data.policy.heartbeat) : "chưa có"}<br>Sao lưu đã tải lên: ${data.policy.last_backup_at ? date(data.policy.last_backup_at) : "chưa có"}</p>${usage}${data.links.map((r: any) => `<div class="stat-row"><span>Link ${esc(linkStatus(r.status).toLowerCase())}</span><strong>${r.count}</strong></div>`).join("")}<p class="small">Số link theo trạng thái lưu trong hệ thống, gồm cả link khách. Không phải số người đang online. Link quá hạn có thể chờ tác vụ định kỳ cập nhật trạng thái.</p>`;
    $("#audit").innerHTML =
      data.audit
        .map(
          (r: any) =>
            `<div class="stat-row"><span>${esc(adminAction(r.action))} - ${esc(r.subject)}</span><span>${date(r.created_at)}</span></div>`,
        )
        .join("") || '<p class="small">Chưa có thao tác.</p>';
    const blocked = await api("/api/admin/blocklist");
    $("#blocklist").innerHTML =
      blocked
        .map(
          (b: any) =>
            `<div class="stat-row"><span>${esc(blockKind(b.kind))} - ${esc(b.value)}</span><button class="quiet danger" data-remove-block="${esc(b.value)}" data-kind="${b.kind}">${icon("unlock")}<span>Gỡ</span></button></div>`,
        )
        .join("") || '<p class="small">Chưa có địa chỉ nào bị chặn.</p>';
  };
  try {
    await refresh();
  } catch (error) {
    message("#admin-message", "");
    throw error;
  }
  $("#admin-content").hidden = false;
  message("#admin-message", "");
  let actionPending = false;
  const action = async (
    body: Record<string, unknown>,
    feedback: string,
    success: string,
    button: HTMLButtonElement,
  ) => {
    if (actionPending) return false;
    actionPending = true;
    const content = button.innerHTML;
    const controls = [
      ...$("#admin-content").querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLSelectElement
      >("input, button, select"),
    ];
    const disabled = controls.map((control) => control.disabled);
    controls.forEach((control) => {
      control.disabled = true;
    });
    button.disabled = true;
    setControlLabel(button, "Đang lưu…", "loading");
    button.setAttribute("aria-busy", "true");
    message(feedback, "Đang lưu thay đổi…");
    try {
      await api("/api/admin/action", {
        method: "POST",
        body: JSON.stringify(body),
      });
      try {
        await refresh();
        message(feedback, success);
      } catch {
        message(
          feedback,
          `${success} Chưa tải được dữ liệu mới. Hãy tải lại trang để kiểm tra.`,
          true,
        );
      }
      return true;
    } catch (e) {
      message(feedback, (e as Error).message, true);
      return false;
    } finally {
      controls.forEach((control, index) => {
        control.disabled = disabled[index];
      });
      button.disabled = false;
      button.innerHTML = content;
      button.removeAttribute("aria-busy");
      actionPending = false;
    }
  };
  const confirmDialog = $<HTMLDialogElement>("#admin-confirm-dialog");
  const confirmButton = $<HTMLButtonElement>("#confirm-admin-action");
  const confirmAction = (
    body: Record<string, unknown>,
    title: string,
    subject: string,
    description: string,
    feedback: string,
    success: string,
    afterSuccess?: () => void,
  ) => {
    if (actionPending) return;
    $("#admin-confirm-title").textContent = title;
    $("#admin-confirm-subject").textContent = subject;
    $("#admin-confirm-description").textContent = description;
    setControlLabel(
      confirmButton,
      title.replace(/\?$/, ""),
      body.action === "remove_block" || body.blocked === false
        ? "unlock"
        : body.action === "block_user" || body.action === "block_user_links"
          ? "lock"
          : "block",
    );
    message("#admin-confirm-message", "");
    confirmButton.onclick = async () => {
      if (
        await action(body, "#admin-confirm-message", success, confirmButton)
      ) {
        const result = $("#admin-confirm-message");
        message(
          feedback,
          result.textContent ?? success,
          result.classList.contains("error"),
        );
        confirmDialog.close();
        afterSuccess?.();
        // Refresh may replace the button that opened this dialog.
        if (
          !document.activeElement ||
          document.activeElement === document.body
        ) {
          $(feedback).tabIndex = -1;
          $(feedback).focus();
        }
      }
    };
    confirmDialog.showModal();
  };
  $("#policy-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data: Record<string, unknown> = { action: "policy" };
    form
      .querySelectorAll<HTMLInputElement>("input")
      .forEach(
        (el) =>
          (data[el.name] =
            el.type === "checkbox" ? Number(el.checked) : Number(el.value)),
      );
    void action(
      data,
      "#policy-message",
      "Đã lưu cấu hình dịch vụ.",
      form.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );
  });
  $("#block-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    confirmAction(
      {
        action: "add_block",
        kind: f.get("kind"),
        subject: f.get("value"),
      },
      "Chặn địa chỉ này?",
      String(f.get("value")),
      f.get("kind") === "host"
        ? "Các link trỏ đến tên miền này và tên miền con sẽ không mở được."
        : "Các link trỏ đến đúng địa chỉ này sẽ không mở được.",
      "#block-message",
      "Đã thêm địa chỉ vào danh sách chặn.",
      () => form.reset(),
    );
  });
  $("#blocklist").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-remove-block]",
    );
    if (b)
      confirmAction(
        {
          action: "remove_block",
          kind: b.dataset.kind,
          subject: b.dataset.removeBlock,
        },
        "Gỡ chặn địa chỉ?",
        b.dataset.removeBlock ?? "",
        "Địa chỉ này sẽ được gỡ khỏi danh sách chặn. Các hạn chế khác của link vẫn áp dụng.",
        "#block-message",
        "Đã gỡ địa chỉ khỏi danh sách chặn.",
      );
  });
  $("#admin-search").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const button = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    if (button.disabled) return;
    const q = new FormData(form).get("query");
    button.disabled = true;
    setControlLabel(button, "Đang tìm…", "loading");
    $("#admin-results").setAttribute("aria-busy", "true");
    const previousResults = $("#admin-results").innerHTML;
    $("#admin-results").innerHTML = skeleton("links");
    message("#admin-search-message", "Đang tra cứu…");
    message("#admin-results-message", "");
    try {
      const r = await api(
        "/api/admin/search?q=" + encodeURIComponent(String(q)),
      );
      $("#admin-results").innerHTML =
        r.users
          .map(
            (u: any) =>
              `<div class="panel"><p>${esc(u.email)} - ${esc(u.name)}</p><button class="secondary danger" data-admin-action="block_user" data-subject="${esc(u.id)}" data-context="${esc(u.email)}" data-blocked="${!u.blocked}">${icon(u.blocked ? "unlock" : "lock")}<span>${u.blocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}</span></button> <button class="quiet danger" data-admin-action="block_user_links" data-subject="${esc(u.id)}" data-context="${esc(u.email)}">${icon("lock")}<span>Khóa tất cả link của tài khoản</span></button></div>`,
          )
          .join("") +
          r.links
            .map(
              (l: any) =>
                `<div class="link-card"><div><strong>${esc(l.slug)} - ${esc(linkStatus(l.status))}</strong><p class="link-target">${esc(l.target)}</p></div><button class="secondary danger" data-admin-action="block_link" data-subject="${esc(l.slug)}">${icon("block")}<span>Vô hiệu hóa link</span></button></div>`,
            )
            .join("") ||
        '<p class="small">Không tìm thấy tài khoản hoặc link phù hợp.</p>';
      message(
        "#admin-search-message",
        `Tìm thấy ${r.users.length} tài khoản và ${r.links.length} link.`,
      );
    } catch (e) {
      message(
        "#admin-search-message",
        `${(e as Error).message} Kết quả bên dưới chưa được cập nhật.`,
        true,
      );
    } finally {
      button.disabled = false;
      setControlLabel(button, "Tra cứu", "search");
      if ($("#admin-results .loading-placeholder"))
        $("#admin-results").innerHTML = previousResults;
      $("#admin-results").removeAttribute("aria-busy");
    }
  });
  $("#admin-results").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-admin-action]",
    );
    if (b) {
      const blocking = b.dataset.blocked !== "false";
      const title = b.textContent?.trim() ?? "Xác nhận";
      const description =
        b.dataset.adminAction === "block_user"
          ? blocking
            ? "Tài khoản này sẽ không thể đăng nhập và quản lý link. Các link của tài khoản không tự bị khóa."
            : "Tài khoản này sẽ được đăng nhập và quản lý link trở lại."
          : b.dataset.adminAction === "block_user_links"
            ? "Tất cả link của tài khoản sẽ ngừng hoạt động. Thao tác này không khóa đăng nhập."
            : "Link này sẽ ngừng chuyển hướng đến địa chỉ đích.";
      confirmAction(
        {
          action: b.dataset.adminAction,
          subject: b.dataset.subject,
          blocked: blocking,
        },
        `${title}?`,
        b.dataset.context ?? `oh.io.vn/${b.dataset.subject}`,
        description,
        "#admin-results-message",
        `Đã ${title.toLocaleLowerCase("vi-VN")}.`,
        () => {
          if (b.dataset.adminAction === "block_user") {
            b.dataset.blocked = String(!blocking);
            setControlLabel(
              b,
              blocking ? "Mở khóa tài khoản" : "Khóa tài khoản",
              blocking ? "unlock" : "lock",
            );
          }
        },
      );
    }
  });
}
configureDialogs();
const retryService =
  document.querySelector<HTMLButtonElement>("#retry-service");
if (retryService) retryService.onclick = () => location.reload();
const reportCopy =
  document.querySelector<HTMLButtonElement>("#copy-report-email");
if (reportCopy)
  reportCopy.onclick = () => copy("hi@oh.io.vn", reportCopy, "#report-message");
try {
  await account();
  await Promise.all([home(), dashboard(), admin()]);
} catch {
  ["#global-notice"].forEach((s) =>
    message(
      s,
      "Không kết nối được dịch vụ. Hãy tải lại trang sau ít phút.",
      true,
    ),
  );
  if (retryService) retryService.hidden = false;
  const submit = document.querySelector<HTMLButtonElement>(
    '#shorten-form button[type="submit"]',
  );
  if (submit) {
    submit.disabled = true;
    setControlLabel(submit, "Rút gọn link", "link");
  }
  const list = document.querySelector<HTMLElement>("#link-list");
  if (list && list.querySelector(".loading-placeholder"))
    list.innerHTML = `<div class="empty" role="status">${icon("error")}<h2>Không tải được link</h2><p>Kiểm tra mạng rồi tải lại trang.</p></div>`;
} finally {
  $("#home-loading")?.remove();
  $("#admin-loading")?.remove();
  $("#account .loading-placeholder")?.remove();
  const login = $("#login-link");
  if (login) login.hidden = false;
  $("#link-list")?.removeAttribute("aria-busy");
}
