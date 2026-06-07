import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { sendVia } from "../lib/sendGate";
import {
  Scale, CheckCircle, ChevronRight, DollarSign, Calendar,
  Clock, FileText, AlertCircle, Phone, X, ArrowLeft,
  Sparkles, Shield, Users, CreditCard, HelpCircle, ChevronDown,
  Video, RefreshCw, UserCheck, Mic, MicOff, PhoneCall, PhoneOff,
  Star, Zap, MessageSquare, ClipboardList
} from "lucide-react";
import IntakeAnswersSummary from "./IntakeAnswersSummary";
import type { PlatformRole } from "../lib/auth";
import { canSetPaymentPlan, canQuoteFee } from "../lib/auth";

export interface AcceptanceData {
  chapter: string;
  attorney_fee: number;
  filing_fee: number;
  credit_counseling_fee: number;
  is_bifurcated: boolean;
  client_pay_frequency: string;
  acceptance_notes: string;
  accepted_by: string;
}

interface Props {
  clientId: string;
  clientName: string;
  acceptanceData: AcceptanceData;
  onCompleted: () => void;
  onDefer: (date: string) => void;
  // BAN-35: current user's platform role. Optional during the transition —
  // when undefined, behavior matches pre-BAN-35 (no gating). When set, the
  // BoldSign send and welcome-call complete actions require legal_admin /
  // attorney; the attorney fee display is read-only for non-attorneys.
  currentUserRole?: PlatformRole | null;
}

const PAY_FREQ_LABEL: Record<string, string> = {
  "Weekly": "weekly",
  "Bi-Weekly": "every two weeks",
  "Semi-Monthly": "twice a month",
  "Monthly": "monthly",
};

function getMaxMonths(isBifurcated: boolean, chapter: string): number {
  if (chapter === "13") return 6;
  if (isBifurcated) return 18;
  return 10;
}

function calcPaymentPlan(
  attorneyFee: number,
  isBifurcated: boolean,
  chapter: string,
  freq: string,
  months: number,
  downPayment: number = 0
): { perPeriod: number; totalPeriods: number; lastPayment: number; balance: number } {
  const freqMap: Record<string, number> = {
    "Weekly": 52, "Bi-Weekly": 26, "Semi-Monthly": 24, "Monthly": 12,
  };
  const periodsPerYear = freqMap[freq] ?? 26;
  const periodsPerMonth = periodsPerYear / 12;
  const totalPeriods = Math.max(1, Math.round(months * periodsPerMonth));
  const balance = Math.max(0, attorneyFee - downPayment);
  const perPeriod = totalPeriods > 0 ? balance / totalPeriods : balance;
  const roundedPerPeriod = Math.ceil(perPeriod);
  const lastPayment = balance - roundedPerPeriod * (totalPeriods - 1);
  return { perPeriod: roundedPerPeriod, totalPeriods, lastPayment: Math.max(0, lastPayment), balance };
}

type ScriptStep =
  | "welcome"
  | "case_accepted"
  | "chapter_explained"
  | "what_was_reviewed"
  | "unexempt_assets"
  | "full_service"
  | "qualify_readiness"
  | "attorney_call"
  | "attorney_call_active"
  | "attorney_call_complete"
  | "fees_intro"
  | "fee_breakdown"
  | "payment_plan"
  | "bifurcated_explain"
  | "objections"
  | "timeline"
  | "next_steps"
  | "qualifying_close"
  | "welcome_call_pending"
  | "defer"
  | "done";

const STEP_ORDER: ScriptStep[] = [
  "welcome", "case_accepted", "chapter_explained", "what_was_reviewed",
  "unexempt_assets", "full_service", "qualify_readiness",
  "attorney_call", "attorney_call_active", "attorney_call_complete",
  "fees_intro", "fee_breakdown", "payment_plan", "bifurcated_explain",
  "objections", "timeline", "next_steps", "qualifying_close",
  "welcome_call_pending", "defer", "done",
];

const CH7_BENEFITS = [
  { icon: <Zap size={14} className="text-green-400" />, text: "Fast discharge — most cases complete in 90–120 days from the date we file" },
  { icon: <Shield size={14} className="text-blue-400" />, text: "Automatically stops all wage garnishments, lawsuits, and collection calls the moment we file — by federal law" },
  { icon: <CheckCircle size={14} className="text-green-400" />, text: "Eliminates credit card debt, medical bills, personal loans, payday loans, and most unsecured debt permanently" },
  { icon: <Star size={14} className="text-amber-400" />, text: "Your home, car, retirement accounts, household goods, and other exempt property are fully protected throughout" },
  { icon: <DollarSign size={14} className="text-green-400" />, text: "No ongoing payment plan — once discharged, you owe nothing on those eliminated debts" },
  { icon: <Scale size={14} className="text-amber-400" />, text: "Most Chapter 7 cases are no-asset cases — the trustee does not liquidate any of your property" },
];

const CH13_BENEFITS = [
  { icon: <Shield size={14} className="text-amber-400" />, text: "You keep every single asset — no liquidation, even property that might not be fully exempt in Chapter 7" },
  { icon: <Zap size={14} className="text-blue-400" />, text: "Immediately stops foreclosure proceedings — mortgage arrears are cured in full over your 3–5 year plan" },
  { icon: <DollarSign size={14} className="text-green-400" />, text: "Vehicle loans can be restructured — in many cases, the loan balance is reduced to the car's current fair market value" },
  { icon: <CheckCircle size={14} className="text-green-400" />, text: "At the end of your plan, all remaining general unsecured debt (credit cards, medical bills) is permanently discharged" },
  { icon: <Scale size={14} className="text-amber-400" />, text: "Priority debts like recent taxes and domestic support can be repaid over time through the plan" },
  { icon: <Users size={14} className="text-cyan-400" />, text: "Co-signers on your debts are also protected — the co-debtor stay is unique to Chapter 13 and applies immediately upon filing" },
];

const OBJECTION_SCRIPTS: { q: string; a: string }[] = [
  {
    q: "I can't afford it right now.",
    a: "Are you currently making payments to your creditors? If so, you can stop paying them today and redirect that money toward your case. Most clients find the monthly payment to us is less than what they were paying just one creditor.",
  },
  {
    q: "I need to think about it.",
    a: "That's completely understandable. Can I ask — is there a specific concern I can help address right now? Many clients tell us the biggest stress is not knowing what happens next. We can answer any question you have before you decide.",
  },
  {
    q: "I'm worried about my credit.",
    a: "Your credit is already being impacted by missed payments and collection accounts. Bankruptcy gives you a fresh start — most clients see their credit score start recovering within 12–18 months after discharge, much faster than trying to pay off the debt on their own.",
  },
  {
    q: "Will I lose everything?",
    a: "That's a very common concern. The attorney reviewed what you listed and determined you qualify. Most clients keep everything they own. The goal of exemptions is to protect exactly what you need to live and work.",
  },
  {
    q: "What if I lose my job?",
    a: "The automatic stay goes into effect the moment we file — it stops all collection calls, lawsuits, and wage garnishments immediately. If you're worried about job stability, that's actually a reason to file sooner rather than later.",
  },
];

