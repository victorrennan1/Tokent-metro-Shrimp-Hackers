import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AuthenticatedProfile = {
  id: string;
  githubHandle: string;
  displayName: string;
  avatarUrl: string | null;
  leaderboardOptIn: boolean;
};

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "user_auth_required");
  return token;
}

function profileFromUser(user: User) {
  const metadata = user.user_metadata ?? {};
  const handle = String(metadata.user_name ?? metadata.preferred_username ?? `user-${user.id.slice(0, 8)}`).slice(0, 64);
  const displayName = String(metadata.full_name ?? metadata.name ?? handle).slice(0, 80);
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
  const providerId = metadata.provider_id ?? user.identities?.[0]?.identity_data?.sub;
  const githubUserId = typeof providerId === "string" && /^\d+$/.test(providerId) ? providerId : null;
  return { id: user.id, github_user_id: githubUserId, github_handle: handle, display_name: displayName, avatar_url: avatarUrl };
}

export async function requireAuthenticatedProfile(request: Request): Promise<AuthenticatedProfile> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ApiError(503, "supabase_not_configured");
  const token = getBearerToken(request);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new ApiError(401, "user_auth_invalid");

  const { data: existing, error: selectError } = await admin.from("profiles")
    .select("id,github_handle,display_name,avatar_url,leaderboard_opt_in")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (selectError) throw new ApiError(503, "profile_read_failed");

  let row = existing;
  if (!row) {
    const { error: insertError } = await admin.from("profiles")
      .upsert(profileFromUser(auth.user), { onConflict: "id", ignoreDuplicates: true });
    if (insertError) throw new ApiError(503, "profile_creation_failed");
    const { data: created, error: createdError } = await admin.from("profiles")
      .select("id,github_handle,display_name,avatar_url,leaderboard_opt_in")
      .eq("id", auth.user.id)
      .single();
    if (createdError) throw new ApiError(503, "profile_creation_failed");
    row = created;
  }
  if (!row) throw new ApiError(503, "profile_creation_failed");

  return {
    id: row.id,
    githubHandle: row.github_handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    leaderboardOptIn: row.leaderboard_opt_in
  };
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.code }, { status: error.status });
  return Response.json({ error: "internal_error" }, { status: 500 });
}

