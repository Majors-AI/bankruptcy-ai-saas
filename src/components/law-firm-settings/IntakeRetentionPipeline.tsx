// Intake — lead scheduling → conducting intake → presenting case → welcome
// call/text → fee-agreement signature → auto file-cabinet entry + dual
// portal listing.
//
// Attorney-only gates:
//   - Acceptance email (case-specific legal advice) — attorney sends.
//   - Welcome call/text mark-complete — attorney marks complete; this
//     triggers sending the fee-agreement signing link.
//
// All transitions are in-memory today. Persistence + the fee-agreement send
// + e-sign webhook + auto file-cabinet entry + dual-portal listing are
// flagged TODO.

import { useState, createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import {
  Sparkles, Phone, MessageSquare, Mail, FileSignature, CheckCircle2,
  ArrowRight, Send, Lock, FileBox, Briefcase, Coins,
} from "lucide-react";
import type { ViewerRole } from "../department-management/types";

// ─── Lead model ────────────────────────────────────────────────────────────

export type LeadStage =
  | "scheduling"        // lead being scheduled for intake
  | "intake_in_progress"
  | "presenting"        // legal admin presenting OR attorney sent acceptance email
  | "welcome_pending"   // welcome call/text required
  | "fee_agreement_sent"
  | "fee_signed"        // fee-agreement signature received — auto-promote
  | "completed";        // post-signature: file cabinet + dual-portal listed

export interface Lead {
  id: string;
  clientName: string;
  state: string;
  chapter: "7" | "11" | "12" | "13";
  stage: LeadStage;
  attorneyId: string | null;
  legalAdminId: string | null;
  welcomeChannel: "call" | "text" | null;
  acceptanceEmailSentAt: string | null;
  welcomeCompletedAt: string | null;
  feeAgreementSentAt: string | null;
  feeSignedAt: string | null;
  transferredAt: string | null;
}

interface IntakeApi {
  leads: Lead[];
  addLead(input: Omit<Lead, "id" | "stage" | "attorneyId" | "legalAdminId" | "welcomeChannel" | "acceptanceEmailSentAt" | "welcomeCompletedAt" | "feeAgreementSentAt" | "feeSignedAt" | "transferredAt">): void;
  advanceTo(id: string, stage: LeadStage, patch?: Partial<Lead>): void;
  sendAcceptanceEmail(id: string): void;
  setWelcomeChannel(id: string, channel: "call" | "text"): void;
  completeWelcome(id: string): void;             // triggers fee-agreement send
  receiveFeeSignature(id: string): void;          // moves to completed + adds to file cabinet
}

const Ctx = createContext<IntakeApi | null>(null);

function uid(p: string) { return `${p}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`; }

export function IntakePipelineProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: "lead-demo-1", clientName: "[Demo] John Smith", state: "AZ", chapter: "7",
      stage: "presenting", attorneyId: null, legalAdminId: null, welcomeChannel: null,
      acceptanceEmailSentAt: null, welcomeCompletedAt: null,
      feeAgreementSentAt: null, feeSignedAt: null, transferredAt: null,
    },
  ]);

  const addLead = useCallback<IntakeApi["addLead"]>((input) => {
    setLeads(prev => [{
      id: uid("lead"), stage: "scheduling", attorneyId: null, legalAdminId: null,
      welcomeChannel: null, acceptanceEmailSentAt: null, welcomeCompletedAt: null,
      feeAgreementSentAt: null, feeSignedAt: null, transferredAt: null, ...input,
    }, ...prev]);
  }, []);

  const advanceTo = useCallback<IntakeApi["advanceTo"]>((id, stage, patch) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, stage } : l));
  }, []);

  const sendAcceptanceEmail = useCallback<IntakeApi["sendAcceptanceEmail"]>((id) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, acceptanceEmailSentAt: new Date().toISOString(), stage: "presenting" } : l));
    // TODO Phase B — Anthropic-drafted case-specific acceptance email sent via SendGrid.
  }, []);

  const setWelcomeChannel = useCallback<IntakeApi["setWelcomeChannel"]>((id, channel) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, welcomeChannel: channel, stage: "welcome_pending" } : l));
  }, []);

  const completeWelcome = useCallback<IntakeApi["completeWelcome"]>((id) => {
    setLeads(prev => prev.map(l => l.id === id ? {
      ...l, welcomeCompletedAt: new Date().toISOString(),
      stage: "fee_agreement_sent", feeAgreementSentAt: new Date().toISOString(),
    } : l));
    // TODO Phase B — send fee-agreement signing link via SendGrid + e-sign
    // service (DocuSign / signNow). Webhook updates feeSignedAt on signature.
  }, []);

  const receiveFeeSignature = useCallback<IntakeApi["receiveFeeSignature"]>((id) => {
    setLeads(prev => prev.map(l => l.id === id ? {
      ...l, feeSignedAt: new Date().toISOString(), transferredAt: new Date().toISOString(),
      stage: "completed",
    } : l));
    // TODO Phase B — insert into file_cabinet, mark intake_leads.status='retained',
    // list in Accounting + Legal department portals (via department_clients table).
  }, []);

  const api: IntakeApi = useMemo(() => ({
    leads, addLead, advanceTo, sendAcceptanceEmail, setWelcomeChannel,
    completeWelcome, receiveFeeSignature,
  }), [leads, addLead, advanceTo, sendAcceptanceEmail, setWelcomeChannel, completeWelcome, receiveFeeSignature]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useIntakePipeline(): IntakeApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useIntakePipeline must be used inside IntakePipelineProvider");
  return v;
}

