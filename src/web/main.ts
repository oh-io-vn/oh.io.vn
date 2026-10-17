import "./styles.css";
import {
  createIcons,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Zap,
  Sprout,
  Heart,
  ChartNoAxesColumn,
  X,
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  Check,
} from "lucide";
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
    turnstile: {
      render: (node: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id: string) => void;
    };
  }
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const icons = () =>
  createIcons({
    icons: {
      ArrowRight,
      ArrowUpRight,
      Copy,
      Zap,
      Sprout,
      Heart,
      ChartNoAxesColumn,
      X,
      Plus,
      Search,
      Download,
      Pencil,
      Trash2,
      Check,
    },
  });
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
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(n);
const localDate = (n: number | null) =>
  n
    ? new Date(n - new Date(n).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
let me: Me = { user: null, admin: false, csrf: null };
async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.method
        ? { "Content-Type": "application/json", "X-CSRF-Token": me.csrf ?? "" }
        : {}),
      ...options.headers,
    },
  });
  const data = (await response.json()) as any;
  if (!response.ok)
    throw new Error(data.error ?? "Có lỗi xảy ra. Vui lòng thử lại.");
  return data;
}
function message(selector: string, value: string, error = false) {
  const el = $(selector);
  if (el) {
    el.textContent = value;
    el.classList.toggle("error", error);
  }
}
async function copy(value: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(value);
    const old = button.innerHTML;
    button.textContent = "Đã sao chép";
    setTimeout(() => {
      button.innerHTML = old;
      icons();
    }, 1800);
  } catch {
    message(
      "#form-message",
      "Trình duyệt chưa cho phép sao chép. Bạn có thể chọn và sao chép địa chỉ bên trên.",
      true,
    );
  }
}
function configureDialogs() {
  document.querySelectorAll("[data-donate]").forEach((el) =>
    el.addEventListener("click", (event) => {
      event.preventDefault();
      $("#donate-dialog")?.closest<HTMLDialogElement>("dialog")?.showModal();
    }),
  );
  document.addEventListener("click", (event) => {
    const el = (event.target as HTMLElement).closest("[data-close]");
    el?.closest<HTMLDialogElement>("dialog")?.close();
  });
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("click", (e) => {
      if (e.target === d) {
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
  if (me.user) {
    $("#nav-dashboard").hidden = false;
    $("#account").innerHTML =
      `<span class="user-name">${esc(me.user.name)}</span>${me.admin ? '<a href="/admin/" class="quiet">Quản trị</a>' : ""}<button class="quiet" id="logout">Đăng xuất</button>`;
    $("#logout").addEventListener("click", async () => {
      await api("/api/logout", { method: "POST", body: "{}" });
      location.href = "/";
    });
  }
  icons();
}
async function home() {
  const form = $<HTMLFormElement>("#shorten-form");
  if (!form) return;
  let token = "",
    widget = "";
  let loginHint = me.user
    ? "Link này thuộc tài khoản của bạn. Thời hạn: 12 tháng không hoạt động."
    : "Link khách tồn tại 3 tháng không hoạt động và không thể quản lý sau khi tạo.";
  if (me.user) {
    $("#custom-options").hidden = false;
    $("#guest-hint").textContent = loginHint;
  }
  const config = await api("/api/config");
  if (!config.createEnabled || (!me.user && !config.guestEnabled)) {
    message(
      "#service-notice",
      !config.createEnabled
        ? "Dịch vụ đang tạm ngừng tạo link mới để bảo vệ tài nguyên. Vui lòng quay lại sau."
        : "Tạm ngừng tạo link khách. Bạn có thể đăng nhập để thử lại.",
    );
    form.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled =
      true;
  } else if (!config.siteKey) {
    message(
      "#service-notice",
      "Hệ thống đang được chuẩn bị. Tạo link sẽ mở khi xác minh an toàn sẵn sàng.",
    );
    form.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled =
      true;
  } else {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      widget = window.turnstile.render($("#turnstile"), {
        sitekey: config.siteKey,
        action: "create",
        appearance: "interaction-only",
        theme: "light",
        language: "vi",
        callback: (t: string) => {
          token = t;
          message("#verification-message", "");
        },
        "expired-callback": () => {
          token = "";
        },
        "error-callback": () => {
          token = "";
          message(
            "#verification-message",
            "Xác minh cho lần tạo tiếp theo chưa sẵn sàng. Bạn có thể tải lại trang để thử lại; link đã tạo vẫn sử dụng được.",
          );
        },
      });
    };
    script.onerror = () =>
      message(
        "#verification-message",
        "Không tải được xác minh. Hãy kiểm tra kết nối.",
        true,
      );
    document.head.append(script);
  }
  if (new URLSearchParams(location.search).has("error"))
    message(
      "#form-message",
      "Đăng nhập chưa thành công. Vui lòng thử lại hoặc liên hệ hi@oh.io.vn.",
      true,
    );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message("#form-message", "");
    if (!token) {
      message(
        "#form-message",
        "Vui lòng chờ xác minh hoàn tất rồi thử lại.",
        true,
      );
      return;
    }
    const button = form.querySelector<HTMLButtonElement>(
      "button[type=submit]",
    )!;
    button.disabled = true;
    const values = new FormData(form);
    const fixed = String(values.get("fixed_expires_at") ?? "");
    try {
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
      $("#result").hidden = false;
      $("#result-expiry").textContent =
        `Hạn hiện tại: ${date(result.expires_at)} (giờ Việt Nam). Mỗi lượt truy cập hợp lệ tính lại ${result.months} tháng, trong giới hạn ngày cố định nếu có. ${me.user ? "Quản lý link trong “Link của tôi”." : "Hãy lưu lại link; link khách không có trang quản lý."}`;
      $("#copy-result").onclick = () =>
        copy(result.url, $<HTMLButtonElement>("#copy-result"));
    } catch (e) {
      message("#form-message", (e as Error).message, true);
    } finally {
      button.disabled = false;
      token = "";
      if (widget) window.turnstile.reset(widget);
    }
  });
}
let links: LinkData[] = [],
  next: string | null = null,
  selected: LinkData | null = null,
  stats: Stats | null = null;
