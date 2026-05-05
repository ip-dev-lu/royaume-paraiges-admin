import { z } from "zod";

export const seasonSourceSchema = z.enum([
  "cron",
  "cron_fallback",
  "manual",
  "dry_run_aborted",
]);

export const seasonClosureSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  source: seasonSourceSchema.default("manual"),
});

export type SeasonClosureInput = z.infer<typeof seasonClosureSchema>;
