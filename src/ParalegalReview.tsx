import { useState, useEffect } from "react";
import {
  CheckCircle2, AlertTriangle, XCircle, FileText, User, Scale,
  ChevronDown, ChevronRight, ExternalLink, RefreshCw, Send, Plus,
  Copy, ArrowRightLeft, Trash2, Check, X, Info, MessageSquare,
  ClipboardCheck, Eye, Loader2, Ban, Home, Car, Briefcase,
  CreditCard, Heart, DollarSign, ReceiptText, Building2, Folder,
  PiggyBank, ShieldCheck, AlertCircle, BookOpen, Pencil,
} from "lucide-react";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Removed CLIENT_ID = "client-demo" const (formerly line 13) — see §12
// matter-spine slice. The hardcoded default masked real "no case
// selected" states; callers now pass leadId via props.

// ─── REST helpers ─────────────────────────────────────────────────────────────

const api = {
  get: async (path: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    return r.ok ? r.json() : [];
  },
  post: async (table: string, body: object) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.ok ? r.json() : null;
  },
  patch: async (table: string, id: string, body: object) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.ok ? r.json() : null;
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientDocument {
  id: string;
  client_id: string;
  document_type: string;
  document_category: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  ai_verified: boolean;
  ai_note: string | null;
  context_ref: string | null;
  uploaded_at: string;
}

type RejectionReason = "not_correct" | "incomplete_documents" | "duplicate_entry" | "not_applicable" | "other";

const REJECTION_REASONS: { value: RejectionReason; label: string; description: string }[] = [
  { value: "not_correct",           label: "Not Correct",           description: "Information or document does not match what is required" },
  { value: "incomplete_documents",  label: "Incomplete Documents",  description: "Missing pages, illegible, or partially submitted" },
  { value: "duplicate_entry",       label: "Duplicate Entry",       description: "This document was already submitted (should be caught by AI)" },
  { value: "not_applicable",        label: "Not Applicable",        description: "Document does not apply to this client's situation" },
  { value: "other",                 label: "Other",                 description: "See details below" },
];

interface DocConfirmation {
  id: string;
  review_id: string;
  client_document_id: string;
  section: string;
  status: "pending" | "confirmed" | "needs_info" | "rejected" | "transferred" | "duplicated";
  transfer_to_section: string | null;
  paralegal_note: string | null;
  confirmed_at: string | null;
  rejection_reason: RejectionReason | null;
  rejection_detail: string | null;
}

interface SectionConfirmation {
  id: string;
  review_id: string;
  section_key: string;
  status: "pending" | "confirmed" | "needs_info" | "rejected";
  paralegal_note: string | null;
  confirmed_at: string | null;
  rejection_reason: RejectionReason | null;
  rejection_detail: string | null;
}

interface ParalegalReview {
  id: string;
  client_id: string;
  paralegal_name: string;
  status: "in_progress" | "complete" | "needs_info";
  notes: string | null;
  info_request_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Intake Submission Type ───────────────────────────────────────────────────

interface IntakeSubmission {
  id: string;
  first_name: string; middle_name?: string; last_name: string;
  dob?: string; ssn_last4?: string; email?: string; phone?: string; alt_phone?: string;
  street_address?: string; city?: string; state?: string; zip_code?: string; county?: string;
  address_years?: string; prior_address?: string; prior_state?: string;
  marital_status?: string;
  spouse_first_name?: string; spouse_last_name?: string; spouse_dob?: string;
  spouse_email?: string; spouse_phone?: string;
  filing_type?: string; chapter_type?: string;
  num_dependents?: number; dependent_ages?: string; dependents_json?: unknown[];

  debtor_work_status?: string; debtor_employer?: string;
  debtor_gross_monthly?: number; debtor_net_monthly?: number; debtor_pay_frequency?: string;
  debtor_other_income?: number; debtor_other_income_desc?: string;
  spouse_work_status?: string; spouse_employer?: string; spouse_gross_monthly?: number;
  income_sources_json?: unknown[];

  owns_real_estate?: boolean; real_prop_address?: string;
  real_prop_value?: number; mortgage_balance?: number; mortgage_lender?: string;
  real_properties_json?: unknown[];

  num_vehicles?: number; vehicle_descriptions?: string; vehicles_json?: unknown[];

  bank_balance?: number; retirement_balance?: number;
  has_stocks?: boolean; stocks_value?: number;
  has_life_insurance?: boolean; life_insurance_cash_value?: number;
  has_firearms?: boolean; firearm_value?: number;
  has_collectibles?: boolean; collectibles_value?: number;
  household_goods_value?: number;
  other_assets?: string; other_property_desc?: string;

  secured_debt?: number; credit_card_debt?: number; medical_debt?: number;
  student_loan_debt?: number; tax_debt?: number; personal_loan_debt?: number; other_unsecured?: number;

  exp_rent_mortgage?: number; exp_utilities?: number; exp_food?: number;
  exp_transportation?: number; exp_healthcare?: number; exp_insurance?: number;
  exp_childcare?: number; exp_other?: number;

  primary_reason?: string;
  prior_bankruptcy?: boolean; has_prior_bk?: boolean; prior_bankruptcies_json?: unknown[];
  pending_lawsuits?: boolean; lawsuit_details?: string;
  garnishment?: boolean; garnishment_details?: string;
  owned_business?: boolean; business_details?: string;
  has_transfers?: boolean; transfers_json?: unknown[];
  has_preferential_payments?: boolean; preferential_payments_json?: unknown[];
  expected_refund?: boolean; refund_amount?: number;
  recent_luxury?: boolean; luxury_details?: string;

  in_state_over_2_years?: boolean; moved_to_state_date?: string;
  prior_residences_json?: unknown[];
  exemption_state?: string; exemption_state_reason?: string;
  review_status?: string;
}

// ─── Line-item confirmation type ─────────────────────────────────────────────

interface LineConfirmation {
  id: string;
  review_id: string;
  line_key: string;          // e.g. "asset_real_0", "creditor_cc", "income_w2"
  schedule: string;          // e.g. "Schedule A/B", "Schedule D"
  label: string;
  intake_value: string;
  confirmed_value: string | null;
  status: "pending" | "confirmed" | "amended" | "flagged";
  paralegal_note: string | null;
  confirmed_at: string | null;
}

// ─── Required doc spec ────────────────────────────────────────────────────────

interface RequiredDocSpec {
  label: string;
  docType: string;
  docCategory: string;
  reason: string;
  uploaded?: boolean;
}

function $$(n: number | undefined | null, digits = 0) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(n);
}

