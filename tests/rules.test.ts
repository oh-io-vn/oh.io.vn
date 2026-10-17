import { describe, it, expect } from "vitest";
import {
  addMonths,
  slugValue,
  targetValue,
  sourceGroup,
} from "../src/shared/rules";
describe("Quy tắc công khai", () => {
  it("cộng tháng lịch theo Việt Nam và kẹp ngày cuối tháng", () => {
    expect(
      new Date(
        addMonths(Date.parse("2024-01-31T20:30:00+07:00"), 1),
      ).toISOString(),
    ).toBe("2024-02-29T13:30:00.000Z");
    expect(
      new Date(
        addMonths(Date.parse("2024-02-29T00:00:00+07:00"), 12),
      ).toISOString(),
    ).toBe("2025-02-27T17:00:00.000Z");
  });
  it("chuẩn hóa mã và dành đường dẫn hệ thống", () => {
    expect(slugValue("My-Link")).toBe("my-link");
    expect(() => slugValue("ADMIN")).toThrow();
    expect(() => slugValue("../x")).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "http://127.0.0.1/a",
    "http://0x7f000001",
    "http://192.168.0.1",
    "http://[::1]",
    "https://oh.io.vn/abc",
    "https://user:pass@example.com",
  ])("từ chối đích không an toàn %s", (u) =>
    expect(() => targetValue(u)).toThrow(),
  );
  it("chấp nhận HTTP(S) công khai", () =>
    expect(targetValue("https://example.com/a?q=1").hostname).toBe(
      "example.com",
    ));
  it("không tự gán referrer thiếu là trực tiếp", () => {
    expect(sourceGroup(null)).toBe("Không xác định");
    expect(sourceGroup("https://l.facebook.com/redirect?q=secret")).toBe(
      "Facebook",
    );
    expect(sourceGroup("https://fakefacebook.com")).toBe("Khác");
  });
});
