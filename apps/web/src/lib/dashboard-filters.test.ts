import { describe, expect, it } from "vitest";
import type { DashboardEvent } from "./dashboard-types";
import { filterDashboardEvents } from "./dashboard-filters";

const event = (overrides: Partial<DashboardEvent>): DashboardEvent => ({
  id: "event",
  occurredAt: "2026-10-18T12:00:00.000Z",
  agent: "codex",
  model: "gpt-test",
  repository: "owner/repository",
  input: 1,
  output: 1,
  cached: 0,
  reasoning: 0,
  total: 2,
  cost: null,
  sourceSessionHash: "session",
  ...overrides
});

const base = {
  period: "Todo o período",
  customStart: "2026-10-01",
  customEnd: "2026-10-31",
  agent: "Todos os agentes",
  model: "Todos os modelos",
  repository: "Todos os repositórios"
};

describe("dashboard filters", () => {
  it("combines period, agent, model and repository filters", () => {
    const events = [event({ id: "match" }), event({ id: "other-agent", agent: "claude-code" }), event({ id: "other-repo", repository: "other/repository" })];
    expect(filterDashboardEvents(events, { ...base, period: "7 dias", agent: "Codex", model: "gpt-test", repository: "owner/repository" }, Date.parse("2026-10-19T12:00:00Z")).map((item) => item.id)).toEqual(["match"]);
  });

  it("uses inclusive calendar dates for a custom period", () => {
    const events = [event({ id: "morning", occurredAt: "2026-10-18T12:00:00Z" }), event({ id: "evening", occurredAt: "2026-10-18T20:00:00Z" }), event({ id: "outside", occurredAt: "2026-10-19T12:00:00Z" })];
    expect(filterDashboardEvents(events, { ...base, period: "Personalizado", customStart: "2026-10-18", customEnd: "2026-10-18" }).map((item) => item.id)).toEqual(["morning", "evening"]);
  });
});
