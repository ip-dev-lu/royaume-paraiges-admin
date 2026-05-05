"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type {
  AchievementBadgePayload,
  AchievementCriterionType,
  BadgeRarity,
  EvaluationMode,
} from "@/lib/services/achievementBadgeService";

const CRITERION_OPTIONS: {
  value: AchievementCriterionType;
  label: string;
  defaultMode: EvaluationMode;
}[] = [
  { value: "first_order", label: "Première commande", defaultMode: "realtime" },
  { value: "orders_threshold", label: "Nombre total de commandes ≥ X", defaultMode: "realtime" },
  { value: "cities_visited", label: "Villes différentes visitées ≥ X", defaultMode: "realtime" },
  { value: "all_establishments_visited", label: "Tous les établissements visités", defaultMode: "realtime" },
  { value: "establishments_threshold", label: "Établissements distincts visités ≥ X", defaultMode: "realtime" },
  { value: "consecutive_weekly_quests", label: "Quêtes hebdo complétées N semaines d'affilée", defaultMode: "cron" },
];

const RARITY_OPTIONS: BadgeRarity[] = ["common", "rare", "epic", "legendary"];

function generateSlug(name: string): string {
  return (
    "achievement_" +
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
  );
}

const formSchema = z
  .object({
    slug: z
      .string()
      .min(1, "Le slug est requis.")
      .regex(/^[a-z0-9_]+$/, "Slug : uniquement [a-z0-9_]."),
    name: z.string().min(1, "Le nom est requis.").max(200),
    description: z.string().max(1000),
    lore: z.string().max(2000),
    icon: z.string().max(100),
    rarity: z.enum(["common", "rare", "epic", "legendary"]),
    criterion_type: z.enum([
      "first_order",
      "orders_threshold",
      "cities_visited",
      "all_establishments_visited",
      "establishments_threshold",
      "consecutive_weekly_quests",
    ]),
    threshold: z.string(),
    min_cities: z.string(),
    n_weeks: z.string(),
    evaluation_mode: z.enum(["realtime", "cron"]),
  })
  .superRefine((data, ctx) => {
    switch (data.criterion_type) {
      case "orders_threshold":
      case "establishments_threshold": {
        const n = parseInt(data.threshold, 10);
        if (!n || n < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Le seuil doit être ≥ 2.",
            path: ["threshold"],
          });
        }
        break;
      }
      case "cities_visited": {
        const n = parseInt(data.min_cities, 10);
        if (!n || n < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Le nombre minimum de villes doit être ≥ 2.",
            path: ["min_cities"],
          });
        }
        break;
      }
      case "consecutive_weekly_quests": {
        const n = parseInt(data.n_weeks, 10);
        if (!n || n < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Le nombre de semaines doit être ≥ 2.",
            path: ["n_weeks"],
          });
        }
        if (data.evaluation_mode !== "cron") {
          ctx.addIssue({
            code: "custom",
            message: "Ce critère requiert le mode cron.",
            path: ["evaluation_mode"],
          });
        }
        break;
      }
    }
  });

type FormInput = z.infer<typeof formSchema>;

interface FormStateInitial {
  slug?: string;
  name?: string;
  description?: string;
  lore?: string;
  icon?: string;
  rarity?: BadgeRarity;
  criterion_type?: AchievementCriterionType;
  threshold?: string;
  min_cities?: string;
  n_weeks?: string;
  evaluation_mode?: EvaluationMode;
}

interface Props {
  initial?: FormStateInitial;
  submitLabel: string;
  onSubmit: (payload: AchievementBadgePayload) => Promise<void>;
  onCancel: () => void;
  lockSlug?: boolean;
}

function buildCriterionParams(values: FormInput): Record<string, unknown> {
  switch (values.criterion_type) {
    case "orders_threshold":
    case "establishments_threshold":
      return { threshold: parseInt(values.threshold, 10) };
    case "cities_visited":
      return { min_cities: parseInt(values.min_cities, 10) };
    case "consecutive_weekly_quests":
      return { n_weeks: parseInt(values.n_weeks, 10) };
    default:
      return {};
  }
}

