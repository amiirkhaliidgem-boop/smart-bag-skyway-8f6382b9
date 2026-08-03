// Provider registry — the single swap point for going live.
//
// Today every channel is served by a simulated adapter. When a real provider
// is procured, write an adapter that implements `NotificationChannelAdapter`
// and register it below (or from anywhere at boot):
//
//   registerProvider("sms", twilioSmsAdapter);
//
// The Workflow Engine, the notification templates, the Notification Center
// and all business logic stay untouched.

import type { NotificationChannelAdapter } from "./channels";
import type { NotificationChannel } from "./templates";
import { simulatedAdapters } from "./adapters/simulated";

export interface ProviderConfig {
  channel: NotificationChannel;
  adapter: NotificationChannelAdapter;
  /** Disabled channels are skipped by the engine (event is never queued). */
  enabled: boolean;
  /** Mirrors `adapter.simulated`; surfaced read-only in the monitor. */
  simulate: boolean;
}

function config(adapter: NotificationChannelAdapter, enabled: boolean): ProviderConfig {
  return { channel: adapter.channel, adapter, enabled, simulate: adapter.simulated };
}

// Simulated transports exist for local development only. In production a
// channel without a configured provider is DISABLED — the engine must never
// mark a message "sent" that was not actually transmitted.
const DEV_ONLY = import.meta.env?.DEV === true;

const registry: Record<NotificationChannel, ProviderConfig> = {
  sms: config(simulatedAdapters.sms, DEV_ONLY),
  whatsapp: config(simulatedAdapters.whatsapp, DEV_ONLY),
  email: config(simulatedAdapters.email, false),
  push: config(simulatedAdapters.push, false),
};

/** Replace the transport for a channel. This is the entire go-live change. */
export function registerProvider(
  channel: NotificationChannel,
  adapter: NotificationChannelAdapter,
  opts: { enabled?: boolean } = {},
) {
  registry[channel] = config(adapter, opts.enabled ?? true);
}

export function setChannelEnabled(channel: NotificationChannel, enabled: boolean) {
  registry[channel] = { ...registry[channel], enabled };
}

export function getProvider(channel: NotificationChannel): ProviderConfig {
  return registry[channel];
}

export function isChannelEnabled(channel: NotificationChannel): boolean {
  return registry[channel]?.enabled === true;
}

/** Channels the engine should fan a notification out to. */
export function enabledChannels(): NotificationChannel[] {
  return (Object.keys(registry) as NotificationChannel[]).filter((c) => registry[c].enabled);
}

export function listProviders(): ProviderConfig[] {
  return Object.values(registry);
}