import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, sha256 } from "@/lib/supabase-admin";

const deviceName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N} _.-]+$/u);
const requestSchema = z
  .object({
    pairingCode: z.string().trim().min(6).max(24),
    name: deviceName,
    platform: z.string().trim().min(1).max(32),
    collectorVersion: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[0-9A-Za-z.+-]+$/),
    sessionHashVersion: z.literal(1),
  })
  .strict();

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { sessionHashVersion?: unknown }).sessionHashVersion !== 1
  ) {
    return NextResponse.json(
      { error: "collector_upgrade_required" },
      { status: 426 },
    );
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: "invalid_pairing_request" },
      { status: 400 },
    );
  const admin = getSupabaseAdmin();
  const deviceToken = `ttm_${randomBytes(32).toString("base64url")}`;
  if (!admin) {
    if (parsed.data.pairingCode.toUpperCase() !== "SHRIMP-42Q")
      return NextResponse.json(
        { error: "pairing_code_invalid_or_expired", demoHint: "SHRIMP-42Q" },
        { status: 401 },
      );
    return NextResponse.json({
      deviceToken,
      sessionHashKey: randomBytes(32).toString("hex"),
      mode: "demo",
      persisted: false,
    });
  }
  const secret = process.env.PAIRING_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("replace-"))
    return NextResponse.json(
      { error: "pairing_secret_not_configured" },
      { status: 503 },
    );
  const codeHash = await sha256(
    `${secret}:${parsed.data.pairingCode.toUpperCase()}`,
  );
  const { data: pairing, error } = await admin.rpc("exchange_pairing_code_v2", {
    p_code_hash: codeHash,
    p_token_hash: await sha256(deviceToken),
    p_name: parsed.data.name,
    p_platform: parsed.data.platform,
    p_collector_version: parsed.data.collectorVersion,
  });
  if (error)
    return NextResponse.json(
      { error: "device_creation_failed" },
      { status: 503 },
    );
  if (!pairing)
    return NextResponse.json(
      { error: "pairing_code_invalid_expired_or_used" },
      { status: 401 },
    );
  if (
    typeof pairing !== "object" ||
    typeof pairing.deviceId !== "string" ||
    typeof pairing.sessionHashKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(pairing.sessionHashKey)
  ) {
    return NextResponse.json({ error: "pairing_response_invalid" }, { status: 503 });
  }
  return NextResponse.json({
    deviceToken,
    deviceId: pairing.deviceId,
    sessionHashKey: pairing.sessionHashKey,
  });
}
