import { describe, it, expect } from "vitest";
import { dispatchEvents } from "@/lib/notifications/dispatch";
import { registerProvider, getProvider, enabledChannels } from "@/lib/notifications/registry";

const ev = { id: "NTF-1", channel: "sms" as const, to: "+201234567", locale: "en" as const, message: { body: "hi" } };

describe("dispatch", () => {
  it("sends via simulated adapter", async () => {
    const patches: any[] = [];
    dispatchEvents([ev], (id, p) => patches.push(p));
    await new Promise((r) => setTimeout(r, 2500));
    expect(patches.at(-1).status_).toBe("sent");
    expect(patches.at(-1).providerId).toMatch(/^sim_sms_/);
  });

  it("retries retryable failures then fails", async () => {
    registerProvider("sms", {
      channel: "sms", name: "flaky", simulated: true,
      async send() { return { ok: false, error: "boom", retryable: true }; },
    });
    const patches: any[] = [];
    dispatchEvents([{ ...ev, id: "NTF-2" }], (id, p) => patches.push(p));
    await new Promise((r) => setTimeout(r, 6000));
    expect(patches.filter((p) => p.status_ === "sending").length).toBe(3);
    expect(patches.at(-1)).toMatchObject({ status_: "failed", failureReason: "boom" });
  }, 15000);

  it("enabled channels are sms+whatsapp", () => {
    expect(enabledChannels()).toEqual(["sms", "whatsapp"]);
  });
});
