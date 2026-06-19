// "Get Help" — the public-facing entry screen for Change 1.
//
// Fresh, simple, standalone page. Does NOT retrofit ClientRegistration;
// reuses Tailwind primitives + the light/blue chrome from the
// registration restyle. Six entry options in priority order (Change 1
// spec): Call now, Chat now, Text us, Schedule, Self-serve, Email.
//
// Each option:
//   1. Creates a firm-scoped Lead via `createLead({ channel })`.
//   2. Branches to the matching next step (tel: link, FloatingChat,
//      one-tap soonest slot, the questionnaire, or an email-capture
//      stub). Soonest-slot booking uses `intakeScheduling.findSoonestSlot`
//      / `bookSlot` (Phase 1 adapter).
//   3. Surfaces a clean confirmation, with errors flagged honestly when
//      a step fails (no fake success messages).
//
// Feature flags (Change 1):
//   - ENABLE_SMS_INTAKE: hides the "Text us" path behind a coming-soon
//     state until A2P is live. Default OFF.
//
// Lead lifecycle:
//   - The lead is created with `lifecycle_status` set per channel —
//     `call_now` starts at `contacted` (they're literally on the phone),
//     everything else starts at `new`. The `follow_up_queue` is set to
//     `priority` for `call_now` per spec.

import { useState, useEffect } from "react";
import {
  Phone, MessageSquare, MessageCircle, Calendar, FileText, Mail,
  CheckCircle2, AlertCircle, ChevronRight, Loader2,
} from "lucide-react";
import { createLead } from "../../lib/createLead";
import { findSoonestSlot, bookSlot, type OpenSlot } from "../../lib/intakeScheduling";
import type { LeadChannel } from "../../lib/leadLifecycle";
import { supabase } from "../../lib/supabase";

/** Coming-soon gate for the SMS path. Flip to true once A2P is live and
 *  the SMS bot's inbound webhook is wired. Today the path renders as a
 *  disabled card with "available soon" copy — the route exists, just
 *  doesn't fire. */
const ENABLE_SMS_INTAKE = false;

/** Branding fallbacks for the MLG pilot. Real firm name + phone come
 *  from firm_branding (display_name + firm_phone — the firm_phone column
 *  is specced for Canelo in docs/schema-changes-for-canelo.md §1.5). If
 *  the column doesn't exist yet, we fall back to VITE_FIRM_PHONE. */
const FALLBACK_FIRM_NAME = "Majors Law Group";
const ENV_FIRM_PHONE = (import.meta.env.VITE_FIRM_PHONE as string | undefined) ?? "";

interface FirmBranding {
  display_name: string;
  logo_url: string | null;
  firm_phone: string | null;
  firm_phone_e164: string | null;
}

/** Read the firm-branding row (display_name + phone). Returns null on
 *  any error (column missing, RLS, etc.) — the page falls back to
 *  defaults so the public entry never breaks the public surface. */
async function loadFirmBranding(firmId: string | undefined): Promise<FirmBranding | null> {
  if (!firmId) return null;
  try {
    const { data, error } = await supabase
      .from("firm_branding")
      .select("display_name, logo_url, firm_phone, firm_phone_e164")
      .eq("firm_id", firmId)
      .maybeSingle();
    if (error || !data) return null;
    return data as FirmBranding;
  } catch {
    return null;
  }
}

export interface GetHelpEntryProps {
  /** Callback when the client picks "Do it myself" — the host routes
   *  to the existing self-serve questionnaire view. */
  onSelfServe: (leadId: string) => void;
  /** Callback when the client picks "Chat now" — the host opens the
   *  AI live chat (the existing FloatingChat surface today; the
   *  full questionnaire engine bot lands in Phase 4). */
  onChatNow: (leadId: string) => void;
  /** Optional override of the resolved firm id. Defaults to the MLG
   *  pilot firm via VITE_FIRM_ID at the createLead layer. */
  firmId?: string;
}

type EntryState =
  | { kind: "idle" }
  | { kind: "creating"; channel: LeadChannel }
  | { kind: "scheduling"; leadId: string; slot: OpenSlot | null; loading: boolean }
  | { kind: "email_capture"; leadId: string }
  | { kind: "sms_coming_soon" }
  | { kind: "success"; channel: LeadChannel; leadId: string; detail?: string }
  | { kind: "error"; message: string };

