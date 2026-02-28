"use client";

import { useCallback, useEffect, useState } from "react";

export type MetricKey =
  | "guest_pending"
  | "guest_paid"
  | "contr_pending"
  | "contr_paid"
  | "rejected"
  | "other_pending";

export type PageGroup = "invoices" | "operations" | "admin";

export const DEFAULT_METRIC_ORDER: MetricKey[] = [
  "guest_pending",
  "guest_paid",
  "contr_pending",
  "contr_paid",
  "rejected",
  "other_pending",
];

export type HiddenSectionKey =
  | "alerts"
  | "pending_actions"
  | "producer_stats"
  | "metrics"
  | "charts"
  | "quick_overview";

export type ChartKey = "invoices" | "projects" | "office_requests" | "assignments";

export interface DashboardLayout {
  metricOrder: MetricKey[];
  pageOrderByGroup: Record<PageGroup, string[]>;
  hiddenSections?: HiddenSectionKey[];
  hiddenMetrics?: MetricKey[];
  hiddenPages?: string[];
  chartExpanded?: Partial<Record<ChartKey, boolean>>;
}

const STORAGE_KEY_PREFIX = "dashboard_layout_";

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function loadLayout(userId: string | undefined): DashboardLayout | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as DashboardLayout).metricOrder) &&
      typeof (parsed as DashboardLayout).pageOrderByGroup === "object"
    ) {
      const layout = parsed as DashboardLayout;
      if (!Array.isArray(layout.hiddenSections)) layout.hiddenSections = [];
      if (!Array.isArray(layout.hiddenMetrics)) layout.hiddenMetrics = [];
      if (!Array.isArray(layout.hiddenPages)) layout.hiddenPages = [];
      if (!layout.chartExpanded || typeof layout.chartExpanded !== "object") layout.chartExpanded = {};
      return layout;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function saveLayout(userId: string | undefined, layout: DashboardLayout): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

export function useDashboardLayout(userId: string | undefined) {
  const [layout, setLayoutState] = useState<DashboardLayout | null>(null);

  useEffect(() => {
    setLayoutState(loadLayout(userId));
  }, [userId]);

  const setLayout = useCallback(
    (updater: (prev: DashboardLayout) => DashboardLayout) => {
      if (!userId) return;
      setLayoutState((prev) => {
        const base = prev ?? {
          metricOrder: [...DEFAULT_METRIC_ORDER],
          pageOrderByGroup: {
            invoices: [] as string[],
            operations: [] as string[],
            admin: [] as string[],
          },
          hiddenSections: [] as HiddenSectionKey[],
          hiddenMetrics: [] as MetricKey[],
          hiddenPages: [] as string[],
          chartExpanded: {} as Partial<Record<ChartKey, boolean>>,
        };
        const next = updater(base);
        saveLayout(userId, next);
        return next;
      });
    },
    [userId]
  );

  const metricOrder = layout?.metricOrder ?? DEFAULT_METRIC_ORDER;
  const pageOrderByGroup = layout?.pageOrderByGroup ?? {
    invoices: [],
    operations: [],
    admin: [],
  };
  const hiddenSections = layout?.hiddenSections ?? [];
  const hiddenMetrics = layout?.hiddenMetrics ?? [];
  const hiddenPages = layout?.hiddenPages ?? [];
  const chartExpanded = layout?.chartExpanded ?? {};

  const resetLayout = useCallback(() => {
    if (!userId) return;
    try {
      localStorage.removeItem(getStorageKey(userId));
    } catch {
      // ignore
    }
    setLayoutState(null);
  }, [userId]);

  const toggleSection = useCallback(
    (key: HiddenSectionKey) => {
      setLayout((prev) => {
        const current = prev.hiddenSections ?? [];
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        return { ...prev, hiddenSections: next };
      });
    },
    [setLayout]
  );

  const toggleMetric = useCallback(
    (key: MetricKey) => {
      setLayout((prev) => {
        const current = prev.hiddenMetrics ?? [];
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        return { ...prev, hiddenMetrics: next };
      });
    },
    [setLayout]
  );

  const togglePage = useCallback(
    (key: string) => {
      setLayout((prev) => {
        const current = prev.hiddenPages ?? [];
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        return { ...prev, hiddenPages: next };
      });
    },
    [setLayout]
  );

  const setChartExpanded = useCallback(
    (key: ChartKey, expanded: boolean) => {
      setLayout((prev) => ({
        ...prev,
        chartExpanded: { ...(prev.chartExpanded ?? {}), [key]: expanded },
      }));
    },
    [setLayout]
  );

  return {
    metricOrder,
    pageOrderByGroup,
    hiddenSections,
    hiddenMetrics,
    hiddenPages,
    chartExpanded,
    setLayout,
    resetLayout,
    toggleSection,
    toggleMetric,
    togglePage,
    setChartExpanded,
    hasCustomLayout: layout !== null,
  };
}
