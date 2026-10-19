import { describe, expect, it } from "vitest";
import { demoDashboardData, demoLeaderboard } from "./demo-data";

describe("sanitized demo data", () => {
  it("contains useful non-zero aggregates", () => {
    expect(demoDashboardData.events.reduce((sum, event) => sum + event.total, 0)).toBeGreaterThan(0);
    expect(demoLeaderboard.length).toBeGreaterThan(0);
  });

  it("does not contain local absolute paths", () => {
    expect(JSON.stringify(demoDashboardData)).not.toMatch(/[A-Z]:\\|\/Users\/|\/home\//);
  });
});