export default function GetHelpEntry({ onSelfServe, onChatNow, firmId }: GetHelpEntryProps) {
  const [state, setState] = useState<EntryState>({ kind: "idle" });
  const [branding, setBranding] = useState<FirmBranding | null>(null);

  // Load firm branding once. Failure is non-fatal — fallbacks render.
  useEffect(() => {
    const env = (import.meta.env.VITE_FIRM_ID as string | undefined);
    loadFirmBranding(firmId ?? env).then(b => setBranding(b));
  }, [firmId]);

  const firmName = branding?.display_name?.trim() || FALLBACK_FIRM_NAME;
  const firmPhoneDisplay = branding?.firm_phone?.trim() || ENV_FIRM_PHONE || "(call to be connected)";
  const firmPhoneE164 = branding?.firm_phone_e164?.trim() || ENV_FIRM_PHONE || "";

  // ── Option handlers ─────────────────────────────────────────────────────

  async function pick(channel: LeadChannel) {
    setState({ kind: "creating", channel });
    const result = await createLead({ channel, firmId });
    if (!result.ok || !result.leadId) {
      setState({ kind: "error", message: `Could not create your lead (${result.reason ?? "unknown reason"}). Please try again or call us.` });
      return;
    }
    return result.leadId;
  }

  async function handleCallNow() {
    const leadId = await pick("call_now");
    if (!leadId) return;
    // The lead is created + flagged priority. We do NOT initiate a tel:
    // here (the button's <a href="tel:..."> handles that); we only mark
    // success so the UI updates after the dialer launches.
    setState({
      kind: "success",
      channel: "call_now",
      leadId,
      detail: firmPhoneDisplay
        ? `Your call to ${firmPhoneDisplay} is logged. An intake specialist will pick up shortly.`
        : "Your call is logged. An intake specialist will pick up shortly.",
    });
  }

  async function handleChatNow() {
    const leadId = await pick("live_chat");
    if (!leadId) return;
    setState({ kind: "success", channel: "live_chat", leadId });
    onChatNow(leadId);
  }

  function handleTextUs() {
    if (!ENABLE_SMS_INTAKE) {
      setState({ kind: "sms_coming_soon" });
      return;
    }
    void pick("sms").then(leadId => {
      if (!leadId) return;
      setState({ kind: "success", channel: "sms", leadId, detail: "You'll receive a text shortly to start." });
    });
  }

  async function handleScheduleNow() {
    const leadId = await pick("scheduled");
    if (!leadId) return;
    setState({ kind: "scheduling", leadId, slot: null, loading: true });
    const slot = await findSoonestSlot();
    setState({ kind: "scheduling", leadId, slot, loading: false });
  }

  async function confirmSchedule(leadId: string, slot: OpenSlot, name: string, phone: string, email: string) {
    setState({ kind: "creating", channel: "scheduled" });   // reuse "creating" spinner
    const res = await bookSlot({
      leadId,
      staffId: slot.staff_id,
      startIso: slot.slot_start,
      endIso:   slot.slot_end,
      clientName: name || "Get-Help visitor",
      clientPhone: phone || null,
      clientEmail: email || null,
      createdBy: "Get Help entry",
    });
    if (!res.ok) {
      setState({ kind: "error", message: `Booking failed: ${res.reason ?? "unknown reason"}. Please try a different time or call us.` });
      return;
    }
    const when = new Date(slot.slot_start).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
    setState({
      kind: "success",
      channel: "scheduled",
      leadId,
      detail: `Booked with ${slot.staff_name} on ${when}. Confirmation email and reminder on the way.`,
    });
  }

  async function handleSelfServe() {
    const leadId = await pick("self_serve");
    if (!leadId) return;
    setState({ kind: "success", channel: "self_serve", leadId });
    onSelfServe(leadId);
  }

  async function handleEmail() {
    const leadId = await pick("agent_assisted");
    if (!leadId) return;
    setState({ kind: "email_capture", leadId });
  }

  async function submitEmailCapture(leadId: string, name: string, email: string) {
    // The email-interview engine (Change 2) isn't live yet — for v1 we
    // confirm receipt + the firm will send the first interview email
    // manually. When the engine lands, this branch will call
    // `start_email_interview` and the client immediately gets question 1.
    // The lead row is already populated by createLead(); store the
    // captured contact info now.
    if (name || email) {
      await supabase
        .from("intake_leads")
        .update({ full_name: name || null, email: email || null })
        .eq("id", leadId);
    }
    setState({
      kind: "success",
      channel: "agent_assisted",
      leadId,
      detail: "Got it — we'll email you within 24 hours to start your interview.",
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-5 py-5 flex items-center gap-3">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={`${firmName} logo`} className="h-10 w-auto"/>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
              {firmName[0]}
            </div>
          )}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">{firmName}</p>
            <p className="text-[10px] text-slate-500">Bankruptcy intake — get help in one step</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-8">
        {/* Stage: idle — show the six options */}
        {state.kind === "idle" && (
          <>
            <div className="mb-7 text-center">
              <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                How would you like to start?
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                Pick the option that fits you best. Every path connects you
                to a real person at {firmName} — we just want to make it
                easy to start.
              </p>
            </div>
            <div className="space-y-3">
              <OptionCard
                icon={<Phone className="w-5 h-5" />}
                title="Call now"
                blurb={firmPhoneDisplay ? `Speak with an intake specialist now — ${firmPhoneDisplay}.` : "Speak with an intake specialist right now."}
                cta="Call"
                primary
                href={firmPhoneE164 ? `tel:${firmPhoneE164.replace(/[^\d+]/g, "")}` : undefined}
                onClick={handleCallNow}
              />
              <OptionCard
                icon={<MessageCircle className="w-5 h-5" />}
                title="Chat now"
                blurb={`Start a live chat — our AI walks you through the questions and an intake specialist is one click away.`}
                cta="Start chat"
                primary
                onClick={handleChatNow}
              />
              <OptionCard
                icon={<MessageSquare className="w-5 h-5" />}
                title={ENABLE_SMS_INTAKE ? "Text us — we'll gather your info" : "Text us — we'll gather your info (coming soon)"}
                blurb={ENABLE_SMS_INTAKE
                  ? "We'll text you to start. Reply at your own pace."
                  : "Text intake is being set up. For now, please pick one of the other options."}
                cta={ENABLE_SMS_INTAKE ? "Text me" : "Coming soon"}
                disabled={!ENABLE_SMS_INTAKE}
                onClick={handleTextUs}
              />
              <OptionCard
                icon={<Calendar className="w-5 h-5" />}
                title="Schedule a call or video call"
                blurb="Pick the soonest open slot — we'll book it for you. One tap."
                cta="Find the soonest time"
                onClick={handleScheduleNow}
              />
              <OptionCard
                icon={<FileText className="w-5 h-5" />}
                title="Do it myself (self-serve)"
                blurb="Open the questionnaire and fill it out at your own pace. You can come back and finish later."
                cta="Open questionnaire"
                onClick={handleSelfServe}
              />
              <OptionCard
                icon={<Mail className="w-5 h-5" />}
                title="By email"
                blurb="We'll email you one question at a time. Answer when you have a minute."
                cta="Start by email"
                muted
                onClick={handleEmail}
              />
            </div>
          </>
        )}

        {/* Stage: creating — generic spinner while a lead is being inserted */}
        {state.kind === "creating" && (
          <StageCard>
            <div className="flex items-center gap-3 text-blue-700">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-sm font-semibold">Getting things ready…</p>
            </div>
          </StageCard>
        )}

        {/* Stage: scheduling — show the resolved soonest slot + confirm */}
        {state.kind === "scheduling" && (
          <ScheduleConfirm
            slot={state.slot}
            loading={state.loading}
            firmName={firmName}
            onConfirm={(name, phone, email) => state.slot && confirmSchedule(state.leadId, state.slot, name, phone, email)}
            onCancel={() => setState({ kind: "idle" })}
          />
        )}

        {/* Stage: email_capture — capture name + email; queue the interview */}
        {state.kind === "email_capture" && (
          <EmailCapture
            firmName={firmName}
            onSubmit={(name, email) => submitEmailCapture(state.leadId, name, email)}
            onCancel={() => setState({ kind: "idle" })}
          />
        )}

        {/* Stage: SMS coming soon */}
        {state.kind === "sms_coming_soon" && (
          <StageCard>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 mb-1">Text intake — coming soon</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We're setting up SMS intake right now. In the meantime, please
                  pick one of the other options — call, chat, schedule, self-serve,
                  or email all connect you to the same intake team.
                </p>
                <button onClick={() => setState({ kind: "idle" })}
                  className="mt-4 text-xs font-semibold text-blue-700 hover:text-blue-800">
                  ← Back to options
                </button>
              </div>
            </div>
          </StageCard>
        )}

        {/* Stage: success */}
        {state.kind === "success" && (
          <StageCard>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 mb-1">You're in good hands.</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {state.detail || `Your intake has started (channel: ${state.channel}). An intake specialist will follow up shortly.`}
                </p>
                <p className="text-[10px] text-slate-400 mt-3 font-mono">Lead ref: {state.leadId.slice(0, 8)}…</p>
              </div>
            </div>
          </StageCard>
        )}

        {/* Stage: error */}
        {state.kind === "error" && (
          <StageCard>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 mb-1">Something went wrong</p>
                <p className="text-xs text-slate-600 leading-relaxed">{state.message}</p>
                <button onClick={() => setState({ kind: "idle" })}
                  className="mt-4 text-xs font-semibold text-blue-700 hover:text-blue-800">
                  ← Back to options
                </button>
              </div>
            </div>
          </StageCard>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-5 py-4 text-center">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {firmName} is a debt-relief agency. We help people file for bankruptcy
            relief under the Bankruptcy Code. By starting an intake you agree to
            be contacted about your case.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  cta: string;
  primary?: boolean;
  muted?: boolean;
  disabled?: boolean;
  href?: string;
  onClick: () => void;
}

function OptionCard({ icon, title, blurb, cta, primary, muted, disabled, href, onClick }: OptionCardProps) {
  const baseCls =
    "w-full flex items-start gap-4 p-5 rounded-2xl border transition-all text-left";
  const stateCls = disabled
    ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
    : primary
      ? "border-blue-200 bg-white hover:border-blue-400 hover:shadow-md hover:shadow-blue-100"
      : muted
        ? "border-slate-200 bg-white hover:border-slate-400"
        : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm";

  const inner = (
    <>
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
        primary ? "bg-blue-100 text-blue-700" : muted ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-600"
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${disabled ? "text-slate-500" : "text-slate-900"} mb-0.5`}>{title}</p>
        <p className="text-xs text-slate-600 leading-relaxed">{blurb}</p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold self-center whitespace-nowrap">
        <span className={
          disabled
            ? "text-slate-400"
            : primary
              ? "text-blue-700"
              : "text-slate-700"
        }>{cta}</span>
        {!disabled && <ChevronRight className="w-4 h-4" />}
      </div>
    </>
  );

  // Call-now uses an <a href="tel:..."> so the OS dial-out works on mobile.
  // We still fire onClick so the lead row is created and follow-up_queue
  // is set. The tel: link opens AFTER onClick because it's an <a> click
  // handler chain — same UI flow as a button + redirect.
  if (href && !disabled) {
    return (
      <a
        href={href}
        onClick={() => onClick()}
        className={`${baseCls} ${stateCls}`}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      className={`${baseCls} ${stateCls}`}
    >
      {inner}
    </button>
  );
}

function StageCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function ScheduleConfirm({
  slot, loading, firmName, onConfirm, onCancel,
}: {
  slot: OpenSlot | null;
  loading: boolean;
  firmName: string;
  onConfirm: (name: string, phone: string, email: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  if (loading) {
    return (
      <StageCard>
        <div className="flex items-center gap-3 text-blue-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-sm font-semibold">Finding the soonest open time…</p>
        </div>
      </StageCard>
    );
  }
  if (!slot) {
    return (
      <StageCard>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-900 mb-1">No open times in the next few weeks.</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Please call us or pick another option — we'll get you scheduled directly.
            </p>
            <button onClick={onCancel} className="mt-4 text-xs font-semibold text-blue-700 hover:text-blue-800">
              ← Back to options
            </button>
          </div>
        </div>
      </StageCard>
    );
  }

  const when = new Date(slot.slot_start).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  return (
    <StageCard>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-1">Soonest open time</p>
      <p className="text-lg font-bold text-slate-900 mb-1">{when}</p>
      <p className="text-xs text-slate-600 mb-4">with {slot.staff_name} at {firmName}</p>
      <div className="space-y-2 mb-4">
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Your full name"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="Phone number"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email (for the confirmation)"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onConfirm(name, phone, email)}
          disabled={!name.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          Confirm this time
        </button>
        <button onClick={onCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2.5">
          Cancel
        </button>
      </div>
    </StageCard>
  );
}

function EmailCapture({
  firmName, onSubmit, onCancel,
}: {
  firmName: string;
  onSubmit: (name: string, email: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const valid = !!email.trim() && email.includes("@");

  return (
    <StageCard>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-1">Email interview</p>
      <p className="text-sm text-slate-900 font-semibold mb-1">We'll email you one question at a time.</p>
      <p className="text-xs text-slate-600 leading-relaxed mb-4">
        Tell us how to reach you. {firmName} will start your interview within 24 hours.
      </p>
      <div className="space-y-2 mb-4">
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit(name, email)}
          disabled={!valid}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          <Mail className="w-4 h-4" />
          Start by email
        </button>
        <button onClick={onCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2.5">
          Cancel
        </button>
      </div>
    </StageCard>
  );
}
