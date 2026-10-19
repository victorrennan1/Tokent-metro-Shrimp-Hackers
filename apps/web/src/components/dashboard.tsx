"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  CircleHelp,
  Code2,
  Cpu,
  Database,
  Laptop,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type {
  DashboardData,
  DashboardDevice,
  DashboardEvent,
} from "@/lib/dashboard-types";
import { filterDashboardEvents } from "@/lib/dashboard-filters";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type View = "overview" | "rankings" | "devices" | "privacy";
type Mode = "demo" | "real";
type LeaderboardRow = { rank: number; name: string; tokens: number };

const nav: Array<{ id: View; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "devices", label: "Computadores", icon: Laptop },
  { id: "privacy", label: "Privacidade", icon: ShieldCheck },
];

const agentNames: Record<DashboardEvent["agent"], string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  antigravity: "Antigravity",
};
const format = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2).replace(".", ",")} mi`
    : value >= 1000
      ? `${Math.round(value / 1000)} mil`
      : String(value);
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(
    value,
  );
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(value))
    .replace(".", "");
const dateTimeLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "nunca";
const localDateInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export function Dashboard({
  data,
  mode,
  accessToken,
  onReload,
  leaderboard,
}: {
  data: DashboardData;
  mode: Mode;
  accessToken?: string;
  onReload?: () => Promise<void>;
  leaderboard?: LeaderboardRow[];
}) {
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState("7 dias");
  const [customStart, setCustomStart] = useState(() =>
    localDateInput(new Date(Date.now() - 7 * 86_400_000)),
  );
  const [customEnd, setCustomEnd] = useState(() => localDateInput(new Date()));
  const [agent, setAgent] = useState("Todos os agentes");
  const [model, setModel] = useState("Todos os modelos");
  const [repository, setRepository] = useState("Todos os repositórios");
  const [mobile, setMobile] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filteredEvents = useMemo(
    () =>
      filterDashboardEvents(data.events, {
        period,
        customStart,
        customEnd,
        agent,
        model,
        repository,
      }),
    [agent, customEnd, customStart, data.events, model, period, repository],
  );

  async function reload() {
    if (!onReload || mode === "demo") return;
    setRefreshing(true);
    try {
      await onReload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink lg:flex">
      <Sidebar
        data={data}
        mode={mode}
        view={view}
        setView={(next) => {
          setView(next);
          setMobile(false);
        }}
        mobile={mobile}
        close={() => setMobile(false)}
      />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-black/10 bg-paper/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-black/10 p-2 lg:hidden"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu size={19} />
            </button>
            <div>
              <p className="eyebrow text-black/45">
                {mode === "real"
                  ? "Workspace pessoal"
                  : "Ambiente de demonstração"}
              </p>
              <h1 className="text-lg font-bold tracking-tight">
                {nav.find((item) => item.id === view)?.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              disabled={mode === "demo" || refreshing}
              onClick={reload}
              className="hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 sm:flex"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              {mode === "demo" ? "Dados de exemplo" : "Atualizar dados"}
            </button>
            <button
              onClick={() => setPairing(true)}
              className="flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-coral"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Adicionar computador</span>
              <span className="sm:hidden">Adicionar</span>
            </button>
            <Avatar data={data} />
          </div>
        </header>

        {mode === "demo" && (
          <div className="border-b border-amber-300 bg-amber-100 px-5 py-2 text-center text-xs font-bold text-amber-900">
            DEMONSTRAÇÃO — dados, dispositivos e pareamento abaixo são simulados
            e não são persistidos.
          </div>
        )}

        <div className="mx-auto max-w-[1440px] p-5 sm:p-8">
          {view === "overview" && (
            <Overview
              data={data}
              events={filteredEvents}
              period={period}
              setPeriod={setPeriod}
              customStart={customStart}
              setCustomStart={setCustomStart}
              customEnd={customEnd}
              setCustomEnd={setCustomEnd}
              agent={agent}
              setAgent={setAgent}
              model={model}
              setModel={setModel}
              repository={repository}
              setRepository={setRepository}
              mode={mode}
            />
          )}
          {view === "rankings" && (
            <Rankings mode={mode} leaderboard={leaderboard} />
          )}
          {view === "devices" && (
            <Devices
              devices={data.devices}
              mode={mode}
              accessToken={accessToken}
              onPair={() => setPairing(true)}
              onReload={reload}
            />
          )}
          {view === "privacy" && (
            <Privacy
              data={data}
              mode={mode}
              accessToken={accessToken}
              onReload={reload}
            />
          )}
        </div>
      </main>
      {pairing && (
        <PairingModal
          mode={mode}
          accessToken={accessToken}
          close={() => setPairing(false)}
        />
      )}
    </div>
  );
}

function Avatar({ data }: { data: DashboardData }) {
  if (data.profile.avatarUrl)
    return (
      <div
        role="img"
        aria-label="Avatar do perfil"
        className="h-9 w-9 rounded-full bg-cover bg-center ring-2 ring-white"
        style={{ backgroundImage: `url(${data.profile.avatarUrl})` }}
      />
    );
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-acid text-xs font-black ring-2 ring-white">
      {data.profile.displayName.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Sidebar({
  data,
  mode,
  view,
  setView,
  mobile,
  close,
}: {
  data: DashboardData;
  mode: Mode;
  view: View;
  setView: (view: View) => void;
  mobile: boolean;
  close: () => void;
}) {
  const monthTotal = data.events
    .filter(
      (event) =>
        new Date(event.occurredAt).getMonth() === new Date().getMonth(),
    )
    .reduce((sum, event) => sum + event.total, 0);
  return (
    <>
      <aside
        className={`${mobile ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-black/10 bg-[#efeee9] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
      >
        <div className="mb-10 flex items-center justify-between px-2 pt-1">
          <button
            onClick={() => setView("overview")}
            className="flex items-center gap-3"
          >
            <span className="grid h-9 w-9 -rotate-3 place-items-center rounded-xl bg-coral text-white shadow-[3px_3px_0_#171717]">
              <Zap size={20} fill="currentColor" />
            </span>
            <span className="text-xl font-black tracking-[-.05em]">
              tokentômetro
            </span>
          </button>
          <button
            className="lg:hidden"
            onClick={close}
            aria-label="Fechar menu"
          >
            <X />
          </button>
        </div>
        <nav className="space-y-1">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${view === id ? "bg-white shadow-sm" : "text-black/55 hover:bg-white/60 hover:text-black"}`}
            >
              <Icon size={18} />
              {label}
              {id === "rankings" && mode === "demo" && (
                <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-black">
                  DEMO
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-8 border-t border-black/10 pt-6">
          <p className="eyebrow mb-3 px-3 text-black/35">Seu consumo</p>
          <div className="rounded-2xl bg-ink p-4 text-white">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-white/55">MÊS ATUAL</span>
              <Sparkles size={15} className="text-acid" />
            </div>
            <p className="num text-2xl font-black">{format(monthTotal)}</p>
            <p className="mt-1 text-xs text-white/50">
              tokens reportados pela telemetria local
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center gap-3 rounded-xl p-2">
          <Avatar data={data} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {data.profile.displayName}
            </p>
            <p className="truncate text-xs text-black/40">
              @{data.profile.githubHandle}
            </p>
          </div>
          <button
            aria-label="Sair"
            onClick={async () => {
              await getSupabaseBrowser()?.auth.signOut();
              window.location.assign("/login");
            }}
            className="rounded-lg p-2 text-black/35 hover:bg-black/5"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-label="Fechar menu"
        />
      )}
    </>
  );
}

function Filter({
  value,
  options,
  set,
}: {
  value: string;
  options: string[];
  set: (value: string) => void;
}) {
  return (
    <label className="relative">
      <select
        value={value}
        onChange={(event) => set(event.target.value)}
        className="max-w-[210px] appearance-none rounded-xl border border-black/10 bg-white py-2.5 pl-3 pr-9 text-sm font-bold outline-none focus:ring-2 focus:ring-coral/30"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-3 text-black/40"
      />
    </label>
  );
}

function Overview({
  data,
  events,
  period,
  setPeriod,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  agent,
  setAgent,
  model,
  setModel,
  repository,
  setRepository,
  mode,
}: {
  data: DashboardData;
  events: DashboardEvent[];
  period: string;
  setPeriod: (value: string) => void;
  customStart: string;
  setCustomStart: (value: string) => void;
  customEnd: string;
  setCustomEnd: (value: string) => void;
  agent: string;
  setAgent: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  repository: string;
  setRepository: (value: string) => void;
  mode: Mode;
}) {
  const totals = events.reduce(
    (sum, event) => ({
      total: sum.total + event.total,
      input: sum.input + event.input,
      output: sum.output + event.output,
      cached: sum.cached + event.cached,
    }),
    { total: 0, input: 0, output: 0, cached: 0 },
  );
  const priced = events
    .map((event) => event.cost)
    .filter((cost): cost is number => cost !== null);
  const sessions = new Set(events.map((event) => event.sourceSessionHash)).size;
  const repositories = new Set(
    events
      .map((event) => event.repository)
      .filter((name) => name !== "Desconhecido"),
  ).size;
  const models = Array.from(
    new Set(
      data.events
        .map((event) => event.model)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort();
  const repos = Array.from(
    new Set(data.events.map((event) => event.repository)),
  ).sort();

  return (
    <div className="enter space-y-7">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${mode === "real" ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <span
              className={`eyebrow ${mode === "real" ? "text-emerald-700" : "text-amber-700"}`}
            >
              {mode === "real" ? "Dados persistidos" : "Fixtures sanitizadas"}
            </span>
          </div>
          <h2 className="max-w-2xl text-3xl font-black tracking-[-.055em] sm:text-4xl">
            Veja onde seus tokens
            <br className="hidden sm:block" /> estão trabalhando.
          </h2>
          <p className="mt-2 text-sm text-black/45">
            Dados carregados em {dateTimeLabel(data.loadedAt)} ·{" "}
            {data.devices.filter((device) => !device.revokedAt).length}{" "}
            computador(es) ativo(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Filter
            value={period}
            set={setPeriod}
            options={[
              "Hoje",
              "7 dias",
              "30 dias",
              "Personalizado",
              "Todo o período",
            ]}
          />
          {period === "Personalizado" && (
            <>
              <label className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/45">
                De{" "}
                <input
                  aria-label="Início do período"
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="ml-2 bg-transparent text-sm text-ink outline-none"
                />
              </label>
              <label className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/45">
                Até{" "}
                <input
                  aria-label="Fim do período"
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="ml-2 bg-transparent text-sm text-ink outline-none"
                />
              </label>
            </>
          )}
          <Filter
            value={agent}
            set={setAgent}
            options={[
              "Todos os agentes",
              "Codex",
              "Claude Code",
              "Antigravity",
            ]}
          />
          <Filter
            value={model}
            set={setModel}
            options={["Todos os modelos", ...models]}
          />
          <Filter
            value={repository}
            set={setRepository}
            options={["Todos os repositórios", ...repos]}
          />
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Tokens reportados"
          value={format(totals.total)}
          icon={Zap}
          accent
        />
        <Metric
          label="Tokens em cache"
          value={format(totals.cached)}
          sub={`${totals.input ? Math.round((totals.cached / totals.input) * 100) : 0}% da entrada`}
          icon={Database}
        />
        <Metric
          label="Sessões"
          value={String(sessions)}
          sub={`em ${repositories} repositório(s)`}
          icon={Code2}
        />
        <Metric
          label="Custo equivalente estimado"
          value={
            priced.length
              ? money(priced.reduce((sum, cost) => sum + cost, 0))
              : "Sem preço"
          }
          sub="não é sua cobrança real"
          icon={CircleHelp}
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.55fr_.85fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-black/5 p-5 sm:p-6">
            <p className="eyebrow text-black/40">Atividade diária</p>
            <h3 className="mt-1 text-xl font-black">Ritmo de construção</h3>
          </div>
          <TokenChart events={events} />
        </div>
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow text-black/40">Por agente</p>
              <h3 className="mt-1 text-xl font-black">Quem fez o trabalho</h3>
            </div>
            <Cpu size={20} className="text-black/35" />
          </div>
          <AgentBreakdown events={events} />
        </div>
      </section>
      <RecentActivity events={events} />
      <p className="rounded-xl border border-black/10 bg-white/50 px-4 py-3 text-xs leading-relaxed text-black/50">
        <strong className="text-black/70">Sobre a comparação:</strong> os
        números do Codex são tokens reportados pela telemetria local do Codex,
        não medição oficial da OpenAI nem cobrança. Entrada em cache já pertence
        à entrada e raciocínio já pertence à saída; esses componentes não são
        somados novamente. Provedores podem usar semânticas diferentes.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Zap;
  accent?: boolean;
}) {
  return (
    <div className={`card p-5 ${accent ? "bg-coral text-white" : ""}`}>
      <div className="mb-7 flex items-start justify-between">
        <p
          className={`text-xs font-bold ${accent ? "text-white/70" : "text-black/45"}`}
        >
          {label}
        </p>
        <Icon
          size={17}
          className={accent ? "text-white/70" : "text-black/30"}
        />
      </div>
      <p className="num text-3xl font-black">{value}</p>
      {sub && (
        <p
          className={`mt-2 text-xs ${accent ? "text-white/60" : "text-black/40"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function TokenChart({ events }: { events: DashboardEvent[] }) {
  const daily = Array.from(
    events
      .reduce((map, event) => {
        const key = event.occurredAt.slice(0, 10);
        const current = map.get(key) ?? {
          date: event.occurredAt,
          total: 0,
          cached: 0,
        };
        current.total += event.total;
        current.cached += event.cached;
        map.set(key, current);
        return map;
      }, new Map<string, { date: string; total: number; cached: number }>())
      .values(),
  ).sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(...daily.map((item) => item.total), 1);
  if (!daily.length)
    return <EmptyState text="Nenhuma atividade corresponde aos filtros." />;
  return (
    <div className="grid-noise flex h-[290px] items-end gap-2 p-5 pt-9 sm:gap-4 sm:p-7">
      {daily.map((item) => (
        <div
          key={item.date}
          className="group flex min-w-0 flex-1 flex-col items-center justify-end"
        >
          <div className="relative flex w-full items-end justify-center gap-1">
            <div className="absolute -top-12 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[10px] font-bold text-white group-hover:block">
              {format(item.total)} tokens
            </div>
            <div
              className="w-[42%] max-w-8 rounded-t-md bg-coral"
              style={{ height: Math.max((item.total / max) * 205, 3) }}
            />
            <div
              className="w-[28%] max-w-5 rounded-t-md bg-acid ring-1 ring-black/10"
              style={{
                height: Math.max(
                  (item.cached / max) * 205,
                  item.cached ? 3 : 0,
                ),
              }}
            />
          </div>
          <span className="mt-3 truncate text-[10px] font-bold text-black/40">
            {dateLabel(item.date)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AgentBreakdown({ events }: { events: DashboardEvent[] }) {
  const agents = Object.entries(agentNames).map(([key, name]) => ({
    name,
    total: events
      .filter((event) => event.agent === key)
      .reduce((sum, event) => sum + event.total, 0),
  }));
  const grand = agents.reduce((sum, item) => sum + item.total, 0) || 1;
  const colors = ["bg-coral", "bg-ink", "bg-acid"];
  return (
    <div className="mt-8 space-y-7">
      {agents.map((item, index) => (
        <div key={item.name}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">{item.name}</span>
            <span className="num text-sm font-black">{format(item.total)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/5">
            <div
              className={`h-full rounded-full ${colors[index]}`}
              style={{ width: `${(item.total / grand) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentActivity({ events }: { events: DashboardEvent[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-black/5 p-5">
        <p className="eyebrow text-black/40">Metadados permitidos</p>
        <h3 className="mt-1 text-xl font-black">Atividade recente</h3>
      </div>
      {events.length ? (
        events.slice(0, 8).map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 border-b border-black/5 px-5 py-3.5 last:border-0"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/5">
              <Code2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{event.repository}</p>
              <p className="truncate text-xs text-black/40">
                {agentNames[event.agent]} ·{" "}
                {event.model ?? "Modelo desconhecido"}
              </p>
            </div>
            <div className="text-right">
              <p className="num text-sm font-black">{format(event.total)}</p>
              <p className="text-[10px] text-black/35">
                {dateLabel(event.occurredAt)}
              </p>
            </div>
          </div>
        ))
      ) : (
        <EmptyState text="Nenhum evento persistido para os filtros atuais." />
      )}
    </div>
  );
}

function Rankings({
  mode,
  leaderboard,
}: {
  mode: Mode;
  leaderboard?: LeaderboardRow[];
}) {
  if (mode === "real")
    return (
      <Unavailable
        title="Ranking público não conectado nesta fatia"
        text="A interface não apresenta dados simulados em uma sessão real. O ranking será habilitado quando a consulta pública consentida estiver ligada ao banco."
      />
    );
  return (
    <div className="enter">
      <div className="mb-6">
        <p className="eyebrow text-amber-700">Demonstração</p>
        <h2 className="mt-2 text-4xl font-black tracking-[-.05em]">
          Ranking ilustrativo
        </h2>
        <p className="mt-2 text-sm text-black/45">
          Estes nomes e totais são fixtures sanitizadas; não representam
          usuários autenticados.
        </p>
      </div>
      <div className="card overflow-hidden">
        {(leaderboard ?? []).map((row) => (
          <div
            key={row.rank}
            className="grid grid-cols-[50px_1fr_auto] items-center border-b border-black/5 p-5 last:border-0"
          >
            <span className="text-2xl font-black text-black/20">
              #{row.rank}
            </span>
            <p className="font-black">{row.name}</p>
            <p className="num font-black">{format(row.tokens)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Devices({
  devices,
  mode,
  accessToken,
  onPair,
  onReload,
}: {
  devices: DashboardDevice[];
  mode: Mode;
  accessToken?: string;
  onPair: () => void;
  onReload: () => Promise<void>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function revoke(id: string) {
    if (mode === "demo" || !accessToken) return;
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    const response = await fetch(`/api/v1/devices/${id}/revoke`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setError("Não foi possível revogar o dispositivo.");
      return;
    }
    setConfirmId(null);
    await onReload();
  }
  return (
    <div className="enter">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-coral">Coleta local</p>
          <h2 className="mt-2 text-4xl font-black tracking-[-.055em]">
            Seus computadores
          </h2>
          <p className="mt-2 text-sm text-black/45">
            {mode === "real"
              ? "Dispositivos persistidos no seu perfil."
              : "Dispositivos ilustrativos; nenhuma revogação será executada."}
          </p>
        </div>
        <button
          onClick={onPair}
          className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white"
        >
          <Plus size={17} />
          Adicionar computador
        </button>
      </div>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {devices.map((device) => (
          <div key={device.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black text-white">
                <Laptop size={21} />
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${device.revokedAt ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
              >
                {device.revokedAt ? "REVOGADO" : "● ATIVO"}
              </span>
            </div>
            <h3 className="mt-6 text-xl font-black">{device.name}</h3>
            <p className="mt-1 text-sm text-black/40">
              {device.platform} · coletor{" "}
              {device.collectorVersion ?? "desconhecido"}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
              <p className="text-xs text-black/40">
                Última sincronização{" "}
                <strong className="text-black/70">
                  {dateTimeLabel(device.lastSeenAt)}
                </strong>
              </p>
              {!device.revokedAt && (
                <button
                  disabled={mode === "demo"}
                  onClick={() => revoke(device.id)}
                  className="text-xs font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {mode === "demo"
                    ? "Simulado"
                    : confirmId === device.id
                      ? "Confirmar revogação"
                      : "Revogar"}
                </button>
              )}
            </div>
          </div>
        ))}
        {!devices.length && <EmptyState text="Nenhum computador pareado." />}
      </div>
    </div>
  );
}

function Privacy({
  data,
  mode,
  accessToken,
  onReload,
}: {
  data: DashboardData;
  mode: Mode;
  accessToken?: string;
  onReload: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  async function toggle() {
    if (mode === "demo" || !accessToken) return;
    setSaving(true);
    await fetch("/api/v1/profile", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        leaderboardOptIn: !data.profile.leaderboardOptIn,
      }),
    });
    await onReload();
    setSaving(false);
  }
  return (
    <div className="enter max-w-3xl">
      <div className="mb-7">
        <p className="eyebrow text-coral">Você no controle</p>
        <h2 className="mt-2 text-4xl font-black tracking-[-.055em]">
          Privacidade por padrão.
        </h2>
      </div>
      <div className="card divide-y divide-black/5">
        <Setting
          title="Aparecer no ranking público"
          text={
            mode === "real"
              ? "Preferência persistida no seu perfil. O ranking público ainda não está conectado."
              : "Controle ilustrativo desabilitado no modo demonstração."
          }
          value={data.profile.leaderboardOptIn}
          disabled={mode === "demo" || saving}
          action={toggle}
        />
        <Setting
          title="Política de repositórios"
          text="Configurada localmente durante `tokentometro setup`, antes de qualquer envio."
          value={false}
          disabled
          action={() => {}}
        />
      </div>
      <div className="card mt-5 flex gap-4 p-5">
        <LockKeyhole className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-sm leading-relaxed text-black/50">
          A API rejeita prompts, respostas, mensagens, código, credenciais e
          caminhos absolutos. Repositórios privados são ocultados ou
          anonimizados no coletor.
        </p>
      </div>
    </div>
  );
}

function Setting({
  title,
  text,
  value,
  disabled,
  action,
}: {
  title: string;
  text: string;
  value: boolean;
  disabled?: boolean;
  action: () => void;
}) {
  return (
    <div className="flex items-center gap-5 p-5">
      <div className="flex-1">
        <h3 className="font-black">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-black/45">{text}</p>
      </div>
      <button
        disabled={disabled}
        onClick={action}
        role="switch"
        aria-checked={value}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${value ? "bg-ink" : "bg-black/15"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${value ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}

function PairingModal({
  mode,
  accessToken,
  close,
}: {
  mode: Mode;
  accessToken?: string;
  close: () => void;
}) {
  const [code, setCode] = useState<string | null>(
    mode === "demo" ? "SHRIMP-42Q" : null,
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(
    mode === "demo" ? new Date(Date.now() + 10 * 60_000).toISOString() : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(600);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (mode === "demo") return;
    if (!accessToken) {
      setError("Sessão autenticada indisponível.");
      return;
    }
    fetch("/api/v1/pairing-codes", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ code: string; expiresAt: string }>;
      })
      .then((result) => {
        setCode(result.code);
        setExpiresAt(result.expiresAt);
      })
      .catch(() =>
        setError(
          "Não foi possível gerar o código. Verifique a configuração do servidor.",
        ),
      );
  }, [accessToken, mode]);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
        ),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  const time = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[24px] bg-paper p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-acid">
            <Laptop size={20} />
          </div>
          <button onClick={close} className="rounded-full p-2 hover:bg-black/5">
            <X size={19} />
          </button>
        </div>
        <p
          className={`eyebrow mt-6 ${mode === "demo" ? "text-amber-700" : "text-coral"}`}
        >
          {mode === "demo"
            ? "Código ilustrativo"
            : remaining
              ? `Expira em ${time}`
              : "Código expirado"}
        </p>
        <h2 className="mt-1 text-2xl font-black">Vincule seu computador</h2>
        <p className="mt-2 text-sm leading-relaxed text-black/50">
          Execute o comando abaixo. O código temporário e de uso único será
          solicitado separadamente.
        </p>
        {mode === "demo" && (
          <p className="mt-3 rounded-xl bg-amber-100 p-3 text-xs font-bold text-amber-900">
            Este fluxo apenas demonstra a validação. O dispositivo e as
            sincronizações não serão persistidos.
          </p>
        )}
        <pre className="mt-5 overflow-x-auto rounded-xl bg-ink p-4 text-xs text-acid">
          <code>npx tokentometro@beta setup</code>
        </pre>
        {error ? (
          <p className="mt-3 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : code ? (
          <button
            disabled={!remaining}
            onClick={() => {
              navigator.clipboard?.writeText(code);
              setCopied(true);
            }}
            className="mt-3 w-full rounded-xl border-2 border-dashed border-black/15 bg-white p-4 text-center disabled:opacity-40"
          >
            <span className="block text-xs font-bold text-black/35">
              {mode === "real"
                ? "CÓDIGO DE USO ÚNICO"
                : "CÓDIGO DE DEMONSTRAÇÃO"}
            </span>
            <strong className="num mt-1 block text-2xl tracking-[.18em]">
              {code}
            </strong>
            <span className="mt-1 block text-[10px] font-bold text-coral">
              {copied
                ? "COPIADO"
                : remaining
                  ? "CLIQUE PARA COPIAR"
                  : "EXPIRADO"}
            </span>
          </button>
        ) : (
          <div className="mt-3 h-24 animate-pulse rounded-xl bg-black/5" />
        )}
        <p className="mt-4 flex items-center gap-2 text-xs text-black/40">
          <ShieldCheck size={14} />O coletor mostra uma prévia local antes de
          perguntar sobre o primeiro envio.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card grid min-h-32 place-items-center p-8 text-center text-sm font-bold text-black/35">
      {text}
    </div>
  );
}
function Unavailable({ title, text }: { title: string; text: string }) {
  return (
    <div className="enter max-w-2xl">
      <p className="eyebrow text-black/35">Indisponível nesta entrega</p>
      <h2 className="mt-2 text-3xl font-black">{title}</h2>
      <p className="mt-3 leading-relaxed text-black/50">{text}</p>
    </div>
  );
}
