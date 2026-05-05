import { createClient } from "@/lib/supabase/client";
import {
  achievementBadgeSchema,
  achievementBadgeUpdateSchema,
} from "@/lib/schemas/achievement.schema";

export type AchievementCriterionType =
  | "first_order"
  | "orders_threshold"
  | "cities_visited"
  | "all_establishments_visited"
  | "consecutive_weekly_quests"
  | "establishments_threshold";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";
export type EvaluationMode = "realtime" | "cron";

export interface AchievementBadge {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  lore: string | null;
  icon: string | null;
  rarity: BadgeRarity | null;
  category: "achievement";
  criterion_type: AchievementCriterionType | null;
  criterion_params: Record<string, unknown>;
  evaluation_mode: EvaluationMode;
  archived_at: string | null;
  created_at: string | null;
}

export interface AchievementBadgePayload {
  slug: string;
  name: string;
  description?: string | null;
  lore?: string | null;
  icon?: string | null;
  rarity: BadgeRarity;
  criterion_type: AchievementCriterionType;
  criterion_params: Record<string, unknown>;
  evaluation_mode: EvaluationMode;
}

export async function listAchievementBadges(): Promise<AchievementBadge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("badge_types")
    .select(
      "id, slug, name, description, lore, icon, rarity, category, criterion_type, criterion_params, evaluation_mode, archived_at, created_at",
    )
    .eq("category", "achievement")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as AchievementBadge[];
}

export async function getAchievementBadge(id: number): Promise<AchievementBadge | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("badge_types")
    .select(
      "id, slug, name, description, lore, icon, rarity, category, criterion_type, criterion_params, evaluation_mode, archived_at, created_at",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as AchievementBadge | null;
}

export async function createAchievementBadge(
  payload: AchievementBadgePayload,
): Promise<AchievementBadge> {
  achievementBadgeSchema.parse(payload);
  const supabase = createClient();
  const insertPayload = {
    slug: payload.slug,
    name: payload.name,
    description: payload.description ?? null,
    lore: payload.lore ?? null,
    icon: payload.icon ?? null,
    rarity: payload.rarity,
    category: "achievement" as const,
    criterion_type: payload.criterion_type,
    criterion_params: payload.criterion_params,
    evaluation_mode: payload.evaluation_mode,
  };
  const { data, error } = await supabase
    .from("badge_types")
    .insert(insertPayload as never)
    .select()
    .single();
  if (error) throw error;
  return data as AchievementBadge;
}

export async function updateAchievementBadge(
  id: number,
  payload: Partial<AchievementBadgePayload>,
): Promise<AchievementBadge> {
  achievementBadgeUpdateSchema.parse(payload);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("badge_types")
    .update({ ...payload } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as AchievementBadge;
}

/**
 * Soft-delete : archivage pour préserver l'historique user_badges.
 */
export async function archiveAchievementBadge(id: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("badge_types")
    .update({ archived_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Relance l'attribution du badge à tous les clients éligibles
 * (post-création ou post-édition d'un critère).
 */
export async function reawardAchievementBadge(
  id: number,
): Promise<{ awarded_count: number }> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "award_achievements_for_all_for_badge",
    { p_badge_id: id },
  );
  if (error) throw error;
  return (data as { awarded_count: number }) ?? { awarded_count: 0 };
}
