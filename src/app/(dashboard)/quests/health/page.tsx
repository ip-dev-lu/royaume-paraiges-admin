"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Globe,
  Building2,
  Settings as SettingsIcon,
  Activity,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { useToast } from "@/components/ui/use-toast";
import { getActiveQuests } from "@/lib/services/questService";
import { createClient } from "@/lib/supabase/client";
import {
  getQuestAlertRatioPct,
  getQuestReferencePrices,
  getAvgTicket12m,
  type QuestReferencePrices,
} from "@/lib/services/adminSettingsService";
import type { QuestWithRelations, ConsumptionType } from "@/types/database";

type RatioStatus = "alert" | "ok" | "excluded" | "missing_ref";

interface QuestHealthRow {
  quest: QuestWithRelations;
  establishmentCount: number;
  referenceCents: number | null;
  ratioPct: number | null;
  status: RatioStatus;
  reason: string;
}

function formatEuro(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

function signatureLabel(quest: QuestWithRelations): string {
  return [
    quest.quest_type,
    quest.period_type,
    quest.consumption_type ?? "—",
  ].join(" / ");
}

function computeReference(
  quest: QuestWithRelations,
  prices: QuestReferencePrices,
  avgTicketCents: number
): { cents: number | null; reason: string; excluded: boolean } {
  switch (quest.quest_type) {
    case "consumption_count": {
      const key = quest.consumption_type as keyof QuestReferencePrices | null;
      if (!key) return { cents: null, reason: "consumption_type manquant", excluded: false };
      const unit = prices[key];
      if (!unit || unit <= 0) {
        return { cents: null, reason: `prix de référence "${key}" non défini`, excluded: false };
      }
      return {
        cents: quest.target_value * unit,
        reason: `${quest.target_value} × ${formatEuro(unit)}`,
        excluded: false,
      };
    }
    case "orders_count":
    case "establishments_visited": {
      if (!avgTicketCents || avgTicketCents <= 0) {
        return { cents: null, reason: "panier moyen indisponible", excluded: false };
      }
      return {
        cents: quest.target_value * avgTicketCents,
        reason: `${quest.target_value} × ${formatEuro(avgTicketCents)} (panier moyen 12m)`,
        excluded: false,
      };
    }
    case "amount_spent":
      // target_value déjà en centimes (€ dépensés) → référence directe
      return {
        cents: quest.target_value,
        reason: `${formatEuro(quest.target_value)} à dépenser`,
        excluded: false,
      };
    case "cashback_earned":
      // target_value en PdB. À cashback 1% & coef 1,0, 1 PdB = 1 centime
      // dépensé → équivalent en centimes = target_value * 100.
      return {
        cents: quest.target_value * 100,
        reason: `${quest.target_value} PdB à collecter (~ ${formatEuro(quest.target_value * 100)} dépensés)`,
        excluded: false,
      };
    case "xp_earned":
      return {
        cents: null,
        reason: "XP ne déclenche pas directement de PdB — check non pertinent",
        excluded: true,
      };
    case "quest_completed":
      return {
        cents: null,
        reason: "méta-quête — pas de pendant économique direct",
        excluded: true,
      };
    default:
      return { cents: null, reason: "type de quête inconnu", excluded: false };
  }
}

export default function QuestHealthPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<QuestWithRelations[]>([]);
  const [establishmentMap, setEstablishmentMap] = useState<Map<number, number>>(new Map());
  const [ratioPct, setRatioPct] = useState(10);
  const [prices, setPrices] = useState<QuestReferencePrices>({});
  const [avgTicket, setAvgTicket] = useState<{ cents: number; sample: number }>({
    cents: 0,
    sample: 0,
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [activeQuests, ratio, refPrices, avg] = await Promise.all([
          getActiveQuests(),
          getQuestAlertRatioPct(),
          getQuestReferencePrices(),
          getAvgTicket12m(),
        ]);

        // Compter les établissements par quest_id (pour scope global / local)
        const supabase = createClient();
         
        const { data: qe, error } = await (supabase.from("quests_establishments") as any)
          .select("quest_id");
        if (error) throw error;
        const map = new Map<number, number>();
        for (const row of (qe || []) as { quest_id: number }[]) {
          map.set(row.quest_id, (map.get(row.quest_id) || 0) + 1);
        }

        setQuests(activeQuests);
        setEstablishmentMap(map);
        setRatioPct(ratio);
        setPrices(refPrices);
        setAvgTicket({ cents: avg.avg_ticket_cents, sample: avg.sample_size });
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger les données de santé.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [toast]);

  const rows = useMemo<QuestHealthRow[]>(() => {
    return quests.map((quest) => {
      const ref = computeReference(quest, prices, avgTicket.cents);
      const establishmentCount = establishmentMap.get(quest.id) || 0;

      let ratioComputed: number | null = null;
      let status: RatioStatus;
      if (ref.excluded) {
        status = "excluded";
      } else if (ref.cents === null || ref.cents <= 0) {
        status = "missing_ref";
      } else {
        ratioComputed = (quest.bonus_cashback / ref.cents) * 100;
        status = ratioComputed > ratioPct ? "alert" : "ok";
      }

      return {
        quest,
        establishmentCount,
        referenceCents: ref.cents,
        ratioPct: ratioComputed,
        status,
        reason: ref.reason,
      };
    });
  }, [quests, prices, avgTicket.cents, establishmentMap, ratioPct]);

  const alertCount = rows.filter((r) => r.status === "alert").length;
  const okCount = rows.filter((r) => r.status === "ok").length;
  const excludedCount = rows.filter((r) => r.status === "excluded").length;
  const missingCount = rows.filter((r) => r.status === "missing_ref").length;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Santé des quêtes actives</h1>
          <p className="text-muted-foreground">
            Ratio bonus PdB / panier attendu pour détecter les quêtes trop généreuses.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Paramètres
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Quêtes actives"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          value={rows.length}
        />
        <StatCard
          title="En alerte"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          value={alertCount}
          subtitle={`Bonus > ${ratioPct} % du panier attendu`}
          valueClassName={alertCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        />
        <StatCard
          title="Conformes"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          value={okCount}
        />
        <StatCard
          title="Exclues / non mesurables"
          icon={<MinusCircle className="h-4 w-4 text-muted-foreground" />}
          value={excludedCount + missingCount}
          subtitle={`${excludedCount} exclues, ${missingCount} sans référence`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres appliqués</CardTitle>
          <CardDescription>
            Éditables depuis la page{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Paramètres
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Seuil alerte : {ratioPct} %</Badge>
            <Badge variant="outline">
              Panier moyen 12m :{" "}
              {avgTicket.cents > 0 ? formatEuro(avgTicket.cents) : "—"} ({avgTicket.sample}{" "}
              tickets)
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["biere", "cocktail", "alcool", "soft", "boisson_chaude", "restauration"] as ConsumptionType[]).map(
              (k) => {
                const cents = prices[k as keyof QuestReferencePrices];
                return (
                  <Badge key={k} variant="secondary">
                    {k} : {cents !== undefined ? formatEuro(cents) : "—"}
                  </Badge>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détail par quête</CardTitle>
          <CardDescription>
            Cliquez sur une ligne pour ouvrir la quête en édition.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quête</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Bonus PdB</TableHead>
                <TableHead className="text-right">Référence</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead>État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isAlert = row.status === "alert";
                return (
                  <TableRow
                    key={row.quest.id}
                    className={isAlert ? "bg-amber-50/50 dark:bg-amber-950/20" : undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/quests/${row.quest.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.quest.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {signatureLabel(row.quest)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.establishmentCount === 0 ? (
                        <Badge variant="secondary" className="gap-1">
                          <Globe className="h-3 w-3" />
                          Globale
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          {row.establishmentCount} établissement
                          {row.establishmentCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatEuro(row.quest.bonus_cashback)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {row.referenceCents !== null ? (
                        <>
                          {formatEuro(row.referenceCents)}
                          <div className="text-[10px]">{row.reason}</div>
                        </>
                      ) : (
                        row.reason
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.ratioPct !== null ? (
                        <span
                          className={
                            isAlert
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : undefined
                          }
                        >
                          {row.ratioPct.toFixed(1)} %
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {row.status === "alert" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Alerte
                        </Badge>
                      )}
                      {row.status === "ok" && (
                        <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                      {row.status === "excluded" && (
                        <Badge variant="secondary">Exclue du check</Badge>
                      )}
                      {row.status === "missing_ref" && (
                        <Badge variant="outline">Référence manquante</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Aucune quête active.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
