import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { apiErrorResponse, ApiError, requireAuthenticatedProfile } from "@/lib/server-auth";

const updateSchema = z.object({ leaderboardOptIn: z.boolean() }).strict();

export async function PATCH(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "invalid_profile_update");
    const admin = getSupabaseAdmin()!;
    const { data, error } = await admin.from("profiles")
      .update({ leaderboard_opt_in: parsed.data.leaderboardOptIn })
      .eq("id", profile.id)
      .select("leaderboard_opt_in")
      .single();
    if (error || !data) throw new ApiError(503, "profile_update_failed");
    return Response.json({ leaderboardOptIn: data.leaderboard_opt_in });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
