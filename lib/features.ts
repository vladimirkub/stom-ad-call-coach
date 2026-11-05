// Sections that exist but are switched off: their pages say so and their APIs refuse.
export const FEATURES = { operator: false, knowledge: false } as const;
export type Feature = keyof typeof FEATURES;

/** API paths of the switched-off sections; `proxy.ts` refuses them. */
export const FEATURE_APIS: { prefix: string; feature: Feature }[] = [
  { prefix: "/api/operator/", feature: "operator" },
  { prefix: "/api/knowledge", feature: "knowledge" },
];

export const OFF_MESSAGE = "Раздел временно недоступен";
