import ChatWidget from "../ChatWidget";

interface IntakeChatbotProps {
  clientId?: string;
  clientName?: string;
  sessionId?: string | null;
  isAdmin?: boolean;
}

export default function IntakeChatbot({ clientId, clientName, sessionId, isAdmin }: IntakeChatbotProps) {
  return (
    <ChatWidget
      sectionContext={sessionId ? `Session ${sessionId}` : undefined}
    />
  );
}
