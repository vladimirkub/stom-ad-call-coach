// Latency settings for the ElevenLabs voice agents (fields verified against the public OpenAPI spec).
// Plain objects, no imports: shared by the setup script and the API routes.
export const FAST_TURN = {
  turn_eagerness: "eager", // respond sooner after the person stops speaking
  speculative_turn: true, // start generating the reply during the pause, before the turn is certainly over
} as const;

export const FAST_PROMPT = {
  thinking_budget: 0, // no hidden "thinking" tokens before the first spoken word
  max_tokens: 300, // short spoken replies (2-3 sentences) finish and start faster
} as const;
