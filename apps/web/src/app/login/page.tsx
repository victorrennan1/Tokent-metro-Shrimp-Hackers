"use client";

import { Github, ShieldCheck, Zap } from "lucide-react";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";

export default function LoginPage() {
  async function login() {
    const supabase = getSupabaseBrowser();
    if (!supabase) { window.location.assign("/"); return; }
    await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "read:user" } });
  }
  return <main className="grid min-h-screen bg-ink p-5 text-white lg:grid-cols-2 lg:p-0">
    <section className="relative flex min-h-[48vh] flex-col justify-between overflow-hidden rounded-[28px] bg-coral p-8 lg:m-4 lg:min-h-0 lg:p-14"><div className="grid-noise absolute inset-0 opacity-25" /><div className="relative flex items-center gap-3"><span className="grid h-10 w-10 -rotate-3 place-items-center rounded-xl bg-white text-coral shadow-[3px_3px_0_#171717]"><Zap size={21} fill="currentColor" /></span><span className="text-xl font-black tracking-[-.05em]">tokentômetro</span></div><div className="relative max-w-xl"><p className="eyebrow text-white/60">Telemetria para builders</p><h1 className="mt-4 text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl">Seus tokens.<br />Uma visão clara.</h1><p className="mt-6 max-w-md text-base leading-relaxed text-white/70">Consolide Claude Code e Codex sem enviar prompts, respostas ou código. Antigravity é detectado, mas ainda não produz eventos.</p></div><p className="relative text-xs font-bold text-white/50">Privado por padrão · Somente metadados · Você no controle</p></section>
    <section className="flex items-center justify-center px-5 py-16"><div className="w-full max-w-sm"><div className="mb-8 grid h-12 w-12 place-items-center rounded-2xl bg-acid text-ink"><ShieldCheck size={22} /></div><p className="eyebrow text-acid">Bem-vindo</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">Entre para medir o que você está construindo.</h2><p className="mt-3 text-sm leading-relaxed text-white/45">Usamos apenas seu perfil público do GitHub. Nenhum acesso ao conteúdo de repositórios privados.</p><button onClick={login} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-black text-ink hover:bg-acid"><Github size={19} />Entrar com GitHub</button>{!isSupabaseConfigured() && <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs text-white/45">Modo demonstração: o botão abre o dashboard sem autenticação externa.</p>}<p className="mt-8 text-center text-[11px] leading-relaxed text-white/30">Ao continuar, você concorda com a política de privacidade do Tokentômetro.</p></div></section>
  </main>;
}

