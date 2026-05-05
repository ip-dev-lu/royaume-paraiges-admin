"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isWithinInterval,
  parseISO,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailablePeriod, PeriodType } from "@/types/database";

interface PeriodCalendarProps {
  periodType: PeriodType;
  availablePeriods: AvailablePeriod[];
  selectedPeriods: string[];
  onTogglePeriod: (identifier: string) => void;
  loadingPeriods?: boolean;
}

const MONTH_NAMES = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

const DAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function findPeriodForDate(
  date: Date,
  periods: AvailablePeriod[]
): AvailablePeriod | undefined {
  return periods.find((p) => {
    const start = parseISO(p.start_date);
    const end = parseISO(p.end_date);
    return isWithinInterval(date, { start, end });
  });
}

function WeeklyCalendar({
  availablePeriods,
  selectedPeriods,
  onTogglePeriod,
}: Omit<PeriodCalendarProps, "periodType" | "loadingPeriods">) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Group days into weeks (7 days per week)
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return weeks;
  }, [currentMonth]);

  const today = new Date();

  return (
    <div className="space-y-3">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar weeks */}
      <div className="space-y-1">
        {calendarWeeks.map((week) => {
          // Use Monday of this week to find the matching period
          const monday = week[0];
          if (!monday) return null;
          const period = findPeriodForDate(monday, availablePeriods);
          const isSelected = period
            ? selectedPeriods.includes(period.period_identifier)
            : false;
          const isClickable = !!period;

          // Check if current week (today is in this week)
          const isCurrentWeek = week.some((day) => isSameDay(day, today));

          return (
            <button
              key={monday.toISOString()}
              type="button"
              disabled={!isClickable}
              onClick={() => {
                if (period) onTogglePeriod(period.period_identifier);
              }}
              className={cn(
                "grid w-full grid-cols-7 gap-0 rounded-md py-1 transition-colors",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-default opacity-50",
                isSelected && "bg-primary/15 ring-1 ring-primary/30",
                !isSelected && isClickable && "hover:bg-muted",
                isCurrentWeek && !isSelected && "bg-accent/50",
              )}
            >
              {week.map((day) => {
                const inCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, today);

                return (
                  <span
                    key={day.toISOString()}
                    className={cn(
                      "flex h-8 items-center justify-center text-sm",
                      !inCurrentMonth && "text-muted-foreground/40",
                      inCurrentMonth && "text-foreground",
                      isToday &&
                        "font-bold underline decoration-primary underline-offset-2",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyCalendar({
  availablePeriods,
  selectedPeriods,
  onTogglePeriod,
}: Omit<PeriodCalendarProps, "periodType" | "loadingPeriods">) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const periodMap = useMemo(() => {
    const map = new Map<string, AvailablePeriod>();
    for (const p of availablePeriods) {
      map.set(p.period_identifier, p);
    }
    return map;
  }, [availablePeriods]);

  const currentMonth = new Date().getMonth();
  const isCurrentYear = currentYear === new Date().getFullYear();

  return (
    <div className="space-y-3">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentYear((y) => y - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{currentYear}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentYear((y) => y + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 4x3 grid of months */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {MONTH_NAMES.map((name, index) => {
          const identifier = `${currentYear}-${(index + 1).toString().padStart(2, "0")}`;
          const period = periodMap.get(identifier);
          const isSelected = selectedPeriods.includes(identifier);
          const isClickable = !!period;
          const isCurrent = isCurrentYear && index === currentMonth;

          return (
            <button
              key={identifier}
              type="button"
              disabled={!isClickable}
              onClick={() => {
                if (period) onTogglePeriod(period.period_identifier);
              }}
              className={cn(
                "rounded-md border px-3 py-3 text-sm transition-colors",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-default opacity-40",
                isSelected && "border-primary bg-primary/15 font-medium",
                !isSelected && isClickable && "hover:bg-muted",
                isCurrent && !isSelected && "bg-accent/50",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearlyCalendar({
  availablePeriods,
  selectedPeriods,
  onTogglePeriod,
}: Omit<PeriodCalendarProps, "periodType" | "loadingPeriods">) {
  const periodMap = useMemo(() => {
    const map = new Map<string, AvailablePeriod>();
    for (const p of availablePeriods) {
      map.set(p.period_identifier, p);
    }
    return map;
  }, [availablePeriods]);

  const years = useMemo(() => {
    return availablePeriods
      .map((p) => parseInt(p.period_identifier))
      .filter((y) => !isNaN(y))
      .sort((a, b) => a - b);
  }, [availablePeriods]);

  const currentYear = new Date().getFullYear();

  if (years.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Aucune annee disponible
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {years.map((year) => {
          const identifier = year.toString();
          const period = periodMap.get(identifier);
          const isSelected = selectedPeriods.includes(identifier);
          const isCurrent = year === currentYear;

          return (
            <button
              key={year}
              type="button"
              onClick={() => {
                if (period) onTogglePeriod(period.period_identifier);
              }}
              className={cn(
                "cursor-pointer rounded-md border px-3 py-3 text-sm transition-colors",
                isSelected && "border-primary bg-primary/15 font-medium",
                !isSelected && "hover:bg-muted",
                isCurrent && !isSelected && "bg-accent/50",
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PeriodCalendar({
  periodType,
  availablePeriods,
  selectedPeriods,
  onTogglePeriod,
  loadingPeriods,
}: PeriodCalendarProps) {
  if (loadingPeriods) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  switch (periodType) {
    case "weekly":
      return (
        <WeeklyCalendar
          availablePeriods={availablePeriods}
          selectedPeriods={selectedPeriods}
          onTogglePeriod={onTogglePeriod}
        />
      );
    case "monthly":
      return (
        <MonthlyCalendar
          availablePeriods={availablePeriods}
          selectedPeriods={selectedPeriods}
          onTogglePeriod={onTogglePeriod}
        />
      );
    case "yearly":
      return (
        <YearlyCalendar
          availablePeriods={availablePeriods}
          selectedPeriods={selectedPeriods}
          onTogglePeriod={onTogglePeriod}
        />
      );
  }
}
