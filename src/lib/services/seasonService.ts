import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { seasonClosureSchema } from "@/lib/schemas/seasonClosure.schema";

export type SeasonClosureStep = "snapshot" | "award_badges" | "reset";
export type SeasonClosureSource = "cron" | "cron_fallback" | "manual" | "dry_run_aborted";

export type SeasonClosureLog = Database["public"]["Tables"]["season_closure_log"]["Row"];
export type SeasonSnapshot = Database["public"]["Tables"]["season_snapshots"]["Row"];

export interface SeasonClosurePreview {
  year: number;
  total_profiles: number;
  rank_distribution: Record<string, number>;
  total_pdb_earned_cents: number;
  snapshot_done: boolean;
  badges_done: boolean;
  reset_done: boolean;
}

export interface SeasonStepResult {
  success: boolean;
  year: number;
  skipped?: boolean;
  reason?: string;
  snapshotted?: number;
  badges_awarded?: number;
  profiles_reset?: number;
  duration_ms?: number;
}

/**
 * Dry-run : retourne la distribution simulée des rangs et l'état d'avancement.
 * Aucune écriture en base.
 */
export async function previewSeasonClosure(year: number): Promise<SeasonClosurePreview> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("preview_season_closure", {
    p_year: year,
  });
  if (error) throw error;
  return data as SeasonClosurePreview;
}

/**
 * Étape 1/3 : fige le rang max de chaque Compagnon dans season_snapshots.
 * Idempotente.
 */
export async function snapshotSeason(year: number): Promise<SeasonStepResult> {
  const input = seasonClosureSchema.parse({ year, source: "manual" });
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("snapshot_season", {
    p_year: input.year,
    p_source: input.source,
  });
  if (error) throw error;
  return data as SeasonStepResult;
}

/**
 * Étape 2/3 : distribue les badges « mémoire de saison » selon le rang figé.
 * Garde sur prérequis : le snapshot doit avoir été exécuté.
 */
export async function awardSeasonRankBadges(year: number): Promise<SeasonStepResult> {
  const input = seasonClosureSchema.parse({ year, source: "manual" });
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("award_season_rank_badges", {
    p_year: input.year,
    p_source: input.source,
  });
  if (error) throw error;
  return data as SeasonStepResult;
}

/**
 * Étape 3/3 : remet les coefficients cashback à 1,0 pour la saison suivante.
 * Garde sur prérequis : les badges doivent avoir été distribués.
 * PdB et badges déjà attribués ne sont PAS touchés.
 */
export async function resetSeason(year: number): Promise<SeasonStepResult> {
  const input = seasonClosureSchema.parse({ year, source: "manual" });
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("reset_season", {
    p_year: input.year,
    p_source: input.source,
  });
  if (error) throw error;
  return data as SeasonStepResult;
}

/**
 * Récupère le journal des étapes de clôture pour une année (ou toutes si non spécifiée).
 */
export async function getSeasonClosureLog(year?: number): Promise<SeasonClosureLog[]> {
  const supabase = createClient();
  let query = supabase
    .from("season_closure_log")
    .select("*")
    .order("year", { ascending: false })
    .order("executed_at", { ascending: false });
  if (year !== undefined) {
    query = query.eq("year", year);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as SeasonClosureLog[];
}

/**
 * Récupère les snapshots d'une saison (avec rang/XP figé pour chaque Compagnon).
 */
export async function getSeasonSnapshots(year: number): Promise<SeasonSnapshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("season_snapshots")
    .select("*")
    .eq("year", year)
    .order("max_level", { ascending: false });
  if (error) throw error;
  return data as SeasonSnapshot[];
}
