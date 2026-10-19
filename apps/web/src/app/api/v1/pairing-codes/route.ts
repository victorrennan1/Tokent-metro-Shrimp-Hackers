import { randomInt } from "node:crypto";
import { getSupabaseAdmin, sha256 } from "@/lib/supabase-admin";
import { apiErrorResponse, ApiError, requireAuthenticatedProfile } from "@/lib/server-auth";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function createCode() {
  const raw = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export async function POST(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request);
    const secret = process.env.PAIRING_SECRET;
    if (!secret || secret.length < 32 || secret.startsWith("replace-")) throw new ApiError(503, "pairing_secret_not_configured");
    const code = createCode();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const admin = getSupabaseAdmin()!;
    const { error } = await admin.from("pairing_codes").insert({
      profile_id: profile.id,
      code_hash: await sha256(`${secret}:${code}`),
      expires_at: expiresAt
    });
    if (error) throw new ApiError(503, "pairing_code_creation_failed");
    return Response.json({ code, expiresAt });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