function getRequiredDocs(intake: IntakeSubmission, docs: ClientDocument[]): Record<string, RequiredDocSpec[]> {
  const uploaded = (cat: string, type?: string) =>
    docs.some(d => d.document_category === cat || (type && d.document_type === type));

  const result: Record<string, RequiredDocSpec[]> = {
    petition:     [],
    schedule_ab_real: [],
    schedule_d:   [],
    schedule_ef:  [],
    schedule_i:   [],
    schedule_j:   [],
    sofa:         [],
    means_test:   [],
  };

  // Identity
  result.petition.push({ label: "Government-issued photo ID (front)", docType: "id_front", docCategory: "identity", reason: "Required for Voluntary Petition verification", uploaded: uploaded("identity","id_front") });
  result.petition.push({ label: "Social Security card or ITIN letter", docType: "ss_card", docCategory: "identity", reason: "Required for SSN verification on petition", uploaded: uploaded("identity","ss_card") });
  if (intake.marital_status === "married" && intake.spouse_first_name) {
    result.petition.push({ label: `Spouse ID – ${intake.spouse_first_name} ${intake.spouse_last_name ?? ""}`, docType: "id_front", docCategory: "identity", reason: "Non-filing spouse ID for joint/married filing", uploaded: uploaded("identity","id_front") });
  }

  // Real estate
  if (intake.owns_real_estate) {
    result.schedule_ab_real.push({ label: "Property deed or title", docType: "deed", docCategory: "real_estate", reason: "Verify ownership and legal description", uploaded: uploaded("real_estate","deed") });
    result.schedule_ab_real.push({ label: "Current mortgage statement", docType: "mortgage_stmt", docCategory: "real_estate", reason: "Confirm current payoff balance for Schedule D", uploaded: uploaded("real_estate","mortgage_stmt") });
    result.schedule_ab_real.push({ label: "Property tax assessment / appraisal", docType: "appraisal", docCategory: "real_estate", reason: "Support stated value of real property", uploaded: uploaded("real_estate","appraisal") });
    result.schedule_d.push({ label: "Mortgage statement (current balance)", docType: "mortgage_stmt", docCategory: "secured-creditors", reason: "Schedule D secured creditor balance", uploaded: uploaded("secured-creditors","mortgage_stmt") });
  }

  // Vehicles
  if ((intake.num_vehicles ?? 0) > 0) {
    result.schedule_ab_real.push({ label: "Vehicle registration(s)", docType: "vehicle_registration", docCategory: "vehicles", reason: "Verify ownership and VIN for Schedule A/B", uploaded: uploaded("vehicles","vehicle_registration") });
    result.schedule_ab_real.push({ label: "Vehicle loan statement(s)", docType: "vehicle_loan_stmt", docCategory: "vehicles", reason: "Confirm current payoff balance for Schedule D", uploaded: uploaded("vehicles","vehicle_loan_stmt") });
    result.schedule_d.push({ label: "Auto loan statement(s) – current payoff", docType: "vehicle_loan_stmt", docCategory: "secured-creditors", reason: "Schedule D secured balance and lender info", uploaded: uploaded("secured-creditors","vehicle_loan_stmt") });
    result.schedule_ab_real.push({ label: "Vehicle insurance declarations page", docType: "vehicle_insurance", docCategory: "vehicles", reason: "Confirm ownership and insurable value", uploaded: uploaded("vehicles","vehicle_insurance") });
  }

  // Bank accounts
  result.schedule_ab_real.push({ label: "Bank statement(s) – last 3 months", docType: "bank_statement", docCategory: "bank", reason: "Verify current balance and account activity for Schedule A/B and SOFA", uploaded: uploaded("bank","bank_statement") });

  // Retirement
  if ((intake.retirement_balance ?? 0) > 0) {
    result.schedule_ab_real.push({ label: "Retirement account statement (IRA, 401k, pension)", docType: "retirement_stmt", docCategory: "retirement", reason: "Verify balance for Schedule A/B; may be exempt", uploaded: uploaded("retirement","retirement_stmt") });
  }

  // Life insurance with cash value
  if (intake.has_life_insurance && (intake.life_insurance_cash_value ?? 0) > 0) {
    result.schedule_ab_real.push({ label: "Life insurance policy / cash value statement", docType: "insurance_stmt", docCategory: "insurance", reason: "Verify cash surrender value for Schedule A/B", uploaded: uploaded("insurance","insurance_stmt") });
  }

  // Unsecured creditors
  if ((intake.credit_card_debt ?? 0) > 0) {
    result.schedule_ef.push({ label: "Credit card statements (most recent for each card)", docType: "credit_card_stmt", docCategory: "credit_cards", reason: "Verify balance and account details for Schedule E/F", uploaded: uploaded("credit_cards","credit_card_stmt") });
  }
  if ((intake.medical_debt ?? 0) > 0) {
    result.schedule_ef.push({ label: "Medical bills / EOB statements", docType: "medical_bill", docCategory: "medical", reason: "Itemize medical creditors for Schedule E/F", uploaded: uploaded("medical","medical_bill") });
  }
  if ((intake.personal_loan_debt ?? 0) > 0) {
    result.schedule_ef.push({ label: "Loan statements (SBA / personal loans)", docType: "loan_stmt", docCategory: "unsecured-creditors", reason: "Verify SBA/personal loan balances for Schedule E/F", uploaded: uploaded("unsecured-creditors","loan_stmt") });
  }
  if ((intake.student_loan_debt ?? 0) > 0) {
    result.schedule_ef.push({ label: "Student loan statement", docType: "loan_stmt", docCategory: "unsecured-creditors", reason: "Verify student loan balances for Schedule E/F", uploaded: uploaded("unsecured-creditors","loan_stmt") });
  }
  if ((intake.tax_debt ?? 0) > 0) {
    result.schedule_ef.push({ label: "IRS / state tax transcripts or notices", docType: "tax_return", docCategory: "tax", reason: "Document tax debt for Schedule E/F (priority)", uploaded: uploaded("tax","tax_return") });
  }

  // Income
  if (intake.debtor_work_status === "employed") {
    result.schedule_i.push({ label: "Pay stubs – last 60 days (debtor)", docType: "paystub", docCategory: "income", reason: "Verify current gross/net for Schedule I and means test", uploaded: uploaded("income","paystub") });
  }
  if (intake.debtor_work_status === "self_employed") {
    result.schedule_i.push({ label: "Profit & Loss statement or business bank statements (last 6 months)", docType: "business_financials", docCategory: "income", reason: "Self-employment income verification for Schedule I", uploaded: uploaded("income","business_financials") });
  }
  if (intake.spouse_work_status === "employed" || intake.spouse_work_status === "self_employed") {
    result.schedule_i.push({ label: `Pay stubs – last 60 days (${intake.spouse_first_name ?? "spouse"})`, docType: "paystub", docCategory: "income", reason: "Non-filing spouse income required for means test and Schedule I", uploaded: uploaded("income","paystub") });
  }
  if ((intake.debtor_other_income ?? 0) > 0) {
    result.schedule_i.push({ label: "Other income documentation (rental, pension, annuity, royalties)", docType: "pension_stmt", docCategory: "income", reason: "Support all other income sources listed on Schedule I", uploaded: uploaded("income","pension_stmt") });
  }
  result.means_test.push({ label: "Pay stubs for 6 full calendar months prior to filing", docType: "paystub", docCategory: "income", reason: "Required for Form 122A-1 (means test) income calculation", uploaded: uploaded("income","paystub") });
  result.means_test.push({ label: "Prior 2 years tax returns", docType: "tax_return", docCategory: "tax", reason: "SOFA income disclosure and means test income verification", uploaded: uploaded("tax","tax_return") });

  // SOFA
  result.sofa.push({ label: "Bank statements – last 3 months all accounts", docType: "bank_statement", docCategory: "bank", reason: "SOFA financial history disclosure", uploaded: uploaded("bank","bank_statement") });
  result.sofa.push({ label: "Federal & state tax returns – last 2 years", docType: "tax_return", docCategory: "tax", reason: "SOFA income history disclosure", uploaded: uploaded("tax","tax_return") });
  if (intake.has_preferential_payments) {
    result.sofa.push({ label: "Documentation of payments made in last 12 months to insiders / family", docType: "bank_statement", docCategory: "bank", reason: "SOFA Q4 – Payments to insiders within 1 year (preference risk)", uploaded: uploaded("bank","bank_statement") });
  }
  if (intake.pending_lawsuits) {
    result.sofa.push({ label: "Lawsuit / litigation documents", docType: "lawsuit_docs", docCategory: "legal", reason: "SOFA Q9 – Pending lawsuits disclosure", uploaded: uploaded("legal","lawsuit_docs") });
  }
  if (intake.garnishment) {
    result.sofa.push({ label: "Garnishment order / wage withholding notice", docType: "garnishment", docCategory: "legal", reason: "SOFA Q13 – Garnishment disclosure", uploaded: uploaded("legal","garnishment") });
  }
  if (intake.owned_business) {
    result.sofa.push({ label: "Business dissolution / closure documents", docType: "business_financials", docCategory: "income", reason: "SOFA Q27 – Prior business ownership disclosure", uploaded: uploaded("income","business_financials") });
  }
  if (!intake.in_state_over_2_years) {
    result.petition.push({ label: "Proof of prior state residency (utility bills, lease, CA driver license)", docType: "other_doc", docCategory: "legal", reason: "Residency < 2 years – exemption state determination requires proof of CA domicile for 730-day lookback", uploaded: uploaded("legal","other_doc") });
  }

  return result;
}

// ─── Petition Data Panel ──────────────────────────────────────────────────────

interface PetitionPanelProps {
  intake: IntakeSubmission;
  docs: ClientDocument[];
  lineConfs: LineConfirmation[];
  onConfirmLine: (key: string, schedule: string, label: string, intakeValue: string, confirmedValue: string, note: string) => void;
  onFlagLine: (key: string, schedule: string, label: string, intakeValue: string, note: string) => void;
  reviewId: string;
}

