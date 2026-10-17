import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "../src/web/request";
afterEach(() => vi.restoreAllMocks());
describe("Thông báo API trên giao diện", () => {
  it("đọc JSON thành công và giữ CSRF cho yêu cầu ghi", async () => {
    const remote = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ ok: true }));
    expect(
      await requestJson(
        "/api/example",
        {
          method: "POST",
          body: "{}",
          headers: new Headers({ "X-QA-Context": "fixture" }),
        },
        "csrf-fixture",
      ),
    ).toEqual({ ok: true });
    expect(
      new Headers(remote.mock.calls[0][1]?.headers).get("X-CSRF-Token"),
    ).toBe("csrf-fixture");
    expect(
      new Headers(remote.mock.calls[0][1]?.headers).get("X-QA-Context"),
    ).toBe("fixture");
    expect(remote.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("hiển thị lỗi mạng bằng tiếng Việt", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await expect(requestJson("/api/example")).rejects.toThrow("kiểm tra mạng");
  });
  it("giữ thông báo từ API khi thao tác không hợp lệ", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "Mã đã được sử dụng." }, { status: 409 }),
    );
    await expect(requestJson("/api/example")).rejects.toThrow(
      "Mã đã được sử dụng.",
    );
  });
  it.each([429, 502])(
    "xử lý trang lỗi HTML từ hạ tầng, HTTP %s",
    async (status) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("<html>Error</html>", { status }),
      );
      await expect(requestJson("/api/example")).rejects.toThrow(
        status === 429 ? "thao tác quá nhanh" : "Dịch vụ đang bận",
      );
    },
  );
});