// ─── UI ────────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<LeadStage, string> = {
  scheduling: "Scheduling",
  intake_in_progress: "Conducting intake",
  presenting: "Presenting / acceptance",
  welcome_pending: "Welcome (call/text)",
  fee_agreement_sent: "Fee agreement sent",
  fee_signed: "Fee signed",
  completed: "Completed → File Cabinet",
};

interface Props { viewerRole: ViewerRole; }

export default function IntakeRetentionPipeline({ viewerRole }: Props) {
  const intake = useIntakePipeline();
  const isAttorney = viewerRole === "attorney" || viewerRole === "law_firm_owner" || viewerRole === "super_admin";

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">Intake · retention pipeline</p>
      </div>
      <p className="text-[11px] text-[#6B6B66] leading-relaxed">
        Lead scheduling → conducting intake → presenting case (legal admin OR attorney
        acceptance email) → welcome call/text → fee-agreement signature → auto file-cabinet
        entry + listing in both Accounting and Legal department portals.
      </p>

      {/* Stage legend */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] text-[#6B6B66]">
        {(Object.keys(STAGE_LABEL) as LeadStage[]).map((s, i, arr) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded border border-[#2A2A28]">{STAGE_LABEL[s]}</span>
            {i < arr.length - 1 && <ArrowRight className="w-3 h-3" />}
          </span>
        ))}
      </div>

      {/* Leads */}
      {intake.leads.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No leads.</p>
      ) : (
        <ul className="space-y-3">
          {intake.leads.map(l => <LeadCard key={l.id} lead={l} isAttorney={isAttorney} />)}
        </ul>
      )}
    </div>
  );
}

