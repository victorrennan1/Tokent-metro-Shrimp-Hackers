import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  sha256: vi.fn(async (value: string) => `hashed:${value}`),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: mocks.getAdmin,
  sha256: mocks.sha256,
}));
import { POST } from "./route";

const request = (pairingCode = "ABCD-EFGH") =>
  new Request("http://localhost/api/v1/pair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pairingCode,
      name: "Test device",
      platform: "win32",
      collectorVersion: "0.1.0-beta.1",
    }),
  });

describe("device pairing route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAIRING_SECRET = "a-secure-test-secret-with-32-characters";
  });

  it("exchanges a valid code without sending its clear value to Postgres", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: "11111111-1111-4111-8111-111111111111",
        error: null,
      });
    mocks.getAdmin.mockReturnValue({ rpc });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "exchange_pairing_code",
      expect.objectContaining({
        p_code_hash: expect.stringContaining("hashed:"),
        p_collector_version: "0.1.0-beta.1",
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('"ABCD-EFGH"');
  });

  it("rejects a device name that could contain a local path", async () => {
    const unsafe = new Request("http://localhost/api/v1/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pairingCode: "ABCD-EFGH",
        name: "C:\\Users\\private",
        platform: "win32",
        collectorVersion: "0.1.0-beta.1",
      }),
    });
    expect((await POST(unsafe)).status).toBe(400);
    expect(mocks.getAdmin).not.toHaveBeenCalled();
  });

  it.each(["expired", "reused"])("rejects an %s code", async () => {
    mocks.getAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "pairing_code_invalid_expired_or_used",
    });
  });

  it("labels demo pairing as non-persistent", async () => {
    mocks.getAdmin.mockReturnValue(null);
    const response = await POST(request("SHRIMP-42Q"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ mode: "demo", persisted: false }),
    );
  });
});
