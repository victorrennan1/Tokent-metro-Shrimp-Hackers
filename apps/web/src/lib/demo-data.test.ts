import { describe, expect, it } from "vitest";
import { demoEvents, leaderboard } from "./demo-data";

describe("sanitized demo data", () => {
  it("contains useful non-zero aggregates", () => {
    expect(demoEvents.reduce((sum, event) => sum + event.input + event.output, 0)).toBeGreaterThan(0);
    expect(leaderboard.some((builder) => builder.me)).toBe(true);
  });

  it("does not contain local absolute paths", () => {
    expect(JSON.stringify(demoEvents)).not.toMatch(/[A-Z]:\\|\/Users\/|\/home\//);
  });
});
