"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Percent, Wallet, Utensils } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import {
  SETTING_KEYS,
  getQuestAlertRatioPct,
  getQuestReferencePrices,
  updateAdminSetting,
  getAvgTicket12m,
  type QuestReferencePrices,
} from "@/lib/services/adminSettingsService";

const REFERENCE_PRICE_TYPES: { key: keyof QuestReferencePrices; label: string }[] = [
  { key: "biere", label: "Bière" },
  { key: "cocktail", label: "Cocktail" },
  { key: "alcool", label: "Alcool" },
  { key: "soft", label: "Soft / soda" },
  { key: "boisson_chaude", label: "Boisson chaude" },
  { key: "restauration", label: "Restauration" },
];

function centsToEuros(cents: number | undefined): string {
  if (cents === undefined || cents === null || Number.isNaN(cents)) return "";
  return (cents / 100).toFixed(2);
}

function eurosToCents(value: string): number | null {
  const n = parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function SettingsPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ratioPct, setRatioPct] = useState("10");
  const [prices, setPrices] = useState<Record<keyof QuestReferencePrices, string>>({
    biere: "",
    cocktail: "",
    alcool: "",
    soft: "",
    boisson_chaude: "",
    restauration: "",
  });
  const [avgTicket, setAvgTicket] = useState<{ cents: number; sample: number }>({
    cents: 0,
    sample: 0,
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ratio, refPrices, avg] = await Promise.all([
          getQuestAlertRatioPct(),
          getQuestReferencePrices(),
          getAvgTicket12m(),
        ]);
        setRatioPct(String(ratio));
        setPrices({
          biere: centsToEuros(refPrices.biere),
          cocktail: centsToEuros(refPrices.cocktail),
          alcool: centsToEuros(refPrices.alcool),
          soft: centsToEuros(refPrices.soft),
          boisson_chaude: centsToEuros(refPrices.boisson_chaude),
          restauration: centsToEuros(refPrices.restauration),
        });
        setAvgTicket({ cents: avg.avg_ticket_cents, sample: avg.sample_size });
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger les paramètres.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [toast]);

  const handleSave = async () => {
    const ratio = parseInt(ratioPct, 10);
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 500) {
      toast({
        variant: "destructive",
        title: "Seuil invalide",
        description: "Le seuil doit être un entier entre 1 et 500.",
      });
      return;
    }

    const referencePrices: QuestReferencePrices = {};
    for (const { key, label } of REFERENCE_PRICE_TYPES) {
      const raw = prices[key];
      if (raw === "") continue;
      const cents = eurosToCents(raw);
      if (cents === null) {
        toast({
          variant: "destructive",
          title: "Prix invalide",
          description: `Prix de référence pour "${label}" doit être un nombre positif.`,
        });
        return;
      }
      referencePrices[key] = cents;
    }

    setSaving(true);
    try {
      await Promise.all([
        updateAdminSetting(SETTING_KEYS.QUEST_ALERT_RATIO_PCT, ratio),
        updateAdminSetting(SETTING_KEYS.QUEST_REFERENCE_PRICES_CENTS, referencePrices),
      ]);
      toast({ title: "Paramètres enregistrés" });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer les paramètres.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Configuration globale de l&apos;admin. Stockée dans la table{" "}
          <code className="rounded bg-muted px-1 font-mono text-sm">admin_settings</code> (migration 020).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Panier moyen 12 mois"
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
          value={avgTicket.cents > 0 ? `${(avgTicket.cents / 100).toFixed(2)} €` : "—"}
          subtitle={`${avgTicket.sample} tickets (hors comptes test)`}
        />
        <StatCard
          title="Seuil d'alerte actuel"
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          value={`${ratioPct} %`}
          subtitle="Quêtes dépassant ce ratio signalées sur /quests/health"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Seuil d&apos;alerte ratio bonus / panier attendu
          </CardTitle>
          <CardDescription>
            Signaler une quête dont le bonus cashback dépasse cette fraction du montant de
            référence (bonus &gt; ratio × montant_attendu). Appliqué sur{" "}
            <code className="rounded bg-muted px-1 text-xs">/quests/health</code>. Les quêtes{" "}
            <code className="rounded bg-muted px-1 text-xs">xp_earned</code> et{" "}
            <code className="rounded bg-muted px-1 text-xs">quest_completed</code> sont exclues du
            check.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="ratio">Seuil en pourcentage</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ratio"
              type="number"
              min={1}
              max={500}
              step={1}
              value={ratioPct}
              onChange={(e) => setRatioPct(e.target.value)}
              className="max-w-32"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Valeur par défaut recommandée : <strong>10 %</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Prix de référence par type de consommation
          </CardTitle>
          <CardDescription>
            Utilisés pour calculer le montant attendu à dépenser pour compléter une quête{" "}
            <code className="rounded bg-muted px-1 text-xs">consumption_count</code>. Montants en
            euros, convertis automatiquement en centimes pour stockage.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REFERENCE_PRICE_TYPES.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`price-${key}`}>{label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`price-${key}`}
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={prices[key]}
                  onChange={(e) =>
                    setPrices((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Enregistrer les paramètres
        </Button>
      </div>
    </div>
  );
}
