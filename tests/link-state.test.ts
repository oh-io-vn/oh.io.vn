import { describe, expect, it } from "vitest";
import { canEditLink } from "../src/web/link-state";
describe("Quyền sửa hiển thị khi hoãn hết hạn", () => {
  const idle = { status: "active", expires_at: 10, fixed_expires_at: null };
  it("cho sửa link quá hạn không hoạt động đang được bảo toàn", () => {
    expect(canEditLink(idle, true, 20)).toBe(true);
    expect(canEditLink(idle, false, 20)).toBe(false);
  });
  it("không cho sửa khi hạn cố định đã qua hoặc link bị khóa/xóa", () => {
    expect(canEditLink({ ...idle, fixed_expires_at: 15 }, true, 20)).toBe(
      false,
    );
    for (const status of ["blocked", "deleted", "expired"])
      expect(canEditLink({ ...idle, status }, true, 20)).toBe(false);
  });
});
