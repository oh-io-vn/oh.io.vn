import { afterEach, describe, expect, it, vi } from "vitest";
import { VerificationGate } from "../src/web/verification";

afterEach(() => vi.useRealTimers());

describe("Chờ xác minh trên biểu mẫu", () => {
  it("một lần bấm chờ callback rồi dùng token đúng một lần", async () => {
    const gate = new VerificationGate();
    const waiting = gate.take();
    gate.accept("real-token");
    expect(await waiting).toBe("real-token");
    expect(gate.ready).toBe(false);
    const next = gate.take();
    const failure = expect(next).rejects.toThrow("Thử lại");
    gate.fail("Thử lại");
    await failure;
  });

  it("tiêu thụ token có sẵn và không dùng token đã hết hạn", async () => {
    vi.useFakeTimers();
    const gate = new VerificationGate();
    gate.accept("first");
    expect(await gate.take()).toBe("first");
    gate.accept("old");
    vi.advanceTimersByTime(290000);
    expect(gate.ready).toBe(false);
    const waiting = gate.take();
    gate.accept("fresh");
    expect(await waiting).toBe("fresh");
  });

  it("lỗi không để biểu mẫu kẹt và lần thử lại nhận token mới", async () => {
    const gate = new VerificationGate();
    const first = gate.take();
    const failure = expect(first).rejects.toThrow("Mất kết nối");
    gate.fail("Mất kết nối");
    await failure;
    const second = gate.take();
    gate.accept("recovered");
    expect(await second).toBe("recovered");
  });

  it("timeout kết thúc chờ và không chặn lần thử sau", async () => {
    vi.useFakeTimers();
    const gate = new VerificationGate();
    const first = expect(gate.take(1000)).rejects.toThrow("nhiều thời gian");
    await vi.advanceTimersByTimeAsync(1000);
    await first;
    gate.accept("next");
    expect(await gate.take()).toBe("next");
  });

  it("hết hạn xóa token cũ trong lúc chờ token mới", async () => {
    const gate = new VerificationGate();
    gate.accept("expired");
    gate.invalidate();
    const waiting = gate.take();
    gate.invalidate();
    gate.accept("refreshed");
    expect(await waiting).toBe("refreshed");
  });
});
