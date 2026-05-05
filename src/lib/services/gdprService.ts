import { createClient } from "@/lib/supabase/client";
import type { GdprRequest, Profile } from "@/types/database";

export interface GdprRequestWithProfile extends GdprRequest {
  profiles: Pick<Profile, "first_name" | "last_name" | "email"> | null;
}

export async function getGdprRequests(
  limit = 20,
  offset = 0,
  statusFilter?: string
): Promise<{ data: GdprRequestWithProfile[]; count: number }> {
  const supabase = createClient();

  let query = supabase
    .from("gdpr_requests")
    .select("*, profiles!user_id(first_name, last_name, email)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching GDPR requests:", error.message, error);
    throw error;
  }

  return { data: (data || []) as GdprRequestWithProfile[], count: count || 0 };
}

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as any)("gdpr_export_user_data", {
    target_user_id: userId,
  });

  if (error) {
    console.error("Error exporting user data:", error);
    throw error;
  }

  return data;
}

export async function anonymizeUser(userId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await (supabase.rpc as any)("gdpr_anonymize_user", {
    target_user_id: userId,
  });

  if (error) {
    console.error("Error anonymizing user:", error);
    throw error;
  }
}

export async function updateGdprRequestStatus(
  requestId: string,
  status: string,
  notes?: string
): Promise<void> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {
    status,
    processed_at: new Date().toISOString(),
  };

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const { error } = await supabase
    .from("gdpr_requests")
    .update(updateData as never)
    .eq("id", requestId);

  if (error) {
    console.error("Error updating GDPR request:", error);
    throw error;
  }
}
