import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, sha256 } from "@/lib/supabase-admin";

const requestSchema = z.object({
  pairingCode: z.string().trim().min(6).max(24),
  name: z.string().trim().min(1).max(80),
  platform: z.string().trim().min(1).max(32)
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_pairing_request" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const deviceToken = `ttm_${randomBytes(32).toString("base64url")}`;
  if (!admin) {
    if (parsed.data.pairingCode.toUpperCase() !== "SHRIMP-42Q") return NextResponse.json({ error: "pairing_code_invalid_or_expired", demoHint: "SHRIMP-42Q" }, { status: 401 });
    return NextResponse.json({ deviceToken, mode: "demo", persisted: false });
  }
  const secret = process.env.PAIRING_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-")) return NextResponse.json({ error: "pairing_secret_not_configured" }, { status: 503 });
  const codeHash = await sha256(`${secret}:${parsed.data.pairingCode.toUpperCase()}`);
  const { data: deviceId, error } = await admin.rpc("exchange_pairing_code", {
    p_code_hash: codeHash,
    p_token_hash: await sha256(deviceToken),
    p_name: parsed.data.name,
    p_platform: parsed.data.platform,
    p_collector_version: "0.1.0"
  });
  if (error) return NextResponse.json({ error: "device_creation_failed" }, { status: 503 });
  if (!deviceId) return NextResponse.json({ error: "pairing_code_invalid_expired_or_used" }, { status: 401 });
  return NextResponse.json({ deviceToken, deviceId });
}

