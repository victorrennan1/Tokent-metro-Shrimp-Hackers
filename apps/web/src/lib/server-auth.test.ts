import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: mocks.getAdmin }));
import { requireAuthenticatedProfile } from "./server-auth";

describe("authenticated profile provisioning", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the GitHub profile once and reuses it idempotently", async () => {
    let stored: Record<string, unknown> | null = null;
    let inserts = 0;
    const admin = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111", user_metadata: { user_name: "builder", full_name: "Builder Test", avatar_url: "https://example.test/avatar.png", provider_id: "12345" }, identities: [] } }, error: null }) },
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: stored, error: null }),
          single: async () => ({ data: stored, error: null })
        }) }),
        upsert: async (row: Record<string, unknown>) => { inserts += 1; stored ??= { ...row, leaderboard_opt_in: false }; return { error: null }; }
      }))
    };
    mocks.getAdmin.mockReturnValue(admin);
    const request = new Request("http://localhost/api/v1/dashboard", { headers: { authorization: "Bearer user-token" } });
    const first = await requireAuthenticatedProfile(request);
    const second = await requireAuthenticatedProfile(request);
    expect(first).toEqual(second);
    expect(first).toEqual(expect.objectContaining({ githubHandle: "builder", displayName: "Builder Test" }));
    expect(inserts).toBe(1);
  });
});

