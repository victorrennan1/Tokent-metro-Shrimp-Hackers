"use client";

import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "@/components/dashboard";
import type { DashboardData } from "@/lib/dashboard-types";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export function RealDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) { setError("Supabase não configurado."); return; }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { window.location.replace("/login"); return; }
    setToken(accessToken);
    const response = await fetch("/api/v1/dashboard", { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (response.status === 401) { await supabase.auth.signOut(); window.location.replace("/login"); return; }
    if (!response.ok) { setError("Não foi possível carregar seus dados persistidos."); return; }
    setData(await response.json() as DashboardData);
    setError(null);
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (error) return <main className="grid min-h-screen place-items-center bg-paper p-5"><div className="max-w-md text-center"><h1 className="text-2xl font-black">Falha ao carregar o dashboard</h1><p className="mt-2 text-sm text-black/50">{error}</p><button onClick={() => void load()} className="mt-5 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">Tentar novamente</button></div></main>;
  if (!data || !token) return <main className="grid min-h-screen place-items-center bg-paper"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black/15 border-t-coral" /><p className="mt-3 text-sm font-bold text-black/45">Carregando dados persistidos…</p></div></main>;
  return <Dashboard data={data} mode="real" accessToken={token} onReload={load} />;
}

