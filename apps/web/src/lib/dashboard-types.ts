export type DashboardEvent = {
  id: string;
  occurredAt: string;
  agent: "claude-code" | "codex" | "antigravity";
  model: string | null;
  repository: string;
  input: number;
  output: number;
  cached: number;
  reasoning: number;
  total: number;
  cost: number | null;
  sourceSessionHash: string;
};

export type DashboardDevice = {
  id: string;
  name: string;
  platform: string;
  collectorVersion: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

export type DashboardData = {
  profile: {
    id: string;
    githubHandle: string;
    displayName: string;
    avatarUrl: string | null;
    leaderboardOptIn: boolean;
  };
  events: DashboardEvent[];
  devices: DashboardDevice[];
  loadedAt: string;
};

