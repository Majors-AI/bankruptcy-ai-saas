// Post-call "Scheduled" workflow — SCAFFOLD.
//
// When a dashboard task gets marked "Called → Scheduled," we promise the
// client two automated touches:
//   1) An SMS with a consent opt-in / opt-out link.
//   2) A confirmation email with the consult details.
//
// Neither sends today. This modal is the visible surface that PROMISES the
// behavior + previews exactly what will go out once the backend is wired.
// Staff hit "Continue to scheduler" and the existing scheduling flow runs;
// the sends are queued conceptually but no real outbound traffic happens.
//
// WHAT'S NOT IN SCOPE (TODO Phase B):
//   - Twilio SMS dispatch + delivery callback.
//   - SendGrid email dispatch + open/click tracking.
//   - Consent table: per-client opt_in_status, opted_out_at, opt_in_source.
//     Drop opted-out clients from the outbound SMS list (filter on opt-out
//     flag at queue time, not at send time).
//   - Surface the dispatched messages in ConsolidatedMessagingWidget's
//     All / SMS / Email tabs (the read path is already in place — once a
//     `client_messages` row is inserted with channel='sms'/'email' and
//     sender_role='firm', it shows up automatically).
//
// NO REAL SENDS. NO DB WRITES. Local UI state only.

import { useState, type ReactNode } from "react";
import { Mail, MessageSquare, Send, X, ShieldCheck, AlertCircle } from "lucide-react";

export interface PostCallScheduledModalProps {
  /** Lead being scheduled — used to template the previews. */
  lead: {
    full_name: string;
    phone: string | null;
    email: string | null;
    /**
     * Optional read-only opt-out flag. Field doesn't exist in the schema yet
     * (TODO: consent table); if/when present, the SMS preview shows a clear
     * "SMS suppressed — client opted out" warning instead of the preview.
     */
    sms_opt_out?: boolean | null;
  };
  /** Closes the modal without continuing. */
  onCancel: () => void;
  /** Continue to the existing scheduler flow. */
  onContinue: () => void;
}

export default function PostCallScheduledModal({
  lead, onCancel, onContinue,
}: PostCallScheduledModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const optedOut = lead.sms_opt_out === true;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post-call scheduled sends"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#2A2A28] bg-[#1A1A18] shadow-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#2A2A28] flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-[#FAFAF7]">Reached — scheduling</h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] border border-[#3A3A36] px-1.5 py-0.5 rounded">
            Scaffold
          </span>
          <button onClick={onCancel} aria-label="Close" className="ml-auto text-[#6B6B66] hover:text-[#FAFAF7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-sm text-[#FAFAF7] leading-relaxed">
            After you book the consult, two automated touches will go out to{" "}
            <span className="font-semibold">{lead.full_name}</span>:
          </p>

          {/* SMS preview */}
          <PreviewCard
            icon={<MessageSquare className="w-3.5 h-3.5 text-amber-300" />}
            label="SMS — opt-in / opt-out"
            recipient={lead.phone ?? "—"}
            disabled={optedOut || !lead.phone}
            disabledNote={
              optedOut
                ? "Client previously opted out — suppressed from the outbound SMS list."
                : !lead.phone
                  ? "No phone on file — SMS skipped."
                  : null
            }
          >
            <p className="text-[11px] text-[#FAFAF7]/90 leading-relaxed">
              "Hi {lead.full_name.split(" ")[0]}, this is the law firm.
              We'll send appointment reminders by text. Reply <span className="font-mono">YES</span> to opt in,
              or <span className="font-mono">STOP</span> at any time to opt out."
            </p>
          </PreviewCard>

          {/* Email preview */}
          <PreviewCard
            icon={<Mail className="w-3.5 h-3.5 text-sky-300" />}
            label="Email — confirmation"
            recipient={lead.email ?? "—"}
            disabled={!lead.email}
            disabledNote={!lead.email ? "No email on file — confirmation skipped." : null}
          >
            <p className="text-[11px] text-[#FAFAF7]/90 leading-relaxed">
              Subject: Your bankruptcy consultation is scheduled
            </p>
            <p className="text-[11px] text-[#6B6B66] leading-relaxed mt-1">
              Includes: date/time, attorney, dial-in or office address, pre-intake link,
              and an unsubscribe-from-marketing footer (transactional confirmations are
              always delivered — consent applies to outbound marketing/SMS reminders).
            </p>
          </PreviewCard>

          <div className="rounded-lg border border-dashed border-[#3A3A36] bg-[#0F0F0E] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-[#6B6B66] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-[#6B6B66] leading-relaxed">
                Coming soon — Twilio / SendGrid wiring + the consent system aren't built yet,
                so nothing leaves the system today. Once wired, both messages appear in the
                <span className="font-semibold text-[#FAFAF7]"> Messaging </span>
                panel's All / SMS / Email tabs alongside inbound client comms.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="accent-[#B8945F] mt-0.5"
            />
            <span className="text-[11px] text-[#FAFAF7] leading-snug">
              I understand the SMS opt-in + email confirmation will be sent once the wiring lands.
              For now they are previewed here only.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#2A2A28] flex-shrink-0">
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-[#6B6B66] hover:text-[#FAFAF7] px-3 py-1.5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            disabled={!acknowledged}
            className="flex items-center gap-1.5 text-xs font-bold text-[#0F0F0E] bg-[#B8945F] hover:bg-[#C8A46F] disabled:bg-[#2A2A28] disabled:text-[#6B6B66] disabled:cursor-not-allowed px-3 py-1.5 rounded transition-colors"
            title={acknowledged ? "Continue to scheduler" : "Acknowledge the scaffold sends first"}
          >
            <Send className="w-3 h-3" /> Continue to scheduler
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  icon, label, recipient, children, disabled, disabledNote,
}: {
  icon: ReactNode;
  label: string;
  recipient: string;
  children: ReactNode;
  disabled?: boolean;
  disabledNote?: string | null;
}) {
  return (
    <div className={`rounded-lg border bg-[#0F0F0E] px-3 py-2.5 ${disabled ? "border-[#3A3A36] opacity-60" : "border-[#2A2A28]"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#FAFAF7]">{label}</p>
        <span className="ml-auto text-[10px] font-mono text-[#6B6B66] truncate max-w-[60%]">
          → {recipient}
        </span>
      </div>
      {disabled && disabledNote ? (
        <p className="text-[11px] text-amber-300/90 italic leading-snug">{disabledNote}</p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