function LeadCard({ lead, isAttorney }: { lead: Lead; isAttorney: boolean }) {
  const intake = useIntakePipeline();

  return (
    <li className="rounded border border-[#2A2A28] bg-[#1A1A18] p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div>
          <p className="text-[12px] font-semibold text-[#FAFAF7]">{lead.clientName}</p>
          <p className="text-[10px] text-[#6B6B66]">{lead.state} · Chapter {lead.chapter}</p>
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border" style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}>
          {STAGE_LABEL[lead.stage]}
        </span>
      </div>

      {/* Action row varies by stage */}
      {lead.stage === "scheduling" && (
        <ActionRow>
          <button onClick={() => intake.advanceTo(lead.id, "intake_in_progress")} className={btnPrimary}>
            <Phone className="w-3 h-3" /> Conduct intake
          </button>
        </ActionRow>
      )}

      {lead.stage === "intake_in_progress" && (
        <ActionRow>
          <button onClick={() => intake.advanceTo(lead.id, "presenting")} className={btnPrimary}>
            <ArrowRight className="w-3 h-3" /> Move to presenting
          </button>
        </ActionRow>
      )}

      {lead.stage === "presenting" && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#6B6B66]">A legal admin presents OR the attorney sends an acceptance email.</p>
          <ActionRow>
            <button
              disabled={!isAttorney}
              onClick={() => intake.sendAcceptanceEmail(lead.id)}
              className={`${btnPrimary} ${!isAttorney ? "opacity-50 cursor-not-allowed" : ""}`}
              title={isAttorney ? "Send acceptance email" : "Attorney-only — non-lawyers can't send case-specific legal advice"}
            >
              <Mail className="w-3 h-3" /> Send acceptance email (attorney)
              {!isAttorney && <Lock className="w-3 h-3" />}
            </button>
            <button onClick={() => intake.setWelcomeChannel(lead.id, "call")} className={btnSecondary}>
              <Phone className="w-3 h-3" /> Schedule welcome (call)
            </button>
            <button onClick={() => intake.setWelcomeChannel(lead.id, "text")} className={btnSecondary}>
              <MessageSquare className="w-3 h-3" /> Schedule welcome (text)
            </button>
          </ActionRow>
          {lead.acceptanceEmailSentAt && (
            <p className="text-[10px] text-emerald-300 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Acceptance email sent {new Date(lead.acceptanceEmailSentAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {lead.stage === "welcome_pending" && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#6B6B66]">
            Welcome {lead.welcomeChannel}. The attorney marks complete (a welcome text can confirm "no questions; ready to proceed").
            Completing triggers sending the fee-agreement signing link.
          </p>
          <ActionRow>
            <button
              disabled={!isAttorney}
              onClick={() => intake.completeWelcome(lead.id)}
              className={`${btnPrimary} ${!isAttorney ? "opacity-50 cursor-not-allowed" : ""}`}
              title={isAttorney ? "Mark welcome complete" : "Attorney-only"}
            >
              <CheckCircle2 className="w-3 h-3" /> Mark welcome complete (attorney)
              {!isAttorney && <Lock className="w-3 h-3" />}
            </button>
          </ActionRow>
        </div>
      )}

      {lead.stage === "fee_agreement_sent" && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#6B6B66]">
            Fee-agreement signing link sent. On signature notice, the lead auto-promotes
            and is added to the File Cabinet + listed in both Accounting + Legal portals.
            {/* TODO Phase B — e-sign webhook triggers receiveFeeSignature. */}
          </p>
          <ActionRow>
            <button onClick={() => intake.receiveFeeSignature(lead.id)} className={btnSecondary} title="Simulate e-sign webhook (scaffold)">
              <FileSignature className="w-3 h-3" /> Simulate signature webhook
            </button>
            <button onClick={() => alert("Resending fee agreement (scaffold).")} className={btnSecondary}>
              <Send className="w-3 h-3" /> Resend
            </button>
          </ActionRow>
          {lead.feeAgreementSentAt && (
            <p className="text-[10px] text-[#6B6B66]">Sent {new Date(lead.feeAgreementSentAt).toLocaleString()}</p>
          )}
        </div>
      )}

      {lead.stage === "completed" && (
        <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-2 space-y-1">
          <p className="text-[11px] text-emerald-200 inline-flex items-center gap-1.5">
            <FileBox className="w-3 h-3" /> Added to File Cabinet
            {lead.transferredAt && <span className="text-[10px] text-emerald-300/80">on {new Date(lead.transferredAt).toLocaleString()}</span>}
          </p>
          <p className="text-[11px] text-emerald-200 inline-flex items-center gap-1.5">
            <Briefcase className="w-3 h-3" /> Listed in Legal department portal
          </p>
          <p className="text-[11px] text-emerald-200 inline-flex items-center gap-1.5">
            <Coins className="w-3 h-3" /> Listed in Accounting department portal
          </p>
          <p className="text-[10px] text-emerald-200/70 italic mt-1">
            Intake lead marked COMPLETED with transfer date.
            {/* TODO Phase B — actual file_cabinet INSERT + department_clients fan-out. */}
          </p>
        </div>
      )}
    </li>
  );
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 flex-wrap">{children}</div>;
}

const btnPrimary = "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border " +
  "border-[var(--lfs-accent)] text-[#FAFAF7] hover:opacity-90";
const btnSecondary = "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border " +
  "border-[#2A2A28] text-[#6B6B66] hover:text-white";
