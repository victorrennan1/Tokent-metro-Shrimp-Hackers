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
import { DELETE } from "./route";

const deviceId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";

function adminReturning(data: { id: string } | null) {
  const filters: Array<[string, ...unknown[]]> = [];
  const query = {
    eq: vi.fn((key: string, value: string) => { filters.push([key, value]); return query; }),
    not: vi.fn((key: string, operator: string, value: null) => { filters.push([key, operator, value]); return query; }),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null }))
  };
  return { admin: { from: vi.fn(() => ({ delete: vi.fn(() => query) })) }, filters };
}

describe("device deletion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfile.mockResolvedValue({ id: profileId });
  });

  it("deletes only a revoked device owned by the authenticated profile", async () => {
    const store = adminReturning({ id: deviceId });
    mocks.getAdmin.mockReturnValue(store.admin);
    const response = await DELETE(new Request("http://localhost/api/v1/devices/id", { method: "DELETE" }), { params: Promise.resolve({ id: deviceId }) });
    expect(response.status).toBe(200);
    expect(store.filters).toContainEqual(["id", deviceId]);
    expect(store.filters).toContainEqual(["profile_id", profileId]);
    expect(store.filters).toContainEqual(["revoked_at", "is", null]);
  });

  it("does not reveal another profile's or active device", async () => {
    const store = adminReturning(null);
    mocks.getAdmin.mockReturnValue(store.admin);
    const response = await DELETE(new Request("http://localhost/api/v1/devices/id", { method: "DELETE" }), { params: Promise.resolve({ id: deviceId }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "device_not_found_or_not_revoked" });
  });
});
