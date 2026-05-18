import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface StatCardProps {
  title: string;
  icon: ReactNode;
  value: string | number;
  subtitle?: string;
  valueClassName?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  icon,
  value,
  subtitle,
  valueClassName,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        onClick && "cursor-pointer hover:bg-muted/50 transition-colors"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
