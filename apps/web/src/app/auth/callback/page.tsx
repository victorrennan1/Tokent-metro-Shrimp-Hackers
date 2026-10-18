"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) { window.location.replace("/"); return; }
    supabase.auth.getSession().then(({ data, error }) => window.location.replace(data.session && !error ? "/" : "/login?error=oauth"));
  }, []);
  return <main className="grid min-h-screen place-items-center bg-ink text-white"><p className="text-sm font-bold text-white/60">Conectando seu GitHub…</p></main>;
}

