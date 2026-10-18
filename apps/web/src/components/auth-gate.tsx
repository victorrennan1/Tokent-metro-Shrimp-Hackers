"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured());
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.replace("/login");
      else setReady(true);
    });
  }, []);
  if (!ready) return <main className="grid min-h-screen place-items-center bg-paper"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black/15 border-t-coral" /><p className="mt-3 text-sm font-bold text-black/45">Verificando sessão…</p></div></main>;
  return children;
}

