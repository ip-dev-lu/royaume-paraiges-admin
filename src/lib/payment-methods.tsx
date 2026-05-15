import { CreditCard, Banknote, Coins, Ticket, Receipt } from "lucide-react";
import type { ReactNode } from "react";

export type PaymentMethod = "card" | "cash" | "cashback" | "coupon";

interface PaymentMethodConfig {
  label: string;
  icon: ReactNode;
  iconColor: string;
  badgeClass: string;
  dotClass: string;
}

export const paymentMethodConfig: Record<string, PaymentMethodConfig> = {
  card: {
    label: "Carte",
    icon: <CreditCard className="h-4 w-4" />,
    iconColor: "text-blue-700 dark:text-blue-400",
    badgeClass:
      "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
    dotClass: "bg-blue-500",
  },
  cash: {
    label: "Espèces",
    icon: <Banknote className="h-4 w-4" />,
    iconColor: "text-emerald-700 dark:text-emerald-400",
    badgeClass:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  cashback: {
    label: "PdB",
    icon: <Coins className="h-4 w-4" />,
    iconColor: "text-bronze-strong dark:text-bronze-strong",
    badgeClass:
      "border-bronze/40 bg-bronze-soft text-bronze-strong dark:border-bronze/50 dark:bg-bronze-soft dark:text-bronze-strong",
    dotClass: "bg-bronze",
  },
  coupon: {
    label: "Coupon",
    icon: <Ticket className="h-4 w-4" />,
    iconColor: "text-violet-700 dark:text-violet-400",
    badgeClass:
      "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
};

const fallbackConfig: PaymentMethodConfig = {
  label: "Autre",
  icon: <Receipt className="h-4 w-4" />,
  iconColor: "text-muted-foreground",
  badgeClass: "border-border bg-muted text-muted-foreground",
  dotClass: "bg-muted-foreground",
};

export function getPaymentMethodConfig(method: string): PaymentMethodConfig {
  return paymentMethodConfig[method] ?? fallbackConfig;
}