function DocRequiredBadge({ spec }: { spec: RequiredDocSpec }) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold ${
      spec.uploaded
        ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-400"
        : "bg-amber-500/8 border-amber-500/25 text-amber-300"
    }`}>
      {spec.uploaded
        ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
        : <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      }
      <span className="truncate">{spec.label}</span>
    </div>
  );
}

type LineStatus = "pending" | "confirmed" | "amended" | "flagged";

function LineItem({ lineKey, schedule, label, intakeValue, conf, onConfirm, onFlag, docSpecs }: {
  lineKey: string; schedule: string; label: string; intakeValue: string;
  conf: LineConfirmation | undefined;
  onConfirm: (confirmedVal: string, note: string) => void;
  onFlag: (note: string) => void;
  docSpecs?: RequiredDocSpec[];
}) {
  const [editing, setEditing]       = useState(false);
  const [editVal, setEditVal]       = useState(intakeValue);
  const [note, setNote]             = useState(conf?.paralegal_note ?? "");
  const [showDocs, setShowDocs]     = useState(false);
  const status: LineStatus           = conf?.status ?? "pending";

  const statusCls = {
    pending:   "border-slate-700/60 bg-slate-800/40",
    confirmed: "border-emerald-500/20 bg-emerald-500/4",
    amended:   "border-sky-500/25 bg-sky-500/5",
    flagged:   "border-red-500/25 bg-red-500/5",
  }[status];

  const missingDocs = (docSpecs ?? []).filter(d => !d.uploaded);

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 transition-all ${statusCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{schedule}</span>
            {status === "confirmed" && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Verified</span>}
            {status === "amended"   && <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full">Amended</span>}
            {status === "flagged"   && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">Flagged</span>}
            {missingDocs.length > 0 && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                {missingDocs.length} doc{missingDocs.length !== 1 ? "s" : ""} missing
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-300 mt-0.5">{label}</p>
          {editing ? (
            <div className="mt-1.5 space-y-1.5">
              <input
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                className="w-full bg-slate-900 border border-sky-500/40 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                autoFocus
              />
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none placeholder-slate-600"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-white">{conf?.confirmed_value ?? intakeValue}</span>
              {conf?.confirmed_value && conf.confirmed_value !== intakeValue && (
                <span className="text-[10px] text-slate-500 line-through">{intakeValue}</span>
              )}
            </div>
          )}
          {conf?.paralegal_note && !editing && (
            <p className="text-[10px] text-slate-500 italic mt-0.5">{conf.paralegal_note}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!editing && status === "pending" && (
            <>
              <button
                onClick={() => onConfirm(intakeValue, "")}
                className="flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
              >
                <Check className="w-3 h-3" /> Confirm
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 text-sky-400 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
              >
                <Pencil className="w-3 h-3" /> Amend
              </button>
              <button
                onClick={() => onFlag("")}
                className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
              >
                <AlertCircle className="w-3 h-3" /> Flag
              </button>
            </>
          )}
          {!editing && status !== "pending" && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={() => { onConfirm(editVal, note); setEditing(false); }}
                className="flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditVal(conf?.confirmed_value ?? intakeValue); }}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-1.5"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Required documents for this line */}
      {docSpecs && docSpecs.length > 0 && (
        <div>
          <button
            onClick={() => setShowDocs(v => !v)}
            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Folder className="w-3 h-3" />
            Required docs ({docSpecs.filter(d => d.uploaded).length}/{docSpecs.length} uploaded)
            {showDocs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {showDocs && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {docSpecs.map((spec, i) => <DocRequiredBadge key={i} spec={spec} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PetitionDataGroup({ title, icon, schedule, lines, lineConfs, docs, requiredDocSpecs, onConfirmLine, onFlagLine }: {
  title: string;
  icon: React.ReactNode;
  schedule: string;
  lines: { key: string; label: string; value: string; docSpecs?: RequiredDocSpec[] }[];
  lineConfs: LineConfirmation[];
  docs: ClientDocument[];
  requiredDocSpecs?: RequiredDocSpec[];
  onConfirmLine: (key: string, schedule: string, label: string, intakeValue: string, confirmedValue: string, note: string) => void;
  onFlagLine: (key: string, schedule: string, label: string, intakeValue: string, note: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const confirmed = lines.filter(l => {
    const c = lineConfs.find(c => c.line_key === l.key);
    return c?.status === "confirmed" || c?.status === "amended";
  }).length;
  const flagged = lines.filter(l => lineConfs.find(c => c.line_key === l.key)?.status === "flagged").length;
  const allDone = confirmed === lines.length;
  const sectionMissingDocs = (requiredDocSpecs ?? []).filter(d => !d.uploaded).length;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      allDone && flagged === 0 ? "border-emerald-500/25 bg-emerald-500/3" :
      flagged > 0 ? "border-red-500/25 bg-red-500/3" :
      "border-slate-700/60 bg-[#0d1221]"
    }`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          allDone && flagged === 0 ? "bg-emerald-500/15" :
          flagged > 0 ? "bg-red-500/15" : "bg-slate-800"
        }`}>
          <span className={allDone && flagged === 0 ? "text-emerald-400" : flagged > 0 ? "text-red-400" : "text-slate-400"}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{title}</span>
            <span className="text-[10px] text-slate-500 font-medium">{schedule}</span>
            {allDone && flagged === 0 && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">All Verified</span>}
            {flagged > 0 && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">{flagged} Flagged</span>}
            {sectionMissingDocs > 0 && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">{sectionMissingDocs} docs needed</span>}
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">{confirmed}/{lines.length} lines verified</p>
        </div>
        <div className="flex-shrink-0">
          {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2">
          {/* Required docs for this section */}
          {requiredDocSpecs && requiredDocSpecs.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 mb-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Required Supporting Documents</p>
              <div className="flex flex-wrap gap-1.5">
                {requiredDocSpecs.map((spec, i) => <DocRequiredBadge key={i} spec={spec} />)}
              </div>
            </div>
          )}

          {lines.map(line => (
            <LineItem
              key={line.key}
              lineKey={line.key}
              schedule={schedule}
              label={line.label}
              intakeValue={line.value}
              conf={lineConfs.find(c => c.line_key === line.key)}
              docSpecs={line.docSpecs}
              onConfirm={(val, note) => onConfirmLine(line.key, schedule, line.label, line.value, val, note)}
              onFlag={(note) => onFlagLine(line.key, schedule, line.label, line.value, note)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PetitionDataPanel({ intake, docs, lineConfs, onConfirmLine, onFlagLine }: PetitionPanelProps) {
  const reqDocs = getRequiredDocs(intake, docs);

  const vehicles = (intake.vehicles_json as Record<string,unknown>[] | undefined) ?? [];
  const properties = (intake.real_properties_json as Record<string,unknown>[] | undefined) ?? [];
  const incomeSources = (intake.income_sources_json as Record<string,unknown>[] | undefined) ?? [];
  const preferences = (intake.preferential_payments_json as Record<string,unknown>[] | undefined) ?? [];
  const transfers = (intake.transfers_json as Record<string,unknown>[] | undefined) ?? [];

  // Schedule A/B – Real Property lines
  const realPropLines = properties.length > 0
    ? properties.map((p, i) => ({
        key: `asset_real_${i}`,
        label: `${p.type as string ?? "Real Property"}: ${p.address as string ?? ""}`,
        value: `Value: ${$$(p.value as number)} | Mortgage: ${$$(p.mortgage_balance as number)} | Equity: ${$$(p.equity as number)} | Lender: ${p.lender as string ?? "—"}`,
        docSpecs: reqDocs.schedule_ab_real.filter(d => d.docCategory === "real_estate"),
      }))
    : intake.owns_real_estate ? [{
        key: "asset_real_0",
        label: `Real Property: ${intake.real_prop_address ?? "—"}`,
        value: `Value: ${$$(intake.real_prop_value)} | Mortgage: ${$$(intake.mortgage_balance)} | Equity: ${$$(((intake.real_prop_value ?? 0) - (intake.mortgage_balance ?? 0)))} | Lender: ${intake.mortgage_lender ?? "—"}`,
        docSpecs: reqDocs.schedule_ab_real.filter(d => d.docCategory === "real_estate"),
      }]
    : [];

  // Schedule A/B – Vehicles
  const vehicleLines = vehicles.length > 0
    ? vehicles.map((v, i) => ({
        key: `asset_vehicle_${i}`,
        label: `${v.year as string} ${v.make as string} ${v.model as string} ${v.trim as string ?? ""}`,
        value: `Value: ${$$(v.value as number)} | Loan Balance: ${$$(v.loan_balance as number)} | Lender: ${v.lender as string ?? "—"} | Rate: ${v.interest_rate as number}% | Negative Equity: ${$$(v.negative_equity as number)}`,
        docSpecs: reqDocs.schedule_ab_real.filter(d => d.docCategory === "vehicles"),
      }))
    : [];

  // Schedule A/B – Financial Assets
  const financialLines = [
    { key: "asset_bank", label: "Bank accounts – total balance", value: $$(intake.bank_balance), docSpecs: reqDocs.schedule_ab_real.filter(d => d.docCategory === "bank") },
    ...(intake.retirement_balance ? [{ key: "asset_retirement", label: "Retirement accounts (IRA, 401k, pension)", value: `${$$(intake.retirement_balance)} – likely exempt under 11 USC §522(n)`, docSpecs: reqDocs.schedule_ab_real.filter(d => d.docCategory === "retirement") }] : []),
    ...(intake.has_stocks && intake.stocks_value ? [{ key: "asset_stocks", label: "Stocks / investments", value: $$(intake.stocks_value) }] : []),
    ...(intake.has_life_insurance && intake.life_insurance_cash_value ? [{ key: "asset_life_ins", label: "Life insurance cash surrender value", value: $$(intake.life_insurance_cash_value), docSpecs: reqDocs.schedule_ab_real.filter(d => d.docCategory === "insurance") }] : []),
    ...(intake.has_firearms && intake.firearm_value ? [{ key: "asset_firearms", label: "Firearms", value: $$(intake.firearm_value) }] : []),
    ...(intake.has_collectibles && intake.collectibles_value ? [{ key: "asset_collectibles", label: "Collectibles / antiques", value: $$(intake.collectibles_value) }] : []),
    { key: "asset_household", label: "Household goods and furnishings", value: $$(intake.household_goods_value) },
    ...(intake.other_assets ? [{ key: "asset_other", label: "Other assets / notes", value: intake.other_assets }] : []),
  ];

  // Income sources
  const incomeLines = incomeSources.length > 0
    ? incomeSources.map((s, i) => ({
        key: `income_${i}`,
        label: `${s.debtor as string} – ${s.source as string} (${s.payer as string ?? "—"})`,
        value: `Gross: ${$$(s.gross_monthly as number)}/mo | Net: ${$$(s.net_monthly as number)}/mo | Frequency: ${s.frequency as string ?? "—"}${s.notes ? ` | Note: ${s.notes as string}` : ""}`,
        docSpecs: reqDocs.schedule_i,
      }))
    : [
        ...(intake.debtor_work_status === "employed" ? [{ key: "income_w2", label: `${intake.first_name} – W-2 Employment (${intake.debtor_employer ?? "—"})`, value: `Gross: ${$$(intake.debtor_gross_monthly)}/mo | Net: ${$$(intake.debtor_net_monthly)}/mo | ${intake.debtor_pay_frequency ?? ""}`, docSpecs: reqDocs.schedule_i }] : []),
        ...(intake.debtor_other_income ? [{ key: "income_other", label: `${intake.first_name} – Other income`, value: `${$$(intake.debtor_other_income)}/mo – ${intake.debtor_other_income_desc ?? ""}`, docSpecs: reqDocs.schedule_i }] : []),
        ...(intake.spouse_work_status ? [{ key: "income_spouse", label: `${intake.spouse_first_name ?? "Spouse"} – ${intake.spouse_work_status === "employed" ? "Employment" : "Self-Employment"} (${intake.spouse_employer ?? "—"})`, value: `Gross: ${$$(intake.spouse_gross_monthly)}/mo`, docSpecs: reqDocs.schedule_i }] : []),
      ];

  // Expenses
  const expenseLines = [
    { key: "exp_mortgage", label: "Rent/Mortgage payment", value: $$(intake.exp_rent_mortgage) },
    { key: "exp_utilities", label: "Utilities (electric, gas, water)", value: $$(intake.exp_utilities) },
    { key: "exp_food", label: "Food and household supplies", value: $$(intake.exp_food) },
    { key: "exp_transport", label: "Transportation (gas, insurance, car payments)", value: $$(intake.exp_transportation) },
    { key: "exp_healthcare", label: "Healthcare and medical", value: $$(intake.exp_healthcare) },
    { key: "exp_insurance", label: "Insurance (auto, life, etc.)", value: $$(intake.exp_insurance) },
    ...(intake.exp_childcare ? [{ key: "exp_childcare", label: "Childcare / dependent care", value: $$(intake.exp_childcare) }] : []),
    ...(intake.exp_other ? [{ key: "exp_other", label: "Other monthly expenses", value: $$(intake.exp_other) }] : []),
  ];

  const totalMonthlyExp = (intake.exp_rent_mortgage ?? 0) + (intake.exp_utilities ?? 0) + (intake.exp_food ?? 0) + (intake.exp_transportation ?? 0) + (intake.exp_healthcare ?? 0) + (intake.exp_insurance ?? 0) + (intake.exp_childcare ?? 0) + (intake.exp_other ?? 0);
  const totalMonthlyIncome = (intake.debtor_net_monthly ?? 0) + (intake.debtor_other_income ?? 0) + (incomeSources.filter(s => (s as Record<string,unknown>).debtor !== "Mickey" || true).reduce((a, s) => a + ((s as Record<string,unknown>).net_monthly as number ?? 0), 0));
  const disposable = totalMonthlyIncome - totalMonthlyExp;

  // Secured creditors (Schedule D)
  const securedLines = [
    ...realPropLines.map((p, i) => ({ key: `cred_secured_re_${i}`, label: `Mortgage – ${properties[i]?.lender as string ?? intake.mortgage_lender ?? "—"}`, value: `Balance: ${properties[i]?.mortgage_balance ? $$(properties[i].mortgage_balance as number) : $$(intake.mortgage_balance)} | Collateral: ${properties[i]?.address as string ?? intake.real_prop_address ?? "—"}` })),
    ...vehicles.map((v, i) => ({ key: `cred_secured_v_${i}`, label: `Auto Loan – ${v.lender as string ?? "—"} (${v.year as string} ${v.make as string} ${v.model as string})`, value: `Balance: ${$$(v.loan_balance as number)} | APR: ${v.interest_rate as number}% | Payment: ${$$(v.monthly_payment as number)}/mo | Negative equity: ${$$(v.negative_equity as number)}` })),
  ];

  // Unsecured creditors (Schedule E/F)
  const unsecuredLines = [
    ...(intake.credit_card_debt ? [{ key: "cred_cc", label: "Credit card debt (total)", value: $$(intake.credit_card_debt), docSpecs: reqDocs.schedule_ef.filter(d => d.docCategory === "credit_cards") }] : []),
    ...(intake.medical_debt ? [{ key: "cred_medical", label: "Medical bills (total)", value: $$(intake.medical_debt), docSpecs: reqDocs.schedule_ef.filter(d => d.docCategory === "medical") }] : []),
    ...(intake.personal_loan_debt ? [{ key: "cred_sba", label: "SBA loan / personal loan (total)", value: $$(intake.personal_loan_debt), docSpecs: reqDocs.schedule_ef.filter(d => d.docCategory === "unsecured-creditors") }] : []),
    ...(intake.student_loan_debt ? [{ key: "cred_student", label: "Student loan debt", value: $$(intake.student_loan_debt) }] : []),
    ...(intake.tax_debt ? [{ key: "cred_tax", label: "Tax debt (IRS/state) – PRIORITY", value: $$(intake.tax_debt) }] : []),
    ...(intake.other_unsecured ? [{ key: "cred_other", label: "Other unsecured debt", value: $$(intake.other_unsecured) }] : []),
  ];

  // SOFA disclosures
  const sofaLines = [
    ...(preferences.length > 0 ? preferences.map((p, i) => ({
      key: `sofa_pref_${i}`,
      label: `INSIDER PAYMENT – ${p.creditor as string ?? "—"} (${p.relationship as string ?? "—"})`,
      value: `Amount: ${$$(p.amount as number)} | Date: ${p.date as string ?? "—"} | ${p.payment_type as string ?? ""} | Reason: ${p.reason as string ?? "—"} | NOTES: ${p.notes as string ?? "—"}`,
    })) : []),
    ...(transfers.length > 0 ? transfers.map((t, i) => ({
      key: `sofa_transfer_${i}`,
      label: `Property transfer – ${t.description as string ?? "—"}`,
      value: `Value: ${$$(t.value as number)} | Date: ${t.date as string ?? "—"} | Recipient: ${t.recipient as string ?? "—"}`,
    })) : []),
    ...(intake.pending_lawsuits ? [{ key: "sofa_lawsuit", label: "Pending lawsuit", value: intake.lawsuit_details ?? "Yes – details required" }] : []),
    ...(intake.garnishment ? [{ key: "sofa_garnishment", label: "Wage garnishment", value: intake.garnishment_details ?? "Yes – details required" }] : []),
    ...(intake.owned_business ? [{ key: "sofa_business", label: "Prior business ownership", value: intake.business_details ?? "Yes – details required" }] : []),
    ...(intake.expected_refund ? [{ key: "sofa_refund", label: "Expected tax refund", value: $$(intake.refund_amount) }] : []),
    ...(intake.recent_luxury ? [{ key: "sofa_luxury", label: "Recent luxury purchase / cash advance", value: intake.luxury_details ?? "Yes – details required" }] : []),
  ];

  // Residency / Exemption
  const residencyLines = [
    { key: "res_state", label: "Current state of residence", value: `${intake.city ?? ""}, ${intake.state ?? ""} – ${intake.address_years ?? "?"} years` },
    { key: "res_prior", label: "Prior state of residence", value: `${intake.prior_address ?? "—"} (${intake.prior_state ?? "—"})` },
    { key: "res_2yr", label: "Residing in state >2 years?", value: intake.in_state_over_2_years ? "Yes" : `No – moved: ${intake.moved_to_state_date ?? "—"}` },
    { key: "res_exemption", label: "Applicable exemption state", value: intake.exemption_state ? `${intake.exemption_state} – ${intake.exemption_state_reason?.slice(0, 120) ?? ""}` : `${intake.state ?? "—"} (default)` },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Petition Data — Intake Answers</h3>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full ml-auto">Confirm each line against supporting documents</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Review every line below against the client's uploaded documents. Use <strong className="text-emerald-400">Confirm</strong> when the value matches the supporting document exactly. Use <strong className="text-sky-400">Amend</strong> if the document shows a different value. Use <strong className="text-red-400">Flag</strong> if there is a discrepancy that needs attorney or client attention.
        </p>
      </div>

      {/* Client info summary */}
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Client Summary</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {[
            ["Debtor", `${intake.first_name} ${intake.middle_name ? intake.middle_name + " " : ""}${intake.last_name}`],
            ["DOB", intake.dob ?? "—"],
            ["SSN (last 4)", intake.ssn_last4 ? `***-**-${intake.ssn_last4}` : "—"],
            ["Filing Type", intake.filing_type?.replace("_"," ") ?? "—"],
            ["Chapter", intake.chapter_type?.replace("_"," ") ?? "—"],
            ["Marital Status", intake.marital_status ?? "—"],
            ...(intake.spouse_first_name ? [["Spouse (non-filing)", `${intake.spouse_first_name} ${intake.spouse_last_name ?? ""}`]] : []),
            ["Address", `${intake.street_address ?? ""}, ${intake.city ?? ""}, ${intake.state ?? ""} ${intake.zip_code ?? ""}`],
            ["In State", `${intake.address_years ?? "?"} years`],
          ].map(([label, val]) => (
            <div key={label} className="bg-slate-800/50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-slate-200 font-semibold text-[11px]">{val}</p>
            </div>
          ))}
        </div>
        {!intake.in_state_over_2_years && (
          <div className="mt-3 flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/25 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300">Residency Flag — Exemption State Not Current</p>
              <p className="text-[11px] text-amber-500 leading-snug mt-0.5">{intake.exemption_state_reason?.slice(0, 200) ?? "CA exemptions may apply – attorney review required."}</p>
            </div>
          </div>
        )}
      </div>

      {/* Schedule I – Income */}
      <PetitionDataGroup
        title="Schedule I — Current Income"
        icon={<DollarSign className="w-4 h-4" />}
        schedule="Schedule I"
        lines={incomeLines}
        lineConfs={lineConfs}
        docs={docs}
        requiredDocSpecs={reqDocs.schedule_i}
        onConfirmLine={onConfirmLine}
        onFlagLine={onFlagLine}
      />

      {/* Schedule J – Expenses */}
      <PetitionDataGroup
        title="Schedule J — Monthly Expenses"
        icon={<ReceiptText className="w-4 h-4" />}
        schedule="Schedule J"
        lines={[
          ...expenseLines,
          { key: "sched_j_total", label: "Total monthly expenses", value: $$(totalMonthlyExp) },
          { key: "sched_j_disposable", label: "Monthly disposable income (net income minus expenses)", value: $$(disposable) },
        ]}
        lineConfs={lineConfs}
        docs={docs}
        onConfirmLine={onConfirmLine}
        onFlagLine={onFlagLine}
      />

      {/* Schedule A/B – Real Property */}
      {realPropLines.length > 0 && (
        <PetitionDataGroup
          title="Schedule A/B — Real Property"
          icon={<Home className="w-4 h-4" />}
          schedule="Schedule A/B"
          lines={realPropLines}
          lineConfs={lineConfs}
          docs={docs}
          requiredDocSpecs={reqDocs.schedule_ab_real.filter(d => d.docCategory === "real_estate")}
          onConfirmLine={onConfirmLine}
          onFlagLine={onFlagLine}
        />
      )}

      {/* Schedule A/B – Vehicles */}
      {vehicleLines.length > 0 && (
        <PetitionDataGroup
          title="Schedule A/B — Vehicles"
          icon={<Car className="w-4 h-4" />}
          schedule="Schedule A/B"
          lines={vehicleLines}
          lineConfs={lineConfs}
          docs={docs}
          requiredDocSpecs={reqDocs.schedule_ab_real.filter(d => d.docCategory === "vehicles")}
          onConfirmLine={onConfirmLine}
          onFlagLine={onFlagLine}
        />
      )}

      {/* Schedule A/B – Financial Assets */}
      <PetitionDataGroup
        title="Schedule A/B — Financial & Personal Assets"
        icon={<PiggyBank className="w-4 h-4" />}
        schedule="Schedule A/B"
        lines={financialLines}
        lineConfs={lineConfs}
        docs={docs}
        requiredDocSpecs={reqDocs.schedule_ab_real.filter(d => !["real_estate","vehicles"].includes(d.docCategory))}
        onConfirmLine={onConfirmLine}
        onFlagLine={onFlagLine}
      />

      {/* Schedule D – Secured Creditors */}
      {securedLines.length > 0 && (
        <PetitionDataGroup
          title="Schedule D — Secured Creditors"
          icon={<Building2 className="w-4 h-4" />}
          schedule="Schedule D"
          lines={securedLines}
          lineConfs={lineConfs}
          docs={docs}
          requiredDocSpecs={reqDocs.schedule_d}
          onConfirmLine={onConfirmLine}
          onFlagLine={onFlagLine}
        />
      )}

      {/* Schedule E/F – Unsecured Creditors */}
      <PetitionDataGroup
        title="Schedule E/F — Unsecured Creditors"
        icon={<CreditCard className="w-4 h-4" />}
        schedule="Schedule E/F"
        lines={unsecuredLines}
        lineConfs={lineConfs}
        docs={docs}
        requiredDocSpecs={reqDocs.schedule_ef}
        onConfirmLine={onConfirmLine}
        onFlagLine={onFlagLine}
      />

      {/* SOFA – Disclosures */}
      {sofaLines.length > 0 && (
        <PetitionDataGroup
          title="Statement of Financial Affairs — Disclosures"
          icon={<ShieldCheck className="w-4 h-4" />}
          schedule="SOFA Form 107"
          lines={sofaLines}
          lineConfs={lineConfs}
          docs={docs}
          requiredDocSpecs={reqDocs.sofa}
          onConfirmLine={onConfirmLine}
          onFlagLine={onFlagLine}
        />
      )}

      {/* Residency / Exemptions */}
      <PetitionDataGroup
        title="Residency & Exemption State"
        icon={<Scale className="w-4 h-4" />}
        schedule="Petition / Schedule C"
        lines={residencyLines}
        lineConfs={lineConfs}
        docs={docs}
        requiredDocSpecs={reqDocs.petition.filter(d => d.docCategory === "legal")}
        onConfirmLine={onConfirmLine}
        onFlagLine={onFlagLine}
      />

      {/* Means Test Summary */}
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Briefcase className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Means Test — Form 122A-1</span>
          <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full ml-auto">Over Median Income</span>
        </div>
        <div className="space-y-1.5">
          {reqDocs.means_test.map((spec, i) => <DocRequiredBadge key={i} spec={spec} />)}
        </div>
        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
          Debtor is over the median income threshold for {intake.state ?? "WA"}. Form 122A-2 (means test calculation) will be required. Pay stubs for the 6 full calendar months prior to filing are mandatory. Attorney must confirm Ch.7 eligibility or recommend Ch.13.
        </p>
      </div>
    </div>
  );
}

// ─── Review sections with scripts ─────────────────────────────────────────────

interface ReviewSection {
  key: string;
  label: string;
  documentName: string;
  schedule: string;
  script: string;
  docCategories: string[];
  docTypes?: string[];
}

// Opening disclosure read at the start of every review session — before any section
const OPENING_DISCLOSURE = `Before we begin, I want to make a few important disclosures. First, I am a paralegal, not an attorney. I am not able to provide legal advice, and nothing I say during this review should be taken as legal advice. If you have legal questions about your case, those will need to be directed to your attorney.

