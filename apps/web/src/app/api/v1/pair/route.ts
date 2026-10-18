import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, sha256 } from "@/lib/supabase-admin";

const requestSchema = z.object({ pairingCode: z.string().trim().min(6).max(24), name: z.string().trim().min(1).max(80), platform: z.string().trim().min(1).max(32), fallbackSecret: z.string().optional() }).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_pairing_request" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const deviceToken = `ttm_${randomBytes(32).toString("base64url")}`;
  if (!admin) {
    if (parsed.data.pairingCode.toUpperCase() !== "SHRIMP-42Q") return NextResponse.json({ error: "pairing_code_invalid_or_expired", demoHint: "SHRIMP-42Q" }, { status: 401 });
    return NextResponse.json({ deviceToken, mode: "demo" });
  }
  const codeHash = await sha256(`${process.env.PAIRING_SECRET ?? ""}:${parsed.data.pairingCode.toUpperCase()}`);
  const { data: code, error } = await admin.from("pairing_codes").select("id,profile_id,expires_at,used_at").eq("code_hash", codeHash).maybeSingle();
  if (error || !code || code.used_at || new Date(code.expires_at) <= new Date()) return NextResponse.json({ error: "pairing_code_invalid_or_expired" }, { status: 401 });
  const { data: device, error: deviceError } = await admin.from("devices").insert({ profile_id: code.profile_id, name: parsed.data.name, platform: parsed.data.platform, token_hash: await sha256(deviceToken), collector_version: "0.1.0" }).select("id").single();
  if (deviceError || !device) return NextResponse.json({ error: "device_creation_failed" }, { status: 500 });
  await admin.from("pairing_codes").update({ used_at: new Date().toISOString() }).eq("id", code.id).is("used_at", null);
  return NextResponse.json({ deviceToken, deviceId: device.id });
}

