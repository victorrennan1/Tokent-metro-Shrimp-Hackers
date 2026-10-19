import { DemoDashboard } from "@/components/demo-dashboard";
import { RealDashboard } from "@/components/real-dashboard";

export default function Page() {
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configured = Boolean(url && publicKey && secretKey
    && !url.includes("your-project") && !publicKey.includes("replace-me") && !secretKey.includes("replace-me"));
  return configured ? <RealDashboard /> : <DemoDashboard />;
}
