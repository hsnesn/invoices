"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const TOAST_KEY = "invoice_toast";

export function InvoiceToastListener() {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TOAST_KEY);
      if (!raw) return;
      sessionStorage.removeItem(TOAST_KEY);
      const data = JSON.parse(raw) as { type?: "success" | "error"; message?: string };
      const msg = data?.message ?? "Done";
      if (data?.type === "error") {
        toast.error(msg);
      } else {
        toast.success(msg);
      }
    } catch {
      sessionStorage.removeItem(TOAST_KEY);
    }
  }, []);
  return null;
}

export function setInvoiceToast(type: "success" | "error", message: string) {
  try {
    sessionStorage.setItem(TOAST_KEY, JSON.stringify({ type, message }));
  } catch {
    /* */
  }
}
