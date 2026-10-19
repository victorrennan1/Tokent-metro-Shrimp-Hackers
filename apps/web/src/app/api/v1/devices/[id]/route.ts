import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { apiErrorResponse, ApiError, requireAuthenticatedProfile } from "@/lib/server-auth";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireAuthenticatedProfile(request);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, "invalid_device_id");
    const admin = getSupabaseAdmin()!;
    const { data, error } = await admin.from("devices")
      .delete()
      .eq("id", id)
      .eq("profile_id", profile.id)
      .not("revoked_at", "is", null)
      .select("id")
      .maybeSingle();
    if (error) throw new ApiError(503, "device_deletion_failed");
    if (!data) throw new ApiError(404, "device_not_found_or_not_revoked");
    return Response.json({ deleted: true, deviceId: data.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
