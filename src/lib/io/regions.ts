// SLA Regions reference data for Bulk Import.
//
// Regions are configured in System Settings (sla_regions). The importer
// matches the "Region" column against the active regions by English or
// Arabic name, case-insensitively.

import { supabase } from "@/integrations/supabase/client";

export interface RegionRef {
  id: string;
  name: string;
  name_ar: string;
}

let cache: RegionRef[] = [];

export async function loadRegions(): Promise<RegionRef[]> {
  const { data, error } = await supabase
    .from("sla_regions")
    .select("id,name,name_ar")
    .eq("active", true)
    .order("sort_order");
  if (!error && data) cache = data as RegionRef[];
  return cache;
}

export function getRegions(): RegionRef[] {
  return cache;
}

function norm(v: string) {
  return v.trim().toLowerCase();
}

/** Resolves a free-text region cell to a configured region, or null. */
export function resolveRegion(value: unknown): RegionRef | null {
  const v = norm(String(value ?? ""));
  if (!v) return null;
  return (
    cache.find((r) => norm(r.name) === v || norm(r.name_ar ?? "") === v) ?? null
  );
}

export function regionNames(): string[] {
  return cache.map((r) => r.name);
}