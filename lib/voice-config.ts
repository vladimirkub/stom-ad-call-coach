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

// Per-patient model trials. Everyone else stays on ELEVENLABS_LLM (default gemini-2.5-flash).
// claude-sonnet-5-5 has no "none" reasoning level, so it runs at the lowest one ("low") with no thinking budget cap.
// temperature: ElevenLabs defaults to 0, which makes a role-play patient sound the same every time; ~0.7 keeps her lively.
export const PATIENT_LLM_OVERRIDES: Record<string, { llm: string; reasoning_effort?: string; thinking_budget?: number | null; temperature?: number }> = {
  elena: { llm: "claude-sonnet-5-5", reasoning_effort: "low", thinking_budget: null, temperature: 0.7 },
};

// Per-patient voice trials. eleven_v3_conversational speaks emotions through audio tags ([sighs], [hesitates]...);
// with expressive_mode on, ElevenLabs adds the tag instructions to the prompt itself. Others stay on eleven_flash_v2_5.
export const PATIENT_TTS_OVERRIDES: Record<string, Record<string, unknown>> = {
  elena: {
    model_id: "eleven_v3_conversational",
    expressive_mode: true,
    speed: 0.95,
    suggested_audio_tags: [
      { tag: "sighs", description: "Устало или с облегчением вздыхает" },
      { tag: "hesitates", description: "Подбирает слова, сомневается" },
      { tag: "nervous laugh", description: "Смущается, говорит о себе или о прошлом опыте" },
      { tag: "softly", description: "Оттаяла, говорит теплее" },
      { tag: "worried", description: "Тревожится о цене или обмане" },
      { tag: "irritated", description: "Сердится на давление, увёртки или грубость" },
      { tag: "voice breaking", description: "Тяжело рассказывать про прошлую клинику" },
    ],
  },
};

// The virtual operator (Anna). Applied both by the setup script and before every call (app/api/operator/start),
// which rewrites the agent's prompt block, so everything that lives in that block must be here.
export const OPERATOR_LLM = { llm: "claude-sonnet-5-5", reasoning_effort: "low", thinking_budget: null, temperature: 0.7 };

export const OPERATOR_TTS: Record<string, unknown> = {
  model_id: "eleven_v3_conversational",
  expressive_mode: true,
  suggested_audio_tags: [
    { tag: "warmly", description: "Приветствие, благодарность, согласие пациента" },
    { tag: "smiling", description: "Дружелюбный тон, лёгкая шутка" },
    { tag: "empathetic", description: "Пациент делится страхом, болью или неприятным опытом" },
    { tag: "curious", description: "Открытый вопрос о причинах и переживаниях" },
    { tag: "reassuring", description: "Снимает тревогу, объясняет бесплатную диагностику" },
    { tag: "thoughtful", description: "Подбирает слова, уточняет" },
  ],
};

export const OPERATOR_END_CALL_TOOL = {
  type: "system",
  name: "end_call",
  description: "Завершить звонок: только после прощания, когда разговор окончен (запись закреплена, договорились о следующем контакте или человек твёрдо отказался).",
  params: { system_tool_type: "end_call" },
};
