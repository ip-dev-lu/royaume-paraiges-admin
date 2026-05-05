import { z } from "zod";

export const criterionTypeSchema = z.enum([
  "first_order",
  "orders_threshold",
  "cities_visited",
  "all_establishments_visited",
  "consecutive_weekly_quests",
  "establishments_threshold",
]);

export const badgeRaritySchema = z.enum(["common", "rare", "epic", "legendary"]);

export const evaluationModeSchema = z.enum(["realtime", "cron"]);

const criterionParamsSchema = z.record(z.string(), z.unknown());

const achievementBadgeBaseShape = {
  slug: z
    .string()
    .min(1, "Slug requis")
    .regex(/^[a-z0-9_]+$/, "Slug: uniquement [a-z0-9_]"),
  name: z.string().min(1, "Nom requis").max(200),
  description: z.string().max(1000).nullish(),
  lore: z.string().max(2000).nullish(),
  icon: z.string().max(100).nullish(),
  rarity: badgeRaritySchema,
  criterion_type: criterionTypeSchema,
  criterion_params: criterionParamsSchema,
  evaluation_mode: evaluationModeSchema,
};

function refineCriterionParams(
  data: {
    criterion_type: z.infer<typeof criterionTypeSchema>;
    criterion_params: Record<string, unknown>;
    evaluation_mode: z.infer<typeof evaluationModeSchema>;
  },
  ctx: z.RefinementCtx
) {
  const params = data.criterion_params;

  switch (data.criterion_type) {
    case "orders_threshold":
    case "establishments_threshold": {
      const threshold = params.threshold;
      if (typeof threshold !== "number" || threshold < 1) {
        ctx.addIssue({
          code: "custom",
          message: `criterion_params.threshold (int >= 1) requis pour ${data.criterion_type}`,
          path: ["criterion_params", "threshold"],
        });
      }
      break;
    }
    case "cities_visited": {
      const minCities = params.min_cities;
      if (typeof minCities !== "number" || minCities < 1) {
        ctx.addIssue({
          code: "custom",
          message: "criterion_params.min_cities (int >= 1) requis pour cities_visited",
          path: ["criterion_params", "min_cities"],
        });
      }
      break;
    }
    case "consecutive_weekly_quests": {
      const nWeeks = params.n_weeks;
      if (typeof nWeeks !== "number" || nWeeks < 1) {
        ctx.addIssue({
          code: "custom",
          message:
            "criterion_params.n_weeks (int >= 1) requis pour consecutive_weekly_quests",
          path: ["criterion_params", "n_weeks"],
        });
      }
      if (data.evaluation_mode !== "cron") {
        ctx.addIssue({
          code: "custom",
          message:
            "consecutive_weekly_quests requiert evaluation_mode = cron (batch nocturne)",
          path: ["evaluation_mode"],
        });
      }
      break;
    }
    // first_order et all_establishments_visited : pas de paramètre requis
  }
}

export const achievementBadgeSchema = z
  .object(achievementBadgeBaseShape)
  .superRefine(refineCriterionParams);

export const achievementBadgeUpdateSchema = z
  .object({
    slug: achievementBadgeBaseShape.slug.optional(),
    name: achievementBadgeBaseShape.name.optional(),
    description: achievementBadgeBaseShape.description,
    lore: achievementBadgeBaseShape.lore,
    icon: achievementBadgeBaseShape.icon,
    rarity: achievementBadgeBaseShape.rarity.optional(),
    criterion_type: achievementBadgeBaseShape.criterion_type.optional(),
    criterion_params: achievementBadgeBaseShape.criterion_params.optional(),
    evaluation_mode: achievementBadgeBaseShape.evaluation_mode.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.criterion_type !== undefined &&
      data.criterion_params !== undefined &&
      data.evaluation_mode !== undefined
    ) {
      refineCriterionParams(
        {
          criterion_type: data.criterion_type,
          criterion_params: data.criterion_params,
          evaluation_mode: data.evaluation_mode,
        },
        ctx
      );
    }
  });

export type AchievementBadgeInput = z.infer<typeof achievementBadgeSchema>;
export type AchievementBadgeUpdateInput = z.infer<typeof achievementBadgeUpdateSchema>;
