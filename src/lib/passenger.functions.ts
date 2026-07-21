import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryOptions } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public, token-scoped view for /passenger/$token.
//
// This module MUST NOT depend on staff auth or the service role. All reads
// and writes go through public SECURITY DEFINER RPCs that are granted
// EXECUTE to `anon`. This is what makes the portal behave identically on
// desktop, mobile Safari, Lovable Mobile, preview, and published.

export interface PassengerView {
  found: boolean;
  passengerName: string;
  status: string;
  stage: string;
  bagTag: string | null;
  airline: string | null;
  flightNo: string | null;
  flightDate: string | null;
  otpCode: string | null;
  pirNumber: string | null;
}

function serverPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        // Opaque sb_ keys aren't JWTs; strip the default Authorization bearer.
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const EMPTY_VIEW: PassengerView = {
  found: false,
  passengerName: "",
  status: "",
  stage: "",
  bagTag: null,
  airline: null,
  flightNo: null,
  flightDate: null,
  otpCode: null,
  pirNumber: null,
};

export const getPassengerViewByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(4) }).parse(input))
  .handler(async ({ data }): Promise<PassengerView> => {
    const sb = serverPublicClient();
    const { data: rpcData, error } = await sb.rpc("get_passenger_view", {
      p_token: data.token,
    });
    if (error) {
      console.warn("[passenger] rpc failed:", error.message);
      return EMPTY_VIEW;
    }
    if (!rpcData) return EMPTY_VIEW;
    const row = rpcData as {
      passenger_name: string | null;
      status: string | null;
      stage: string | null;
      bag_tag: string | null;
      airline: string | null;
      flight_no: string | null;
      flight_date: string | null;
      otp_code: string | null;
      pir_number: string | null;
    };
    return {
      found: true,
      passengerName: row.passenger_name ?? "",
      status: row.status ?? "",
      stage: row.stage ?? "",
      bagTag: row.bag_tag,
      airline: row.airline,
      flightNo: row.flight_no,
      flightDate: row.flight_date,
      otpCode: row.otp_code,
      pirNumber: row.pir_number,
    };
  });

const TERMINAL_STAGES = new Set([
  "Delivered",
  "Failed",
  "Returned to Airport",
]);

export function isTerminalPassengerStage(stage: string | undefined | null): boolean {
  return !!stage && TERMINAL_STAGES.has(stage);
}

export const passengerViewQuery = (token: string) =>
  queryOptions({
    queryKey: ["passenger-view", token],
    queryFn: () => getPassengerViewByToken({ data: { token } }),
    staleTime: 0,
    gcTime: 60_000,
  });

const passengerActionSchema = z.discriminatedUnion("action", [
  z.object({ token: z.string().min(4), action: z.literal("confirm-delivery") }),
  z.object({ token: z.string().min(4), action: z.literal("report-misconduct") }),
  z.object({
    token: z.string().min(4),
    action: z.literal("submit-feedback"),
    rating: z.number().int().min(1).max(5),
    resolved: z.boolean(),
    comments: z.string().max(1000),
  }),
]);

export const mutatePassengerView = createServerFn({ method: "POST" })
  .inputValidator((input) => passengerActionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sb = serverPublicClient();
    if (data.action === "confirm-delivery") {
      const { data: ok, error } = await sb.rpc("passenger_confirm_delivery", {
        p_token: data.token,
      });
      if (error) throw new Error(error.message);
      return { ok: Boolean(ok) };
    }
    if (data.action === "report-misconduct") {
      const { data: ok, error } = await sb.rpc("passenger_report_misconduct", {
        p_token: data.token,
      });
      if (error) throw new Error(error.message);
      return { ok: Boolean(ok) };
    }
    const { data: ok, error } = await sb.rpc("passenger_submit_feedback", {
      p_token: data.token,
      p_rating: data.rating,
      p_resolved: data.resolved,
      p_comments: data.comments,
    });
    if (error) throw new Error(error.message);
    return { ok: Boolean(ok) };
  });