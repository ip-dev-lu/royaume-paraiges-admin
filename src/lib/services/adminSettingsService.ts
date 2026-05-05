import { createClient } from "@/lib/supabase/client";
import type { AdminSetting } from "@/types/database";

/**
 * Accès à la table `admin_settings` (migration 020). RLS admin-only : le
 * contrôle d'accès est délégué à PostgreSQL, pas de vérification ici.
 */

// Clés typées connues de la PR prévention quêtes redondantes
export const SETTING_KEYS = {
  QUEST_ALERT_RATIO_PCT: "quest_alert_ratio_pct",
  QUEST_REFERENCE_PRICES_CENTS: "quest_reference_prices_cents",
} as const;

export type QuestReferencePrices = {
  biere?: number;
  cocktail?: number;
  alcool?: number;
  soft?: number;
  boisson_chaude?: number;
  restauration?: number;
};

export async function getAllAdminSettings(): Promise<AdminSetting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("*")
    .order("key");
  if (error) throw error;
  return (data || []) as AdminSetting[];
}

export async function getAdminSetting(key: string): Promise<AdminSetting | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as AdminSetting | null) ?? null;
}

export async function updateAdminSetting(key: string, value: unknown): Promise<AdminSetting> {
  const supabase = createClient();
  const payload = { value: value as never, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("admin_settings")
    .update(payload as never)
    .eq("key", key)
    .select()
    .single();
  if (error) throw error;
  return data as AdminSetting;
}

/**
 * Helper typé : récupère le seuil de ratio en pourcentage (entier).
 * Fallback 10 si la clé n'existe pas ou si la valeur est invalide.
 */
export async function getQuestAlertRatioPct(): Promise<number> {
  const setting = await getAdminSetting(SETTING_KEYS.QUEST_ALERT_RATIO_PCT);
  const raw = setting?.value;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  return 10;
}

/**
 * Helper typé : récupère le dict de prix de référence par consumption_type
 * (valeurs en centimes). Fallback vide si la clé n'existe pas.
 */
export async function getQuestReferencePrices(): Promise<QuestReferencePrices> {
  const setting = await getAdminSetting(SETTING_KEYS.QUEST_REFERENCE_PRICES_CENTS);
  if (!setting || !setting.value || typeof setting.value !== "object") return {};
  return setting.value as QuestReferencePrices;
}

/**
 * Vue `avg_ticket_12m` (migration 020) — panier moyen en centimes sur les 12
 * derniers mois, hors comptes `is_test`.
 */
export interface AvgTicket12m {
  avg_ticket_cents: number;
  sample_size: number;
}

export async function getAvgTicket12m(): Promise<AvgTicket12m> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("avg_ticket_12m")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { avg_ticket_cents: 0, sample_size: 0 };
  return data as AvgTicket12m;
}
