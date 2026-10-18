import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ status: "ok", mode: getSupabaseAdmin() ? "supabase" : "demo", schemaVersion: 1 }); }

