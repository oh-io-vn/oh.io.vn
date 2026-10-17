import { it, expect } from "vitest";
import { resourceLevel } from "../src/worker/monitor";
it("ngưỡng áp dụng riêng theo tài nguyên, không trộn tổng quota", () => {
  expect(resourceLevel(70000, 0, 0, 0).level).toBe(70);
  expect(resourceLevel(0, 0, 80000, 0).level).toBe(80);
  expect(resourceLevel(0, 4500000, 0, 0).level).toBe(90);
  expect(resourceLevel(0, 0, 0, 450000000).level).toBe(90);
  expect(resourceLevel(30000, 1500000, 30000, 150000000).level).toBe(0);
});
