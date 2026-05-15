"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";
import type { DailyCashback } from "@/lib/services/analyticsService";

const SERIES = [
  { key: "creditedOrganic", label: "Organique", color: "#b8864b" },
  { key: "creditedRewards", label: "Récompenses", color: "#d9a964" },
  { key: "spent", label: "Dépensé", color: "#5a0f1a" },
  { key: "netBalance", label: "Solde net", color: "#475569" },
] as const;

interface CashbackChartCardProps {
  data: DailyCashback[];
}

export function CashbackChartCard({ data }: CashbackChartCardProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set(["netBalance"]));

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        netBalance: d.creditedOrganic + d.creditedRewards - d.spent,
      })),
    [data]
  );

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Crédité vs Dépensé</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Aucune donnée sur cette période
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {SERIES.map((series) => {
                const isHidden = hiddenSeries.has(series.key);
                return (
                  <button
                    key={series.key}
                    onClick={() => toggleSeries(series.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors",
                      isHidden
                        ? "text-muted-foreground opacity-50"
                        : "font-medium"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: isHidden ? "#a1a1aa" : series.color,
                      }}
                    />
                    {series.label}
                  </button>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const [, m, day] = d.split("-");
                    return `${day}/${m}`;
                  }}
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label: string) => {
                    const [y, m, d] = label.split("-");
                    return `${d}/${m}/${y}`;
                  }}
                />
                {!hiddenSeries.has("creditedOrganic") && (
                  <Area
                    type="monotone"
                    dataKey="creditedOrganic"
                    name="Organique"
                    stroke="#b8864b"
                    fill="#b8864b"
                    fillOpacity={0.2}
                  />
                )}
                {!hiddenSeries.has("creditedRewards") && (
                  <Area
                    type="monotone"
                    dataKey="creditedRewards"
                    name="Récompenses"
                    stroke="#d9a964"
                    fill="#d9a964"
                    fillOpacity={0.3}
                  />
                )}
                {!hiddenSeries.has("spent") && (
                  <Area
                    type="monotone"
                    dataKey="spent"
                    name="Dépensé"
                    stroke="#5a0f1a"
                    fill="#5a0f1a"
                    fillOpacity={0.2}
                  />
                )}
                {!hiddenSeries.has("netBalance") && (
                  <Line
                    type="monotone"
                    dataKey="netBalance"
                    name="Solde net"
                    stroke="#475569"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
