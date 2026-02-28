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

export interface DashboardLayout {
  metricOrder: MetricKey[];
  pageOrderByGroup: Record<PageGroup, string[]>;
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
      return parsed as DashboardLayout;
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

  return {
    metricOrder,
    pageOrderByGroup,
    setLayout,
    hasCustomLayout: layout !== null,
  };
}
