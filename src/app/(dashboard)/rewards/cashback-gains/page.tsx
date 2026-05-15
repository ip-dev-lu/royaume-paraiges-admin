"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus } from "lucide-react";
import { getBonusCashbackGains } from "@/lib/services/couponService";
import { formatCurrency, formatDate } from "@/lib/utils";
import { couponKeys } from "@/lib/queries/keys";

type SourceFilter =
  | "all"
  | "bonus_cashback_manual"
  | "bonus_cashback_leaderboard"
  | "bonus_cashback_quest"
  | "bonus_cashback_trigger"
  | "bonus_cashback_migration";

function getSourceLabel(sourceType: string | null | undefined): string {
  const st = sourceType || "";
  if (st.includes("manual")) return "Manuel";
  if (st.includes("leaderboard")) return "Leaderboard";
  if (st.includes("quest")) return "Quête";
  if (st.includes("trigger")) return "Trigger";
  if (st.includes("migration")) return "Migration";
  return st.replace("bonus_cashback_", "").replace(/_/g, " ") || "-";
}

export default function CashbackGainsPage() {
  const router = useRouter();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const gainsQuery = useQuery({
    queryKey: couponKeys.list({ kind: "cashback-gains" }),
    queryFn: async () => {
      const { data } = await getBonusCashbackGains(500, 0);
      return data;
    },
  });

  useEffect(() => {
    if (gainsQuery.error) {
      console.error(gainsQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger les bonus cashback",
      });
    }
  }, [gainsQuery.error]);

  const allGains = gainsQuery.data ?? [];

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return allGains;
    return allGains.filter((g) => g.source_type === sourceFilter);
  }, [allGains, sourceFilter]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedItems = filtered.slice(page * limit, (page + 1) * limit);

  const onSourceChange = (value: SourceFilter) => {
    setSourceFilter(value);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bonus cashback</h1>
          <p className="text-muted-foreground">
            Paraiges de Bronze (PdB) crédités directement aux utilisateurs.
          </p>
        </div>
        <Link href="/rewards/cashback-gains/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau bonus
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={sourceFilter}
            onValueChange={(v) => onSourceChange(v as SourceFilter)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              <SelectItem value="bonus_cashback_manual">Manuel</SelectItem>
              <SelectItem value="bonus_cashback_leaderboard">
                Leaderboard
              </SelectItem>
              <SelectItem value="bonus_cashback_quest">Quête</SelectItem>
              <SelectItem value="bonus_cashback_trigger">Trigger</SelectItem>
              <SelectItem value="bonus_cashback_migration">
                Migration
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des bonus cashback</CardTitle>
          <CardDescription>
            {totalItems} bonus au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gainsQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun bonus cashback trouvé
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((gain) => (
                    <TableRow
                      key={gain.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/users/${gain.customer_id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        #{gain.id}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {gain.profiles
                              ? `${gain.profiles.first_name || ""} ${gain.profiles.last_name || ""}`.trim() ||
                                gain.profiles.email
                              : "Inconnu"}
                          </span>
                          <p className="text-sm text-muted-foreground">
                            {gain.profiles?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-bronze/40 bg-bronze-soft text-bronze-strong dark:border-bronze/50 dark:bg-bronze-soft dark:text-bronze-strong"
                        >
                          {formatCurrency(gain.cashback_money || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {getSourceLabel(gain.source_type)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {gain.period_identifier || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(gain.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} sur {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(page + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
