import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { apiErrorResponse, requireAuthenticatedProfile } from "@/lib/server-auth";
import type { DashboardData } from "@/lib/dashboard-types";

export const dynamic = "force-dynamic";

function repositoryLabel(value: unknown): string {
  if (!value || typeof value !== "object") return "Desconhecido";
  const repository = value as { type?: unknown; canonicalName?: unknown };
  if (repository.type === "public" && typeof repository.canonicalName === "string") return repository.canonicalName;
  if (repository.type === "anonymous") return "Repositório privado";
  return "Desconhecido";
}

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request);
    const admin = getSupabaseAdmin()!;
    const [{ data: events, error: eventError }, { data: devices, error: deviceError }] = await Promise.all([
      admin.from("usage_events")
        .select("id,occurred_at,agent,model,repository_snapshot,input_tokens,output_tokens,cached_input_tokens,reasoning_tokens,total_tokens,estimated_cost_usd,source_session_hash")
        .eq("profile_id", profile.id)
        .order("occurred_at", { ascending: false })
        .limit(2000),
      admin.from("devices")
        .select("id,name,platform,collector_version,last_seen_at,revoked_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
    ]);
    if (eventError || deviceError) return Response.json({ error: "dashboard_read_failed" }, { status: 503 });

    const payload: DashboardData = {
      profile,
      events: (events ?? []).map((event) => ({
        id: event.id,
        occurredAt: event.occurred_at,
        agent: event.agent,
        model: event.model,
        repository: repositoryLabel(event.repository_snapshot),
        input: Number(event.input_tokens ?? 0),
        output: Number(event.output_tokens ?? 0),
        cached: Number(event.cached_input_tokens ?? 0),
        reasoning: Number(event.reasoning_tokens ?? 0),
        total: Number(event.total_tokens),
        cost: event.estimated_cost_usd == null ? null : Number(event.estimated_cost_usd),
        sourceSessionHash: event.source_session_hash
      })),
      devices: (devices ?? []).map((device) => ({
        id: device.id,
        name: device.name,
        platform: device.platform,
        collectorVersion: device.collector_version,
        lastSeenAt: device.last_seen_at,
        revokedAt: device.revoked_at
      })),
      loadedAt: new Date().toISOString()
    };
    return Response.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

