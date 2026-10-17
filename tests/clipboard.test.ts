import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "../src/web/clipboard";
afterEach(() => vi.useRealTimers());
it("sao chép thành công và không giữ timer", async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  await copyText("https://example.com/", write);
  expect(write).toHaveBeenCalledWith("https://example.com/");
});
it("cho giao diện xử lý quyền clipboard bị từ chối", async () => {
  await expect(
    copyText("text", async () => {
      throw new Error("denied");
    }),
  ).rejects.toThrow("denied");
});
it("không để thao tác sao chép treo khi trình duyệt không phản hồi", async () => {
  vi.useFakeTimers();
  const pending = expect(
    copyText("text", () => new Promise(() => {}), 1000),
  ).rejects.toThrow("Clipboard unavailable");
  await vi.advanceTimersByTimeAsync(1000);
  await pending;
});