export function AchievementBadgeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  lockSlug,
}: Props) {
  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: initial?.slug ?? "",
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      lore: initial?.lore ?? "",
      icon: initial?.icon ?? "🏅",
      rarity: initial?.rarity ?? "common",
      criterion_type: initial?.criterion_type ?? "first_order",
      threshold: initial?.threshold ?? "",
      min_cities: initial?.min_cities ?? "",
      n_weeks: initial?.n_weeks ?? "",
      evaluation_mode: initial?.evaluation_mode ?? "realtime",
    },
  });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const criterionType = watch("criterion_type");
  const slugValue = watch("slug");
  const [serverError, setServerError] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setValue("name", value, { shouldValidate: true, shouldDirty: true });
    if (!lockSlug && !slugValue) {
      setValue("slug", generateSlug(value), { shouldValidate: true });
    }
  };

  const handleCriterionChange = (value: AchievementCriterionType) => {
    const opt = CRITERION_OPTIONS.find((o) => o.value === value);
    setValue("criterion_type", value, { shouldValidate: true });
    setValue("evaluation_mode", opt?.defaultMode ?? "realtime", {
      shouldValidate: true,
    });
    setValue("threshold", "");
    setValue("min_cities", "");
    setValue("n_weeks", "");
  };

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const payload: AchievementBadgePayload = {
      slug: values.slug.trim(),
      name: values.name.trim(),
      description: values.description.trim() || null,
      lore: values.lore.trim() || null,
      icon: values.icon.trim() || null,
      rarity: values.rarity,
      criterion_type: values.criterion_type,
      criterion_params: buildCriterionParams(values),
      evaluation_mode: values.evaluation_mode,
    };
    try {
      await onSubmit(payload);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>
            Nom affiché, slug technique unique, visuel et texte narratif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Nom</Label>
            <Input
              {...register("name")}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="ex: Habitué"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Slug (unique)</Label>
            <Input
              {...register("slug")}
              placeholder="achievement_orders_10"
              disabled={lockSlug}
              className="font-mono"
            />
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Icône (emoji)</Label>
            <Input {...register("icon")} placeholder="🏅" maxLength={6} />
          </div>
          <div className="grid gap-2">
            <Label>Description (phrase courte)</Label>
            <Input
              {...register("description")}
              placeholder="10 commandes au compteur."
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Lore (narratif, 1-2 lignes)</Label>
            <Textarea
              {...register("lore")}
              rows={3}
              placeholder="Dix coupes, dix signatures sur le registre des Compagnons…"
            />
            {errors.lore && (
              <p className="text-xs text-destructive">{errors.lore.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Critère de déblocage</CardTitle>
          <CardDescription>
            Le choix du type de critère détermine les paramètres à renseigner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Type de critère</Label>
            <Controller
              control={control}
              name="criterion_type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) =>
                    handleCriterionChange(v as AchievementCriterionType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITERION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {(criterionType === "orders_threshold" ||
            criterionType === "establishments_threshold") && (
            <div className="grid gap-2">
              <Label>Seuil (≥ 2)</Label>
              <Input
                type="number"
                min={2}
                {...register("threshold")}
                placeholder="10"
              />
              {errors.threshold && (
                <p className="text-xs text-destructive">
                  {errors.threshold.message}
                </p>
              )}
            </div>
          )}

          {criterionType === "cities_visited" && (
            <div className="grid gap-2">
              <Label>Nombre minimum de villes (≥ 2)</Label>
              <Input
                type="number"
                min={2}
                {...register("min_cities")}
                placeholder="2"
              />
              {errors.min_cities && (
                <p className="text-xs text-destructive">
                  {errors.min_cities.message}
                </p>
              )}
            </div>
          )}

          {criterionType === "consecutive_weekly_quests" && (
            <div className="grid gap-2">
              <Label>Nombre de semaines d&apos;affilée (≥ 2)</Label>
              <Input
                type="number"
                min={2}
                {...register("n_weeks")}
                placeholder="4"
              />
              {errors.n_weeks && (
                <p className="text-xs text-destructive">
                  {errors.n_weeks.message}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label>Mode d&apos;évaluation</Label>
            <Controller
              control={control}
              name="evaluation_mode"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as EvaluationMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">
                      Temps réel (hook create_receipt)
                    </SelectItem>
                    <SelectItem value="cron">
                      Cron nocturne (02:00 UTC)
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.evaluation_mode && (
              <p className="text-xs text-destructive">
                {errors.evaluation_mode.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Les critères de streak (N semaines d&apos;affilée) sont recommandés
              en mode cron.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rareté</CardTitle>
          <CardDescription>
            Définie manuellement à la création, modifiable à tout moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label>Rareté</Label>
            <Controller
              control={control}
              name="rarity"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as BadgeRarity)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITY_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {serverError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
