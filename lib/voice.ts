import type { useConversation } from "@elevenlabs/react";
import { LoggerNames, setLogLevel } from "livekit-client";

type Conversation = ReturnType<typeof useConversation>;

// When the voice server closes the call, LiveKit's signal loop logs "error reading from signal stream {}" via console.error,
// which the Next.js dev overlay shows as an error. The call is already over by then; real failures still reach onError/onDisconnect.
setLogLevel("silent", LoggerNames.Signal);

/**
 * Starts a voice session over WebRTC (lower latency) and falls back to the WebSocket signed URL.
 * Open the page with ?transport=ws to force the WebSocket path.
 */
export async function startSessionFast(
  conversation: Conversation,
  body: { signedUrl: string; conversationToken?: string | null; dynamicVariables?: Record<string, string> },
) {
  const dynamicVariables = body.dynamicVariables;
  const forceWs = new URLSearchParams(window.location.search).get("transport") === "ws";
  if (body.conversationToken && !forceWs) {
    try {
      await conversation.startSession({ conversationToken: body.conversationToken, connectionType: "webrtc", dynamicVariables });
      return "webrtc";
    } catch (e) {
      console.warn("WebRTC start failed, falling back to WebSocket", e);
    }
  }
  await conversation.startSession({ signedUrl: body.signedUrl, dynamicVariables });
  return "websocket";
}
