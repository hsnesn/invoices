import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrOperations } from "@/lib/auth";

const SERVICE_DESCRIPTIONS = [
  "Audio Production Services",
  "Broadcast Technical Services",
  "Camera & Editing Services",
  "Camera & Filming Services",
  "Editorial Production Services",
  "Output Support Services",
  "Presentation Services",
];

const BOOKED_BY = [
  "Hasan ESEN",
  "Kubra SELVI",
  "Mehmet Ali MAYBASKAN",
  "Alice TEGG",
  "Ahmet SEÇKİN",
  "Tarik ZARROUG",
  "Zeyney ERYILMAZ",
];

const ADDITIONAL_COST_REASONS = [
  "Transport and Logistics Cost",
  "Rental",
  "Makeup and Styling Service (Outside)",
  "Field Filming Services",
];

export async function POST() {
  try {
    await requireAdminOrOperations();
    const supabase = createAdminClient();

    await supabase.from("freelancer_setup_items").delete().eq("category", "service_description");
    await supabase.from("freelancer_setup_items").delete().eq("category", "booked_by");
    await supabase.from("freelancer_setup_items").delete().eq("category", "additional_cost_reason");

    const allItems: { category: string; value: string; sort_order: number }[] = [];
    SERVICE_DESCRIPTIONS.forEach((v, i) => allItems.push({ category: "service_description", value: v, sort_order: i + 1 }));
    BOOKED_BY.forEach((v, i) => allItems.push({ category: "booked_by", value: v, sort_order: i + 1 }));
    ADDITIONAL_COST_REASONS.forEach((v, i) => allItems.push({ category: "additional_cost_reason", value: v, sort_order: i + 1 }));

    await supabase.from("freelancer_setup_items").insert(allItems);

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
