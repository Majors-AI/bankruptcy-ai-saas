// New-lead logging window — unified scheduling experience.
//
// Full-screen experience opened when a legal admin logs a NEW inbound caller
// who is not yet in the system. Now shares the 5-business-day calendar +
// 3-action ladder with the existing-lead scheduling surface
// (ScheduleConsultModal). Both surfaces show the same bubbles, the same
// recommendation logic, and the same Do-Consult-Now / See-Who's-Available /
// Schedule actions.
//
// What's REAL:
//   - Lead row creation in intake_leads (assigned_name = session.name).
//   - In-system dedup on phone / email against intake_leads + clients.
//   - Slot fetch + booking via get_open_slots / book_consultation RPCs.
//   - Declined-consent leads land with follow_up_queue='priority' and
//     bot_followup_enabled=false so they surface in the To-do dashboard.
//
// What's NOT in scope this build:
//   - Real outbound sends. The dedicated "Send Invite" action was removed
//     from this surface — invite dispatch is a separate phase.
//   - Live transfer / reassign with accept handshake. "See Who's Available"
//     is visibility-only; a fire-and-forget reassign would need an
//     intake_transfer_requests table (intentionally not built).
//   - Modality persistence (no schema column yet — attached to p_notes only).
//
// Locked Client Portal questionnaire and BankruptcyIntake are NOT modified.

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, AlertCircle, Calendar, PhoneCall, Plus, RefreshCw, UserCheck, Users,
  Ban, ExternalLink,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import ConsultSchedulerPanel, {
  todayInFirmTz, formatDayLabel,
  StaffAvailabilityList,
  StaffDetail, CalEvent, SchedulerSelection,
} from "../scheduler/ConsultSchedulerPanel";
import {
  firmSettings, availableModalities, modalityLabel, ConsultModality,
} from "../../lib/firmSettings";
import ClientSearchBar, { normalizePhone, type ClientSearchLead } from "../client-search/ClientSearchBar";

// TODO firm-aware refactor: read state from firms.state when available.
const DEFAULT_FIRM_STATE = "AZ";

const DEFAULT_SLOT_MINUTES = 45;
// Buffer so book_consultation's "p_start_time < now() - 1 minute" check
// doesn't trip on client/server clock drift.
const IMMEDIATE_START_BUFFER_MS = 60_000;

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortalSession {
  id: string;
  name: string;
  role: string;
  title: string | null;
}

interface DedupHit {
  source: "intake_leads" | "clients";
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status?: string;
}

type ConsentState = "unknown" | "opted_in" | "declined";

