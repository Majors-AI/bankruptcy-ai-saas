import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader, MessageSquare, ChevronDown, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getScript } from "../lib/scriptLibrary";

interface ChatMessage {
  id: string;
  sender: "client" | "ai" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
}

interface Props {
  clientId?: string;
  clientName?: string;
  draftId?: string;
  sessionId: string;
  isAdmin?: boolean;
  adminName?: string;
  embedded?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What is the means test?",
  "Why do IRS standards matter?",
  "What can I keep in bankruptcy?",
  "How long does Chapter 7 take?",
  "What debts can be discharged?",
];

export default function IntakeChatbot({
  clientId,
  clientName,
  draftId,
  sessionId,
  isAdmin = false,
  adminName,
  embedded = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Default collapsed so the chat doesn't compete with the intake form for
  // attention — clients see the form prompts first and can open the chat
  // when they actually have a question.
  const [collapsed, setCollapsed] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [draftId, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadHistory() {
    let query = supabase
      .from("intake_chats")
      .select("*")
      .order("created_at", { ascending: true });

    if (draftId) {
      query = query.eq("draft_id", draftId);
    } else {
      query = query.eq("session_id", sessionId);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      setMessages(data as ChatMessage[]);
      setInitialized(true);
    } else {
      sendWelcome();
    }
  }

  async function saveMessage(msg: Omit<ChatMessage, "id" | "created_at">) {
    const { data } = await supabase
      .from("intake_chats")
      .insert({
        draft_id: draftId ?? null,
        client_id: clientId ?? null,
        session_id: sessionId,
        sender: msg.sender,
        sender_name: msg.sender_name,
        message: msg.message,
      })
      .select()
      .maybeSingle();
    return data as ChatMessage | null;
  }

  function addLocalMessage(msg: Omit<ChatMessage, "id" | "created_at">): ChatMessage {
    const local: ChatMessage = {
      ...msg,
      id: `local_${Date.now()}_${Math.random()}`,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, local]);
    return local;
  }

  async function sendWelcome() {
    if (initialized) return;
    setInitialized(true);

    // BAN-36: client-facing opening line is sourced from script_library so it
    // can be updated platform-wide without a code change. The admin variant is
    // staff-internal and stays inline. firmName isn't available in component
    // scope today — TODO BAN-40: thread firmName from the firm context once
    // user_profiles/firms is wired in. For now pass the literal MLG.
    // NOTE: the system prompt inside supabase/functions/intake-ai-chat/index.ts
    // also needs UPL review (separate PR per BAN-34) — this only updates the
    // client-visible welcome message that appears before the LLM is involved.
    let welcomeText: string;
    if (isAdmin) {
      welcomeText = `Welcome to the intake chat. You are viewing this conversation as ${adminName ?? "a legal admin"}. You can send messages to the client from here — all messages are retained with the file.`;
    } else {
      const scripted = await getScript('intake_bot_opening', {
        firm_name: 'Majors Law Group', // TODO BAN-40: replace with firmName from auth/firm context
      });
      // Fallback to legacy inline copy if script_library lookup fails.
      welcomeText = scripted ||
        `Hi${clientName ? ` ${clientName.split(" ")[0]}` : ""}! I'm your AI assistant for the intake process. I can answer questions about the form, explain bankruptcy concepts, or help clarify anything as you go. What would you like to know?`;
    }

    const saved = await saveMessage({
      sender: "ai",
      sender_name: "AI Assistant",
      message: welcomeText,
    });
    if (saved) {
      setMessages([saved]);
    } else {
      addLocalMessage({ sender: "ai", sender_name: "AI Assistant", message: welcomeText });
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const trimmed = text.trim();
    setInput("");

    const senderName = isAdmin ? (adminName ?? "Legal Admin") : (clientName ?? "Client");
    const senderRole = isAdmin ? "admin" : "client";

    const userSaved = await saveMessage({ sender: senderRole, sender_name: senderName, message: trimmed });
    if (userSaved) {
      setMessages(prev => [...prev, userSaved]);
    } else {
      addLocalMessage({ sender: senderRole, sender_name: senderName, message: trimmed });
    }

    if (isAdmin) return;

    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ sender: m.sender, message: m.message }));

      const res = await fetch(`${supabaseUrl}/functions/v1/intake-ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ message: trimmed, history }),
      });

      const json = await res.json();
      const reply = json.reply ?? "I'm sorry, I wasn't able to generate a response. Please try again or ask your attorney.";

      const aiSaved = await saveMessage({ sender: "ai", sender_name: "AI Assistant", message: reply });
      if (aiSaved) {
        setMessages(prev => [...prev, aiSaved]);
      } else {
        addLocalMessage({ sender: "ai", sender_name: "AI Assistant", message: reply });
      }
    } catch {
      const errMsg = "I'm having trouble connecting right now. Your question has been recorded and our team will follow up.";
      const errSaved = await saveMessage({ sender: "ai", sender_name: "AI Assistant", message: errMsg });
      if (errSaved) {
        setMessages(prev => [...prev, errSaved]);
      } else {
        addLocalMessage({ sender: "ai", sender_name: "AI Assistant", message: errMsg });
      }
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  if (embedded) {
    return (
      <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare size={24} className="text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Loading chat history...</p>
              </div>
            </div>
          )}
          {messages.map(msg => {
            const isAi = msg.sender === "ai";
            const isAdminMsg = msg.sender === "admin";
            return (
              <div key={msg.id} className={`flex gap-2 ${isAi || isAdminMsg ? "justify-start" : "justify-end"}`}>
                {(isAi || isAdminMsg) && (
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isAi ? "bg-amber-400/15" : "bg-blue-500/15"}`}>
                    {isAi ? <Bot size={12} className="text-amber-400" /> : <User size={12} className="text-blue-400" />}
                  </div>
                )}
                <div className={`max-w-[78%] ${isAi || isAdminMsg ? "" : "order-first"}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-xs font-semibold ${isAi ? "text-amber-400" : isAdminMsg ? "text-blue-400" : "text-slate-400"}`}>
                      {msg.sender_name}
                    </span>
                    <span className="text-slate-600 text-xs">{formatTime(msg.created_at)}</span>
                  </div>
                  <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                    isAi
                      ? "bg-slate-800 text-slate-200 rounded-tl-sm"
                      : isAdminMsg
                      ? "bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tl-sm"
                      : "bg-amber-400/15 border border-amber-400/20 text-amber-100 rounded-tr-sm"
                  }`}>
                    {msg.message}
                  </div>
                </div>
                {!isAi && !isAdminMsg && (
                  <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={12} className="text-amber-400" />
                  </div>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={12} className="text-amber-400" />
              </div>
              <div className="bg-slate-800 rounded-xl rounded-tl-sm px-3 py-2">
                <Loader size={12} className="text-amber-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-800 p-3 flex gap-2 items-end bg-slate-900/50">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAdmin ? `Message as ${adminName ?? "Legal Admin"}...` : "Ask a question about your intake..."}
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 focus:border-amber-400/40 rounded-xl px-3 py-2 text-white text-xs focus:outline-none placeholder-slate-600 resize-none transition-colors"
            style={{ minHeight: "36px", maxHeight: "90px" }}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              input.trim() && !loading
                ? "bg-amber-400 hover:bg-amber-300 text-slate-900"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            <Send size={13} />
          </button>
        </div>
        <div className="px-3 pb-2.5 pt-0 bg-slate-900/50">
          <p className="text-xs text-slate-600 text-center">Messages are visible to the client and retained with their file</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-400/15 rounded-lg flex items-center justify-center">
            <Sparkles size={13} className="text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-white text-xs font-semibold">
              {isAdmin ? "Client Chat" : "Ask a Question"}
            </p>
            {isAdmin && (
              <p className="text-slate-500 text-xs">All messages retained with file</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-xs bg-amber-400/15 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {!collapsed && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: "340px" }}>
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare size={24} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">Loading chat...</p>
                </div>
              </div>
            )}

            {messages.map(msg => {
              const isAi = msg.sender === "ai";
              const isAdminMsg = msg.sender === "admin";
              return (
                <div key={msg.id} className={`flex gap-2 ${isAi || isAdminMsg ? "justify-start" : "justify-end"}`}>
                  {(isAi || isAdminMsg) && (
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isAi ? "bg-amber-400/15" : "bg-blue-500/15"}`}>
                      {isAi ? <Bot size={12} className="text-amber-400" /> : <User size={12} className="text-blue-400" />}
                    </div>
                  )}
                  <div className={`max-w-[78%] ${isAi || isAdminMsg ? "" : "order-first"}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-xs font-semibold ${isAi ? "text-amber-400" : isAdminMsg ? "text-blue-400" : "text-slate-400"}`}>
                        {msg.sender_name}
                      </span>
                      <span className="text-slate-600 text-xs">{formatTime(msg.created_at)}</span>
                    </div>
                    <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                      isAi
                        ? "bg-slate-800 text-slate-200 rounded-tl-sm"
                        : isAdminMsg
                        ? "bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tl-sm"
                        : "bg-amber-400/15 border border-amber-400/20 text-amber-100 rounded-tr-sm"
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                  {!isAi && !isAdminMsg && (
                    <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={12} className="text-amber-400" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={12} className="text-amber-400" />
                </div>
                <div className="bg-slate-800 rounded-xl rounded-tl-sm px-3 py-2">
                  <Loader size={12} className="text-amber-400 animate-spin" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {!isAdmin && messages.length === 1 && (
            <div className="px-3 pb-2">
              <p className="text-xs text-slate-500 mb-1.5">Suggested questions:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-400/40 text-slate-300 px-2.5 py-1 rounded-lg transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-700 p-3 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAdmin ? "Send a message to the client..." : "Ask a question about your intake..."}
              rows={1}
              className="flex-1 bg-slate-800 border border-slate-600 focus:border-amber-400/60 rounded-xl px-3 py-2 text-white text-xs focus:outline-none placeholder-slate-500 resize-none transition-colors"
              style={{ minHeight: "36px", maxHeight: "90px" }}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                input.trim() && !loading
                  ? "bg-amber-400 hover:bg-amber-300 text-slate-900"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Send size={13} />
            </button>
          </div>

          <div className="px-3 pb-2.5 pt-0">
            <p className="text-xs text-slate-600 text-center">
              {isAdmin
                ? "Messages are visible to the client and retained with their file"
                : "All messages are saved and shared with your attorney"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
