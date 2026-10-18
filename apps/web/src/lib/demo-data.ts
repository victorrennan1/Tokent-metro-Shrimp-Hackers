export type DemoEvent = { date: string; agent: string; model: string; repo: string; input: number; output: number; cached: number; cost: number; sessions: number };

export const demoEvents: DemoEvent[] = [
  { date: "12 out", agent: "Codex", model: "GPT-5", repo: "shrimp/tokentometro", input: 183000, output: 38000, cached: 91000, cost: 1.92, sessions: 6 },
  { date: "13 out", agent: "Claude Code", model: "Claude Sonnet 4.5", repo: "shrimp/tokentometro", input: 242000, output: 51000, cached: 132000, cost: 2.86, sessions: 8 },
  { date: "14 out", agent: "Antigravity", model: "Gemini 2.5 Pro", repo: "labs/sandcastle", input: 118000, output: 29000, cached: 53000, cost: 1.14, sessions: 4 },
  { date: "15 out", agent: "Codex", model: "GPT-5", repo: "shrimp/tokentometro", input: 361000, output: 74000, cached: 177000, cost: 3.61, sessions: 11 },
  { date: "16 out", agent: "Claude Code", model: "Claude Sonnet 4.5", repo: "private-7af2", input: 204000, output: 46000, cached: 105000, cost: 2.42, sessions: 7 },
  { date: "17 out", agent: "Codex", model: "GPT-5 Mini", repo: "labs/sandcastle", input: 276000, output: 63000, cached: 149000, cost: 2.18, sessions: 9 },
  { date: "18 out", agent: "Codex", model: "GPT-5", repo: "shrimp/tokentometro", input: 317000, output: 69000, cached: 164000, cost: 3.07, sessions: 10 }
];

export const leaderboard = [
  { rank: 1, name: "ana.codes", handle: "@anacarvalho", tokens: 8420000, trend: "+12%", initials: "AC" },
  { rank: 2, name: "Rennan", handle: "@victorrennan1", tokens: 6942000, trend: "+18%", initials: "VR", me: true },
  { rank: 3, name: "mora.dev", handle: "@lmora", tokens: 5210000, trend: "+7%", initials: "LM" },
  { rank: 4, name: "Rafa", handle: "@rafabits", tokens: 4870000, trend: "+5%", initials: "RB" }
];
