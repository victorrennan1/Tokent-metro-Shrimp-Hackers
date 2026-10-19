import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("database authorization boundaries", () => {
  const initial = readFileSync(
    resolve(
      process.cwd(),
      "../../supabase/migrations/202610180001_initial_schema.sql",
    ),
    "utf8",
  );
  const authenticatedFlow = readFileSync(
    resolve(
      process.cwd(),
      "../../supabase/migrations/202610180002_authenticated_flow.sql",
    ),
    "utf8",
  );
  const rateLimit = readFileSync(
    resolve(
      process.cwd(),
      "../../supabase/migrations/202610180004_persistent_ingest_rate_limit.sql",
    ),
    "utf8",
  );
  const realDashboard = readFileSync(
    resolve(process.cwd(), "src/components/real-dashboard.tsx"),
    "utf8",
  );
  const dashboardShell = readFileSync(
    resolve(process.cwd(), "src/components/dashboard.tsx"),
    "utf8",
  );

  it("scopes private tables to the authenticated profile", () => {
    expect(initial).toContain("using (auth.uid() = profile_id)");
    expect(initial).toContain("using (auth.uid() = id)");
    expect(initial).not.toMatch(/usage_events for select using \(true\)/i);
  });

  it("keeps atomic pairing unavailable to browser roles", () => {
    expect(authenticatedFlow).toContain(
      "revoke all on function public.exchange_pairing_code",
    );
    expect(authenticatedFlow).toContain(
      "grant execute on function public.exchange_pairing_code",
    );
    expect(authenticatedFlow).toContain("to service_role");
  });

  it("keeps the persistent ingest limiter server-only", () => {
    expect(rateLimit).toContain("consume_device_ingest_rate_limit");
    expect(rateLimit).toContain(
      "revoke all on function public.consume_device_ingest_rate_limit",
    );
    expect(rateLimit).toContain("to service_role");
    expect(rateLimit).toContain(
      "revoke all privileges on table public.ingest_rate_limits from anon, authenticated",
    );
  });

  it("keeps production dashboard code independent from demo fixtures", () => {
    expect(realDashboard).not.toContain("demo-data");
    expect(dashboardShell).not.toContain("demo-data");
  });

  it("shows the public beta command without embedding the one-time pairing code", () => {
    expect(dashboardShell).toContain(
      "<code>npx tokentometro@beta setup</code>",
    );
    expect(dashboardShell).not.toContain("--pairing-code");
    expect(dashboardShell).toContain("código temporário e de uso único");
    expect(dashboardShell).toContain("prévia local");
  });
});