function card(l: LinkData) {
  const active = l.status === "active" && l.expires_at > Date.now();
  return `<article class="link-card"><div><h2 class="link-title">${esc(l.label || l.slug)} ${!active ? `<span class="badge">${l.status === "blocked" ? "Đã khóa" : l.status === "deleted" ? "Đã xóa" : "Hết hạn"}</span>` : ""}</h2><a href="/${esc(l.slug)}" target="_blank" rel="noopener">oh.io.vn/${esc(l.slug)}</a><div class="link-target">${esc(l.target ?? "Dữ liệu đã được dọn")}</div><div class="link-meta">Tạo ${date(l.created_at)} · Hạn ${date(l.expires_at)} (giờ Việt Nam)</div></div><div class="actions"><button class="icon-button" data-action="copy" data-slug="${esc(l.slug)}" aria-label="Sao chép link ${esc(l.slug)}"><i data-lucide="copy"></i></button>${active ? `<button class="icon-button" data-action="edit" data-slug="${esc(l.slug)}" aria-label="Sửa link ${esc(l.slug)}"><i data-lucide="pencil"></i></button>` : ""}<button class="icon-button" data-action="stats" data-slug="${esc(l.slug)}" aria-label="Thống kê link ${esc(l.slug)}"><i data-lucide="chart-no-axes-column"></i></button><button class="icon-button danger" data-action="delete" data-slug="${esc(l.slug)}" aria-label="Xóa link ${esc(l.slug)}"><i data-lucide="trash-2"></i></button></div></article>`;
}
async function loadLinks(append = false) {
  try {
    const q = $<HTMLInputElement>("#search").value;
    const data = await api(
      `/api/links?q=${encodeURIComponent(q)}${append && next ? "&cursor=" + next : ""}`,
    );
    links = append ? [...links, ...data.links] : data.links;
    next = data.next;
    $("#load-more").hidden = !next;
    $("#link-list").innerHTML = links.length
      ? links.map(card).join("")
      : '<p class="empty">Chưa có link nào. Tạo một link để bắt đầu chia sẻ.</p>';
    if (data.expiryHeld)
      message(
        "#dashboard-notice",
        "Hệ thống đang bảo vệ thời hạn link trong thời gian kiểm tra dữ liệu truy cập. Hạn cố định vẫn được áp dụng.",
      );
    icons();
  } catch (e) {
    message("#dashboard-notice", (e as Error).message, true);
  }
}
async function dashboard() {
  if (!$("#link-list")) return;
  if (!me.user) {
    $("#link-list").innerHTML =
      '<p class="empty">Đăng nhập Google để quản lý link của bạn.<br><br><a class="primary" href="/auth/login">Đăng nhập Google</a></p>';
    $(".toolbar").hidden = true;
    return;
  }
  await loadLinks();
  $("#search-button").onclick = () => loadLinks();
  $<HTMLInputElement>("#search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadLinks();
  });
  $("#load-more").onclick = () => loadLinks(true);
  $("#link-list").addEventListener("click", async (event) => {
    const b = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
    if (!b) return;
    selected = links.find((l) => l.slug === b.dataset.slug)!;
    if (b.dataset.action === "copy") {
      await copy(location.origin + "/" + selected.slug, b);
      return;
    }
    if (b.dataset.action === "edit") {
      const form = $<HTMLFormElement>("#edit-form");
      (form.elements.namedItem("target") as HTMLInputElement).value =
        selected.target ?? "";
      (form.elements.namedItem("label") as HTMLInputElement).value =
        selected.label ?? "";
      (form.elements.namedItem("fixed_expires_at") as HTMLInputElement).value =
        localDate(selected.fixed_expires_at);
      $("#edit-slug").textContent = "oh.io.vn/" + selected.slug;
      message("#edit-message", "");
      $<HTMLDialogElement>("#edit-dialog").showModal();
    }
    if (b.dataset.action === "delete")
      $<HTMLDialogElement>("#delete-dialog").showModal();
    if (b.dataset.action === "stats") {
      try {
        stats = await api<Stats>(`/api/links/${selected.slug}/stats`);
        renderStats(stats);
        $<HTMLDialogElement>("#stats-dialog").showModal();
      } catch (e) {
        message("#dashboard-notice", (e as Error).message, true);
      }
    }
  });
  $("#edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const fixed = String(f.get("fixed_expires_at") ?? "");
    try {
      await api(`/api/links/${selected!.slug}/edit`, {
        method: "PATCH",
        body: JSON.stringify({
          target: f.get("target"),
          label: f.get("label"),
          fixed_expires_at: fixed ? new Date(fixed).toISOString() : null,
        }),
      });
      $<HTMLDialogElement>("#edit-dialog").close();
      await loadLinks();
    } catch (e) {
      message("#edit-message", (e as Error).message, true);
    }
  });
  $("#confirm-delete").onclick = async () => {
    try {
      await api(`/api/links/${selected!.slug}/delete`, {
        method: "DELETE",
        body: "{}",
      });
      $<HTMLDialogElement>("#delete-dialog").close();
      await loadLinks();
    } catch (e) {
      message("#dashboard-notice", (e as Error).message, true);
    }
  };
  $("#export-excel").onclick = async () => {
    if (!stats || !selected) return;
    const button = $<HTMLButtonElement>("#export-excel");
    button.disabled = true;
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
        ...stats.rows.map((r) => [
          { value: selected!.slug, type: String },
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
            value: `Dữ liệu từ ${stats.since}; số lượt, không phải người dùng duy nhất.`,
            type: String,
          },
        ],
        ...stats.gaps.map((g) => [
          {
            value: `Thiếu dữ liệu: ${date(g.started_at)} — ${g.ended_at ? date(g.ended_at) : "đang tiếp diễn"}: ${g.reason}`,
            type: String,
          },
        ]),
      ];
      await writeXlsxFile([
        { data: rows, sheet: "Thống kê" },
        { data: notes, sheet: "Phạm vi" },
      ]).toFile(`oh-${selected.slug}-${stats.since}.xlsx`);
    } catch {
      message(
        "#dashboard-notice",
        "Chưa xuất được Excel. Vui lòng thử lại.",
        true,
      );
    } finally {
      button.disabled = false;
    }
  };
}
function renderStats(data: Stats) {
  const total = data.rows.reduce((n, r) => n + r.clicks, 0);
  const groups = (key: "source" | "device" | "day") => {
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
  const days = groups("day").sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...days.map(([, n]) => n), 1);
  $("#stats-content").innerHTML =
    `<p class="small">oh.io.vn/${esc(selected!.slug)} · Từ ${data.since} (giờ Việt Nam)</p><div class="stats-total">${total.toLocaleString("vi-VN")} <span class="small">lượt được ghi nhận</span></div>${data.gaps.length || !data.enabled ? `<div class="notice">Có khoảng thiếu dữ liệu. Tổng chỉ phản ánh lượt đã ghi nhận.${data.gaps.map((g) => `<div class="small">${date(g.started_at)} — ${g.ended_at ? date(g.ended_at) : "đang tiếp diễn"}: ${esc(g.reason)}</div>`).join("")}</div>` : ""}${days.length ? `<div class="chart" aria-label="Lượt theo ngày">${days.map(([day, n]) => `<span style="height:${Math.max(2, (n / max) * 100)}%" title="${day}: ${n}"></span>`).join("")}</div><div class="stats-grid"><div><h3 class="small">Nhóm nguồn</h3>${render(groups("source"))}</div><div><h3 class="small">Thiết bị</h3>${render(groups("device"))}</div></div><details class="optional"><summary>Số liệu theo ngày</summary>${render(days)}</details>` : '<p class="small">Chưa có lượt truy cập được ghi nhận trong khoảng này.</p>'}<p class="small">Có thể gồm bot hoặc lượt xem trước chưa nhận diện. “Không xác định” là thiếu thông tin nguồn giới thiệu.</p>`;
}
async function admin() {
  if (!$("#admin-content")) return;
  if (!me.admin) {
    message(
      "#admin-message",
      "Chỉ tài khoản quản trị được cấu hình mới có thể truy cập.",
      true,
    );
    return;
  }
  $("#admin-content").hidden = false;
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
      '<p class="small">Chưa có số liệu giám sát. Tạo link sẽ chờ đến khi có số liệu hợp lệ.</p>';
    try {
      const m = JSON.parse(data.policy.monitoring);
      if (m) {
        const resources: [string, number, number][] = [
          ["Lượt Worker hôm nay", m.requests, 100000],
          ["Hàng D1 đã đọc", m.reads, 5000000],
          ["Hàng D1 đã ghi", m.writes, 100000],
          ["Dung lượng D1 (byte)", m.databaseBytes, 500000000],
        ];
        usage =
          resources
            .map(
              ([name, value, limit]) =>
                `<div class="stat-row"><span>${name}</span><strong>${Number(value).toLocaleString("vi-VN")} / ${limit.toLocaleString("vi-VN")} (${((value / limit) * 100).toFixed(1)}%)</strong></div>`,
            )
            .join("") +
          `<p class="small">Số liệu lúc ${date(m.at)}. Bộ đếm ngày của nền tảng theo UTC; có độ trễ. Mức giảm tải tự động: ${m.level || "bình thường"}.</p>`;
      }
    } catch {
      /* Missing or incomplete snapshots are shown explicitly. */
    }
    $("#usage").innerHTML =
      `<p class="small">Bảo trì gần nhất: ${data.policy.heartbeat ? date(data.policy.heartbeat) : "chưa có"}<br>Sao lưu đã tải lên: ${data.policy.last_backup_at ? date(data.policy.last_backup_at) : "chưa có"}</p>${usage}${data.links.map((r: any) => `<div class="stat-row"><span>Link ${esc(r.status)}</span><strong>${r.count}</strong></div>`).join("")}`;
    $("#audit").innerHTML =
      data.audit
        .map(
          (r: any) =>
            `<div class="stat-row"><span>${esc(r.action)} · ${esc(r.subject)}</span><span>${date(r.created_at)}</span></div>`,
        )
        .join("") || '<p class="small">Chưa có thao tác.</p>';
    const blocked = await api("/api/admin/blocklist");
    $("#blocklist").innerHTML = blocked
      .map(
        (b: any) =>
          `<div class="stat-row"><span>${esc(b.kind)} · ${esc(b.value)}</span><button class="quiet" data-remove-block="${esc(b.value)}" data-kind="${b.kind}">Gỡ</button></div>`,
      )
      .join("");
  };
  await refresh();
  const action = async (body: Record<string, unknown>) => {
    try {
      await api("/api/admin/action", {
        method: "POST",
        body: JSON.stringify(body),
      });
      message("#admin-message", "Đã cập nhật.");
      await refresh();
    } catch (e) {
      message("#admin-message", (e as Error).message, true);
    }
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
    action(data);
  });
  $("#block-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    action({
      action: "add_block",
      kind: f.get("kind"),
      subject: f.get("value"),
    });
  });
  $("#blocklist").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-remove-block]",
    );
    if (b)
      action({
        action: "remove_block",
        kind: b.dataset.kind,
        subject: b.dataset.removeBlock,
      });
  });
  $("#admin-search").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = new FormData(e.target as HTMLFormElement).get("query");
    try {
      const r = await api(
        "/api/admin/search?q=" + encodeURIComponent(String(q)),
      );
      $("#admin-results").innerHTML =
        r.users
          .map(
            (u: any) =>
              `<div class="panel"><p>${esc(u.email)} · ${esc(u.name)}</p><button class="secondary" data-admin-action="block_user" data-subject="${esc(u.id)}" data-blocked="${!u.blocked}">${u.blocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}</button> <button class="quiet danger" data-admin-action="block_user_links" data-subject="${esc(u.id)}">Khóa riêng toàn bộ link của tài khoản</button></div>`,
          )
          .join("") +
          r.links
            .map(
              (l: any) =>
                `<div class="link-card"><div><strong>${esc(l.slug)} · ${esc(l.status)}</strong><p class="link-target">${esc(l.target)}</p></div><button class="secondary" data-admin-action="block_link" data-subject="${esc(l.slug)}">Vô hiệu hóa link</button></div>`,
            )
            .join("") || '<p class="small">Không tìm thấy.</p>';
    } catch (e) {
      message("#admin-message", (e as Error).message, true);
    }
  });
  $("#admin-results").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-admin-action]",
    );
    if (b)
      action({
        action: b.dataset.adminAction,
        subject: b.dataset.subject,
        blocked: b.dataset.blocked !== "false",
      });
  });
}
icons();
configureDialogs();
try {
  await account();
  await Promise.all([home(), dashboard(), admin()]);
} catch {
  ["#form-message", "#dashboard-notice", "#admin-message"].forEach((s) =>
    message(
      s,
      "Chưa kết nối được dịch vụ. Vui lòng tải lại trang sau ít phút.",
      true,
    ),
  );
}
