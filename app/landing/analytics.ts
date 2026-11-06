// Site analytics, prepared for Yandex Metrika but not wired to it yet. Every event goes to window.dataLayer (the queue
// tag managers and Metrika's ecommerce read) and is also dispatched as a "coach:event" DOM event, so connecting a
// counter later is one listener and needs no change in the components.

export type SiteEvent =
  | "hero_cta_click"
  | "demo_start"
  | "calculator_interaction"
  | "lead_form_open"
  | "lead_submit_success"
  | "trial_registration_complete";

type Layer = { dataLayer?: Record<string, unknown>[] };

export function track(event: SiteEvent, params: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as Layer;
  const detail = { event, ...params };
  (w.dataLayer ??= []).push(detail);
  window.dispatchEvent(new CustomEvent("coach:event", { detail }));
}
