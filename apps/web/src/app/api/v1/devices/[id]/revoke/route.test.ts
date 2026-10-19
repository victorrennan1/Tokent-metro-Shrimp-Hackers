import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAdmin: vi.fn(), requireProfile: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: mocks.getAdmin }));
vi.mock("@/lib/server-auth", () => ({
  ApiError: class ApiError extends Error {
    constructor(public readonly status: number, public readonly code: string) { super(code); }
  },
  apiErrorResponse: (error: { status?: number; code?: string }) => Response.json({ error: error.code ?? "internal_error" }, { status: error.status ?? 500 }),
  requireAuthenticatedProfile: mocks.requireProfile
}));
import { POST } from "./route";

const deviceId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";

function adminReturning(data: { id: string } | null) {
  const filters: Array<[string, string]> = [];
  const query = {
    eq: vi.fn((key: string, value: string) => { filters.push([key, value]); return query; }),
    is: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null }))
  };
  return { admin: { from: vi.fn(() => ({ update: vi.fn(() => query) })) }, filters };
}

describe("device revocation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfile.mockResolvedValue({ id: profileId });
  });

  it("scopes revocation to both device and authenticated profile", async () => {
    const store = adminReturning({ id: deviceId });
    mocks.getAdmin.mockReturnValue(store.admin);
    const response = await POST(new Request("http://localhost/api/v1/devices/revoke", { method: "POST" }), { params: Promise.resolve({ id: deviceId }) });
    expect(response.status).toBe(200);
    expect(store.filters).toContainEqual(["id", deviceId]);
    expect(store.filters).toContainEqual(["profile_id", profileId]);
  });

  it("does not reveal whether a device belongs to another profile", async () => {
    const store = adminReturning(null);
    mocks.getAdmin.mockReturnValue(store.admin);
    const response = await POST(new Request("http://localhost/api/v1/devices/revoke", { method: "POST" }), { params: Promise.resolve({ id: deviceId }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "device_not_found_or_already_revoked" });
  });
});