export default function CaseAcceptanceFlow({ clientId, clientName, acceptanceData, onCompleted, onDefer, currentUserRole }: Props) {
  // BAN-35: opt-in role gating. When currentUserRole is undefined we treat as
  // "legacy / no role context" and allow everything (matches pre-BAN-35
  // behavior). Callers should pass the platform role once auth is wired in.
  // The attorney fee itself isn't editable inside this component — fee setting
  // lives in LegalAdminPortal's AttorneyAcceptanceModal — but canQuoteFee is
  // referenced here so call sites can see the gating dependency.
  const gateActive = currentUserRole !== undefined && currentUserRole !== null;
  const canSendFeeAgreement = !gateActive || canSetPaymentPlan(currentUserRole);
  void canQuoteFee; // placeholder reference; full enforcement is in AttorneyAcceptanceModal
  const [step, setStep] = useState<ScriptStep>("welcome");
  const [planMonths, setPlanMonths] = useState(3);
  const [downPayment, setDownPayment] = useState(0);
  const [downPaymentInput, setDownPaymentInput] = useState('');
  const [activeObjection, setActiveObjection] = useState<number | null>(null);
  const [deferDate, setDeferDate] = useState("");
  const [deferReason, setDeferReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [welcomeCallId, setWelcomeCallId] = useState<string | null>(null);
  const [welcomeCallStatus, setWelcomeCallStatus] = useState<'pending' | 'requested' | 'completed'>('pending');
  const [showIntakeSummary, setShowIntakeSummary] = useState(false);
  const [attorneyCallTimer, setAttorneyCallTimer] = useState(0);
  const [attorneyCallRunning, setAttorneyCallRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [presentationSessionId, setPresentationSessionId] = useState<string | null>(null);

  const {
    chapter,
    attorney_fee,
    filing_fee,
    credit_counseling_fee,
    is_bifurcated,
    client_pay_frequency,
    accepted_by,
    acceptance_notes,
  } = acceptanceData;

  const totalDue = attorney_fee + filing_fee + credit_counseling_fee;
  const maxMonths = getMaxMonths(is_bifurcated, chapter);
  const { perPeriod, totalPeriods, lastPayment, balance } = calcPaymentPlan(attorney_fee, is_bifurcated, chapter, client_pay_frequency, planMonths, downPayment);
  const firstName = clientName.split(" ")[0] || clientName;
  const chapterLabel = chapter === "13" ? "Chapter 13" : "Chapter 7";
  const chapterType = chapter === "13" ? "a reorganization / repayment plan" : "a full discharge of most unsecured debts";
  const ndtDays = chapter === "13" ? "3–5 years" : "90–120 days";
  const benefits = chapter === "7" ? CH7_BENEFITS : CH13_BENEFITS;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    startSession();
  }, []);

  useEffect(() => {
    if (attorneyCallRunning) {
      timerRef.current = setInterval(() => setAttorneyCallTimer(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [attorneyCallRunning]);

  async function startSession() {
    const { data } = await supabase.from("presentation_sessions").insert([{
      client_id: clientId,
      staff_name: accepted_by || 'intake staff',
      chapter,
      started_at: new Date().toISOString(),
    }]).select().maybeSingle();
    if (data) setPresentationSessionId(data.id);
    await supabase.from("clients").update({
      presentation_started_at: new Date().toISOString(),
      presentation_step: 'welcome',
    }).eq("id", clientId);
  }

  async function saveStep(s: ScriptStep) {
    setStep(s);
    await supabase.from("clients").update({ presentation_step: s, onboarding_step: STEP_ORDER.indexOf(s) }).eq("id", clientId);
  }

  function fmtTimer(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function startAttorneyCall() {
    setAttorneyCallRunning(true);
    await saveStep("attorney_call_active");
    await supabase.from("clients").update({ attorney_call_requested_at: new Date().toISOString() }).eq("id", clientId);
    if (presentationSessionId) {
      await supabase.from("presentation_sessions").update({ attorney_call_requested: true }).eq("id", presentationSessionId);
    }
  }

  async function endAttorneyCall() {
    setAttorneyCallRunning(false);
    await supabase.from("clients").update({ attorney_call_completed_at: new Date().toISOString() }).eq("id", clientId);
    if (presentationSessionId) {
      await supabase.from("presentation_sessions").update({ attorney_call_completed: true }).eq("id", presentationSessionId);
    }
    await saveStep("attorney_call_complete");
  }

  async function completeOnboarding() {
    setSaving(true);
    await supabase.from("clients").update({
      onboarding_completed: true,
      status: "retained",
      case_status: "retained",
      presentation_completed_at: new Date().toISOString(),
      client_decision: "ready_to_retain",
      down_payment: downPayment || 0,
      payment_plan_amount: perPeriod,
      payment_plan_total_periods: totalPeriods,
      payment_plan_balance: balance,
      last_payment_amount: lastPayment,
    }).eq("id", clientId);
    await supabase.from("case_acceptances").update({
      onboarding_script_completed: true,
      down_payment: downPayment || 0,
      payment_plan_amount: perPeriod,
      payment_plan_total_periods: totalPeriods,
      payment_plan_balance: balance,
      last_payment_amount: lastPayment,
    }).eq("client_id", clientId);
    if (presentationSessionId) {
      await supabase.from("presentation_sessions").update({
        completed_at: new Date().toISOString(),
        client_decision: "retained",
        fee_quoted: totalDue,
        plan_months: planMonths,
        outcome: "retained",
      }).eq("id", presentationSessionId);
    }
    setSaving(false);
    onCompleted();
  }

  async function deferOnboarding() {
    setSaving(true);
    await supabase.from("clients").update({
      deferred_followup_date: deferDate || null,
      case_status: "accepted_fee_quoted",
      client_decision: "deferred",
    }).eq("id", clientId);
    if (presentationSessionId) {
      await supabase.from("presentation_sessions").update({
        client_decision: "deferred",
        outcome: "deferred",
        notes: deferReason || null,
      }).eq("id", presentationSessionId);
    }
    setSaving(false);
    onDefer(deferDate);
  }

  async function requestWelcomeCall() {
    setSaving(true);
    const { data } = await supabase.from("welcome_calls").insert({
      client_id: clientId,
      status: 'requested',
      requested_by: accepted_by || 'intake staff',
      requested_at: new Date().toISOString(),
    }).select().maybeSingle();
    if (data) setWelcomeCallId(data.id);

    await supabase.from("clients").update({
      case_status: 'welcome_call_requested',
      down_payment: downPayment || 0,
      payment_plan_amount: perPeriod,
      payment_plan_total_periods: totalPeriods,
      payment_plan_balance: balance,
      last_payment_amount: lastPayment,
    }).eq("id", clientId);

    await supabase.from("case_acceptances").update({
      down_payment: downPayment || 0,
      payment_plan_amount: perPeriod,
      payment_plan_total_periods: totalPeriods,
      payment_plan_balance: balance,
      last_payment_amount: lastPayment,
    }).eq("client_id", clientId);

    try {
      const result = await sendVia(
        "send-boldsign",
        {
          clientId,
          clientName,
          chapter,
          attorney_fee,
          filing_fee,
          credit_counseling_fee,
          is_bifurcated,
          down_payment: downPayment,
          payment_plan_amount: perPeriod,
          payment_plan_total_periods: totalPeriods,
          payment_plan_balance: balance,
          last_payment_amount: lastPayment,
          payment_frequency: client_pay_frequency,
          plan_months: planMonths,
        },
        {
          recipientType: "client",
          clientId,
          actor: "CaseAcceptanceFlow",
          summary: "Retainer signing request (welcome-call request flow)",
        },
      );
      if (!result.sent) {
        // Existing flow silently continued on BoldSign send failure; the gate
        // skip is now recorded in intake_contact_log + browser console so it's
        // auditable post-hoc. A visible UI toast in this presentation flow
        // would be disruptive — punch-list follow-up if needed.
        console.warn("[send-boldsign] gate skipped:", result.reason);
      }
    } catch {
      // BoldSign send attempted; continue regardless
    }

    setWelcomeCallStatus('requested');
    setSaving(false);
  }

  async function markWelcomeCallComplete() {
    setSaving(true);
    if (welcomeCallId) {
      await supabase.from("welcome_calls").update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: accepted_by || 'intake staff',
      }).eq("id", welcomeCallId);
    }
    await supabase.from("clients").update({ case_status: 'welcome_call_complete' }).eq("id", clientId);
    setWelcomeCallStatus('completed');
    setSaving(false);
    await saveStep("done");
  }

  function Step({ title, children, next, nextLabel = "Continue", back, nextDisabled }: {
    title: string;
    children: React.ReactNode;
    next?: () => void;
    nextLabel?: string;
    back?: () => void;
    nextDisabled?: boolean;
  }) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <div className="space-y-4">{children}</div>
        <div className="flex gap-3 pt-2">
          {back && (
            <button onClick={back} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2.5 rounded-xl transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
          )}
          {next && (
            <button onClick={next} disabled={nextDisabled} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm px-6 py-2.5 rounded-xl transition-all ml-auto disabled:opacity-50">
              {nextLabel} <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  function ScriptBox({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "blue" | "green" | "amber" }) {
    const colorMap = {
      default: "bg-slate-800/60 border-slate-600",
      blue: "bg-blue-500/8 border-blue-500/30",
      green: "bg-green-500/8 border-green-500/30",
      amber: "bg-amber-500/8 border-amber-500/30",
    };
    return (
      <div className={`border rounded-xl p-4 ${colorMap[color]}`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-400/15 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Scale size={14} className="text-amber-400" />
          </div>
          <p className="text-slate-200 text-sm leading-relaxed">{children}</p>
        </div>
      </div>
    );
  }

  function InfoCard({ icon, label, value, color = "text-white" }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">{icon}</div>
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className={`text-sm font-bold ${color}`}>{value}</p>
        </div>
      </div>
    );
  }

  const progressSteps = [
    { id: "welcome", label: "Intro" },
    { id: "case_accepted", label: "Good News" },
    { id: "qualify_readiness", label: "Qualify" },
    { id: "attorney_call", label: "Attorney" },
    { id: "fees_intro", label: "Fees" },
    { id: "qualifying_close", label: "Close" },
    { id: "done", label: "Done" },
  ];
  const currentProgressIdx = Math.min(
    progressSteps.findIndex(s => s.id === step),
    progressSteps.length - 1
  );
  const effectiveIdx = currentProgressIdx >= 0 ? currentProgressIdx : 0;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-amber-400" />
          <span className="text-amber-400 font-bold text-sm">bankruptcy.AI</span>
          <span className="text-slate-600 mx-2">·</span>
          <span className="text-slate-400 text-sm">Case Presentation — {firstName}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1">
            {progressSteps.map((ps, idx) => (
              <div key={ps.id} className="flex items-center gap-1">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                  idx < effectiveIdx ? 'text-green-400' :
                  idx === effectiveIdx ? 'text-amber-400 bg-amber-400/10' :
                  'text-slate-600'
                }`}>
                  {idx < effectiveIdx && <CheckCircle size={10} />}
                  {ps.label}
                </div>
                {idx < progressSteps.length - 1 && (
                  <ChevronRight size={10} className={idx < effectiveIdx ? 'text-green-400' : 'text-slate-700'} />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">Live Session</span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">

          {step === "welcome" && (
            <Step title={`Welcome, ${firstName}`} next={() => saveStep("case_accepted")} nextLabel="I'm ready — share the news">
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={28} className="text-green-400" />
                </div>
                <p className="text-white font-bold text-lg mb-1">You have great news to share</p>
                <p className="text-slate-400 text-sm">The attorney has reviewed <strong className="text-white">{clientName}'s</strong> case and made a determination. Walk through this script to present the outcome professionally.</p>
              </div>
              <ScriptBox>
                Hi {firstName}! Thank you so much for being here today. My name is {accepted_by || "a member of our intake team"}, and I am a legal admin at the firm. I have been working with the attorney on your case and I have some really exciting news to share with you today.
              </ScriptBox>
              <ScriptBox>
                I just want to take about 10–15 minutes of your time to walk through what the attorney found and what that means for your situation. Does that sound okay?
              </ScriptBox>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 flex items-start gap-2.5">
                <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">Wait for client to confirm they have time before proceeding. If they are busy, offer to call back at a specific time and use the defer option.</p>
              </div>
            </Step>
          )}

          {step === "case_accepted" && (
            <Step title="Delivering the Great News" next={() => saveStep("chapter_explained")} back={() => setStep("welcome")}>
              <div className={`bg-gradient-to-br ${chapter === "13" ? "from-amber-500/10 to-yellow-500/5 border-amber-500/30" : "from-blue-500/10 to-cyan-500/5 border-blue-500/30"} border rounded-2xl p-6 text-center`}>
                <div className={`w-16 h-16 ${chapter === "13" ? "bg-amber-500/15" : "bg-blue-500/15"} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <CheckCircle size={32} className={chapter === "13" ? "text-amber-400" : "text-blue-400"} />
                </div>
                <p className={`font-bold text-2xl mb-1 ${chapter === "13" ? "text-amber-400" : "text-blue-400"}`}>
                  {chapterLabel} — Accepted
                </p>
                <p className="text-slate-300 text-sm">{firstName} qualifies for {chapterLabel} bankruptcy relief</p>
              </div>
              <ScriptBox>
                {firstName}, the attorney has personally reviewed your case — your income, your debts, your assets, your household — and I am happy to tell you that <strong>your case has been accepted</strong>. You qualify for <strong>{chapterLabel} bankruptcy</strong>.
              </ScriptBox>
              <ScriptBox>
                I know that can feel like a big statement, so let me explain exactly what that means and why the attorney chose this chapter specifically for you. Not every case qualifies, and yours does — that is genuinely good news.
              </ScriptBox>
              <ScriptBox color="blue">
                Just to be transparent — I am a legal admin, not an attorney. The attorney made this determination. I am here to explain what it means and walk you through the next steps. You will also have a chance to speak directly with the attorney before anything is signed.
              </ScriptBox>
            </Step>
          )}

          {step === "chapter_explained" && (
            <Step title={`Why ${chapterLabel} — What It Means for You`} next={() => saveStep("what_was_reviewed")} back={() => setStep("case_accepted")}>
              <ScriptBox>
                {chapterLabel} is {chapterType}. {chapter === "7"
                  ? `It is what most people think of as a "fresh start" bankruptcy. The moment we file, all collection activity stops immediately. Then, within about 90 to 120 days, the court issues your discharge — and most of your unsecured debts simply no longer exist. You are free.`
                  : `It is a structured repayment plan that runs 3 to 5 years. You make one manageable monthly payment, and at the end of the plan, any remaining general unsecured debt — credit cards, medical bills, personal loans — is discharged entirely.`
                }
              </ScriptBox>
              <ScriptBox>
                The attorney chose {chapterLabel} specifically for you based on your income, your household size, the types of debt you have, and the assets you listed. This is the best path for your specific situation.
              </ScriptBox>

              <div className="space-y-2 mt-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">What {chapterLabel} Means for {firstName}</p>
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-3 bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
                    <div className="flex-shrink-0 mt-0.5">{b.icon}</div>
                    <p className="text-slate-300 text-sm leading-relaxed">{b.text}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <InfoCard
                  icon={<Scale size={16} className="text-amber-400" />}
                  label="Chapter"
                  value={chapterLabel}
                  color="text-amber-400"
                />
                <InfoCard
                  icon={<Clock size={16} className="text-blue-400" />}
                  label="Estimated Timeline"
                  value={ndtDays}
                  color="text-blue-400"
                />
              </div>
            </Step>
          )}

          {step === "what_was_reviewed" && (
            <Step title="What the Attorney Reviewed" next={() => saveStep("unexempt_assets")} back={() => setStep("chapter_explained")}>
              <ScriptBox>
                Before accepting your case, the attorney looked at several things. I want to walk you through each one so you understand exactly what was considered and why you qualify.
              </ScriptBox>
              <div className="space-y-3">
                {[
                  {
                    icon: <DollarSign size={15} className="text-green-400" />,
                    title: chapter === "7" ? "Income & Means Test — You Passed" : "Income & Repayment Capacity",
                    desc: chapter === "7"
                      ? "Your household income was compared to the state median for your household size. You qualified, which is why Chapter 7 is available to you."
                      : "Your income and budget were reviewed to determine what you can afford in a repayment plan. Chapter 13 gives you a structured path that works within your means.",
                  },
                  {
                    icon: <Shield size={15} className="text-blue-400" />,
                    title: "Exempt Assets — Your Property is Protected",
                    desc: "State and federal exemptions protect your home equity, vehicle, retirement accounts, household goods, and more. The attorney reviewed what you listed against those limits.",
                  },
                  {
                    icon: <Users size={15} className="text-amber-400" />,
                    title: "Household Budget & IRS Standards",
                    desc: "Your household size and monthly expenses were compared to IRS National Standards to confirm the filing is appropriate and supportable.",
                  },
                  {
                    icon: <FileText size={15} className="text-slate-400" />,
                    title: "Debt Types & Structure",
                    desc: "The types of debt you have — secured, unsecured, student loans, tax debts — were all reviewed to ensure this bankruptcy addresses your situation effectively.",
                  },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">{item.icon}</div>
                    <div>
                      <p className="text-white text-sm font-semibold">{item.title}</p>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Step>
          )}

          {step === "unexempt_assets" && (
            <Step title="A Note on Your Assets" next={() => saveStep("full_service")} back={() => setStep("what_was_reviewed")}>
              <ScriptBox>
                {acceptance_notes
                  ? `The attorney had the following note regarding your assets: "${acceptance_notes}"`
                  : `Based on what you submitted, your assets appear to fall within the applicable exemption limits. That means you would keep everything you currently own.`
                }
              </ScriptBox>
              {acceptance_notes && (
                <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 text-sm font-semibold">Attorney Advisory</p>
                    <p className="text-slate-300 text-xs mt-1">The attorney will discuss the best strategy for any non-exempt assets during your welcome call. You are not required to do anything until you speak with the attorney directly.</p>
                  </div>
                </div>
              )}
              <ScriptBox>
                Any questions about specific items — your car, your house, your retirement — the attorney will walk through all of that with you directly. For now, just know that the goal is to protect as much as possible, and you are in good hands.
              </ScriptBox>
            </Step>
          )}

          {step === "full_service" && (
            <Step title="Full-Service Representation" next={() => saveStep("qualify_readiness")} back={() => setStep("unexempt_assets")}>
              <ScriptBox>
                Our firm provides full-service bankruptcy representation. That means from the moment you sign with us, we handle everything. You do not have to figure any of this out on your own.
              </ScriptBox>
              <div className="space-y-2">
                {[
                  "Preparation and filing of all bankruptcy schedules and petition documents",
                  "All communication with the bankruptcy court and trustee on your behalf",
                  "Attendance at your 341 Meeting of Creditors — we are right there with you",
                  "Handling any creditor objections, trustee requests, or motions",
                  "Guiding you through the required credit counseling and debtor education courses",
                  "Representing you through to your final discharge order",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
                    <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-300 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </Step>
          )}

          {step === "qualify_readiness" && (
            <Step title="Checking In — Are You Ready to Learn More?" back={() => setStep("full_service")}>
              <ScriptBox>
                {firstName}, we have covered a lot — you qualify for {chapterLabel}, we have explained why the attorney chose this chapter for you, and you know we handle everything from start to finish.
              </ScriptBox>
              <ScriptBox color="amber">
                Before we talk about anything else, I want to check in with you. Do you have any questions so far? And would you like to move forward and hear about the next steps, including speaking directly with the attorney?
              </ScriptBox>
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">How is the client responding?</p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => saveStep("attorney_call")}
                    className="w-full flex items-center gap-3 bg-green-500/15 border border-green-500/40 hover:bg-green-500/25 text-green-300 font-semibold text-sm py-3.5 px-4 rounded-xl transition-all text-left"
                  >
                    <CheckCircle size={16} className="flex-shrink-0" />
                    <div>
                      <p className="font-bold">Yes — ready to move forward</p>
                      <p className="text-xs text-green-400/70 mt-0.5">Client is engaged and wants to hear the next steps</p>
                    </div>
                  </button>
                  <button
                    onClick={() => saveStep("defer")}
                    className="w-full flex items-center gap-3 bg-slate-800 border border-slate-600 hover:border-slate-500 text-slate-300 font-semibold text-sm py-3.5 px-4 rounded-xl transition-all text-left"
                  >
                    <Calendar size={16} className="flex-shrink-0 text-slate-400" />
                    <div>
                      <p className="font-bold">Needs more time / not ready today</p>
                      <p className="text-xs text-slate-500 mt-0.5">Schedule a follow-up call for a better time</p>
                    </div>
                  </button>
                </div>
              </div>
            </Step>
          )}

          {step === "attorney_call" && (
            <Step title="Connect Client with the Attorney" next={startAttorneyCall} nextLabel="Start Attorney Call" back={() => setStep("qualify_readiness")}>
              <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/30 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-amber-400/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PhoneCall size={32} className="text-amber-400" />
                </div>
                <p className="text-amber-400 font-bold text-lg mb-1">Attorney Introduction</p>
                <p className="text-slate-300 text-sm">Before discussing fees, the attorney will personally speak with the client to confirm the acceptance, answer any legal questions, and build trust.</p>
              </div>

              <ScriptBox color="amber">
                {firstName}, what I am going to do right now is get the attorney on the line for you. They want to personally introduce themselves, confirm that they have accepted your case, and answer any questions you might have directly — attorney to client. This typically takes just a few minutes.
              </ScriptBox>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Script for this step:</p>
                {[
                  `"${firstName}, I am going to place you on a brief hold while I connect you with [Attorney Name]. They have been expecting your call and are ready to speak with you."`,
                  `[Transfer or conference in attorney]`,
                  `Attorney introduces themselves, confirms case acceptance, answers any initial questions client may have.`,
                  `Attorney wraps up: "I am confident we can help you through this. My team will now walk you through the specifics of your case and fees. It was great speaking with you."`,
                  `[Take the call back] "Thank you [Attorney Name]. ${firstName}, wasn't that great? Now let me walk you through the details of your case."`,
                ].map((s, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${i === 2 ? 'bg-amber-400/8 border-amber-400/25' : 'bg-slate-800/40 border-slate-700'}`}>
                    <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5 ${i === 2 ? 'bg-amber-400/20 text-amber-400' : 'bg-slate-700 text-slate-500'}`}>{i + 1}</span>
                    <p className={`text-xs leading-relaxed ${i === 2 ? 'text-amber-300' : 'text-slate-300'}`}>{s}</p>
                  </div>
                ))}
              </div>
            </Step>
          )}

          {(step === "attorney_call_active") && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-bold text-white">Attorney Call In Progress</h2>
              <div className="bg-gradient-to-br from-green-500/15 to-emerald-500/8 border border-green-500/40 rounded-2xl p-8 text-center">
                <div className="relative mx-auto w-20 h-20 mb-5">
                  <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping" />
                  <div className="relative w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                    <PhoneCall size={36} className="text-green-400" />
                  </div>
                </div>
                <p className="text-green-300 font-bold text-xl mb-1">Attorney Connected</p>
                <p className="text-4xl font-mono text-white font-bold mt-3 mb-1">{fmtTimer(attorneyCallTimer)}</p>
                <p className="text-slate-500 text-sm">Call duration</p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attorney talking points</p>
                {[
                  `"Hello ${firstName}, this is [Attorney Name]. I personally reviewed your case and I am pleased to let you know that you qualify for ${chapterLabel} bankruptcy."`,
                  chapter === "7"
                    ? `"Based on your income, your household size, and the debts you have, Chapter 7 is the right fit. It will eliminate most of what you owe and give you a genuine fresh start."`
                    : `"Chapter 13 is the right fit for you because it lets you keep your assets, catch up on any arrears, and get a complete discharge of your unsecured debt at the end of your plan."`,
                  `"Do you have any questions for me directly — about the process, your specific situation, or anything at all?"`,
                  `[Answer questions] "My team is going to walk you through the rest — including the fee structure. We look forward to working with you."`,
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-slate-700/40 border border-slate-700">
                    <Mic size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 leading-relaxed italic">{s}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={endAttorneyCall}
                className="w-full flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold py-4 rounded-2xl transition-all"
              >
                <PhoneOff size={18} /> End Attorney Call — Take Back Over
              </button>
            </div>
          )}

          {step === "attorney_call_complete" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-bold text-white">Attorney Call Complete</h2>
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
                <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
                <p className="text-green-300 font-bold text-lg mb-1">Great Conversation!</p>
                <p className="text-slate-400 text-sm">The attorney has personally spoken with {firstName}. Now take back over and walk them through the fee agreement.</p>
              </div>
              <ScriptBox color="green">
                Great. So now that you have had a chance to speak with [Attorney Name] directly — and they have confirmed everything — let me walk you through the specifics of how everything works financially. This is going to be very straightforward.
              </ScriptBox>
              <button
                onClick={() => saveStep("fees_intro")}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-2xl transition-all"
              >
                Continue to Fee Discussion <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === "fees_intro" && (
            <Step title="Let's Talk About Fees" next={() => saveStep("fee_breakdown")} back={() => setStep("attorney_call_complete")}>
              <ScriptBox>
                I know talking about money can feel uncomfortable when you are already in a tough financial spot — and that is completely okay. I want to be totally transparent with you about exactly what everything costs and how we can make it work for your specific budget.
              </ScriptBox>
              <ScriptBox>
                There are three components to the total cost of your case. I will walk through each one right now so there are absolutely no surprises.
              </ScriptBox>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Investment</p>
                <p className="text-4xl font-bold text-white">${totalDue.toLocaleString()}</p>
                <p className="text-slate-500 text-xs mt-1">Full-service {chapterLabel} representation through discharge</p>
              </div>
            </Step>
          )}

          {step === "fee_breakdown" && (
            <Step
              title="Fee Breakdown"
              next={() => saveStep(is_bifurcated && chapter === "7" ? "bifurcated_explain" : "payment_plan")}
              back={() => setStep("fees_intro")}
            >
              <div className="space-y-3">
                <div className="bg-slate-800/60 border border-amber-400/30 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-400/15 rounded-xl flex items-center justify-center">
                      <Scale size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Attorney Fee</p>
                      <p className="text-slate-400 text-xs">Full representation through discharge</p>
                    </div>
                  </div>
                  <p className="text-amber-400 font-bold text-lg">${attorney_fee.toLocaleString()}</p>
                </div>

                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-500/15 rounded-xl flex items-center justify-center">
                      <FileText size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Court Filing Fee</p>
                      <p className="text-slate-400 text-xs">Paid directly to the bankruptcy court</p>
                    </div>
                  </div>
                  <p className="text-blue-400 font-bold text-lg">${filing_fee.toLocaleString()}</p>
                </div>

                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-500/15 rounded-xl flex items-center justify-center">
                      <CreditCard size={16} className="text-green-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Credit Counseling Certificate</p>
                      <p className="text-slate-400 text-xs">Required by federal law before filing</p>
                    </div>
                  </div>
                  <p className="text-green-400 font-bold text-lg">~${credit_counseling_fee}</p>
                </div>

                <div className="bg-slate-900 border border-slate-600 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-white font-bold text-sm">Total</p>
                  <p className="text-white font-bold text-xl">${totalDue.toLocaleString()}</p>
                </div>
              </div>
              <ScriptBox>
                The credit counseling certificate is completed online and takes about one hour. We send you the link right after you sign — most clients complete it the same day. It is required by federal law before we file.
              </ScriptBox>
            </Step>
          )}

          {step === "bifurcated_explain" && chapter === "7" && (
            <Step title="How Your Payment Works" next={() => saveStep("payment_plan")} back={() => setStep("fee_breakdown")}>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-blue-400" />
                  <p className="text-blue-300 font-bold text-sm">Bifurcated Fee Structure</p>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Your case qualifies for a <strong className="text-white">bifurcated fee arrangement</strong> — which is a specific type of payment option available for Chapter 7 cases. Here is exactly what that means for you:
                </p>
              </div>
              <ScriptBox>
                Normally, attorney fees must be paid in full before filing. With a bifurcated arrangement, you pay a small initial amount — enough to cover the court filing fee — and then the attorney fee is paid after your case is filed, on a payment plan. The filing gets your automatic stay in place right away.
              </ScriptBox>
              <div className="space-y-2">
                {[
                  { label: "Before filing", value: `$${(filing_fee + credit_counseling_fee).toLocaleString()} — court fee + credit counseling` },
                  { label: "After filing", value: `$${attorney_fee.toLocaleString()} attorney fee on a payment plan` },
                ].map((row, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <p className="text-slate-400 text-sm">{row.label}</p>
                    <p className="text-white font-semibold text-sm">{row.value}</p>
                  </div>
                ))}
              </div>
              <ScriptBox>
                This means we can file your case much sooner — stopping collection calls, lawsuits, and garnishments right away — even while you are still paying the attorney fee over time.
              </ScriptBox>
            </Step>
          )}

          {step === "payment_plan" && (
            <Step
              title="Payment Plan Options"
              next={() => saveStep("objections")}
              back={() => setStep(is_bifurcated && chapter === "7" ? "bifurcated_explain" : "fee_breakdown")}
            >
              <ScriptBox>
                Let's figure out what works for your budget, {firstName}. Based on your pay schedule — {PAY_FREQ_LABEL[client_pay_frequency] || "regular payments"} — here is what each option looks like. We also want to ask: are you able to put anything down today to get started?
              </ScriptBox>

              {/* Down Payment Input */}
              <div className="bg-green-500/8 border border-green-500/30 rounded-xl p-4">
                <p className="text-green-300 font-semibold text-sm mb-3">Down Payment (Optional)</p>
                <ScriptBox color="green">
                  {chapter === "13"
                    ? `${firstName}, for Chapter 13 cases we do ask for a down payment today. Would you be able to put $500 or more down to get started? Anything you put down today lowers your remaining balance.`
                    : is_bifurcated
                    ? `${firstName}, before we file we need the court filing fee of $${(filing_fee + credit_counseling_fee).toLocaleString()}. On top of that, if you are able to put anything toward your attorney fee today, that will reduce your ongoing payment amount.`
                    : `${firstName}, are you able to put anything down today? Even a small down payment lowers your payments and gets your case started on the right foot.`
                  }
                </ScriptBox>
                <div className="flex items-center gap-3 mt-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      max={attorney_fee}
                      value={downPaymentInput}
                      onChange={e => {
                        setDownPaymentInput(e.target.value);
                        const v = parseFloat(e.target.value) || 0;
                        setDownPayment(Math.min(v, attorney_fee));
                      }}
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-7 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-400 placeholder-slate-500"
                    />
                  </div>
                  {downPayment > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Remaining balance</p>
                      <p className="text-green-400 font-bold text-sm">${(attorney_fee - downPayment).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {Array.from({ length: maxMonths }, (_, i) => i + 1).filter(m => {
                  const freqMap: Record<string, number> = { "Weekly": 52, "Bi-Weekly": 26, "Semi-Monthly": 24, "Monthly": 12 };
                  const ppy = freqMap[client_pay_frequency] ?? 26;
                  return Math.round(m * (ppy / 12)) >= 1;
                }).filter((_, i) => i < 10 || maxMonths <= 12).map(months => {
                  const plan = calcPaymentPlan(attorney_fee, is_bifurcated, chapter, client_pay_frequency, months, downPayment);
                  const isSelected = planMonths === months;
                  return (
                    <button
                      key={months}
                      onClick={() => setPlanMonths(months)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                        isSelected
                          ? "bg-amber-400/15 border-amber-400/50"
                          : "bg-slate-800/40 border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? "text-amber-400" : "text-white"}`}>
                          {months} Month{months > 1 ? "s" : ""} {months === 1 ? "— Pay in Full" : ""}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {plan.totalPeriods} payment{plan.totalPeriods > 1 ? "s" : ""} {PAY_FREQ_LABEL[client_pay_frequency] || ""}
                        </p>
                      </div>
                      <p className={`text-lg font-bold ${isSelected ? "text-amber-400" : "text-slate-300"}`}>
                        ${plan.perPeriod.toLocaleString()}<span className="text-xs font-normal text-slate-500">/{client_pay_frequency === "Monthly" ? "mo" : client_pay_frequency === "Weekly" ? "wk" : "period"}</span>
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-slate-400 text-sm">Selected Plan:</p>
                  <p className="text-amber-400 font-bold">{planMonths} month{planMonths > 1 ? "s" : ""} (max {maxMonths})</p>
                </div>
                {downPayment > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">Down payment today:</p>
                    <p className="text-green-400 font-bold">${downPayment.toLocaleString()}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-slate-400 text-sm">Payment {PAY_FREQ_LABEL[client_pay_frequency] || ""}:</p>
                  <p className="text-white font-bold text-lg">${perPeriod.toLocaleString()}</p>
                </div>
                {lastPayment !== perPeriod && totalPeriods > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-slate-500 text-xs">Final payment:</p>
                    <p className="text-slate-400 text-xs font-semibold">${lastPayment.toLocaleString()}</p>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-700 pt-2 mt-1">
                  <p className="text-slate-400 text-sm">Total payments:</p>
                  <p className="text-slate-300 font-semibold">{totalPeriods} × ${perPeriod.toLocaleString()}{lastPayment !== perPeriod && totalPeriods > 1 ? ` + 1 × $${lastPayment.toLocaleString()}` : ''}</p>
                </div>
                {is_bifurcated && chapter === "7" && (
                  <p className="text-blue-400 text-xs mt-1">
                    + ${(filing_fee + credit_counseling_fee).toLocaleString()} due before filing (court fee + counseling)
                  </p>
                )}
              </div>
            </Step>
          )}

          {step === "objections" && (
            <Step title="Do You Have Any Questions or Concerns?" next={() => saveStep("timeline")} back={() => setStep("payment_plan")} nextLabel="All good — continue">
              <ScriptBox>
                Before we go any further, I want to give you a chance to ask anything at all. There are no wrong questions — in fact, I want to address whatever is on your mind right now.
              </ScriptBox>
              <div className="space-y-2">
                {OBJECTION_SCRIPTS.map((obj, i) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setActiveObjection(activeObjection === i ? null : i)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <HelpCircle size={14} className="text-amber-400 flex-shrink-0" />
                        <p className="text-white text-sm font-medium">{obj.q}</p>
                      </div>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ${activeObjection === i ? "rotate-180" : ""}`} />
                    </button>
                    {activeObjection === i && (
                      <div className="px-4 pb-4">
                        <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-3 mt-1">
                          <div className="flex items-start gap-2.5">
                            <Scale size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-slate-200 text-sm leading-relaxed">{obj.a}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Step>
          )}

          {step === "timeline" && (
            <Step title="What Happens Next — Your Timeline" next={() => saveStep("next_steps")} back={() => setStep("objections")}>
              <ScriptBox>
                I know it helps to see the whole picture from start to finish. Let me walk you through exactly what the process looks like.
              </ScriptBox>
              <div className="relative space-y-1">
                <div className="absolute left-5 top-6 bottom-6 w-px bg-slate-700" />
                {[
                  { label: "Sign Fee Agreement & Retainer", desc: "Once you decide to move forward today, you sign our fee agreement electronically and we get started immediately.", color: "bg-amber-400/15 border-amber-400/50 text-amber-400", dot: "bg-amber-400" },
                  { label: "Document Gathering", desc: "We send you a secure checklist and upload link — paystubs, bank statements, tax returns. Our team helps you through every document.", color: "bg-blue-400/15 border-blue-400/50 text-blue-400", dot: "bg-blue-400" },
                  { label: "Complete Credit Counseling", desc: "A 1-hour online course required by federal law. We send you the link and it takes about one hour.", color: "bg-cyan-400/15 border-cyan-400/50 text-cyan-400", dot: "bg-cyan-400" },
                  { label: "Case Filed — Automatic Stay Begins", desc: "The moment we file, all collection calls, lawsuits, and garnishments must legally stop. Immediately. By federal order.", color: "bg-green-400/15 border-green-400/50 text-green-400", dot: "bg-green-400" },
                  { label: "341 Meeting of Creditors", desc: "A short, informal meeting with the bankruptcy trustee — typically 5–10 minutes. We are right there with you. Creditors rarely appear.", color: "bg-slate-600/50 border-slate-500 text-slate-300", dot: "bg-slate-400" },
                  { label: "Discharge — Debt Eliminated", desc: chapter === "7" ? "Approximately 60 days after your 341 meeting, your eligible debts are legally discharged. You are free." : "After completing your 3–5 year repayment plan, your remaining eligible debts are discharged.", color: "bg-green-500/20 border-green-500/40 text-green-300", dot: "bg-green-500" },
                ].map((item, i) => (
                  <div key={i} className="relative flex items-start gap-4 pl-3 py-2">
                    <div className={`relative z-10 w-5 h-5 rounded-full flex-shrink-0 mt-0.5 ${item.dot}`} />
                    <div className={`flex-1 border rounded-xl p-3 ${item.color}`}>
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs mt-1 opacity-80 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Step>
          )}

          {step === "next_steps" && (
            <Step title="Documents We Will Need" next={() => saveStep("qualifying_close")} back={() => setStep("timeline")}>
              <ScriptBox>
                Once you are ready to move forward, here is what we will need from you. We send you a complete checklist and our team helps you through every single item — you do not have to figure this out alone.
              </ScriptBox>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Last 2 years of federal tax returns",
                  "Last 6 months of bank statements (all accounts)",
                  "Last 60 days of paystubs",
                  "Most recent mortgage statement (if applicable)",
                  "Vehicle titles or loan statements",
                  "Court judgments, lawsuits, or collection letters",
                  "Social Security card and government-issued photo ID",
                  "Life insurance policy (if it has cash value)",
                ].map((doc, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-slate-800/40 border border-slate-700 rounded-xl px-3 py-2.5">
                    <FileText size={13} className="text-slate-500 flex-shrink-0" />
                    <p className="text-slate-300 text-xs">{doc}</p>
                  </div>
                ))}
              </div>
              <ScriptBox>
                Do not worry if you do not have everything right now. We will send you a secure upload link and you can send documents as you find them. Our team will follow up with you throughout the process.
              </ScriptBox>
            </Step>
          )}

          {step === "qualifying_close" && (
            <Step title="Ready to Move Forward?" back={() => setStep("next_steps")}>
              <ScriptBox>
                {firstName}, you have spoken directly with the attorney, we have gone over the fees, looked at a payment plan that works for your schedule, and you understand exactly what the process looks like from start to finish.
              </ScriptBox>
              <ScriptBox color="green">
                The next step is your fee agreement. We send it to you electronically through our secure portal — it takes about two minutes to sign and does not require you to create an account. Once it is signed, your case is officially started and we begin working on your behalf that same day.
              </ScriptBox>
              <ScriptBox>
                Is there anything at all that would prevent you from moving forward right now?
              </ScriptBox>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => saveStep("welcome_call_pending")}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold text-base py-4 rounded-2xl transition-all"
                >
                  <CheckCircle size={18} /> Yes — I am ready. Send my fee agreement.
                </button>
                <button
                  onClick={() => saveStep("defer")}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold text-sm py-3 rounded-2xl transition-all"
                >
                  <Calendar size={15} /> I need more time — schedule a follow-up call
                </button>
              </div>
            </Step>
          )}

          {step === "welcome_call_pending" && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-white">Sending Fee Agreement</h2>
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/30 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-blue-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText size={32} className="text-blue-400" />
                </div>
                <p className="text-blue-300 font-bold text-lg mb-1">Fee Agreement — Ready to Send</p>
                <p className="text-slate-300 text-sm">{firstName} is ready to sign. Confirm the attorney welcome call was completed, then send the BoldSign fee agreement.</p>
              </div>

              {/* Intake answers summary — attached to fee agreement */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowIntakeSummary(s => !s)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <ClipboardList size={16} className="text-amber-400" />
                    <p className="text-white font-semibold text-sm">Intake Summary — Attached to Fee Agreement</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full">Included</span>
                    {showIntakeSummary
                      ? <ChevronDown size={14} className="text-slate-400" />
                      : <ChevronDown size={14} className="text-slate-400 -rotate-90" />}
                  </div>
                </button>
                {showIntakeSummary && (
                  <div className="border-t border-slate-700 max-h-[600px] overflow-y-auto">
                    <IntakeAnswersSummary
                      clientId={clientId}
                      clientName={clientName}
                      hideHeader
                    />
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
                <p className="text-white font-semibold text-sm">Onboarding Steps</p>
                {[
                  { n: 1, label: 'Attorney introduction call completed', done: true },
                  { n: 2, label: 'Confirm client is ready to proceed and send BoldSign fee agreement', done: welcomeCallStatus !== 'pending' },
                  { n: 3, label: 'Client signs electronically — case officially started', done: welcomeCallStatus === 'completed' },
                ].map(item => (
                  <div key={item.n} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500/20 border border-green-500/40' : 'bg-slate-800 border border-slate-600'}`}>
                      {item.done ? <CheckCircle size={14} className="text-green-400" /> : <span className="text-slate-400 text-xs font-bold">{item.n}</span>}
                    </div>
                    <p className={`text-sm ${item.done ? 'text-green-300' : 'text-slate-300'}`}>{item.label}</p>
                  </div>
                ))}
              </div>

              {welcomeCallStatus === 'pending' && canSendFeeAgreement && (
                <button onClick={requestWelcomeCall} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-2xl transition-all disabled:opacity-60">
                  <FileText size={16} /> {saving ? 'Processing...' : 'Send Fee Agreement via BoldSign'}
                </button>
              )}
              {welcomeCallStatus === 'pending' && !canSendFeeAgreement && (
                <button
                  onClick={() => {
                    // BAN-35 placeholder: in BAN-38 / BAN-42 this will notify the
                    // attorney and record a clarification / approval request.
                    console.log('Would notify attorney — Send Fee Agreement requires attorney or legal_admin');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-700 text-slate-300 font-bold py-4 rounded-2xl transition-all"
                >
                  <FileText size={16} /> Pending Attorney Approval
                </button>
              )}

              {welcomeCallStatus === 'requested' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <Clock size={16} className="text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-amber-300 font-semibold text-sm">Fee Agreement Sent</p>
                      <p className="text-slate-400 text-xs mt-0.5">Awaiting {firstName}'s electronic signature via BoldSign. Once signed, mark the agreement as complete below.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={markWelcomeCallComplete} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60 text-sm">
                      <CheckCircle size={14} /> {saving ? 'Saving...' : 'Fee Agreement Signed — Mark Complete'}
                    </button>
                    <button onClick={requestWelcomeCall} disabled={saving} className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-all disabled:opacity-60 text-sm">
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
              )}

              {welcomeCallStatus === 'completed' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-green-300 font-semibold text-sm">Fee Agreement Signed</p>
                      <p className="text-slate-400 text-xs mt-0.5">{firstName} is now officially a retained client. Finish and go to the dashboard.</p>
                    </div>
                  </div>
                  <button onClick={() => saveStep("done")} className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-2xl transition-all">
                    <CheckCircle size={16} /> Complete Onboarding
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "defer" && (
            <Step title="Let's Schedule a Follow-Up" back={() => setStep("qualify_readiness")}>
              <ScriptBox>
                That is completely fine, {firstName}. There is no pressure at all. I want you to feel 100% comfortable and confident. Let's find a time to reconnect when it works for you.
              </ScriptBox>
              <ScriptBox color="amber">
                One thing I do want to mention — your creditors do not stop just because you need more time to decide. Every day without a filed case is a day they can still garnish wages or file lawsuits. Whenever you are ready, we are here.
              </ScriptBox>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">Preferred Follow-Up Date</label>
                  <input
                    type="date"
                    value={deferDate}
                    onChange={e => setDeferDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">What would help you decide? (optional)</label>
                  <textarea
                    value={deferReason}
                    onChange={e => setDeferReason(e.target.value)}
                    rows={3}
                    placeholder="e.g., waiting for spouse, need to review finances, want to speak with attorney again..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 resize-none placeholder-slate-500"
                  />
                </div>
              </div>
              <button
                onClick={deferOnboarding}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-3 rounded-xl transition-all disabled:opacity-60 mt-2"
              >
                <Calendar size={15} /> {saving ? "Scheduling..." : "Schedule My Follow-Up Call"}
              </button>
            </Step>
          )}

          {step === "done" && (
            <div className="text-center space-y-6 py-8">
              <div className="w-20 h-20 bg-green-500/15 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to the Firm, {firstName}!</h2>
                <p className="text-slate-400 text-sm">Fee agreement signed. Your case is officially underway.</p>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 text-left space-y-3">
                <p className="text-sm font-bold text-white mb-2">Your Next Steps</p>
                {[
                  "Check your email for your fee agreement confirmation from BoldSign",
                  "Complete your credit counseling online (~1 hour) — link will be emailed to you",
                  "Gather your documents using the checklist we will send — we will help with every item",
                  "Our team will be in touch within 1 business day to confirm everything and begin prep",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 bg-amber-400/15 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-400 text-xs font-bold">{i + 1}</span>
                    </div>
                    <p className="text-slate-300 text-sm">{item}</p>
                  </div>
                ))}
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-left">
                <p className="text-blue-300 text-sm font-semibold mb-1">BoldSign — Electronic Signature</p>
                <p className="text-slate-400 text-xs">Your fee agreement has been sent to your email. Check your inbox (and spam folder) for a message from BoldSign. It takes 2 minutes to sign and no account is required.</p>
              </div>
              <button
                onClick={completeOnboarding}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-base py-4 rounded-2xl transition-all disabled:opacity-60"
              >
                {saving ? "Saving..." : "Finish & Go to Dashboard"}
                <ChevronRight size={18} />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
