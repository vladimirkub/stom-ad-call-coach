import type { useConversation } from "@elevenlabs/react";

type Conversation = ReturnType<typeof useConversation>;

/**
 * Starts a voice session over WebRTC (lower latency) and falls back to the WebSocket signed URL.
 * Open the page with ?transport=ws to force the WebSocket path.
 */
export async function startSessionFast(conversation: Conversation, body: { signedUrl: string; conversationToken?: string | null }) {
  const forceWs = new URLSearchParams(window.location.search).get("transport") === "ws";
  if (body.conversationToken && !forceWs) {
    try {
      await conversation.startSession({ conversationToken: body.conversationToken, connectionType: "webrtc" });
      return "webrtc";
    } catch (e) {
      console.warn("WebRTC start failed, falling back to WebSocket", e);
    }
  }
  await conversation.startSession({ signedUrl: body.signedUrl });
  return "websocket";
}
