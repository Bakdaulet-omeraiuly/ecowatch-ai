import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null when not configured — callers fall back to local-only mode gracefully.
export const supabase = url && key ? createClient(url, key) : null;

export interface ReportRow {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  district: string | null;
  risk_score: number;
  risk_level: string;
  mosquito_index: number;
  analysis: unknown; // AnalysisResult JSON
  image_url: string | null;
  photo_thumb: string | null;
  verification_status: string | null;
  created_at: string;
}
