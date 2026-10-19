"use client";

import { Dashboard } from "@/components/dashboard";
import { demoDashboardData, demoLeaderboard } from "@/lib/demo-data";

export function DemoDashboard() {
  return <Dashboard data={demoDashboardData} mode="demo" leaderboard={demoLeaderboard} />;
}

