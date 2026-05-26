import { useState, useRef, useEffect, useCallback } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isLegalEscalation?: boolean;
  needsMoreExplanation?: boolean;
  questionId?: string;
  timestamp: Date;
}

interface ChatResponse {
  message: string;
  session_id: string;
  is_legal_question: boolean;
  escalated: boolean;
  suggested_followups: string[];
}

export interface ClientQuestion {
  id: string;
  question: string;
  ai_response: string | null;
  status: 'answered' | 'needs_attorney' | 'pending_review';
  escalated: boolean;
  needs_additional_explanation: boolean;
  attorney_answer: string | null;
  asked_at: string;
  section_context?: string;
}

const SUGGESTED_STARTERS = [
  "How long does Chapter 7 take?",
  "What happens at the 341 meeting?",
  "What documents do I need to upload?",
  "When will creditors stop calling?",
  "What is the automatic stay?",
  "How does the portal unlock?",
];

const CLIENT_ID = "client-demo";
const CLIENT_NAME = "Client";

interface ChatWidgetProps {
  sectionContext?: string;
  onQuestionsChange?: (questions: ClientQuestion[]) => void;
}

export default function ChatWidget({ sectionContext, onQuestionsChange }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followups, setFollowups] = useState<string[]>(SUGGESTED_STARTERS);
  const [unread, setUnread] = useState(0);
  const [hasOpened, setHasOpened] = useState(false);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [showQuestions, setShowQuestions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing questions for this client
  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (onQuestionsChange) onQuestionsChange(questions);
  }, [questions, onQuestionsChange]);

  async function loadQuestions() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/client_questions?client_id=eq.${CLIENT_ID}&order=asked_at.desc`,
        { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setQuestions(data || []);
      }
    } catch { /* silently fail */ }
  }

  async function saveQuestion(question: string, aiResponse: string | null, escalated: boolean): Promise<string | null> {
    try {
      const payload = {
        client_id: CLIENT_ID,
        client_name: CLIENT_NAME,
        question,
        ai_response: aiResponse,
        status: escalated ? 'needs_attorney' : aiResponse ? 'answered' : 'pending_review',
        escalated,
        needs_additional_explanation: false,
        section_context: sectionContext || null,
        session_id: sessionId || null,
      };
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/client_questions`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(payload),
        }
      );
      if (res.ok) {
        const [saved] = await res.json();
        setQuestions(prev => [saved, ...prev]);
        return saved?.id || null;
      }
    } catch { /* silently fail */ }
    return null;
  }

  async function markNeedsMoreExplanation(questionId: string) {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/client_questions?id=eq.${questionId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ needs_additional_explanation: true, status: 'needs_attorney' }),
        }
      );
      setQuestions(prev => prev.map(q => q.id === questionId
        ? { ...q, needs_additional_explanation: true, status: 'needs_attorney' }
        : q
      ));
    } catch { /* silently fail */ }
  }

  useEffect(() => {
    if (open) {
      setUnread(0);
      setHasOpened(true);
      setTimeout(() => inputRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: "Hi! I'm your Case Assistant. I can answer questions about the bankruptcy process, timelines, what to expect, and how to use this portal. What would you like to know?",
          timestamp: new Date(),
        }]);
      }
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setFollowups([]);
    setLoading(true);

    const historyForApi = messages
      .filter(m => m.role !== 'system')
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/chat-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            message: trimmed,
            session_id: sessionId,
            client_id: CLIENT_ID,
            client_name: CLIENT_NAME,
            history: historyForApi,
          }),
        }
      );

      const data: ChatResponse = await res.json();
      if (data.session_id && !sessionId) setSessionId(data.session_id);

      // Save every question to the persistent list
      const qId = await saveQuestion(trimmed, data.message, data.is_legal_question);

      const assistantMsg: Message = {
        id: Date.now().toString() + '-a',
        role: 'assistant',
        content: data.message,
        isLegalEscalation: data.is_legal_question,
        questionId: qId || undefined,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.is_legal_question) {
        const escalationMsg: Message = {
          id: Date.now().toString() + '-esc',
          role: 'system',
          content: '',
          isLegalEscalation: true,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, escalationMsg]);
      }

      setFollowups(data.suggested_followups?.slice(0, 3) || []);

      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '-err',
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment, or reach out to your attorney directly.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, sessionId, open, sectionContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const pendingCount = questions.filter(q => q.status === 'needs_attorney' || q.status === 'pending_review').length;
  const totalCount = questions.length;

  return (
    <>
      {/* Questions Panel */}
      {showQuestions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full sm:max-w-2xl bg-slate-900 border border-slate-700 rounded-none sm:rounded-2xl flex flex-col max-h-screen sm:max-h-[85vh] shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-white font-bold text-base">My Questions</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {totalCount} question{totalCount !== 1 ? 's' : ''} total
                  {pendingCount > 0 && <> · <span className="text-amber-400 font-semibold">{pendingCount} pending attorney review</span></>}
                </p>
              </div>
              <button onClick={() => setShowQuestions(false)} className="text-slate-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {questions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                  </div>
                  <p className="text-slate-500 text-sm">No questions yet. Use the chat assistant to ask anything about your case.</p>
                </div>
              ) : (
                questions.map(q => (
                  <div key={q.id} className={`rounded-2xl border p-4 ${
                    q.status === 'needs_attorney' ? 'bg-amber-400/5 border-amber-400/25' :
                    q.status === 'answered' && q.attorney_answer ? 'bg-green-500/5 border-green-500/25' :
                    'bg-slate-800/60 border-slate-700'
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-semibold text-white leading-snug flex-1">{q.question}</p>
                      {q.status === 'needs_attorney' ? (
                        <span className="shrink-0 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">Pending Attorney</span>
                      ) : q.attorney_answer ? (
                        <span className="shrink-0 text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">Answered</span>
                      ) : (
                        <span className="shrink-0 text-xs font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap">Logged</span>
                      )}
                    </div>

                    {q.section_context && (
                      <p className="text-xs text-slate-500 mb-2">Asked in: {q.section_context}</p>
                    )}

                    {q.ai_response && (
                      <div className="bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 mb-2">
                        <p className="text-xs font-semibold text-slate-400 mb-1">Case Assistant answered:</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{q.ai_response}</p>
                      </div>
                    )}

                    {q.attorney_answer && (
                      <div className="bg-green-500/8 border border-green-500/25 rounded-xl px-3 py-2.5 mb-2">
                        <p className="text-xs font-semibold text-green-400 mb-1">Attorney answered{q.answered_by ? ` (${q.answered_by})` : ''}:</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{q.attorney_answer}</p>
                      </div>
                    )}

                    {q.status === 'answered' && !q.attorney_answer && !q.needs_additional_explanation && (
                      <button
                        onClick={() => markNeedsMoreExplanation(q.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors mt-1"
                      >
                        I need more explanation — send to attorney
                      </button>
                    )}

                    {q.needs_additional_explanation && !q.attorney_answer && (
                      <p className="text-xs text-amber-300 mt-1 italic">Sent to attorney team for additional explanation.</p>
                    )}

                    <p className="text-xs text-slate-600 mt-2">{new Date(q.asked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
              <button
                onClick={() => { setShowQuestions(false); setOpen(true); }}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                Ask Another Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions pill button */}
      {totalCount > 0 && !open && (
        <button
          onClick={() => setShowQuestions(true)}
          className="fixed bottom-24 right-6 z-40 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg transition-all"
        >
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          My Questions
          {pendingCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center">{pendingCount}</span>
          )}
        </button>
      )}

      {/* Floating chat button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          open
            ? 'bg-slate-700 hover:bg-slate-600 rotate-180'
            : 'bg-amber-400 hover:bg-amber-300'
        }`}
        aria-label="Open case assistant"
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        ) : (
          <svg className="w-6 h-6 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
        )}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div className={`fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl border border-slate-700 bg-[#0f172a] overflow-hidden transition-all duration-300 origin-bottom-right ${
        open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'
      }`}
        style={{ maxHeight: 'calc(100vh - 140px)', minHeight: '480px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-none">Case Assistant</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sectionContext ? `Currently in: ${sectionContext}` : 'Ask anything about your case'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <button
                onClick={() => { setOpen(false); setShowQuestions(true); }}
                className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {totalCount}
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-xs text-slate-500">Online</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} onNeedsMoreExplanation={markNeedsMoreExplanation} />
          ))}

          {loading && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                </div>
              </div>
            </div>
          )}

          {/* Suggested follow-ups */}
          {!loading && followups.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {followups.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-amber-400/50 hover:text-white hover:bg-amber-400/5 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your case..."
              disabled={loading}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-slate-600 mt-2">
            All questions are saved · Legal questions go to your attorney
          </p>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message, onNeedsMoreExplanation }: { message: Message; onNeedsMoreExplanation: (id: string) => void }) {
  const [markedForExplanation, setMarkedForExplanation] = useState(false);

  if (message.role === 'system' && message.isLegalEscalation) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Referred to Attorney Team</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your question has been sent to <strong className="text-white">all attorneys in your legal team</strong> and saved to your question log. An attorney will review and respond within <strong className="text-amber-400">24–48 hours</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0 mb-0.5">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-amber-400 text-slate-950 font-medium rounded-br-sm'
            : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
        }`}>
          {message.content}
        </div>
        {!isUser && message.questionId && !message.isLegalEscalation && !markedForExplanation && (
          <button
            onClick={() => { setMarkedForExplanation(true); onNeedsMoreExplanation(message.questionId!); }}
            className="text-xs text-slate-600 hover:text-amber-400 transition-colors self-start ml-1"
          >
            I need more explanation
          </button>
        )}
        {markedForExplanation && (
          <p className="text-xs text-amber-400/70 self-start ml-1 italic">Sent to attorney for more detail.</p>
        )}
      </div>
    </div>
  );
}
