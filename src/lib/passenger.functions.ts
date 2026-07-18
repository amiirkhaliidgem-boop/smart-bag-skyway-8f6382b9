import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

// Public, token-scoped view for /passenger/$token. Reads the app_state
// snapshot server-side (service role bypasses RLS) and returns ONLY the
// delivery + case matching the token — no other passengers' data leaks.
export const getPassengerViewByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(4) }).parse(input))
  .handler(async ({ data }): Promise<JSONValue> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("app_state")
      .select("payload")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const payload = (row?.payload ?? {}) as {
      workflow?: Array<Record<string, unknown> & { deliveryId: string; token: string }>;
      deliveries?: Array<Record<string, unknown>>;
      cases?: Array<Record<string, unknown>>;
    };
    const wf = (payload.workflow ?? []).find((w) => w.token === data.token);
    if (!wf) return { found: false };

    const delivery = (payload.deliveries ?? []).find(
      (d) => (d as { deliveryId?: string }).deliveryId === wf.deliveryId,
    );
    const kase = delivery
      ? (payload.cases ?? []).find(
          (c) => (c as { bagId?: string }).bagId === (delivery as { bagId?: string }).bagId,
        )
      : undefined;

    return JSON.parse(
      JSON.stringify({
        found: true,
        workflow: wf,
        delivery: delivery ?? null,
        case: kase ?? null,
      }),
    ) as JSONValue;
  });