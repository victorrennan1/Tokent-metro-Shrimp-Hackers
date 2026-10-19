import type { DashboardEvent } from "@/lib/dashboard-types";

const agentNames: Record<DashboardEvent["agent"], string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  antigravity: "Antigravity"
};

export type DashboardFilters = {
  period: string;
  customStart: string;
  customEnd: string;
  agent: string;
  model: string;
  repository: string;
};

export function filterDashboardEvents(events: DashboardEvent[], filters: DashboardFilters, now = Date.now()): DashboardEvent[] {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const customStart = new Date(`${filters.customStart}T00:00:00`).getTime();
  const customEnd = new Date(`${filters.customEnd}T23:59:59.999`).getTime();

  return events.filter((event) => {
    const eventTime = new Date(event.occurredAt).getTime();
    const periodMatches = filters.period === "Todo o período"
      || (filters.period === "Personalizado"
        ? eventTime >= customStart && eventTime <= customEnd
        : eventTime <= now && eventTime >= (filters.period === "Hoje"
          ? todayStart.getTime()
          : now - (filters.period === "7 dias" ? 7 : 30) * 86_400_000));
    return periodMatches
      && (filters.agent === "Todos os agentes" || agentNames[event.agent] === filters.agent)
      && (filters.model === "Todos os modelos" || event.model === filters.model)
      && (filters.repository === "Todos os repositórios" || event.repository === filters.repository);
  });
}