interface NewLeadInlineProps {
  session: PortalSession;
  /** Calendar events visible to the parent — drives load + imminent-appt detection. */
  calEvents: CalEvent[];
  /**
   * In-memory leads list from the parent — feeds the search bar at the top
   * of the new-lead window. Optional: when omitted, the search bar still
   * renders but matches against an empty array (it's only a discovery aid).
   */
  existingLeads?: ClientSearchLead[];
  /**
   * Open an existing client/lead record by id (from the search bar or the
   * dedup blocking banner). Wires to the parent's "show lead detail" flow.
   * Optional: when omitted, the search bar and "Open existing record"
   * button are inert (matched rows display read-only).
   */
  onOpenExistingLead?: (leadId: string) => void;
  onExit: () => void;
  /** Bounces to the lead detail panel for the just-created lead. */
  onSaved: (leadId: string) => void;
  /**
   * Launch StaffGuidedIntake for the just-created lead. Required for the
   * "Do Consult Now" action — without this prop the action degrades to a
   * lead-detail bounce.
   */
  onDoIntakeNow?: (leadId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewLeadInline({
  session, calEvents,
  existingLeads = [],
  onOpenExistingLead,
  onExit, onSaved, onDoIntakeNow,
}: NewLeadInlineProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [source, setSource]       = useState("inbound");
  const [chapter, setChapter]     = useState<string>("7");
  const [state, setState]         = useState(DEFAULT_FIRM_STATE);
  const [maritalStatus, setMaritalStatus] = useState<"individual" | "married_joint">("individual");
  const [spouseName, setSpouseName]       = useState("");
  const [urgentMatter, setUrgentMatter] =
    useState<"none" | "foreclosure" | "garnishment" | "legal_action" | "other">("none");
  const [foreclosureDate, setForeclosureDate] = useState("");
  const [urgentDetail, setUrgentDetail]       = useState("");
  const [preferred, setPreferred] = useState("phone");
  const [notes, setNotes]         = useState("");
  // Consent — tri-state. Declined still flips follow_up_queue='priority' on
  // save so the lead surfaces in the To-do dashboard.
  const [consent, setConsent]     = useState<ConsentState>("unknown");
  const [modality, setModality]   = useState<ConsultModality>(firmSettings.defaultModality);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const mappedUrgency: "normal" | "urgent" | "emergency" =
    urgentMatter === "foreclosure" || urgentMatter === "legal_action" ? "emergency" :
    urgentMatter === "garnishment"                                    ? "urgent"    :
    urgentMatter === "other"                                          ? "urgent"    :
                                                                        "normal";

  // ── In-flight state ───────────────────────────────────────────────────────
  const [saving, setSaving]         = useState(false);
  const [bookingNow, setBookingNow] = useState(false);
  const [bookError, setBookError]   = useState<string | null>(null);
  const [showWhosAvailable, setShowWhosAvailable] = useState(false);

  // ── Dedup (real-time, debounced) ─────────────────────────────────────────
  // Two-tier result:
  //   - dedupHits  — every fuzzy match (phone last-4 or email substring).
  //                  Drives the informational warning banner.
  //   - phoneBlockingHits — subset whose phone normalizes to the SAME 10-digit
  //                  form as the entered phone. THIS BLOCKS creation.
  // Email matches alone do not block (a single email can legitimately belong
  // to multiple household members in our intake history); phone equality is
  // the stronger signal and is treated as a hard duplicate.
  const [dedupHits, setDedupHits] = useState<DedupHit[]>([]);
  useEffect(() => {
    const e = email.trim().toLowerCase();
    const digits = phone.replace(/\D/g, "");
    const last4 = digits.slice(-4);
    if (e.length < 4 && last4.length < 4) {
      setDedupHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const hits: DedupHit[] = [];
      try {
        const orParts: string[] = [];
        if (e.length >= 4) orParts.push(`email.ilike.${e}`);
        if (last4.length === 4) orParts.push(`phone.ilike.%${last4}%`);
        if (orParts.length > 0) {
          const { data } = await supabase
            .from("intake_leads")
            .select("id,full_name,phone,email,status")
            .or(orParts.join(","))
            .limit(5);
          if (!cancelled && data) {
            for (const r of data) {
              hits.push({ source: "intake_leads", id: r.id, name: r.full_name, phone: r.phone, email: r.email, status: r.status });
            }
          }
        }
      } catch { /* best-effort */ }
      try {
        const orParts: string[] = [];
        if (e.length >= 4) orParts.push(`email.ilike.${e}`);
        if (last4.length === 4) orParts.push(`phone.ilike.%${last4}%`);
        if (orParts.length > 0) {
          const { data } = await supabase
            .from("clients")
            .select("id,name,phone,email,status")
            .or(orParts.join(","))
            .limit(5);
          if (!cancelled && data) {
            for (const r of data) {
              hits.push({ source: "clients", id: r.id, name: r.name, phone: r.phone, email: r.email, status: r.status });
            }
          }
        }
      } catch { /* best-effort */ }
      if (!cancelled) setDedupHits(hits);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [phone, email]);

  // ── Staff pool (active + intake-eligible) ────────────────────────────────
  const [staffPool, setStaffPool] = useState<StaffDetail[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("staff_members")
        .select("id,name,role,role_level,intake_portal_role,is_active")
        .eq("is_active", true)
        .in("intake_portal_role", ["legal_admin", "super_admin", "attorney_super_admin"])
        .order("role_level", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (!cancelled && data) setStaffPool(data as StaffDetail[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Scheduler selection — panel owns the week start internally now. ───────
  const todayLocal = useMemo(() => todayInFirmTz(), []);
  const [selection, setSelection] = useState<SchedulerSelection>({
    staffId: null, slotStartIso: null, dateStr: null,
  });

  // ── Save / book helpers ───────────────────────────────────────────────────

  async function createLeadOnly(): Promise<string | null> {
    if (!fullName) return null;
    if (!phone.trim() && !email.trim()) return null;
    setSaving(true);
    try {
      const maritalLine =
        maritalStatus === "married_joint"
          ? `[Married — joint filing${spouseName.trim() ? `; Spouse (Debtor 2): ${spouseName.trim()}` : ""}]`
          : `[Individual filer]`;
      const modalityLine = `[Modality: ${modalityLabel(modality)}]`;
      const composedNotes = [maritalLine, modalityLine, notes.trim()].filter(Boolean).join("\n");

      const urgentLabel =
        urgentMatter === "foreclosure"   ? `Foreclosure${foreclosureDate ? ` — sale date ${foreclosureDate}` : ""}` :
        urgentMatter === "garnishment"   ? `Garnishment` :
        urgentMatter === "legal_action"  ? `Legal action` :
        urgentMatter === "other"         ? `Other${urgentDetail.trim() ? ` — ${urgentDetail.trim()}` : ""}` :
                                            null;
      const composedPreScreen = urgentLabel ? `[Urgent: ${urgentLabel}]` : null;

      // Declined consent → priority queue + bot off so a human surfaces it.
      const followUpQueue: "priority" | null = consent === "declined" ? "priority" : null;
      const botFollowupEnabled = consent === "declined" ? false : undefined;

      const { data, error } = await supabase
        .from("intake_leads")
        .insert({
          full_name: fullName,
          phone: phone || null,
          email: email || null,
          source,
          chapter_interest: chapter ? parseInt(chapter) : null,
          state: state || null,
          status: "new",
          urgency: mappedUrgency,
          preferred_contact: preferred,
          notes: composedNotes || null,
          pre_screen_notes: composedPreScreen,
          assigned_name: session.name,
          ...(followUpQueue ? { follow_up_queue: followUpQueue } : {}),
          ...(botFollowupEnabled !== undefined ? { bot_followup_enabled: botFollowupEnabled } : {}),
        })
        .select("id")
        .single();
      if (error || !data) return null;
      return data.id as string;
    } finally {
      setSaving(false);
    }
  }

  async function bookConsult(
    staffId: string,
    startMs: number,
    leadId: string,
    bookingLabel: string,
    isWalkIn: boolean,
  ): Promise<{ ok: boolean; reason: string | null }> {
    const endMs = startMs + DEFAULT_SLOT_MINUTES * 60_000;
    const { data, error } = await supabase.rpc("book_consultation", {
      p_staff_id:    staffId,
      p_lead_id:     leadId,
      p_start_time:  new Date(startMs).toISOString(),
      p_end_time:    new Date(endMs).toISOString(),
      p_client_name: fullName,
      p_client_phone: phone || null,
      p_client_email: email || null,
      p_is_walk_in:  isWalkIn,
      p_notes:       `${bookingLabel} — ${modalityLabel(modality)} consult — logged by ${session.name}`,
      p_created_by:  session.name,
    });
    const result = (data ?? null) as { ok: boolean; reason: string | null } | null;
    if (error || !result?.ok) {
      return { ok: false, reason: result?.reason ?? error?.message ?? "Booking failed" };
    }
    return { ok: true, reason: null };
  }

  // ── Action handlers ───────────────────────────────────────────────────────

  // Schedule — books the slot/staff picked in the 5-day calendar. Disabled
  // until the admin picks a bubble (no implicit "earliest of day" fallback —
  // the bubble grid is the explicit pick).
  async function handleSchedule() {
    if (!selection.staffId || !selection.slotStartIso || !selection.dateStr) return;
    setBookError(null);
    setBookingNow(true);
    try {
      const leadId = await createLeadOnly();
      if (!leadId) {
        setBookError("Could not create lead row.");
        return;
      }
      const startMs = new Date(selection.slotStartIso).getTime();
      const res = await bookConsult(
        selection.staffId, startMs, leadId,
        `Scheduled at ${formatDayLabel(selection.dateStr)}`, false,
      );
      if (!res.ok) setBookError(res.reason);
      onSaved(leadId);
    } finally {
      setBookingNow(false);
    }
  }

  // Do Consult Now — book the immediate consult AND bounce to
  // StaffGuidedIntake. Mirrors the existing "hot start" pattern. Staffer is
  // selection.staffId if picked, otherwise least-loaded via p_staff_id=null.
  async function handleDoConsultNow() {
    setBookError(null);
    setBookingNow(true);
    try {
      const leadId = await createLeadOnly();
      if (!leadId) {
        setBookError("Could not create lead row.");
        return;
      }
      const startMs = Date.now() + IMMEDIATE_START_BUFFER_MS;
      // Pass null staffId when the admin hasn't picked one — book_consultation
      // selects the least-loaded staffer that's free at that exact moment.
      const endMs = startMs + DEFAULT_SLOT_MINUTES * 60_000;
      const { data, error } = await supabase.rpc("book_consultation", {
        p_staff_id:    selection.staffId,
        p_lead_id:     leadId,
        p_start_time:  new Date(startMs).toISOString(),
        p_end_time:    new Date(endMs).toISOString(),
        p_client_name: fullName,
        p_client_phone: phone || null,
        p_client_email: email || null,
        p_is_walk_in:  true,
        p_notes:       `Walk-in consult — ${modalityLabel(modality)} — logged by ${session.name}`,
        p_created_by:  session.name,
      });
      const result = (data ?? null) as { ok: boolean; reason: string | null } | null;
      if (error || !result?.ok) {
        setBookError(result?.reason ?? error?.message ?? "Booking failed");
        // Lead still exists — bounce to detail rather than guided intake.
        onSaved(leadId);
        return;
      }
      if (onDoIntakeNow) {
        onDoIntakeNow(leadId);
      } else {
        onSaved(leadId);
      }
    } finally {
      setBookingNow(false);
    }
  }

  async function handleCreateOnly() {
    const id = await createLeadOnly();
    if (id) onSaved(id);
  }

  // ── Phone-exact duplicate detection (BLOCKING) ────────────────────────────
  // Normalize entered phone + each hit's phone to 10-digit form and compare.
  // The DB query is fuzzy (LIKE %last4%) so it pulls candidates that share a
  // last-4 — we then refine here to exact-match-only for the blocking check.
  const enteredPhoneNorm = useMemo(() => normalizePhone(phone), [phone]);
  const phoneBlockingHits = useMemo<DedupHit[]>(() => {
    if (!enteredPhoneNorm) return [];
    return dedupHits.filter(h => normalizePhone(h.phone) === enteredPhoneNorm);
  }, [dedupHits, enteredPhoneNorm]);
  const isPhoneBlocked = phoneBlockingHits.length > 0;

  // ── Gating ────────────────────────────────────────────────────────────────
  const hasContactMethod = phone.trim().length > 0 || email.trim().length > 0;
  // Phone-exact match is a HARD BLOCK. Email-only / partial-phone matches
  // surface as a soft warning (see dedup banner) but do not block creation.
  const canCreate = fullName.length > 0 && hasContactMethod && !isPhoneBlocked && !saving && !bookingNow;
  const canDoConsultNow = canCreate;
  const canSchedule = canCreate && !!selection.staffId && !!selection.slotStartIso;

  return (
    <div className="min-h-screen flex flex-col text-[#FAFAF7]" style={{ background: "#0F0F0E" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 px-6 flex-shrink-0"
        style={{ height: 56, background: "#0F0F0E", borderBottom: "1px solid #2A2A28", display: "flex", alignItems: "center" }}
      >
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-[#6B6B66] hover:text-[#FAFAF7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="mx-auto flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#B8945F]" />
          <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            New Client Lead
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#6B6B66]">{session.name}</span>
      </header>

      {/* Body — single column, max-width centered. Order: caller details → actions → scheduler. */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 lg:px-8 lg:py-8 space-y-6">

          {/* ── Client search (top of the new-lead window) ──────────────── */}
          {/* Same search bar that lives on the dashboard — lets staff confirm
              the caller isn't already in the system BEFORE starting a new
              record. Click any match to bounce into that lead instead. */}
          <section>
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-2">
                Is the caller already in the system?
              </p>
              <ClientSearchBar
                leads={existingLeads}
                onOpen={(l) => onOpenExistingLead?.(l.id)}
                placeholder="Search by name or phone before creating a new record…"
              />
            </div>
          </section>

          {/* ── Caller details ──────────────────────────────────────────── */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-4">
              Caller details
            </p>
            <div className="space-y-3 max-w-2xl">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *">
                  <Input value={firstName} onChange={setFirstName} placeholder="First" autoFocus />
                </Field>
                <Field label="Last Name *">
                  <Input value={lastName} onChange={setLastName} placeholder="Last" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input value={phone} onChange={setPhone} placeholder="(312) 555-0000" />
                </Field>
                <Field label="Email">
                  <Input value={email} onChange={setEmail} placeholder="email@example.com" />
                </Field>
              </div>
              {!hasContactMethod && (firstName.trim() || lastName.trim()) && (
                <p className="text-[10px] text-amber-300/80 italic -mt-1">
                  At least one of phone or email is required — we drive follow-up by text or call.
                </p>
              )}

              {/* Dedup — phone-exact = BLOCKING. */}
              {isPhoneBlocked && (
                <div className="rounded-lg border border-red-700/70 bg-red-950/40 px-3 py-3">
                  <div className="flex items-start gap-2">
                    <Ban className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-red-300">
                        A client with this phone already exists.
                      </p>
                      <p className="text-[11px] text-red-200/90 mt-0.5 leading-snug">
                        Creating a new record is blocked — open the existing one instead.
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {phoneBlockingHits.slice(0, 3).map(h => {
                          const canOpen = h.source === "intake_leads" && !!onOpenExistingLead;
                          return (
                            <li key={`block_${h.source}_${h.id}`}>
                              <button
                                onClick={() => { if (canOpen) onOpenExistingLead!(h.id); }}
                                disabled={!canOpen}
                                className={`w-full flex items-center gap-2 text-[11px] text-left px-2 py-1.5 rounded transition-colors ${
                                  canOpen
                                    ? "bg-red-900/40 hover:bg-red-900/60 border border-red-700/60 cursor-pointer"
                                    : "bg-red-900/20 border border-red-800/40 cursor-not-allowed opacity-70"
                                }`}
                                title={canOpen
                                  ? "Open this existing record"
                                  : h.source === "clients"
                                    ? "Match is in the clients table — open from the Clients view"
                                    : "Open-existing handler not wired"}
                              >
                                <UserCheck className="w-3 h-3 text-red-300 flex-shrink-0" />
                                <span className="font-semibold text-[#FAFAF7] truncate flex-1">{h.name}</span>
                                {h.status && <span className="text-[#6B6B66] text-[10px] flex-shrink-0">{h.status}</span>}
                                <span className="text-[10px] text-red-300/70 flex-shrink-0">{h.source.replace("_", " ")}</span>
                                {canOpen && <ExternalLink className="w-3 h-3 text-red-300 flex-shrink-0" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Dedup — fuzzy / email-only match = informational warning. */}
              {!isPhoneBlocked && dedupHits.length > 0 && (
                <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-300">
                        Possible match — {dedupHits.length} {dedupHits.length === 1 ? "record" : "records"}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {dedupHits.slice(0, 3).map(h => {
                          const canOpen = h.source === "intake_leads" && !!onOpenExistingLead;
                          return (
                            <li key={`warn_${h.source}_${h.id}`} className="text-[11px] text-[#FAFAF7] flex items-center gap-1.5">
                              <span className="font-semibold">{h.name}</span>
                              {h.status && <span className="text-[#6B6B66]">· {h.status}</span>}
                              <span className="text-[10px] text-[#6B6B66]">({h.source.replace("_", " ")})</span>
                              {canOpen && (
                                <button
                                  onClick={() => onOpenExistingLead!(h.id)}
                                  className="text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] ml-auto inline-flex items-center gap-1"
                                >
                                  Open <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-[10px] text-amber-200/80 mt-1.5">
                        Confirm this isn't a duplicate before proceeding — the email or partial phone is similar to an existing record.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Filing type */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Filing Type">
                  <Select value={maritalStatus} onChange={(v) => setMaritalStatus(v as typeof maritalStatus)} options={[
                    ["individual",    "Individual"],
                    ["married_joint", "Married (joint filing)"],
                  ]} />
                </Field>
                {maritalStatus === "married_joint" && (
                  <Field label="Spouse Name (Debtor 2)">
                    <Input value={spouseName} onChange={setSpouseName} placeholder="Spouse's full name" />
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Source">
                  <Select value={source} onChange={setSource} options={[
                    ["inbound", "Inbound Call / Walk-In"],
                    ["referral", "Referral"],
                    ["ad", "Online Ad"],
                    ["website", "Website Form"],
                    ["other", "Other"],
                  ]} />
                </Field>
                <Field label="Chapter Interest">
                  <Select value={chapter} onChange={setChapter} options={[
                    ["", "Undecided"],
                    ["7", "Chapter 7"],
                    ["13", "Chapter 13"],
                  ]} />
                </Field>
                <Field label="State">
                  <Select value={state} onChange={setState} options={[
                    "AZ","CA","CO","FL","GA","IL","MI","NV","NM","NY","OH","TX","WA",
                  ].map(s => [s, s])} />
                </Field>
                <Field label="Preferred Contact">
                  <Select value={preferred} onChange={setPreferred} options={[
                    ["phone", "Phone Call"], ["email", "Email"], ["text", "Text / SMS"],
                  ]} />
                </Field>
              </div>

              {/* Modality */}
              <Field label="Consult Modality">
                <div className="flex flex-wrap gap-2">
                  {availableModalities().map(m => {
                    const active = m === modality;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModality(m)}
                        className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                          active
                            ? "bg-[#B8945F] border-[#B8945F] text-[#0F0F0E] font-bold"
                            : "bg-[#1A1A18] border-[#2A2A28] text-[#FAFAF7] hover:border-[#B8945F]/60"
                        }`}
                      >
                        {modalityLabel(m)}
                      </button>
                    );
                  })}
                </div>
                {!firmSettings.allowInPersonConsults && (
                  <p className="text-[10px] text-[#6B6B66] italic mt-1.5">
                    In-person consults disabled at the firm level. Toggle in firm settings to enable.
                  </p>
                )}
              </Field>

              {/* Urgent matter */}
              <Field label="Any urgent matters?">
                <Select value={urgentMatter} onChange={(v) => setUrgentMatter(v as typeof urgentMatter)} options={[
                  ["none",         "None"],
                  ["foreclosure",  "Foreclosure (sale scheduled)"],
                  ["garnishment",  "Garnishment"],
                  ["legal_action", "Legal action / lawsuit"],
                  ["other",        "Other"],
                ]} />
              </Field>
              {urgentMatter === "foreclosure" && (
                <Field label="Foreclosure Sale Date">
                  <input
                    type="date"
                    value={foreclosureDate}
                    onChange={e => setForeclosureDate(e.target.value)}
                    className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#B8945F] transition-colors"
                  />
                  <p className="text-[10px] text-amber-300/80 italic mt-1">
                    Hard filing deadline — the priority engine reads urgency = emergency for this case.
                  </p>
                </Field>
              )}
              {urgentMatter === "other" && (
                <Field label="Brief detail">
                  <Input value={urgentDetail} onChange={setUrgentDetail} placeholder="What's pressing? (one line)" />
                </Field>
              )}
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Brief description of situation, reason for contact…"
                  className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 placeholder-[#3A3A36] focus:outline-none focus:border-[#B8945F] resize-none transition-colors"
                />
              </Field>

              {/* Consent — tri-state. Declined still triggers priority-queue on save. */}
              <Field label="SMS / Email follow-up consent">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["unknown",   "Not asked"],
                    ["opted_in",  "Opted in"],
                    ["declined",  "Declined"],
                  ] as const).map(([val, label]) => {
                    const active = consent === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setConsent(val)}
                        className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                          active && val === "opted_in"  ? "bg-emerald-700/40 border-emerald-600 text-emerald-100 font-bold" :
                          active && val === "declined"  ? "bg-rose-900/40 border-rose-700 text-rose-100 font-bold" :
                          active                        ? "bg-[#2A2A28] border-[#B8945F]/60 text-[#FAFAF7] font-bold" :
                                                          "bg-[#1A1A18] border-[#2A2A28] text-[#FAFAF7] hover:border-[#B8945F]/60"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#6B6B66] mt-1.5 leading-relaxed">
                  Caller's verbal consent to receive SMS / email follow-up. Declined leads land in the
                  priority queue so a human surfaces them — no automated outreach.
                </p>
              </Field>
            </div>
          </section>

          {/* ── Actions (3) — same set as the existing-lead scheduler ─────── */}
          <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-3">Action</p>
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Do Consult Now — book immediate + launch StaffGuidedIntake. */}
              <button
                disabled={!canDoConsultNow}
                onClick={handleDoConsultNow}
                className="flex items-center gap-2 bg-[#B8945F] hover:bg-[#C8A46F] disabled:opacity-40 disabled:cursor-not-allowed text-[#0F0F0E] font-bold text-xs px-4 py-2 rounded transition-colors"
                title="Creates the lead, books an immediate consult, and opens the staff-guided intake call."
              >
                {bookingNow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                Do Consult Now
              </button>

              {/* 2. See Who's Available — toggle read-only roster below. */}
              <button
                type="button"
                onClick={() => setShowWhosAvailable(v => !v)}
                className="flex items-center gap-2 bg-[#1A1A18] hover:bg-[#2A2A28] border border-[#B8945F]/40 text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
                title="Shows each intake staffer's current status (free now / next at X / out today)."
              >
                <Users className="w-3.5 h-3.5" />
                {showWhosAvailable ? "Hide Who's Available" : "See Who's Available"}
              </button>

              {/* 3. Schedule — book the slot picked in the 5-day calendar. */}
              <button
                disabled={!canSchedule}
                onClick={handleSchedule}
                className="flex items-center gap-2 bg-[#1A1A18] hover:bg-[#2A2A28] border border-[#2A2A28] disabled:opacity-40 disabled:cursor-not-allowed text-[#FAFAF7] font-semibold text-xs px-4 py-2 rounded transition-colors"
                title={selection.slotStartIso ? "Books the slot picked in the calendar below." : "Pick a time bubble in the calendar below first."}
              >
                {bookingNow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                Schedule
              </button>

              {/* Always-available fallback: create lead only, no booking. */}
              <button
                disabled={!canCreate}
                onClick={handleCreateOnly}
                className="ml-auto flex items-center gap-2 bg-[#2A2A28] hover:bg-[#3A3A36] disabled:opacity-40 text-[#FAFAF7] font-semibold text-xs px-3 py-2 rounded transition-colors"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Create lead only
              </button>
            </div>

            {bookError && (
              <div className="mt-3 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-700/40 rounded px-3 py-1.5">
                <span className="font-semibold">Booking failed:</span> {bookError}
              </div>
            )}
            {!hasContactMethod && fullName.length > 0 && (
              <p className="mt-2 text-[10px] text-amber-300/80 italic">
                Provide a phone or email above before booking.
              </p>
            )}
            {isPhoneBlocked && (
              <p className="mt-2 text-[10px] text-red-300 italic font-semibold">
                Creation blocked — a client with this phone already exists. Open the existing record above.
              </p>
            )}
            {consent === "declined" && (
              <p className="mt-2 text-[10px] text-rose-300/80 italic">
                Caller declined SMS / email follow-up. The lead will be flagged
                <span className="font-semibold text-rose-200"> priority queue</span> on save so it surfaces in the To-do dashboard.
              </p>
            )}
          </section>

          {/* See Who's Available — read-only roster (toggle). */}
          {showWhosAvailable && (
            <StaffAvailabilityList
              staffPool={staffPool}
              calEvents={calEvents}
              currentSessionId={session.id}
              todayLocal={todayLocal}
            />
          )}

          {/* ── Unified 5-day scheduler ──────────────────────────────────── */}
          <ConsultSchedulerPanel
            staffPool={staffPool}
            calEvents={calEvents}
            currentSessionId={session.id}
            selection={selection}
            onChangeSelection={setSelection}
            todayLocal={todayLocal}
          />

        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-[#6B6B66] uppercase tracking-widest block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <input
      autoFocus={autoFocus}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#B8945F] transition-colors placeholder-[#3A3A36]"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#1A1A18] border border-[#2A2A28] text-[#FAFAF7] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#B8945F] transition-colors"
    >
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}
