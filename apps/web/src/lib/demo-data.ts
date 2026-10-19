import type { DashboardData } from "@/lib/dashboard-types";

export const demoDashboardData: DashboardData = {
  profile: {
    id: "demo-profile",
    githubHandle: "demo-builder",
    displayName: "Builder Demo",
    avatarUrl: null,
    leaderboardOptIn: false
  },
  events: [
    ["2026-10-12T12:00:00.000Z", "codex", "GPT-5", "shrimp/tokentometro", 183000, 38000, 91000, 221000, 1.92],
    ["2026-10-13T12:00:00.000Z", "claude-code", "Claude Sonnet 4.5", "shrimp/tokentometro", 242000, 51000, 132000, 293000, 2.86],
    ["2026-10-14T12:00:00.000Z", "antigravity", "Gemini 2.5 Pro", "labs/sandcastle", 118000, 29000, 53000, 147000, 1.14],
    ["2026-10-15T12:00:00.000Z", "codex", "GPT-5", "shrimp/tokentometro", 361000, 74000, 177000, 435000, 3.61],
    ["2026-10-16T12:00:00.000Z", "claude-code", "Claude Sonnet 4.5", "Repositório privado", 204000, 46000, 105000, 250000, 2.42],
    ["2026-10-17T12:00:00.000Z", "codex", "GPT-5 Mini", "labs/sandcastle", 276000, 63000, 149000, 339000, 2.18],
    ["2026-10-18T12:00:00.000Z", "codex", "GPT-5", "shrimp/tokentometro", 317000, 69000, 164000, 386000, 3.07]
  ].map((row, index) => ({
    id: `demo-event-${index}`,
    occurredAt: row[0] as string,
    agent: row[1] as "claude-code" | "codex" | "antigravity",
    model: row[2] as string,
    repository: row[3] as string,
    input: row[4] as number,
    output: row[5] as number,
    cached: row[6] as number,
    reasoning: 0,
    total: row[7] as number,
    cost: row[8] as number,
    sourceSessionHash: `demo-session-${index}`
  })),
  devices: [
    { id: "demo-device-1", name: "DESKTOP-DEMO", platform: "win32", collectorVersion: "0.1.0", lastSeenAt: "2026-10-18T17:00:00.000Z", revokedAt: null },
    { id: "demo-device-2", name: "Notebook Demo", platform: "darwin", collectorVersion: "0.1.0", lastSeenAt: "2026-10-18T14:00:00.000Z", revokedAt: null }
  ],
  loadedAt: "2026-10-18T17:02:00.000Z"
};

export const demoLeaderboard = [
  { rank: 1, name: "ana.codes", tokens: 8420000 },
  { rank: 2, name: "Builder Demo", tokens: 6942000 },
  { rank: 3, name: "mora.dev", tokens: 5210000 }
];