Second, your documents will need to stay current throughout this process. As your case moves forward, you will need to continue providing updated documents right up until your case is filed. Once filed, there will be a final set of documents required for your Meeting of Creditors — we will walk you through exactly what is needed at that time.

Third, once the attorney reviews and approves your case for filing, you will be notified through your client portal. At that point, you will be directed to pay the court filing fee. Once that payment is confirmed, you will be prompted to schedule your signing appointment with the attorney.

Finally, on the actual date your case is filed, you will need to provide the exact balances for all of your bank accounts as of that filing date. We will reach out to you at that time with instructions.

Do you have any questions about any of that before we begin?`;

const REVIEW_SECTIONS: ReviewSection[] = [
  {
    key: "petition",
    label: "Voluntary Petition",
    documentName: "Voluntary Petition for Individuals Filing for Bankruptcy (Form 101)",
    schedule: "Petition — Cover Page",
    script: "I have here your government-issued photo ID and your Social Security card. Please confirm these are current, valid documents and that the name and information on them matches exactly what we have on file for your case. Remember, these documents will need to remain valid through the date your case is filed. Can you confirm that everything shown here is correct?",
    docCategories: ["identity"],
    docTypes: ["id_front", "id_back", "ss_card"],
  },
  {
    key: "schedule_ab_real",
    label: "Schedule A/B — Real & Personal Property",
    documentName: "Schedule A/B: Property (Form 106A/B)",
    schedule: "Schedule A/B",
    script: "We are now reviewing Schedule A/B, which lists all of your real and personal property. This includes any real estate you own or have an interest in, as well as personal property such as bank accounts, vehicles, household goods, and other assets. Please review the documents we have for each item and confirm the information is accurate and current.",
    docCategories: ["bank", "real_estate", "vehicles", "retirement", "personal_property"],
    docTypes: ["bank_statement", "deed", "vehicle_registration", "retirement_stmt"],
  },
  {
    key: "schedule_c",
    label: "Schedule C — Exemptions",
    documentName: "Schedule C: The Property You Claim as Exempt (Form 106C)",
    schedule: "Schedule C",
    script: "Schedule C lists the property you are claiming as exempt from your bankruptcy estate. Exemptions protect certain assets — such as your home, vehicle, retirement accounts, and household goods — up to specified limits. Your attorney will determine which exemptions apply to your situation. For now, please confirm the documents supporting each exempt asset are current and complete.",
    docCategories: ["retirement", "real_estate", "vehicles"],
    docTypes: ["retirement_stmt", "deed", "vehicle_registration", "vehicle_insurance"],
  },
  {
    key: "schedule_d",
    label: "Schedule D — Secured Creditors",
    documentName: "Schedule D: Creditors Who Have Claims Secured by Property (Form 106D)",
    schedule: "Schedule D",
    script: "Schedule D covers your secured debts — these are debts tied to specific collateral, such as a mortgage on your home or a loan on your vehicle. We will review each secured creditor's most recent statement. Please confirm the creditor name, account number, and current balance are accurate for each one.",
    docCategories: ["secured-creditors", "real_estate", "vehicles", "hoa"],
    docTypes: ["mortgage_stmt", "vehicle_loan_stmt", "hoa_stmt", "deed"],
  },
  {
    key: "schedule_ef",
    label: "Schedule E/F — Unsecured Creditors",
    documentName: "Schedule E/F: Creditors Who Have Unsecured Claims (Form 106E/F)",
    schedule: "Schedule E/F",
    script: "Schedule E/F lists your unsecured debts — these include credit cards, medical bills, personal loans, and any other debts not secured by collateral. We will cross-reference the creditors listed in your questionnaire against the documents on file. Please confirm each creditor's name and balance are accurate. If you have received any recent statements or collection notices, those should be included here.",
    docCategories: ["unsecured-creditors", "credit_cards", "medical", "collections"],
    docTypes: ["credit_card_stmt", "medical_bill", "collection_notice", "loan_stmt"],
  },
  {
    key: "schedule_i",
    label: "Schedule I — Current Income",
    documentName: "Schedule I: Your Income (Form 106I)",
    schedule: "Schedule I",
    script: "We are now reviewing your current income for Schedule I. This covers all sources of income you are currently receiving — wages, self-employment, Social Security, disability, pension, rental income, or any other regular income. Please confirm each document shows your name, the income amount, and is from the most recent period available. These documents must stay current up to the filing date.",
    docCategories: ["income", "employment"],
    docTypes: ["paystub", "ss_award", "disability_award", "va_award", "unemployment", "pension_stmt"],
  },
  {
    key: "schedule_j",
    label: "Schedule J — Current Expenses",
    documentName: "Schedule J: Your Expenses (Form 106J)",
    schedule: "Schedule J",
    script: "Schedule J captures your current monthly expenses. This typically includes housing, utilities, food, transportation, insurance, and other regular costs. Most of this information comes directly from your questionnaire, but we may need supporting documents for certain expenses such as rent, utilities, or insurance payments. Please confirm the amounts listed accurately reflect your current monthly expenses.",
    docCategories: ["expenses", "utilities", "insurance"],
    docTypes: ["rent_stmt", "utility_bill", "insurance_stmt"],
  },
  {
    key: "sofa",
    label: "Statement of Financial Affairs",
    documentName: "Statement of Financial Affairs for Individuals Filing for Bankruptcy (Form 107)",
    schedule: "SOFA — Form 107",
    script: "The Statement of Financial Affairs requires disclosure of your financial history over the past several years. This includes income received in the last two years, payments made to creditors in the last 90 days, any property transferred in the last two years, lawsuits, and other financial transactions. The documents we are reviewing here — including tax returns and bank statements — support the disclosures in this form. Please confirm these records are complete and accurate.",
    docCategories: ["tax", "bank", "legal"],
    docTypes: ["tax_return", "bank_statement", "lawsuit_docs", "garnishment"],
  },
  {
    key: "means_test",
    label: "Means Test",
    documentName: "Chapter 7 Statement of Your Current Monthly Income (Form 122A-1)",
    schedule: "Form 122A-1 / 122A-2 — Means Test",
    script: "The means test determines whether you qualify to file Chapter 7 bankruptcy. It compares your average monthly income over the last six months against the median income for your state. We need your pay stubs and income records for the six full calendar months prior to filing. Please confirm these documents cover the correct time period and reflect all sources of income received.",
    docCategories: ["income", "employment", "benefits"],
    docTypes: ["paystub", "ss_award", "disability_award", "va_award", "unemployment", "pension_stmt"],
  },
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function docLabel(doc: ClientDocument): string {
  return doc.original_filename || `${doc.document_type} (${doc.document_category})`;
}

function storageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/client-documents/${path}`;
}

