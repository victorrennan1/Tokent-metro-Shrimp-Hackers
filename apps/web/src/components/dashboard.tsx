"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown, CircleHelp, Code2, Cpu, Database, Laptop, LayoutDashboard, LockKeyhole, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Trophy, X, Zap } from "lucide-react";
import { demoEvents, leaderboard } from "@/lib/demo-data";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type View = "overview" | "rankings" | "devices" | "privacy";
const nav: Array<{ id: View; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "devices", label: "Computadores", icon: Laptop },
  { id: "privacy", label: "Privacidade", icon: ShieldCheck }
];

const format = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2).replace(".", ",")} mi` : `${Math.round(value / 1_000)} mil`;
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);

export function Dashboard() {
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState("7 dias");
  const [agent, setAgent] = useState("Todos os agentes");
  const [mobile, setMobile] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [synced, setSynced] = useState(false);
  const events = useMemo(() => demoEvents.filter((event) => agent === "Todos os agentes" || event.agent === agent), [agent]);
  const totals = events.reduce((sum, event) => ({ input: sum.input + event.input, output: sum.output + event.output, cached: sum.cached + event.cached, cost: sum.cost + event.cost, sessions: sum.sessions + event.sessions }), { input: 0, output: 0, cached: 0, cost: 0, sessions: 0 });
  const total = totals.input + totals.output;

  return <div className="min-h-screen bg-paper text-ink lg:flex">
    <Sidebar view={view} setView={(next) => { setView(next); setMobile(false); }} mobile={mobile} close={() => setMobile(false)} />
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-black/10 bg-paper/90 px-5 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-3">
          <button className="rounded-xl border border-black/10 p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Abrir menu"><Menu size={19} /></button>
          <div><p className="eyebrow text-black/45">Workspace pessoal</p><h1 className="text-lg font-bold tracking-tight">{nav.find((item) => item.id === view)?.label}</h1></div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => { setSynced(true); setTimeout(() => setSynced(false), 1800); }} className="hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold hover:bg-black hover:text-white sm:flex"><RefreshCw size={15} className={synced ? "animate-spin" : ""} />{synced ? "Atualizado" : "Sincronizar"}</button>
          <button onClick={() => setPairing(true)} className="flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-coral"><Plus size={16} /> <span className="hidden sm:inline">Adicionar computador</span><span className="sm:hidden">Adicionar</span></button>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-acid text-xs font-black ring-2 ring-white">VR</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] p-5 sm:p-8">
        {view === "overview" && <Overview period={period} setPeriod={setPeriod} agent={agent} setAgent={setAgent} totals={{ ...totals, total }} events={events} />}
        {view === "rankings" && <Rankings />}
        {view === "devices" && <Devices onPair={() => setPairing(true)} />}
        {view === "privacy" && <Privacy />}
      </div>
    </main>
    {pairing && <PairingModal close={() => setPairing(false)} />}
  </div>;
}

function Sidebar({ view, setView, mobile, close }: { view: View; setView: (v: View) => void; mobile: boolean; close: () => void }) {
  return <><aside className={`${mobile ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-black/10 bg-[#efeee9] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
    <div className="mb-10 flex items-center justify-between px-2 pt-1"><button onClick={() => setView("overview")} className="flex items-center gap-3"><span className="grid h-9 w-9 -rotate-3 place-items-center rounded-xl bg-coral text-white shadow-[3px_3px_0_#171717]"><Zap size={20} fill="currentColor" /></span><span className="text-xl font-black tracking-[-.05em]">tokentômetro</span></button><button className="lg:hidden" onClick={close}><X /></button></div>
    <nav className="space-y-1">{nav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setView(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${view === id ? "bg-white shadow-sm" : "text-black/55 hover:bg-white/60 hover:text-black"}`}><Icon size={18} strokeWidth={view === id ? 2.5 : 2} />{label}{id === "rankings" && <span className="ml-auto rounded-full bg-acid px-2 py-0.5 text-[10px] font-black text-black">AO VIVO</span>}</button>)}</nav>
    <div className="mt-8 border-t border-black/10 pt-6"><p className="eyebrow mb-3 px-3 text-black/35">Seu consumo</p><div className="rounded-2xl bg-ink p-4 text-white"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-white/55">OUTUBRO</span><Sparkles size={15} className="text-acid" /></div><p className="num text-2xl font-black">6,94 mi</p><p className="mt-1 text-xs text-white/50">tokens normalizados</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[69%] rounded-full bg-acid" /></div></div></div>
    <div className="mt-auto flex items-center gap-3 rounded-xl p-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#d4d1c8] text-xs font-black">VR</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Victor Rennan</p><p className="truncate text-xs text-black/40">@victorrennan1</p></div><button aria-label="Sair" onClick={async () => { await getSupabaseBrowser()?.auth.signOut(); window.location.assign("/login"); }} className="rounded-lg p-2 text-black/35 hover:bg-black/5 hover:text-black"><LogOut size={16} /></button></div>
  </aside>{mobile && <button className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm lg:hidden" onClick={close} aria-label="Fechar menu" />}</>;
}

function Filter({ value, options, set }: { value: string; options: string[]; set: (value: string) => void }) {
  return <label className="relative"><select value={value} onChange={(e) => set(e.target.value)} className="appearance-none rounded-xl border border-black/10 bg-white py-2.5 pl-3 pr-9 text-sm font-bold outline-none focus:ring-2 focus:ring-coral/30">{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-black/40" /></label>;
}

function Overview({ period, setPeriod, agent, setAgent, totals, events }: { period: string; setPeriod: (v: string) => void; agent: string; setAgent: (v: string) => void; totals: { total: number; input: number; output: number; cached: number; cost: number; sessions: number }; events: typeof demoEvents }) {
  return <div className="enter space-y-7">
    <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /><span className="eyebrow text-emerald-700">Dados sincronizados</span></div><h2 className="max-w-2xl text-3xl font-black tracking-[-.055em] sm:text-4xl">Veja onde seus tokens<br className="hidden sm:block" /> estão trabalhando.</h2><p className="mt-2 text-sm text-black/45">Última sincronização há 2 minutos · 2 computadores ativos</p></div><div className="flex flex-wrap gap-2"><Filter value={period} set={setPeriod} options={["Hoje", "7 dias", "30 dias", "Personalizado"]} /><Filter value={agent} set={setAgent} options={["Todos os agentes", "Codex", "Claude Code", "Antigravity"]} /></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Tokens consumidos" value={format(totals.total)} delta="+18,4%" icon={Zap} accent="coral" /><Metric label="Tokens em cache" value={format(totals.cached)} sub={`${Math.round((totals.cached / Math.max(totals.input, 1)) * 100)}% da entrada`} icon={Database} /><Metric label="Sessões" value={String(totals.sessions)} sub="em 3 repositórios" icon={Code2} /><Metric label="Custo equivalente estimado" value={money(totals.cost)} sub="não é sua cobrança real" icon={CircleHelp} /></section>
    <section className="grid gap-4 xl:grid-cols-[1.55fr_.85fr]">
      <div className="card overflow-hidden"><div className="flex items-start justify-between border-b border-black/5 p-5 sm:p-6"><div><p className="eyebrow text-black/40">Atividade diária</p><h3 className="mt-1 text-xl font-black tracking-tight">Ritmo de construção</h3></div><div className="flex items-center gap-4 text-xs font-bold"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-coral" />Tokens</span><span className="hidden items-center gap-1.5 sm:flex"><i className="h-2 w-2 rounded-full bg-acid ring-1 ring-black/20" />Cache</span></div></div><TokenChart events={events} /></div>
      <div className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow text-black/40">Por agente</p><h3 className="mt-1 text-xl font-black tracking-tight">Quem fez o trabalho</h3></div><Cpu size={20} className="text-black/35" /></div><AgentBreakdown events={events} /></div>
    </section>
    <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><RecentActivity events={events} /><LeaderboardCompact /></section>
    <p className="rounded-xl border border-black/10 bg-white/50 px-4 py-3 text-xs leading-relaxed text-black/50"><strong className="text-black/70">Sobre a comparação:</strong> provedores podem reportar cache, raciocínio e totais com semânticas diferentes. O ranking é indicativo e preserva os componentes fornecidos por cada fonte.</p>
  </div>;
}

function Metric({ label, value, delta, sub, icon: Icon, accent }: { label: string; value: string; delta?: string; sub?: string; icon: typeof Zap; accent?: string }) {
  return <div className={`card relative overflow-hidden p-5 ${accent === "coral" ? "bg-coral text-white" : ""}`}><div className="mb-7 flex items-start justify-between"><p className={`text-xs font-bold ${accent ? "text-white/70" : "text-black/45"}`}>{label}</p><Icon size={17} className={accent ? "text-white/70" : "text-black/30"} /></div><div className="flex items-end justify-between gap-2"><p className="num text-3xl font-black">{value}</p>{delta && <span className="rounded-full bg-white/20 px-2 py-1 text-[11px] font-black">{delta}</span>}</div>{sub && <p className={`mt-2 text-xs ${accent ? "text-white/60" : "text-black/40"}`}>{sub}</p>}</div>;
}

function TokenChart({ events }: { events: typeof demoEvents }) {
  const max = Math.max(...events.map((e) => e.input + e.output), 1);
  return <div className="grid-noise flex h-[290px] items-end gap-2 p-5 pt-9 sm:gap-4 sm:p-7">{events.map((event) => { const height = ((event.input + event.output) / max) * 205; const cache = (event.cached / max) * 205; return <div key={`${event.date}-${event.agent}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end"><div className="relative flex w-full items-end justify-center gap-1"><div className="absolute -top-12 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg group-hover:block">{format(event.input + event.output)} tokens</div><div className="w-[42%] max-w-8 rounded-t-md bg-coral transition-all group-hover:brightness-90" style={{ height }} /><div className="w-[28%] max-w-5 rounded-t-md bg-acid ring-1 ring-black/10" style={{ height: cache }} /></div><span className="mt-3 truncate text-[10px] font-bold text-black/40">{event.date}</span></div>; })}</div>;
}

function AgentBreakdown({ events }: { events: typeof demoEvents }) {
  const agents = ["Codex", "Claude Code", "Antigravity"].map((name) => ({ name, total: events.filter((e) => e.agent === name).reduce((s, e) => s + e.input + e.output, 0) }));
  const grand = agents.reduce((s, a) => s + a.total, 0) || 1;
  const colors = ["bg-[#171717]", "bg-coral", "bg-acid"];
  return <div className="mt-8 space-y-7">{agents.map((item, index) => <div key={item.name}><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-3 w-3 rounded ${colors[index]}`} /><span className="text-sm font-bold">{item.name}</span></div><span className="num text-sm font-black">{format(item.total)}</span></div><div className="h-2 overflow-hidden rounded-full bg-black/5"><div className={`h-full rounded-full ${colors[index]}`} style={{ width: `${Math.max((item.total / grand) * 100, item.total ? 8 : 0)}%` }} /></div><p className="mt-1.5 text-right text-[10px] font-bold text-black/35">{Math.round((item.total / grand) * 100)}%</p></div>)}</div>;
}

function RecentActivity({ events }: { events: typeof demoEvents }) {
  return <div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-black/5 p-5"><div><p className="eyebrow text-black/40">Agora há pouco</p><h3 className="mt-1 text-xl font-black">Atividade recente</h3></div><button className="text-xs font-black text-coral">Ver tudo</button></div><div>{events.slice().reverse().slice(0, 4).map((event, index) => <div key={`${event.date}-${event.agent}`} className="flex items-center gap-3 border-b border-black/5 px-5 py-3.5 last:border-0"><div className={`grid h-9 w-9 place-items-center rounded-xl ${index === 0 ? "bg-acid" : "bg-black/5"}`}><Code2 size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{event.repo}</p><p className="truncate text-xs text-black/40">{event.agent} · {event.model}</p></div><div className="text-right"><p className="num text-sm font-black">{format(event.input + event.output)}</p><p className="text-[10px] text-black/35">{event.date}</p></div></div>)}</div></div>;
}

function LeaderboardCompact() {
  return <div className="card overflow-hidden"><div className="flex items-center justify-between bg-ink p-5 text-white"><div><p className="eyebrow text-white/40">Ranking público</p><h3 className="mt-1 text-xl font-black">Builders da semana</h3></div><Trophy className="text-acid" /></div><div>{leaderboard.slice(0, 3).map((person) => <div key={person.rank} className={`flex items-center gap-3 border-b border-black/5 px-5 py-4 last:border-0 ${person.me ? "bg-acid/30" : ""}`}><span className="w-5 text-sm font-black text-black/30">{person.rank}</span><div className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[10px] font-black">{person.initials}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{person.name}{person.me && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-[9px] text-white">VOCÊ</span>}</p><p className="text-xs text-black/35">{person.handle}</p></div><p className="num text-sm font-black">{format(person.tokens)}</p></div>)}</div></div>;
}

function Rankings() {
  return <div className="enter"><div className="mb-7"><p className="eyebrow text-coral">Opt-in · atualizado hoje</p><h2 className="mt-2 text-4xl font-black tracking-[-.055em]">Quem está construindo<br />mais com IA?</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-black/50">Uma comparação indicativa entre builders que escolheram participar. Repositórios privados nunca aparecem aqui.</p></div><div className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-black/10 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2"><button className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white">Builders</button><button className="rounded-lg px-3 py-2 text-xs font-bold text-black/45">Agentes</button><button className="rounded-lg px-3 py-2 text-xs font-bold text-black/45">Modelos</button></div><div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2"><Search size={15} className="text-black/30" /><input className="w-36 bg-transparent text-sm outline-none" placeholder="Buscar builder" /></div></div><div>{leaderboard.map((person) => <div key={person.rank} className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b border-black/5 p-5 last:border-0 sm:grid-cols-[60px_1fr_140px_100px] ${person.me ? "bg-acid/30" : ""}`}><span className="text-2xl font-black text-black/20">#{person.rank}</span><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-ink text-xs font-black text-white">{person.initials}</div><div><p className="font-black">{person.name}{person.me && <span className="ml-2 rounded bg-coral px-1.5 py-0.5 text-[9px] text-white">VOCÊ</span>}</p><p className="text-xs text-black/35">{person.handle}</p></div></div><p className="num text-right text-lg font-black">{format(person.tokens)}</p><p className="hidden text-right text-sm font-bold text-emerald-600 sm:block">{person.trend}</p></div>)}</div></div></div>;
}

function Devices({ onPair }: { onPair: () => void }) {
  return <div className="enter"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow text-coral">Coleta local</p><h2 className="mt-2 text-4xl font-black tracking-[-.055em]">Seus computadores</h2><p className="mt-2 text-sm text-black/45">Credenciais independentes. Revogue qualquer dispositivo imediatamente.</p></div><button onClick={onPair} className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white"><Plus size={17} />Adicionar computador</button></div><div className="grid gap-4 lg:grid-cols-2"><Device name="DESKTOP-SHRIMP" meta="Windows 11 · coletor 0.1.0" last="há 2 minutos" active /><Device name="MacBook Air" meta="macOS · coletor 0.1.0" last="há 3 horas" active /></div><div className="card mt-4 flex gap-4 p-5"><LockKeyhole className="mt-0.5 shrink-0 text-emerald-600" /><div><h3 className="font-black">Cada computador tem sua própria chave</h3><p className="mt-1 text-sm leading-relaxed text-black/50">O servidor armazena somente o hash da credencial. Revogar um computador não interfere nos demais e interrompe novos envios imediatamente.</p></div></div></div>;
}

function Device({ name, meta, last, active }: { name: string; meta: string; last: string; active: boolean }) {
  return <div className="card p-5"><div className="flex items-start justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-black text-white"><Laptop size={21} /></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${active ? "bg-emerald-100 text-emerald-700" : "bg-black/5"}`}>● ATIVO</span></div><h3 className="mt-6 text-xl font-black">{name}</h3><p className="mt-1 text-sm text-black/40">{meta}</p><div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4"><p className="text-xs text-black/40">Última sincronização <strong className="text-black/70">{last}</strong></p><button className="text-xs font-black text-red-600">Revogar</button></div></div>;
}

function Privacy() {
  const [publicRank, setPublicRank] = useState(false), [privateRepos, setPrivateRepos] = useState(true);
  return <div className="enter max-w-3xl"><div className="mb-7"><p className="eyebrow text-coral">Você no controle</p><h2 className="mt-2 text-4xl font-black tracking-[-.055em]">Privacidade por padrão.</h2><p className="mt-2 text-sm leading-relaxed text-black/45">O Tokentômetro coleta contagens, nunca conversas. Suas preferências podem ser alteradas a qualquer momento.</p></div><div className="card divide-y divide-black/5"><Setting title="Aparecer no ranking público" text="Mostra seu nome de exibição e total agregado. Desativado por padrão." value={publicRank} set={setPublicRank} /><Setting title="Anonimizar repositórios privados" text="Substitui o nome por um hash estável antes do envio." value={privateRepos} set={setPrivateRepos} /><Setting title="Compartilhar repositórios públicos" text="Exibe owner/repository nas suas métricas privadas." value set={() => {}} /></div><div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5"><h3 className="font-black text-red-800">Zona de exclusão</h3><p className="mt-1 text-sm text-red-800/60">Exclua eventos de um dispositivo ou remova permanentemente sua conta e todos os dados.</p><button className="mt-4 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700">Gerenciar exclusão de dados</button></div></div>;
}

function Setting({ title, text, value, set }: { title: string; text: string; value: boolean; set: (v: boolean) => void }) {
  return <div className="flex items-center gap-5 p-5"><div className="flex-1"><h3 className="font-black">{title}</h3><p className="mt-1 text-sm leading-relaxed text-black/45">{text}</p></div><button onClick={() => set(!value)} role="switch" aria-checked={value} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-ink" : "bg-black/15"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${value ? "left-6" : "left-1"}`} /></button></div>;
}

function PairingModal({ close }: { close: () => void }) {
  const [copied, setCopied] = useState(false); const code = "SHRIMP-42Q";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[24px] bg-paper p-6 shadow-2xl"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-acid"><Laptop size={20} /></div><button onClick={close} className="rounded-full p-2 hover:bg-black/5"><X size={19} /></button></div><p className="eyebrow mt-6 text-coral">Expira em 09:42</p><h2 className="mt-1 text-2xl font-black tracking-tight">Vincule seu computador</h2><p className="mt-2 text-sm leading-relaxed text-black/50">No terminal do computador, instale o coletor e informe este código quando solicitado.</p><pre className="mt-5 overflow-x-auto rounded-xl bg-ink p-4 text-sm text-acid"><code>npx tokentometro@latest setup</code></pre><button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); }} className="mt-3 w-full rounded-xl border-2 border-dashed border-black/15 bg-white p-4 text-center"><span className="block text-xs font-bold text-black/35">CÓDIGO DE USO ÚNICO</span><strong className="num mt-1 block text-2xl tracking-[.18em]">{code}</strong><span className="mt-1 block text-[10px] font-bold text-coral">{copied ? "COPIADO!" : "CLIQUE PARA COPIAR"}</span></button><p className="mt-4 flex items-center gap-2 text-xs text-black/40"><ShieldCheck size={14} />O coletor mostra uma prévia antes do primeiro envio.</p></div></div>;
}
