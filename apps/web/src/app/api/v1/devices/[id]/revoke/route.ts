import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { apiErrorResponse, ApiError, requireAuthenticatedProfile } from "@/lib/server-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireAuthenticatedProfile(request);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, "invalid_device_id");
    const admin = getSupabaseAdmin()!;
    const { data, error } = await admin.from("devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("profile_id", profile.id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw new ApiError(503, "device_revocation_failed");
    if (!data) throw new ApiError(404, "device_not_found_or_already_revoked");
    return Response.json({ revoked: true, deviceId: data.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
