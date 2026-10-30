// Sections that are shown in the workspace but switched off: their cards are greyed out, their pages say so, and their
// APIs refuse. Real-call review stays off so that no real patient's voice or data passes through the service.
export const FEATURES = { realCalls: false, calculator: false, operator: false, knowledge: false } as const;
export type Feature = keyof typeof FEATURES;

/** API paths of the switched-off sections; `proxy.ts` refuses them. */
export const FEATURE_APIS: { prefix: string; feature: Feature }[] = [
  { prefix: "/api/crm/", feature: "realCalls" },
  { prefix: "/api/transcribe", feature: "realCalls" },
  { prefix: "/api/operator/", feature: "operator" },
  { prefix: "/api/knowledge", feature: "knowledge" },
];

export const OFF_MESSAGE = "Раздел временно недоступен";
