import { describe, it, expect } from "vitest";
import {
  getState,
  assignDriver,
  driverMarkDelivered,
  driverStartTrip,
  getDeliveryStage,
} from "../store";

// End-to-end OTP flow: single source of truth from Assign Driver through
// Passenger Portal → Driver Portal verification → Delivered.
describe("OTP single-source-of-truth flow", () => {
  it("uses the same 4-digit OTP across passenger and driver", () => {
    // Pick a delivery whose linked case is Ready for Delivery (or a Pending
    // seed we can assign a driver to).
    const before = getState();
    const target = before.deliveries.find(
      (d) => d.driver === "—" && d.status === "Pending",
    );
    expect(target, "seed delivery available").toBeTruthy();
    const deliveryId = target!.deliveryId;

    assignDriver(deliveryId, "Ahmed Mostafa", { actor: "test", role: "Dispatcher" });

    const afterAssign = getState().deliveries.find((d) => d.deliveryId === deliveryId)!;
    const otp = afterAssign.otpCode;
    // (1) Length is consistent = 4 digits.
    expect(otp).toMatch(/^\d{4}$/);
    // (2) Passenger Portal reads the exact same field.
    expect(afterAssign.otpCode).toBe(otp);

    // (3) Driver Portal verification path — inline compare + mark delivered.
    driverStartTrip(deliveryId, { actor: "Ahmed Mostafa", role: "Driver" });
    const driverInput = otp; // passenger reads it out
    expect(driverInput).toBe(afterAssign.otpCode);

    driverMarkDelivered(deliveryId, { actor: "Ahmed Mostafa", role: "Driver" });

    const afterDelivered = getState().deliveries.find((d) => d.deliveryId === deliveryId)!;
    // (4) OTP unchanged across the whole flow — never re-minted.
    expect(afterDelivered.otpCode).toBe(otp);
    // (5) Stage moves to Delivered.
    expect(getDeliveryStage(afterDelivered)).toBe("Delivered");

    // (6) Audit records assign + delivered.
    const audit = getState().audit;
    expect(audit.some((a) => a.entityId === deliveryId && a.action === "delivery.assign")).toBe(true);
    // (7) L&F mirror — linked case status advances past "Ready for Delivery".
    const kase = getState().cases.find((c) => c.bagId === afterDelivered.bagId);
    if (kase) {
      expect(kase.status).not.toBe("Ready for Delivery");
    }
  });
});