function fmtDate(ts: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(ts));
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:     { label: "Pending",     cls: "text-slate-400 bg-slate-800 border-slate-700" },
  confirmed:   { label: "Confirmed",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  needs_info:  { label: "Needs Info",  cls: "text-amber-400 bg-amber-500/10 border-amber-500/25" },
  rejected:    { label: "Rejected",    cls: "text-red-400 bg-red-500/10 border-red-500/25" },
  transferred: { label: "Transferred", cls: "text-sky-400 bg-sky-500/10 border-sky-500/25" },
  duplicated:  { label: "Duplicated",  cls: "text-slate-400 bg-slate-700/50 border-slate-600/50" },
};

function RejectionBadge({ reason }: { reason: RejectionReason | null }) {
  if (!reason) return null;
  const r = REJECTION_REASONS.find(r => r.value === reason);
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border text-red-300 bg-red-500/8 border-red-500/20">
      {r?.label ?? reason}
    </span>
  );
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CFG }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Document action modal ────────────────────────────────────────────────────

function DocActionModal({ doc, confirmation, sections, onClose, onAction, crossSectionKeys }: {
  doc: ClientDocument;
  confirmation: DocConfirmation | null;
  sections: ReviewSection[];
  onClose: () => void;
  onAction: (action: DocConfirmation["status"], note: string, transferTo?: string, rejectionReason?: RejectionReason, rejectionDetail?: string) => void;
  crossSectionKeys?: string[];
}) {
  const [note, setNote]             = useState(confirmation?.paralegal_note ?? "");
  const [transferTo, setTransferTo] = useState("");
  const [saving, setSaving]         = useState(false);
  const [showReject, setShowReject] = useState(confirmation?.status === "rejected");
  const [rejReason, setRejReason]   = useState<RejectionReason | "">(confirmation?.rejection_reason ?? "");
  const [rejDetail, setRejDetail]   = useState(confirmation?.rejection_detail ?? "");

  async function commit(a: DocConfirmation["status"], rr?: RejectionReason, rd?: string) {
    if (a === "transferred" && !transferTo) return;
    if (a === "rejected" && !rr) return;
    setSaving(true);
    await onAction(a, note, transferTo || undefined, rr, rd);
    setSaving(false);
  }

  function commitReject() {
    if (!rejReason) return;
    commit("rejected", rejReason, rejReason === "other" ? rejDetail : undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white truncate max-w-xs">{docLabel(doc)}</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Document link */}
          <a
            href={storageUrl(doc.storage_path)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span className="flex-1 truncate">{doc.original_filename}</span>
            <ExternalLink className="w-3 h-3 text-slate-600 flex-shrink-0" />
          </a>

          {/* Cross-section notice */}
          {crossSectionKeys && crossSectionKeys.length > 1 && (
            <div className="flex items-start gap-2 bg-sky-500/8 border border-sky-500/20 rounded-xl px-3 py-2.5">
              <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-sky-300 leading-snug">
                This document applies to <span className="font-bold">{crossSectionKeys.length} sections</span>. Confirming will auto-apply to:&nbsp;
                {crossSectionKeys.map(k => REVIEW_SECTIONS.find(s => s.key === k)?.label).filter(Boolean).join(", ")}.
              </p>
            </div>
          )}

          {/* Approve / flag actions */}
          {!showReject ? (
            <>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Action</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => commit("confirmed")}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 font-bold text-xs px-3 py-2.5 rounded-xl transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved & Verified
                  </button>
                  <button
                    onClick={() => setShowReject(true)}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-bold text-xs px-3 py-2.5 rounded-xl transition-all"
                  >
                    <Ban className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => commit("needs_info")}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 font-bold text-xs px-3 py-2.5 rounded-xl transition-all"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Needs Info
                  </button>
                  <button
                    onClick={() => commit("duplicated")}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 font-bold text-xs px-3 py-2.5 rounded-xl transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                </div>
              </div>

              {/* Transfer */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Transfer to Section</p>
                <div className="flex gap-2">
                  <select
                    value={transferTo}
                    onChange={e => setTransferTo(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-slate-500"
                  >
                    <option value="">Select section…</option>
                    {sections.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => commit("transferred")}
                    disabled={saving || !transferTo}
                    className="flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 text-sky-400 font-bold text-xs px-3 py-2 rounded-xl transition-all disabled:opacity-40"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transfer
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Rejection flow */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Rejection Reason</p>
                <button onClick={() => setShowReject(false)} className="text-xs text-slate-500 hover:text-slate-300">
                  Back
                </button>
              </div>

              <div className="space-y-2">
                {REJECTION_REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setRejReason(r.value)}
                    className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                      rejReason === r.value
                        ? "border-red-500/40 bg-red-500/10"
                        : "border-slate-700 bg-slate-800/60 hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                      rejReason === r.value ? "border-red-400 bg-red-400" : "border-slate-600"
                    }`}>
                      {rejReason === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${rejReason === r.value ? "text-red-300" : "text-slate-300"}`}>{r.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{r.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {rejReason === "other" && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Details *</label>
                  <textarea
                    value={rejDetail}
                    onChange={e => setRejDetail(e.target.value)}
                    rows={2}
                    placeholder="Describe the reason for rejection…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-red-500/50 resize-none"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Paralegal Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note about this document…"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
            />
          </div>

          {/* Reject submit */}
          {showReject && (
            <button
              onClick={commitReject}
              disabled={saving || !rejReason || (rejReason === "other" && !rejDetail.trim())}
              className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition-all"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              Reject Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocRow({ doc, confirmation, sections, sectionKey, onUpdate }: {
  doc: ClientDocument;
  confirmation: DocConfirmation | null;
  sections: ReviewSection[];
  sectionKey?: string;
  onUpdate: (docId: string, action: DocConfirmation["status"], note: string, transferTo?: string, sectionKeyOverride?: string, rejectionReason?: RejectionReason, rejectionDetail?: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const status = confirmation?.status ?? "pending";

  const crossSectionKeys = REVIEW_SECTIONS.filter(s =>
    s.docCategories.includes(doc.document_category) ||
    (s.docTypes ?? []).includes(doc.document_type)
  ).map(s => s.key);

  return (
    <>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        status === "confirmed"   ? "bg-emerald-500/5 border-emerald-500/20" :
        status === "needs_info"  ? "bg-amber-500/5 border-amber-500/20" :
        status === "rejected"    ? "bg-red-500/5 border-red-500/20" :
        status === "transferred" ? "bg-sky-500/5 border-sky-500/20" :
                                   "bg-slate-800/60 border-slate-700/60"
      }`}>
        {/* Status icon */}
        <div className="flex-shrink-0">
          {status === "confirmed"   && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {status === "needs_info"  && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          {status === "rejected"    && <XCircle className="w-4 h-4 text-red-400" />}
          {status === "transferred" && <ArrowRightLeft className="w-4 h-4 text-sky-400" />}
          {status === "duplicated"  && <Copy className="w-4 h-4 text-violet-400" />}
          {status === "pending"     && <FileText className="w-4 h-4 text-slate-500" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-slate-200 truncate">{docLabel(doc)}</p>
            <StatusBadge status={status} />
            {crossSectionKeys.length > 1 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-sky-400 bg-sky-500/10 border-sky-500/20" title={`Also applies to: ${crossSectionKeys.filter(k => k !== sectionKey).map(k => REVIEW_SECTIONS.find(s => s.key === k)?.label).join(", ")}`}>
                {crossSectionKeys.length} sections
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-600 capitalize">{doc.document_category.replace("-", " ")}</span>
            <span className="text-[10px] text-slate-700">·</span>
            <span className="text-[10px] text-slate-600">{fmtDate(doc.uploaded_at)}</span>
            {doc.ai_verified && (
              <span className="text-[10px] text-emerald-600">AI verified</span>
            )}
            {status === "rejected" && confirmation?.rejection_reason && (
              <RejectionBadge reason={confirmation.rejection_reason} />
            )}
            {status === "rejected" && confirmation?.rejection_detail && (
              <span className="text-[10px] text-red-400/70 italic truncate max-w-[180px]">{confirmation.rejection_detail}</span>
            )}
            {confirmation?.paralegal_note && (
              <span className="text-[10px] text-slate-500 italic truncate max-w-[180px]">{confirmation.paralegal_note}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <a
            href={storageUrl(doc.storage_path)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-all"
            title="View document"
          >
            <Eye className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
          >
            Review
          </button>
        </div>
      </div>

      {showModal && (
        <DocActionModal
          doc={doc}
          confirmation={confirmation}
          sections={sections}
          crossSectionKeys={crossSectionKeys}
          onClose={() => setShowModal(false)}
          onAction={async (action, note, transferTo, rejectionReason, rejectionDetail) => {
            await onUpdate(doc.id, action, note, transferTo, sectionKey, rejectionReason, rejectionDetail);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ section, docs, confirmations, sectionConf, onDocUpdate, onSectionConfirm, onSectionNeedsInfo, onSectionReject }: {
  section: ReviewSection;
  docs: ClientDocument[];
  confirmations: DocConfirmation[];
  sectionConf: SectionConfirmation | null;
  onDocUpdate: (docId: string, action: DocConfirmation["status"], note: string, transferTo?: string, sectionKeyOverride?: string, rejectionReason?: RejectionReason, rejectionDetail?: string) => void;
  onSectionConfirm: (sectionKey: string, note: string) => void;
  onSectionNeedsInfo: (sectionKey: string, note: string) => void;
  onSectionReject: (sectionKey: string, note: string, reason: RejectionReason, detail?: string) => void;
}) {
  const [expanded, setExpanded]       = useState(true);
  const [scriptVisible, setScript]    = useState(false);
  const [note, setNote]               = useState("");
  const [showNoteBox, setShowNote]    = useState(false);
  const [showRejectForm, setRejectForm] = useState(false);
  const [rejReason, setRejReason]     = useState<RejectionReason | "">("");
  const [rejDetail, setRejDetail]     = useState("");

  const sectionDocs = docs.filter(d =>
    section.docCategories.includes(d.document_category) ||
    (section.docTypes ?? []).includes(d.document_type)
  );

  const confirmedCount = sectionDocs.filter(d => {
    const c = confirmations.find(c => c.client_document_id === d.id);
    return c?.status === "confirmed";
  }).length;

  const hasIssues = sectionDocs.some(d => {
    const c = confirmations.find(c => c.client_document_id === d.id);
    return c?.status === "needs_info" || c?.status === "rejected";
  });

  const allConfirmed = sectionDocs.length > 0 && confirmedCount === sectionDocs.length;
  const secStatus = sectionConf?.status ?? "pending";

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      secStatus === "confirmed"  ? "border-emerald-500/30 bg-emerald-500/5" :
      secStatus === "needs_info" ? "border-amber-500/30 bg-amber-500/5" :
      secStatus === "rejected"   ? "border-red-500/30 bg-red-500/5" :
                                   "border-slate-700/60 bg-[#0d1221]"
    }`}>
      {/* Section header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/20 transition-colors"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          secStatus === "confirmed"  ? "bg-emerald-500/15" :
          secStatus === "needs_info" ? "bg-amber-500/15" :
          secStatus === "rejected"   ? "bg-red-500/15" :
                                       "bg-slate-800"
        }`}>
          {secStatus === "confirmed"  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
           secStatus === "needs_info" ? <AlertTriangle className="w-4 h-4 text-amber-400" /> :
           secStatus === "rejected"   ? <Ban className="w-4 h-4 text-red-400" /> :
                                        <ClipboardCheck className="w-4 h-4 text-slate-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{section.label}</span>
            {secStatus !== "pending" && <StatusBadge status={secStatus} />}
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">{section.documentName}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{section.schedule}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-slate-500">
            {confirmedCount}/{sectionDocs.length} docs
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">

          {/* Script */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
            <button
              onClick={() => setScript(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/30 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-300 flex-1">Review Script</span>
              {scriptVisible ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            {scriptVisible && (
              <div className="px-4 pb-4">
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-xs text-amber-100 leading-relaxed italic">"{section.script}"</p>
                </div>
              </div>
            )}
          </div>

          {/* Documents */}
          {sectionDocs.length === 0 ? (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <Info className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <p className="text-xs text-slate-600">No documents uploaded for this section.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sectionDocs.map(d => (
                <DocRow
                  key={d.id}
                  doc={d}
                  confirmation={confirmations.find(c => c.client_document_id === d.id && c.section === section.key) ?? confirmations.find(c => c.client_document_id === d.id) ?? null}
                  sections={REVIEW_SECTIONS}
                  sectionKey={section.key}
                  onUpdate={onDocUpdate}
                />
              ))}
            </div>
          )}

          {/* Section sign-off */}
          {secStatus === "pending" && (
            <div className="pt-2 border-t border-slate-800/60 space-y-3">
              {showNoteBox && (
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note for this section…"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
                />
              )}

              {!showRejectForm ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onSectionConfirm(section.key, note)}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved & Verified
                  </button>
                  <button
                    onClick={() => onSectionNeedsInfo(section.key, note)}
                    className="flex items-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-bold text-xs px-4 py-2 rounded-xl transition-all"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Needs Info
                  </button>
                  <button
                    onClick={() => setRejectForm(true)}
                    className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-bold text-xs px-4 py-2 rounded-xl transition-all"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Reject Section
                  </button>
                  <button
                    onClick={() => setShowNote(v => !v)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showNoteBox ? "Hide note" : "Add note"}
                  </button>
                </div>
              ) : (
                /* Section rejection form */
                <div className="space-y-3 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Rejection Reason</p>
                    <button onClick={() => { setRejectForm(false); setRejReason(""); setRejDetail(""); }} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                  </div>
                  <div className="space-y-1.5">
                    {REJECTION_REASONS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => setRejReason(r.value)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          rejReason === r.value
                            ? "border-red-500/40 bg-red-500/10"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                          rejReason === r.value ? "border-red-400 bg-red-400" : "border-slate-600"
                        }`}>
                          {rejReason === r.value && <div className="w-1 h-1 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${rejReason === r.value ? "text-red-300" : "text-slate-300"}`}>{r.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{r.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {rejReason === "other" && (
                    <textarea
                      value={rejDetail}
                      onChange={e => setRejDetail(e.target.value)}
                      rows={2}
                      placeholder="Describe the reason for rejection…"
                      className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-red-500/50 resize-none"
                      autoFocus
                    />
                  )}
                  <button
                    onClick={() => {
                      if (!rejReason) return;
                      onSectionReject(section.key, note, rejReason, rejReason === "other" ? rejDetail : undefined);
                      setRejectForm(false);
                    }}
                    disabled={!rejReason || (rejReason === "other" && !rejDetail.trim())}
                    className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-bold text-sm py-2.5 rounded-xl transition-all"
                  >
                    <Ban className="w-4 h-4" />
                    Reject This Section
                  </button>
                </div>
              )}
            </div>
          )}

          {secStatus !== "pending" && (
            <div className="space-y-2 pt-1">
              {secStatus === "rejected" && sectionConf?.rejection_reason && (
                <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <Ban className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-300">
                      {REJECTION_REASONS.find(r => r.value === sectionConf.rejection_reason)?.label ?? sectionConf.rejection_reason}
                    </p>
                    {sectionConf.rejection_detail && (
                      <p className="text-[11px] text-red-400/70 mt-0.5">{sectionConf.rejection_detail}</p>
                    )}
                  </div>
                </div>
              )}
              {sectionConf?.paralegal_note && (
                <div className="flex items-start gap-2 bg-slate-800/40 rounded-xl px-3 py-2.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 italic">{sectionConf.paralegal_note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Start Review Modal ───────────────────────────────────────────────────────

function StartReviewModal({ initialClientId, onStart, onClose }: {
  initialClientId: string;
  onStart: (name: string, clientId: string) => void;
  onClose: () => void;
}) {
  const [name, setName]         = useState("");
  const [clientId, setClientId] = useState(initialClientId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d1221] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">Start Paralegal Review</h3>
          <p className="text-xs text-slate-500 mt-0.5">Begin a new document review session with the client.</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Paralegal Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 placeholder-slate-600 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Client ID</label>
            <input
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => onStart(name, clientId)}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition-all"
          >
            <ClipboardCheck className="w-4 h-4" />
            Begin Review
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ReviewTab = "petition_data" | "document_review";

interface ParalegalReviewProps {
  /**
   * 'full' (default): full-screen page (min-h-screen + #0a0e1a bg + Trebuchet font).
   * 'embedded': renders into parent flow — no chrome ownership. Used by LegalDepartmentPortal.
   */
  layout?: 'full' | 'embedded';
  /**
   * Case spine id — the canonical `intake_leads.id` per §3 / §12 of
   * docs/schema-changes-for-canelo.md. PREFERRED case key when set.
   * Plumbed by LegalDepartmentPortal from `selectedLeadId` (sub-phase 1
   * reads it from `?lead=<uuid>` in the URL; sub-phase 2 Queue replaces
   * that with a case-row click).
   */
  leadId?: string;
  /**
   * Legacy client id. Used as the case key when `leadId` is absent.
   * Once §12 S2 ships (`paralegal_reviews.lead_id` column) and all
   * callers pass `leadId`, this prop deprecates.
   */
  clientId?: string;
}

export default function ParalegalReview(
  { layout = 'full', leadId, clientId }: ParalegalReviewProps = {},
) {
  // Case-key resolution per docs/schema-changes-for-canelo.md §12.
  // See the matching block in src/components/SigningReview.tsx for the
  // full rationale — same pattern.
  //
  // INTERIM table-by-table column choice:
  //   - intake_submissions HAS both `lead_id` and `client_id` — when
  //     leadId is the source, query by `lead_id` (canonical column).
  //   - paralegal_reviews has only `client_id` text today (S2 adds
  //     `lead_id`). Use caseKey as the client_id value — seed scripts
  //     populate the convention.
  //   - client_documents has only `client_id` text today (S3 adds
  //     `lead_id`). Same interim convention.
  const caseKey = leadId ?? clientId ?? null;
  const caseKeyIsLeadId = !!leadId;
  const fullChrome = layout !== 'embedded';
  const fontStyle = fullChrome ? { fontFamily: "'Trebuchet MS', sans-serif" } : undefined;
  const [review, setReview]                 = useState<ParalegalReview | null>(null);
  const [docs, setDocs]                     = useState<ClientDocument[]>([]);
  const [confirmations, setConfirmations]   = useState<DocConfirmation[]>([]);
  const [sectionConfs, setSectionConfs]     = useState<SectionConfirmation[]>([]);
  const [lineConfs, setLineConfs]           = useState<LineConfirmation[]>([]);
  const [intake, setIntake]                 = useState<IntakeSubmission | null>(null);
  const [loading, setLoading]               = useState(false);
  const [showStart, setShowStart]           = useState(true);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [finalizing, setFinalizing]         = useState(false);
  const [disclosureRead, setDisclosureRead] = useState(false);
  const [disclosureExpanded, setDisclosureExpanded] = useState(true);
  const [activeTab, setActiveTab]           = useState<ReviewTab>("petition_data");

  async function startReview(paralegalName: string, effectiveCaseKey: string) {
    if (!effectiveCaseKey) {
      // Modal validation guards this, but be defensive.
      return;
    }
    setLoading(true);
    setShowStart(false);

    // paralegal_reviews and client_documents use `client_id` text today;
    // §12 S2/S3 add lead_id columns. Until then, caseKey is the
    // client_id value by convention.
    const [existingReviews, clientDocs] = await Promise.all([
      api.get(`paralegal_reviews?client_id=eq.${effectiveCaseKey}&status=eq.in_progress&order=created_at.desc&limit=1`),
      api.get(`client_documents?client_id=eq.${effectiveCaseKey}&order=uploaded_at.desc`),
    ]);

    let r: ParalegalReview;
    if (existingReviews?.[0]) {
      r = existingReviews[0];
    } else {
      const created = await api.post("paralegal_reviews", {
        client_id: effectiveCaseKey,
        paralegal_name: paralegalName,
        status: "in_progress",
      });
      r = created?.[0];
    }

    if (r) {
      setReview(r);
      const [docConfs, secConfs, lConfs] = await Promise.all([
        api.get(`paralegal_doc_confirmations?review_id=eq.${r.id}`),
        api.get(`paralegal_section_confirmations?review_id=eq.${r.id}`),
        api.get(`paralegal_line_confirmations?review_id=eq.${r.id}`),
      ]);
      setConfirmations(docConfs ?? []);
      setSectionConfs(secConfs ?? []);
      setLineConfs(lConfs ?? []);
    }

    // Load THIS case's intake submission (not just any most-recent one).
    // The pre-§12 code at this point queried `?order=submitted_at.desc&limit=1`
    // with no filter — broken for multi-case use. Now scoped properly.
    const filterColumn = caseKeyIsLeadId ? "lead_id" : "client_id";
    const intakeData = await api.get(
      `intake_submissions?${filterColumn}=eq.${effectiveCaseKey}&order=submitted_at.desc&limit=1`,
    );
    if (intakeData?.[0]) setIntake(intakeData[0]);

    setDocs(clientDocs ?? []);
    setLoading(false);
  }

  async function handleConfirmLine(key: string, schedule: string, label: string, intakeValue: string, confirmedValue: string, note: string) {
    if (!review) return;
    const existing = lineConfs.find(c => c.line_key === key);
    const isAmended = confirmedValue !== intakeValue;
    const payload = {
      review_id: review.id,
      line_key: key,
      schedule,
      label,
      intake_value: intakeValue,
      confirmed_value: confirmedValue,
      status: isAmended ? "amended" : "confirmed",
      paralegal_note: note || null,
      confirmed_at: new Date().toISOString(),
    };
    if (existing) {
      const updated = await api.patch("paralegal_line_confirmations", existing.id, payload);
      if (updated?.[0]) setLineConfs(prev => prev.map(c => c.id === existing.id ? updated[0] : c));
    } else {
      const created = await api.post("paralegal_line_confirmations", payload);
      if (created?.[0]) setLineConfs(prev => [...prev, created[0]]);
    }
  }

  async function handleFlagLine(key: string, schedule: string, label: string, intakeValue: string, note: string) {
    if (!review) return;
    const existing = lineConfs.find(c => c.line_key === key);
    const payload = {
      review_id: review.id,
      line_key: key,
      schedule,
      label,
      intake_value: intakeValue,
      confirmed_value: null,
      status: "flagged",
      paralegal_note: note || null,
      confirmed_at: null,
    };
    if (existing) {
      const updated = await api.patch("paralegal_line_confirmations", existing.id, payload);
      if (updated?.[0]) setLineConfs(prev => prev.map(c => c.id === existing.id ? updated[0] : c));
    } else {
      const created = await api.post("paralegal_line_confirmations", payload);
      if (created?.[0]) setLineConfs(prev => [...prev, created[0]]);
    }
  }

  async function handleDocUpdate(docId: string, action: DocConfirmation["status"], note: string, transferTo?: string, sectionKeyOverride?: string, rejectionReason?: RejectionReason, rejectionDetail?: string) {
    if (!review) return;
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    const matchingSections = REVIEW_SECTIONS.filter(s =>
      s.docCategories.includes(doc.document_category) ||
      (s.docTypes ?? []).includes(doc.document_type)
    );

    const primarySection = sectionKeyOverride ?? matchingSections[0]?.key ?? "other";
    const now = new Date().toISOString();
    const newConfs: DocConfirmation[] = [];

    for (const sec of matchingSections.length > 0 ? matchingSections : [{ key: "other" } as ReviewSection]) {
      const secKey = sec.key;
      const isActedSection = secKey === primarySection || matchingSections.length === 1;
      const effectiveAction: DocConfirmation["status"] = isActedSection ? action : (action === "confirmed" ? "confirmed" : "pending");
      if (!isActedSection && action !== "confirmed") continue;

      const existing = confirmations.find(c => c.client_document_id === docId && c.section === secKey);
      const payload = {
        review_id: review.id,
        client_document_id: docId,
        section: secKey,
        status: effectiveAction,
        paralegal_note: isActedSection ? (note || null) : null,
        transfer_to_section: isActedSection ? (transferTo ?? null) : null,
        confirmed_at: effectiveAction === "confirmed" ? now : null,
        rejection_reason: isActedSection && effectiveAction === "rejected" ? (rejectionReason ?? null) : null,
        rejection_detail: isActedSection && effectiveAction === "rejected" ? (rejectionDetail ?? null) : null,
      };

      if (existing) {
        const updated = await api.patch("paralegal_doc_confirmations", existing.id, payload);
        if (updated?.[0]) newConfs.push(updated[0]);
      } else {
        const created = await api.post("paralegal_doc_confirmations", payload);
        if (created?.[0]) newConfs.push(created[0]);
      }
    }

    if (newConfs.length > 0) {
      setConfirmations(prev => {
        const updatedIds = new Set(newConfs.map(c => c.id));
        const filtered = prev.filter(c => !updatedIds.has(c.id) && !newConfs.some(nc => nc.client_document_id === c.client_document_id && nc.section === c.section));
        return [...filtered, ...newConfs];
      });
    }
  }

  async function handleSectionConfirm(sectionKey: string, note: string) {
    if (!review) return;
    const existing = sectionConfs.find(s => s.section_key === sectionKey);
    const payload = {
      review_id: review.id,
      section_key: sectionKey,
      status: "confirmed",
      paralegal_note: note || null,
      confirmed_at: new Date().toISOString(),
    };
    if (existing) {
      const updated = await api.patch("paralegal_section_confirmations", existing.id, payload);
      if (updated?.[0]) setSectionConfs(prev => prev.map(s => s.id === existing.id ? updated[0] : s));
    } else {
      const created = await api.post("paralegal_section_confirmations", payload);
      if (created?.[0]) setSectionConfs(prev => [...prev, created[0]]);
    }
  }

  async function handleSectionNeedsInfo(sectionKey: string, note: string) {
    if (!review) return;
    const existing = sectionConfs.find(s => s.section_key === sectionKey);
    const payload = {
      review_id: review.id,
      section_key: sectionKey,
      status: "needs_info",
      paralegal_note: note || null,
      confirmed_at: null,
    };
    if (existing) {
      const updated = await api.patch("paralegal_section_confirmations", existing.id, payload);
      if (updated?.[0]) setSectionConfs(prev => prev.map(s => s.id === existing.id ? updated[0] : s));
    } else {
      const created = await api.post("paralegal_section_confirmations", payload);
      if (created?.[0]) setSectionConfs(prev => [...prev, created[0]]);
    }
  }

  async function handleSectionReject(sectionKey: string, note: string, reason: RejectionReason, detail?: string) {
    if (!review) return;
    const existing = sectionConfs.find(s => s.section_key === sectionKey);
    const payload = {
      review_id: review.id,
      section_key: sectionKey,
      status: "rejected",
      paralegal_note: note || null,
      confirmed_at: null,
      rejection_reason: reason,
      rejection_detail: detail ?? null,
    };
    if (existing) {
      const updated = await api.patch("paralegal_section_confirmations", existing.id, payload);
      if (updated?.[0]) setSectionConfs(prev => prev.map(s => s.id === existing.id ? updated[0] : s));
    } else {
      const created = await api.post("paralegal_section_confirmations", payload);
      if (created?.[0]) setSectionConfs(prev => [...prev, created[0]]);
    }
  }

  async function sendInfoRequest() {
    if (!review) return;
    setSendingRequest(true);
    await api.patch("paralegal_reviews", review.id, {
      status: "needs_info",
      info_request_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setReview(r => r ? { ...r, status: "needs_info", info_request_sent_at: new Date().toISOString() } : r);
    setSendingRequest(false);
  }

  async function finalizeReview() {
    if (!review) return;
    setFinalizing(true);
    await api.patch("paralegal_reviews", review.id, {
      status: "complete",
      updated_at: new Date().toISOString(),
    });
    setReview(r => r ? { ...r, status: "complete" } : r);
    setFinalizing(false);
  }

  // Totals
  const allSectionKeys = REVIEW_SECTIONS.map(s => s.key);
  const confirmedSections = sectionConfs.filter(s => s.status === "confirmed").length;
  const needsInfoSections = sectionConfs.filter(s => s.status === "needs_info").length;
  const rejectedSections  = sectionConfs.filter(s => s.status === "rejected").length;
  const resolvedSections  = confirmedSections + rejectedSections;
  const allDone = resolvedSections === allSectionKeys.length && needsInfoSections === 0;

  const totalDocs = docs.length;
  const confirmedDocs = confirmations.filter(c => c.status === "confirmed").length;

  if (showStart) {
    return (
      <div
        className={fullChrome ? "min-h-screen bg-[#0a0e1a]" : ""}
        style={fontStyle}
      >
        <StartReviewModal initialClientId={caseKey ?? ''} onStart={startReview} onClose={() => {}} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center ${fullChrome ? "min-h-screen bg-[#0a0e1a]" : "py-24"}`}
        style={fontStyle}
      >
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading review session…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`text-white ${fullChrome ? "min-h-screen bg-[#0a0e1a]" : ""}`}
      style={fontStyle}
    >

      {/* Header */}
      <header className="bg-[#0d1221]/95 border-b border-slate-800/60 sticky top-0 z-30 backdrop-blur">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
              <Scale className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
                bankruptcy<span className="text-amber-400">.ai</span>
              </span>
              <span className="hidden sm:inline text-slate-600 mx-2">|</span>
              <span className="hidden sm:inline text-slate-500 text-xs font-medium uppercase tracking-wide">Paralegal Review</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {review && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                {review.paralegal_name} · {intake ? `${intake.first_name} ${intake.last_name}` : `Client: ${review.client_id}`}
              </span>
            )}
            {review?.status === "in_progress" && (
              <>
                <button
                  onClick={sendInfoRequest}
                  disabled={sendingRequest}
                  className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                >
                  {sendingRequest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Needs Additional Info</span>
                  <span className="sm:hidden">Needs Info</span>
                </button>
                <button
                  onClick={finalizeReview}
                  disabled={finalizing || !allDone}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                >
                  {finalizing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Finalize Review
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab bar */}
        {!showStart && !loading && (
          <div className="px-4 sm:px-6 border-t border-slate-800/40 flex items-center gap-0.5">
            {([
              { id: "petition_data",    label: "Petition Data",      icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: "document_review",  label: "Document Review",    icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
            ] as { id: ReviewTab; label: string; icon: React.ReactNode }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "petition_data" && lineConfs.filter(c => c.status === "flagged").length > 0 && (
                  <span className="ml-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {lineConfs.filter(c => c.status === "flagged").length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-28 space-y-6">

        {/* Status banner */}
        {review?.status === "complete" && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-5 py-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-300">Review Complete</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {rejectedSections > 0
                  ? `All sections resolved. ${confirmedSections} approved, ${rejectedSections} rejected. Forwarded to attorney review with notes.`
                  : "All sections approved and verified. This case is ready for attorney review."
                }
              </p>
            </div>
          </div>
        )}
        {review?.status === "needs_info" && (
          <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/25 rounded-2xl px-5 py-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-300">Additional Information Requested</p>
              <p className="text-xs text-amber-600 mt-0.5">
                A request was sent to the client on {review.info_request_sent_at ? fmtDate(review.info_request_sent_at) : "—"}.
                The client has been directed back to their portal to provide missing documents.
              </p>
            </div>
          </div>
        )}

        {/* Opening Disclosure — must be confirmed before sections unlock */}
        <div className={`rounded-2xl border overflow-hidden transition-all ${
          disclosureRead
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-amber-500/40 bg-amber-500/5"
        }`}>
          <button
            onClick={() => setDisclosureExpanded(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              disclosureRead ? "bg-emerald-500/15" : "bg-amber-500/15"
            }`}>
              {disclosureRead
                ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                : <Info className="w-5 h-5 text-amber-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">Opening Disclosure</span>
                {disclosureRead
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/25">Read & Confirmed</span>
                  : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/25 animate-pulse">Required — Read to Client First</span>
                }
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Must be read aloud to the client before beginning document review</p>
            </div>
            {disclosureExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
          </button>

          {disclosureExpanded && (
            <div className="px-5 pb-5 space-y-4">
              <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">Read Aloud to Client</span>
                </div>
                {OPENING_DISCLOSURE.split("\n\n").map((para, i) => (
                  <p key={i} className="text-sm text-amber-100 leading-relaxed italic mb-3 last:mb-0">
                    "{para}"
                  </p>
                ))}
              </div>

              {/* Key points summary for quick reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: <User className="w-3.5 h-3.5" />, color: "text-slate-400", label: "Not Legal Advice", desc: "Paralegal cannot provide legal advice — all legal questions go to the attorney." },
                  { icon: <RefreshCw className="w-3.5 h-3.5" />, color: "text-sky-400", label: "Docs Must Stay Current", desc: "Documents must be updated through the filing date. Final docs needed for Meeting of Creditors." },
                  { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400", label: "Filing Fee & Signing Appt", desc: "After attorney approval, client pays filing fee then schedules signing appointment." },
                  { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-amber-400", label: "Bank Balances on Filing Date", desc: "Client must provide all account balances as of the exact date the case is filed." },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-3">
                    <span className={`flex-shrink-0 mt-0.5 ${item.color}`}>{item.icon}</span>
                    <div>
                      <p className={`text-xs font-bold ${item.color}`}>{item.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {!disclosureRead && (
                <button
                  onClick={() => { setDisclosureRead(true); setDisclosureExpanded(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-amber-400/20"
                >
                  <Check className="w-4 h-4" />
                  Disclosure Read Aloud — Client Confirmed Understanding
                </button>
              )}
              {disclosureRead && (
                <div className="flex items-center gap-2 text-xs text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmed — proceeding to document review
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Review Progress</p>
            <p className="text-xs text-slate-500">{confirmedSections} of {REVIEW_SECTIONS.length} sections complete</p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 mb-3">
            <div
              className="h-2 rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${REVIEW_SECTIONS.length > 0 ? (confirmedSections / REVIEW_SECTIONS.length) * 100 : 0}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{totalDocs}</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">Total Docs</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{confirmedSections}</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{rejectedSections}</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">Rejected</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-400">{needsInfoSections}</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">Needs Info</p>
            </div>
          </div>
        </div>

        {/* Gate: sections locked until disclosure is confirmed */}
        {!disclosureRead && (
          <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-2xl px-5 py-5">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400">Document Review Sections Locked</p>
              <p className="text-xs text-slate-600 mt-0.5">Read the opening disclosure to the client and confirm before proceeding.</p>
            </div>
          </div>
        )}

        {disclosureRead && activeTab === "petition_data" && intake && (
          <PetitionDataPanel
            intake={intake}
            docs={docs}
            lineConfs={lineConfs}
            reviewId={review?.id ?? ""}
            onConfirmLine={handleConfirmLine}
            onFlagLine={handleFlagLine}
          />
        )}

        {disclosureRead && activeTab === "petition_data" && !intake && (
          <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-2xl px-5 py-6">
            <Info className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-400">No intake submission found</p>
              <p className="text-xs text-slate-600 mt-0.5">This client has not yet submitted their intake questionnaire. Petition data will appear here once submitted.</p>
            </div>
          </div>
        )}

        {disclosureRead && activeTab === "document_review" && <>
        {/* Section index */}
        <div className="bg-[#0d1221] border border-slate-800 rounded-2xl px-5 py-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Sections</p>
          <div className="flex flex-wrap gap-2">
            {REVIEW_SECTIONS.map(s => {
              const sc = sectionConfs.find(c => c.section_key === s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => {
                    const el = document.getElementById(`section-${s.key}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                    sc?.status === "confirmed"  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" :
                    sc?.status === "needs_info" ? "bg-amber-500/10 border-amber-500/25 text-amber-400" :
                    sc?.status === "rejected"   ? "bg-red-500/10 border-red-500/25 text-red-400" :
                                                  "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {sc?.status === "confirmed"  && <CheckCircle2 className="w-2.5 h-2.5" />}
                  {sc?.status === "needs_info" && <AlertTriangle className="w-2.5 h-2.5" />}
                  {sc?.status === "rejected"   && <Ban className="w-2.5 h-2.5" />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section cards */}
        {REVIEW_SECTIONS.map(section => (
          <div key={section.key} id={`section-${section.key}`} className="scroll-mt-20">
            <SectionCard
              section={section}
              docs={docs}
              confirmations={confirmations}
              sectionConf={sectionConfs.find(s => s.section_key === section.key) ?? null}
              onDocUpdate={handleDocUpdate}
              onSectionConfirm={handleSectionConfirm}
              onSectionNeedsInfo={handleSectionNeedsInfo}
              onSectionReject={handleSectionReject}
            />
          </div>
        ))}

        {/* Uncategorized docs */}
        {(() => {
          const categorizedIds = new Set(
            REVIEW_SECTIONS.flatMap(s =>
              docs.filter(d =>
                s.docCategories.includes(d.document_category) ||
                (s.docTypes ?? []).includes(d.document_type)
              ).map(d => d.id)
            )
          );
          const uncategorized = docs.filter(d => !categorizedIds.has(d.id));
          if (uncategorized.length === 0) return null;
          return (
            <div className="rounded-2xl border border-slate-700/60 bg-[#0d1221] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-bold text-white">Other Documents</p>
                  <p className="text-xs text-slate-500 mt-0.5">Documents not matched to a specific review section</p>
                </div>
              </div>
              <div className="px-5 py-4 space-y-2">
                {uncategorized.map(d => (
                  <DocRow
                    key={d.id}
                    doc={d}
                    confirmation={confirmations.find(c => c.client_document_id === d.id) ?? null}
                    sections={REVIEW_SECTIONS}
                    sectionKey="other"
                    onUpdate={handleDocUpdate}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Bottom action */}
        {review?.status === "in_progress" && needsInfoSections > 0 && (
          <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-300">{needsInfoSections} section{needsInfoSections !== 1 ? "s" : ""} need additional information</p>
                <p className="text-xs text-amber-600 mt-0.5">Send the client a link to return to their portal and upload or correct the missing documents.</p>
              </div>
            </div>
            <button
              onClick={sendInfoRequest}
              disabled={sendingRequest}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
            >
              {sendingRequest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Info Request
            </button>
          </div>
        )}
        </>}

        {/* Flagged lines summary — always shown when there are flags */}
        {disclosureRead && lineConfs.filter(c => c.status === "flagged").length > 0 && (
          <div className="bg-red-500/8 border border-red-500/25 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-sm font-bold text-red-300">Flagged Items — Require Attention</p>
            </div>
            <div className="space-y-2">
              {lineConfs.filter(c => c.status === "flagged").map(c => (
                <div key={c.id} className="flex items-start gap-2.5 bg-slate-900/60 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">{c.label}</p>
                    <p className="text-[10px] text-slate-500">{c.schedule} · Intake value: {c.intake_value}</p>
                    {c.paralegal_note && <p className="text-[10px] text-red-400/70 italic mt-0.5">{c.paralegal_note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
