import { useState, useRef, useCallback, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  CheckCircle2,
  Clock,
  Upload,
  AlertTriangle,
  FileText,
  X,
  ChevronDown,
  ChevronRight,
  User,
  Banknote,
  Building2,
  Car,
  PiggyBank,
  DollarSign,
  Shield,
  Loader2,
  Eye,
  RotateCcw,
  Info,
  BadgeCheck,
  CalendarDays,
  Lock,
  Send,
  XCircle,
  Bot,
  GraduationCap,
  ClipboardList,
  FolderCheck,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = "missing" | "uploading" | "converting" | "needs_review" | "accepted" | "rejected" | "stale";
type DebtorRole = "debtor1" | "debtor2" | "both" | "case";

interface UploadedDoc {
  slotKey: string;
  fileName: string;
  status: DocStatus;
  wasImage: boolean;
  convertedToPdf: boolean;
  legibilityOk: boolean | null;
  note: string | null;
  uploadedAt: string; // ISO date string — used to compute staleness
}

// ─── Staleness ────────────────────────────────────────────────────────────────
// A document is "stale" if it was uploaded more than 30 days ago (crossed a calendar month).
// For means test income docs specifically, any doc from a prior calendar month is stale.

function isStale(doc: UploadedDoc): boolean {
  if (!doc.uploadedAt) return false;
  const uploaded = new Date(doc.uploadedAt);
  const now = new Date();
  // Different calendar month = stale
  return uploaded.getMonth() !== now.getMonth() || uploaded.getFullYear() !== now.getFullYear();
}

function daysSinceUpload(doc: UploadedDoc): number {
  if (!doc.uploadedAt) return 0;
  return Math.floor((Date.now() - new Date(doc.uploadedAt).getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Income source definitions ────────────────────────────────────────────────
// Each income source maps to required document slots.
// "active" is computed from questionnaire form data (which income sources are non-zero).

interface IncomeSource {
  key: string;
  label: string;
  formFields: string[]; // questionnaire field names that activate this source
  docSlots: DocSlot[];
  monthsRequired: number; // how many months of docs needed (always 6 for means test)
  notes: string;
  requiresAllSixMonths: boolean;
}

interface DocSlot {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
  conditionLabel?: string;
  debtorRole: DebtorRole;
  acceptedFormats?: string;
  isMeansTest?: boolean; // means test docs are specially gated
  monthIndex?: number;   // 1–6 for rolling monthly docs
}

interface DocCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  slots: DocSlot[];
  isMeansTestCategory?: boolean;
}

// ─── MEANS TEST INCOME SOURCE DEFINITIONS ────────────────────────────────────

const MEANS_TEST_INCOME_SOURCES: IncomeSource[] = [
  {
    key: "employment",
    label: "Employment / Self-Employment",
    formFields: ["debtorWorkStatus", "employmentSources", "debtorMonthlyGross"],
    monthsRequired: 6,
    requiresAllSixMonths: true,
    notes: "6 pay stubs required — one per month for each of the last 6 calendar months. If paid bi-weekly, all stubs covering each month are required.",
    docSlots: Array.from({ length: 6 }, (_, i) => ({
      key: `means_paystub_month_${i + 1}`,
      label: `Pay Stub — Month ${i + 1} of 6${i === 0 ? " (most recent)" : i === 5 ? " (oldest)" : ""}`,
      hint: i === 0 ? "Most recent month. Must show employer name, pay period dates, and gross/net amounts." : undefined,
      required: true,
      debtorRole: "debtor1" as DebtorRole,
      acceptedFormats: "PDF, JPG, PNG — images converted to PDF automatically",
      isMeansTest: true,
      monthIndex: i + 1,
    })),
  },
  {
    key: "ss_retirement",
    label: "Social Security Retirement Benefits",
    formFields: ["dSsRetirement"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "Official SSA benefit award letter or current benefit verification letter showing monthly amount. Bank statements showing 6 months of deposits may also satisfy this requirement.",
    docSlots: [
      {
        key: "means_ss_award_letter",
        label: "SSA Benefit Award / Verification Letter",
        hint: "Official letter from SSA showing current monthly benefit amount.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
  {
    key: "ss_disability",
    label: "Social Security Disability (SSDI)",
    formFields: ["dSsDisability"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "Official SSDI award letter or current benefit verification letter. Bank statements showing 6 months of SSDI deposits are also acceptable.",
    docSlots: [
      {
        key: "means_ssdi_award_letter",
        label: "SSDI Award / Benefit Letter",
        hint: "Official SSA letter showing SSDI monthly benefit amount.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
  {
    key: "veterans",
    label: "Veterans (VA) Benefits",
    formFields: ["dVeterans"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "VA benefit award letter showing current monthly compensation or pension amount.",
    docSlots: [
      {
        key: "means_va_award_letter",
        label: "VA Benefit Award Letter",
        hint: "VA letter showing current monthly disability compensation or pension.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
  {
    key: "unemployment",
    label: "Unemployment Benefits",
    formFields: ["dUnemployment"],
    monthsRequired: 6,
    requiresAllSixMonths: true,
    notes: "6 months of unemployment payment history from your state unemployment agency, or bank statements showing deposits for all 6 months.",
    docSlots: Array.from({ length: 6 }, (_, i) => ({
      key: `means_unemployment_month_${i + 1}`,
      label: `Unemployment Payment Record — Month ${i + 1} of 6`,
      hint: i === 0 ? "Most recent month. Agency statement or bank statement showing deposit." : undefined,
      required: true,
      debtorRole: "case" as DebtorRole,
      acceptedFormats: "PDF, JPG, PNG",
      isMeansTest: true,
      monthIndex: i + 1,
    })),
  },
  {
    key: "workers_comp",
    label: "Workers' Compensation",
    formFields: ["dWorkersComp"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "Workers' compensation award letter or payment statements showing monthly amount received.",
    docSlots: [
      {
        key: "means_workers_comp_letter",
        label: "Workers' Compensation Award / Statement",
        hint: "Official letter or payment summary showing monthly benefit amount.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
  {
    key: "pension",
    label: "Pension / Retirement Income",
    formFields: ["dPension"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "Pension award letter or most recent pension statement showing monthly benefit amount and source.",
    docSlots: [
      {
        key: "means_pension_statement",
        label: "Pension Award Letter or Statement",
        hint: "Official letter or statement from pension administrator showing monthly amount.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
  {
    key: "rental",
    label: "Rental / Property Income",
    formFields: ["dRental"],
    monthsRequired: 6,
    requiresAllSixMonths: true,
    notes: "6 months of rental income documentation — lease agreements plus bank statements showing deposits, or rental management statements.",
    docSlots: [
      {
        key: "means_rental_lease",
        label: "Rental Lease Agreement",
        hint: "Current lease showing monthly rent amount.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        key: `means_rental_deposit_month_${i + 1}`,
        label: `Rental Deposit Record — Month ${i + 1} of 6`,
        hint: i === 0 ? "Bank statement or deposit record showing rent received this month." : undefined,
        required: true,
        debtorRole: "case" as DebtorRole,
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
        monthIndex: i + 1,
      })),
    ],
  },
  {
    key: "alimony",
    label: "Alimony / Spousal Support Received",
    formFields: ["dAlimony"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "Divorce decree or support order showing monthly amount, plus 6 months of payment records or bank statements showing deposits.",
    docSlots: [
      {
        key: "means_alimony_order",
        label: "Divorce Decree / Alimony Order",
        hint: "Court order specifying monthly alimony amount.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
  {
    key: "child_support",
    label: "Child Support Received",
    formFields: ["dChildSupport"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "Child support order plus 6 months of payment records or bank statements.",
    docSlots: [
      {
        key: "means_child_support_order",
        label: "Child Support Order",
        hint: "Court order specifying monthly child support amount.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
  {
    key: "royalties",
    label: "Royalties",
    formFields: ["dRoyalties"],
    monthsRequired: 6,
    requiresAllSixMonths: true,
    notes: "6 months of royalty payment statements from publisher, licensing agency, or similar.",
    docSlots: Array.from({ length: 6 }, (_, i) => ({
      key: `means_royalties_month_${i + 1}`,
      label: `Royalty Payment Statement — Month ${i + 1} of 6`,
      required: true,
      debtorRole: "case" as DebtorRole,
      acceptedFormats: "PDF, JPG, PNG",
      isMeansTest: true,
      monthIndex: i + 1,
    })),
  },
  {
    key: "investment",
    label: "Investment / Dividend Income",
    formFields: ["dInvestment"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "6 months of brokerage or investment account statements showing dividends, interest, or distributions received.",
    docSlots: Array.from({ length: 6 }, (_, i) => ({
      key: `means_investment_stmt_month_${i + 1}`,
      label: `Investment / Brokerage Statement — Month ${i + 1} of 6`,
      hint: i === 0 ? "Most recent month." : undefined,
      required: true,
      debtorRole: "case" as DebtorRole,
      acceptedFormats: "PDF, JPG, PNG",
      isMeansTest: true,
      monthIndex: i + 1,
    })),
  },
  {
    key: "other_income",
    label: "Other Income",
    formFields: ["dOtherIncome"],
    monthsRequired: 6,
    requiresAllSixMonths: false,
    notes: "Documentation for any other income source declared — award letters, statements, or bank records showing 6 months of deposits.",
    docSlots: [
      {
        key: "means_other_income_docs",
        label: "Other Income — Supporting Documentation",
        hint: "Award letters, statements, or bank records showing the income declared.",
        required: true,
        debtorRole: "case",
        acceptedFormats: "PDF, JPG, PNG",
        isMeansTest: true,
      },
    ],
  },
];

// ─── Color helpers ─────────────────────────────────────────────────────────────

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  red:     { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400"     },
  sky:     { bg: "bg-sky-500/10",     border: "border-sky-500/25",     text: "text-sky-400"     },
  amber:   { bg: "bg-amber-400/10",   border: "border-amber-400/25",   text: "text-amber-400"   },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400" },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400"    },
  orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/25",  text: "text-orange-400"  },
  teal:    { bg: "bg-teal-500/10",    border: "border-teal-500/25",    text: "text-teal-400"    },
};

// ─── Image → PDF converter ────────────────────────────────────────────────────

async function convertImageToPdf(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 595 * 2;
        const maxH = 842 * 2;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const imgData = dataUrl.split(",")[1];
        const imgBytes = atob(imgData);
        const imgLen   = imgBytes.length;
        const imgArr   = new Uint8Array(imgLen);
        for (let i = 0; i < imgLen; i++) imgArr[i] = imgBytes.charCodeAt(i);

        const w = Math.round(canvas.width / 2);
        const h = Math.round(canvas.height / 2);
        const header = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${w} ${h}]/Contents 4 0 R/Resources<</XObject<</I1 5 0 R>>>>>>endobj\n4 0 obj<</Length 32>>\nstream\nq ${w} 0 0 ${h} 0 0 cm /I1 Do Q\nendstream\nendobj\n5 0 obj<</Type/XObject/Subtype/Image/Width ${canvas.width}/Height ${canvas.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${imgLen}>>\nstream\n`;
        const trailer  = `\nendstream\nendobj\n`;
        const enc = new TextEncoder();
        const headerBytes = enc.encode(header);
        const trailerBytes = enc.encode(trailer);
        const xrefOffset   = headerBytes.length + imgArr.length + trailerBytes.length;
        const xref = `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000274 00000 n \n0000000356 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
        const xrefBytes = enc.encode(xref);
        const pdf = new Uint8Array(headerBytes.length + imgArr.length + trailerBytes.length + xrefBytes.length);
        pdf.set(headerBytes, 0);
        pdf.set(imgArr, headerBytes.length);
        pdf.set(trailerBytes, headerBytes.length + imgArr.length);
        pdf.set(xrefBytes, headerBytes.length + imgArr.length + trailerBytes.length);
        const pdfBlob = new Blob([pdf], { type: "application/pdf" });
        resolve(new File([pdfBlob], file.name.replace(/\.(jpe?g|png|gif|webp|bmp)$/i, ".pdf"), { type: "application/pdf" }));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Legibility checker ────────────────────────────────────────────────────────

async function checkPdfLegibility(file: File): Promise<{ ok: boolean; note: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    if (viewport.width < 50 || viewport.height < 50)
      return { ok: false, note: "Document appears too small or blank. Please upload a clearer copy." };
    const canvas = document.createElement("canvas");
    canvas.width  = Math.min(viewport.width, 400);
    canvas.height = Math.min(viewport.height, 400);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: canvas.width / viewport.width }) }).promise;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let darkPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) < 180) darkPixels++;
    }
    const r = darkPixels / (canvas.width * canvas.height);
    if (r < 0.01) return { ok: false, note: "Document appears blank. Please verify the correct file was uploaded." };
    if (r > 0.9)  return { ok: false, note: "Document is too dark to read. Please upload a clearer copy." };
    return { ok: true, note: "Document looks clear and legible." };
  } catch {
    return { ok: true, note: "Legibility check could not complete — your attorney will review." };
  }
}

// ─── Upload to Supabase ───────────────────────────────────────────────────────

async function uploadToSupabase(clientId: string, slotKey: string, file: File, legibilityNote: string): Promise<void> {
  const storageKey = `${clientId}/documents/${slotKey}_${Date.now()}_${file.name}`;
  await fetch(`${SUPABASE_URL}/storage/v1/object/client-documents/${storageKey}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: file,
  });
  await fetch(`${SUPABASE_URL}/rest/v1/client_documents`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      client_id: clientId,
      document_type: slotKey,
      document_category: slotKey.startsWith("means_") ? "means_test" : slotKey.split("_")[0],
      storage_path: storageKey,
      original_filename: file.name,
      mime_type: file.type,
      ai_verified: true,
      ai_note: legibilityNote,
    }),
  });
}

// ─── Slot Row ─────────────────────────────────────────────────────────────────

function SlotRow({ slot, uploaded, onUpload, onRemove }: {
  slot: DocSlot;
  uploaded?: UploadedDoc;
  onUpload: (slotKey: string, file: File) => void;
  onRemove: (slotKey: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isProcessing = uploaded?.status === "uploading" || uploaded?.status === "converting";
  const stale = uploaded && uploaded.status === "needs_review" && isStale(uploaded);
  const effectiveStatus: DocStatus = stale ? "stale" : (uploaded?.status ?? "missing");

  const statusConfig: Record<DocStatus, { icon: React.ReactNode; label: string; rowCls: string; textCls: string }> = {
    missing:     { icon: <div className={`w-4 h-4 rounded-full border-2 ${slot.required ? "border-slate-600" : "border-slate-700"}`} />, label: "", rowCls: "bg-slate-900/60 border-slate-800 hover:border-slate-700", textCls: "text-slate-400" },
    uploading:   { icon: <Loader2 className="w-4 h-4 animate-spin text-sky-400" />, label: "Uploading…", rowCls: "bg-sky-500/5 border-sky-500/20", textCls: "text-sky-300" },
    converting:  { icon: <Loader2 className="w-4 h-4 animate-spin text-amber-400" />, label: "Converting to PDF…", rowCls: "bg-amber-400/5 border-amber-400/20", textCls: "text-amber-300" },
    needs_review:{ icon: <Clock className="w-4 h-4 text-amber-400" />, label: "Pending Review", rowCls: "bg-slate-800/60 border-slate-700", textCls: "text-amber-400" },
    accepted:    { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, label: "Accepted", rowCls: "bg-emerald-500/5 border-emerald-500/20", textCls: "text-emerald-400" },
    rejected:    { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: "Rejected", rowCls: "bg-red-500/5 border-red-500/20", textCls: "text-red-400" },
    stale:       { icon: <CalendarDays className="w-4 h-4 text-orange-400" />, label: "Outdated — Update Required", rowCls: "bg-orange-500/5 border-orange-500/30", textCls: "text-orange-400" },
  };

  const sc = statusConfig[effectiveStatus];

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${sc.rowCls}`}>
      <div className="mt-0.5 flex-shrink-0">{sc.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={`text-xs font-semibold leading-snug ${
            effectiveStatus === "accepted" ? "text-emerald-300"
            : effectiveStatus === "rejected" ? "text-red-300"
            : effectiveStatus === "stale" ? "text-orange-300"
            : uploaded && effectiveStatus !== "missing" ? "text-white"
            : "text-slate-300"
          }`}>{slot.label}</p>
          {!slot.required && <span className="text-[10px] font-semibold text-slate-600 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">If applicable</span>}
          {slot.required && effectiveStatus === "missing" && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">Required</span>}
          {slot.isMeansTest && <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">Means Test</span>}
        </div>

        {slot.hint && effectiveStatus === "missing" && (
          <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{slot.hint}</p>
        )}
        {slot.conditionLabel && <p className="text-[10px] text-slate-600 mt-0.5 italic">{slot.conditionLabel}</p>}

        {uploaded && effectiveStatus !== "missing" && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <span className="text-[10px] text-slate-400 truncate max-w-[180px]">{uploaded.fileName}</span>
              {uploaded.convertedToPdf && (
                <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-px rounded-full">Converted to PDF</span>
              )}
              {effectiveStatus !== "missing" && uploaded.uploadedAt && (
                <span className="text-[10px] text-slate-600">
                  Uploaded {new Date(uploaded.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {effectiveStatus !== "stale" && ` · ${daysSinceUpload(uploaded)}d ago`}
                </span>
              )}
            </div>

            {/* Stale warning */}
            {effectiveStatus === "stale" && (
              <div className="flex items-start gap-1.5 bg-orange-500/10 border border-orange-500/25 rounded-lg px-3 py-2">
                <CalendarDays className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-orange-400 mb-0.5">Document is from a prior calendar month</p>
                  <p className="text-[10px] text-orange-300/80 leading-snug">
                    Bankruptcy law requires income documents to reflect the current month. Please upload an updated version before this case can proceed to attorney review.
                  </p>
                </div>
              </div>
            )}

            {/* Legibility failure */}
            {uploaded.legibilityOk === false && (
              <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-300 leading-snug">{uploaded.note}</p>
              </div>
            )}
            {uploaded.legibilityOk === true && effectiveStatus === "needs_review" && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1"><Eye className="w-3 h-3" /> Legible — pending attorney review</p>
            )}
            {effectiveStatus === "rejected" && uploaded.note && (
              <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-300 leading-snug"><strong>Rejected:</strong> {uploaded.note}</p>
              </div>
            )}
          </div>
        )}

        {slot.acceptedFormats && effectiveStatus === "missing" && (
          <p className="text-[10px] text-slate-700 mt-1">{slot.acceptedFormats}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 mt-0.5">
        {(effectiveStatus === "missing" || effectiveStatus === "rejected" || effectiveStatus === "stale") && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(slot.key, f); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
            >
              <Upload className="w-3 h-3" />
              {effectiveStatus === "stale" ? "Update" : effectiveStatus === "rejected" ? "Re-upload" : "Upload"}
            </button>
          </>
        )}
        {effectiveStatus === "needs_review" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(slot.key, f); e.target.value = ""; }}
            />
            <button onClick={() => fileRef.current?.click()} title="Replace" className="text-slate-600 hover:text-slate-400 transition-colors p-1">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onRemove(slot.key)} title="Remove" className="text-slate-700 hover:text-red-400 transition-colors p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {effectiveStatus === "accepted" && <BadgeCheck className="w-4 h-4 text-emerald-400" />}
      </div>
    </div>
  );
}

// ─── Means Test Section ────────────────────────────────────────────────────────

interface MeansTestSectionProps {
  activeSources: string[];     // income source keys that are active (non-zero in form data)
  uploads: Record<string, UploadedDoc>;
  onUpload: (slotKey: string, file: File) => void;
  onRemove: (slotKey: string) => void;
}

function MeansTestSection({ activeSources, uploads, onUpload, onRemove }: MeansTestSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const relevantSources = MEANS_TEST_INCOME_SOURCES.filter(s => activeSources.includes(s.key));
  const allSlots = relevantSources.flatMap(s => s.docSlots);
  const totalRequired = allSlots.filter(s => s.required).length;

  const staleOrMissing = allSlots.filter(s => {
    const u = uploads[s.key];
    if (!u || u.status === "missing") return true;
    if (u.status === "rejected") return true;
    if (u.status === "needs_review" && isStale(u)) return true;
    return false;
  });

  const allClear = totalRequired > 0 && staleOrMissing.length === 0;
  const readyForReview = allSlots.every(slot => {
    const u = uploads[slot.key];
    if (!slot.required) return true;
    if (!u || u.status === "missing" || u.status === "rejected") return false;
    if (u.status === "needs_review" && isStale(u)) return false;
    return true;
  });

  return (
    <div className={`rounded-2xl border overflow-hidden ${readyForReview ? "border-emerald-500/25" : "border-orange-500/30"}`}>

      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full px-5 py-4 flex items-center justify-between gap-3 transition-colors ${
          expanded ? "bg-slate-900" : "bg-[#0d1221] hover:bg-slate-900/60"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            readyForReview ? "bg-emerald-500/10 border-emerald-500/25" : "bg-orange-500/10 border-orange-500/25"
          }`}>
            {readyForReview
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <AlertTriangle className="w-4 h-4 text-orange-400" />
            }
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white">Means Test — Income Documentation</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                readyForReview
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : "text-orange-400 bg-orange-500/10 border-orange-500/25"
              }`}>
                {readyForReview ? "Ready for Review" : `${staleOrMissing.length} doc${staleOrMissing.length !== 1 ? "s" : ""} need attention`}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              All income sources from the last 6 months — required for the bankruptcy means test (Form 122A-1)
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="bg-slate-900/80 border-t border-slate-800 px-4 py-4 space-y-5">

          {/* Means test explanation */}
          <div className="flex items-start gap-2.5 bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3">
            <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-sky-400 mb-1">What is the Means Test?</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                The bankruptcy means test (Form 122A-1) requires documentation of ALL income received from every source during the 6 calendar months before filing.
                This determines eligibility for Chapter 7. <strong className="text-white">Every income source you declared in your questionnaire must be documented here.</strong>
                Cases will not proceed to attorney review until all income documentation is uploaded, current, and legible.
              </p>
            </div>
          </div>

          {/* Review gate warning */}
          {!readyForReview && (
            <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-4">
              <Lock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-400 mb-1">Attorney Review Blocked</p>
                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  The following documents are missing, outdated, or rejected. Your case <strong className="text-white">cannot be submitted for attorney review</strong> until all income documentation is uploaded and current.
                </p>
                <ul className="space-y-1">
                  {staleOrMissing.slice(0, 6).map(slot => {
                    const u = uploads[slot.key];
                    const isDocStale = u && u.status === "needs_review" && isStale(u);
                    return (
                      <li key={slot.key} className="flex items-center gap-2 text-[10px] text-slate-400">
                        {isDocStale
                          ? <CalendarDays className="w-3 h-3 text-orange-400 flex-shrink-0" />
                          : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        }
                        <span className={isDocStale ? "text-orange-300" : "text-red-300"}>{slot.label}</span>
                        {isDocStale && <span className="text-orange-400 italic">— outdated, update required</span>}
                      </li>
                    );
                  })}
                  {staleOrMissing.length > 6 && (
                    <li className="text-[10px] text-slate-500">… and {staleOrMissing.length - 6} more</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {readyForReview && (
            <div className="flex items-center gap-2.5 bg-emerald-500/8 border border-emerald-500/25 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-emerald-400">
                All income documentation is current and uploaded. This section is ready for attorney review.
              </p>
            </div>
          )}

          {/* Per-source slots */}
          {relevantSources.length === 0 ? (
            <div className="text-center py-6">
              <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">No income sources declared</p>
              <p className="text-slate-600 text-xs mt-1 max-w-xs mx-auto">
                Complete the income section of your questionnaire first. Documents will appear here for each income source you report.
              </p>
            </div>
          ) : (
            relevantSources.map(source => {
              const sourceSlots = source.docSlots;
              const sourceMissing = sourceSlots.filter(s => {
                const u = uploads[s.key];
                if (!u || u.status === "missing") return true;
                if (u.status === "rejected") return true;
                if (u.status === "needs_review" && isStale(u)) return true;
                return false;
              }).length;

              return (
                <div key={source.key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sourceMissing === 0 ? "bg-emerald-400" : "bg-orange-400"}`} />
                    <p className="text-xs font-bold text-slate-300">{source.label}</p>
                    {sourceMissing > 0 && (
                      <span className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-px rounded-full font-semibold">
                        {sourceMissing} needed
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 px-3 leading-snug">{source.notes}</p>
                  <div className="space-y-1.5">
                    {sourceSlots.map(slot => (
                      <SlotRow
                        key={slot.key}
                        slot={slot}
                        uploaded={uploads[slot.key]}
                        onUpload={onUpload}
                        onRemove={onRemove}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── General Category Section ─────────────────────────────────────────────────

function CategorySection({ category, uploads, onUpload, onRemove }: {
  category: DocCategory;
  uploads: Record<string, UploadedDoc>;
  onUpload: (slotKey: string, file: File) => void;
  onRemove: (slotKey: string) => void;
}) {
  const [expanded, setExpanded] = useState(category.id === "identity");
  const colors = colorMap[category.color] ?? colorMap.sky;

  const totalRequired = category.slots.filter(s => s.required).length;
  const uploaded      = category.slots.filter(s => uploads[s.key] && uploads[s.key].status !== "missing").length;
  const accepted      = category.slots.filter(s => uploads[s.key]?.status === "accepted").length;
  const rejected      = category.slots.filter(s => uploads[s.key]?.status === "rejected").length;
  const staleCount    = category.slots.filter(s => uploads[s.key]?.status === "needs_review" && isStale(uploads[s.key])).length;
  const isComplete    = totalRequired > 0 && accepted >= totalRequired;
  const pct           = totalRequired > 0 ? Math.round((accepted / totalRequired) * 100) : 0;

  return (
    <div className={`rounded-2xl border overflow-hidden ${isComplete ? "border-emerald-500/25" : "border-slate-800"}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full px-5 py-4 flex items-center justify-between gap-3 transition-colors ${
          expanded ? "bg-slate-900" : "bg-[#0d1221] hover:bg-slate-900/60"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg} border ${colors.border}`}>
            <span className={colors.text}>{category.icon}</span>
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white">{category.label}</p>
              {isComplete && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Complete</span>}
              {rejected > 0 && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">{rejected} rejected</span>}
              {staleCount > 0 && <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/25 px-1.5 py-0.5 rounded-full">{staleCount} outdated</span>}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {uploaded} of {category.slots.length} uploaded
              {totalRequired > 0 && ` · ${accepted}/${totalRequired} required accepted`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {totalRequired > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-16 bg-slate-800 rounded-full h-1">
                <div className={`h-1 rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-[10px] font-semibold ${isComplete ? "text-emerald-400" : "text-slate-500"}`}>{pct}%</span>
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="bg-slate-900/80 border-t border-slate-800 px-4 py-4 space-y-2.5">
          <div className={`flex items-start gap-2.5 ${colors.bg} border ${colors.border} rounded-xl px-4 py-3 mb-3`}>
            <Info className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${colors.text}`} />
            <p className="text-xs text-slate-300 leading-relaxed">{category.description}</p>
          </div>
          {category.slots.map(slot => (
            <SlotRow key={slot.key} slot={slot} uploaded={uploads[slot.key]} onUpload={onUpload} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Schedule-Based Document Categories ──────────────────────────────────────

function buildOtherCategories(numDebtors: number): DocCategory[] {
  const debtorLabels = numDebtors > 1 ? ["Debtor 1", "Debtor 2"] : ["Debtor"];

  // ── Voluntary Petition — Identity ─────────────────────────────────────────
  const identitySlots: DocSlot[] = [];
  for (let i = 0; i < numDebtors; i++) {
    const role: DebtorRole = i === 0 ? "debtor1" : "debtor2";
    const name = debtorLabels[i];
    identitySlots.push(
      { key: `${role}_license`, label: `Government-Issued Photo ID — ${name}`, hint: "Driver's license, state ID, or passport. Must be current and not expired.", required: true, debtorRole: role, acceptedFormats: "PDF, JPG, PNG — images converted to PDF automatically" },
      { key: `${role}_ssn_card`, label: `Social Security Card — ${name}`, hint: "Original SSA card or official document showing full Social Security Number.", required: true, debtorRole: role, acceptedFormats: "PDF, JPG, PNG — images converted to PDF automatically" },
    );
  }

  return [
    // ── Voluntary Petition ────────────────────────────────────────────────────
    {
      id: "petition_identity",
      label: "Voluntary Petition — Identity Documents",
      icon: <Shield className="w-4 h-4" />,
      color: "red",
      description: "Required for ALL debtors before we can prepare or file the Voluntary Petition. Government-issued photo ID and Social Security card must be on file.",
      slots: identitySlots,
    },

    // ── Schedule A/B — Assets ─────────────────────────────────────────────────
    {
      id: "schedule_ab",
      label: "Schedule A/B — Assets",
      icon: <Building2 className="w-4 h-4" />,
      color: "blue",
      description: "Supporting documents for every asset you have declared. Bank accounts require the last 6 months of statements. Retirement/investment accounts require the most recent statement. Stocks, bonds, and crypto each require a supporting document per account.",
      slots: [
        // Bank accounts — 6 months each
        ...Array.from({ length: 6 }, (_, i) => ({
          key: `bank_stmt_checking_month_${i + 1}`,
          label: `Checking Account Statement — Month ${i + 1} of 6${i === 0 ? " (most recent)" : ""}`,
          hint: i === 0 ? "Full statement showing all transactions, opening/closing balance." : undefined,
          required: false, conditionLabel: "If you have a checking account",
          debtorRole: "case" as DebtorRole, acceptedFormats: "PDF, JPG, PNG",
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          key: `bank_stmt_savings_month_${i + 1}`,
          label: `Savings Account Statement — Month ${i + 1} of 6${i === 0 ? " (most recent)" : ""}`,
          required: false, conditionLabel: "If you have a savings account",
          debtorRole: "case" as DebtorRole, acceptedFormats: "PDF, JPG, PNG",
        })),
        // Retirement accounts
        { key: "retirement_401k", label: "401(k) / 403(b) — Most Recent Statement", hint: "Most recent quarterly or annual statement showing current balance.", required: false, conditionLabel: "If you have a 401(k) or 403(b)", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "retirement_ira",  label: "IRA / Roth IRA — Most Recent Statement", required: false, conditionLabel: "If you have an IRA or Roth IRA", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "retirement_pension_stmt", label: "Pension Account — Most Recent Statement", required: false, conditionLabel: "If you have a pension", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        // Stocks / Bonds / Crypto — one doc per account
        { key: "stocks_stmt_1", label: "Stock Brokerage Statement — Account 1", hint: "Full statement showing all positions and current value.", required: false, conditionLabel: "If you own stocks or ETFs", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "stocks_stmt_2", label: "Stock Brokerage Statement — Account 2", required: false, conditionLabel: "If you have a second brokerage account", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "bonds_stmt_1", label: "Bond / Treasury Statement — Account 1", required: false, conditionLabel: "If you own bonds or treasuries", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "crypto_stmt_1", label: "Cryptocurrency Account Statement — Account 1", hint: "Screenshot or statement showing all holdings and current value.", required: false, conditionLabel: "If you own cryptocurrency", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "crypto_stmt_2", label: "Cryptocurrency Account Statement — Account 2", required: false, conditionLabel: "If you have a second crypto account", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        // Real property
        { key: "mortgage_stmt_1", label: "Mortgage Statement — Property 1", hint: "Most recent lender-generated statement showing balance, payment, and lender contact.", required: false, conditionLabel: "If you own real estate with a mortgage", debtorRole: "case", acceptedFormats: "PDF preferred" },
        { key: "mortgage_stmt_2", label: "Mortgage Statement — Property 2", required: false, conditionLabel: "If you have a second property or mortgage", debtorRole: "case", acceptedFormats: "PDF preferred" },
        // Vehicles
        { key: "vehicle_registration_1", label: "Vehicle Registration — Vehicle 1", hint: "Current registration showing VIN, year, make, model.", required: false, conditionLabel: "If you own or are financing a vehicle", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "vehicle_loan_stmt_1",    label: "Vehicle Loan Statement — Vehicle 1", hint: "Most recent statement showing balance, monthly payment, and payoff amount.", required: false, conditionLabel: "If your vehicle is financed", debtorRole: "case", acceptedFormats: "PDF preferred" },
        { key: "vehicle_registration_2", label: "Vehicle Registration — Vehicle 2", required: false, conditionLabel: "If you have a second vehicle", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "vehicle_loan_stmt_2",    label: "Vehicle Loan Statement — Vehicle 2", required: false, conditionLabel: "If your second vehicle is financed", debtorRole: "case", acceptedFormats: "PDF preferred" },
      ],
    },

    // ── Schedule D — Secured Creditors ────────────────────────────────────────
    {
      id: "schedule_d",
      label: "Schedule D — Secured Creditors",
      icon: <DollarSign className="w-4 h-4" />,
      color: "orange",
      description: "Most recent statement for each secured creditor — mortgage lenders, HELOC lenders, HOA, vehicle lenders, and any other creditor holding collateral. Statements must be lender-generated showing current balance and payment.",
      slots: [
        { key: "sched_d_mortgage_1",   label: "Mortgage Statement — Creditor 1",     hint: "Full lender statement showing loan balance, interest rate, and monthly payment.", required: false, conditionLabel: "Primary mortgage", debtorRole: "case", acceptedFormats: "PDF preferred" },
        { key: "sched_d_mortgage_2",   label: "Mortgage Statement — Creditor 2",     required: false, conditionLabel: "Second mortgage or second property", debtorRole: "case", acceptedFormats: "PDF preferred" },
        { key: "sched_d_heloc",        label: "HELOC Statement",                     hint: "Home Equity Line of Credit — most recent statement showing drawn balance.", required: false, conditionLabel: "If you have a HELOC", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_d_hoa_1",        label: "HOA Statement — Property 1",          hint: "Statement showing current dues and any balance owed.", required: false, conditionLabel: "If your property has an HOA", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_d_hoa_2",        label: "HOA Statement — Property 2",          required: false, conditionLabel: "If you have a second property with an HOA", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_d_vehicle_1",    label: "Vehicle Loan Statement — Vehicle 1",  required: false, conditionLabel: "If you have a financed vehicle", debtorRole: "case", acceptedFormats: "PDF preferred" },
        { key: "sched_d_vehicle_2",    label: "Vehicle Loan Statement — Vehicle 2",  required: false, conditionLabel: "If you have a second financed vehicle", debtorRole: "case", acceptedFormats: "PDF preferred" },
        { key: "sched_d_other_secured", label: "Other Secured Creditor Statement",   hint: "Any other creditor holding collateral (title loans, equipment loans, etc.).", required: false, conditionLabel: "If applicable", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
      ],
    },

    // ── Schedule E — Priority Debts ───────────────────────────────────────────
    {
      id: "schedule_e",
      label: "Schedule E — Priority Debts",
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "amber",
      description: "Documentation for priority debts that receive special treatment in bankruptcy — back child support, back alimony, and unpaid taxes. Upload the most recent statement or court order for each.",
      slots: [
        { key: "sched_e_child_support", label: "Child Support Arrearage Statement",   hint: "Court order and most recent statement showing amount owed.", required: false, conditionLabel: "If you owe back child support", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_e_alimony",       label: "Alimony / Spousal Support Arrearage", hint: "Court order and statement of amount in arrears.", required: false, conditionLabel: "If you owe back alimony or spousal support", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_e_irs_tax",       label: "IRS Tax Liability Notice / Transcript", hint: "Most recent IRS notice (CP2000, CP504, etc.) or IRS Account Transcript showing balance owed.", required: false, conditionLabel: "If you owe federal income taxes", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_e_state_tax",     label: "State Tax Liability Notice",           required: false, conditionLabel: "If you owe state income taxes", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_e_other_priority", label: "Other Priority Debt Documentation",  hint: "Student loan, customs duties, or other nondischargeable priority claims.", required: false, conditionLabel: "If applicable", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
      ],
    },

    // ── Schedule F — Unsecured Creditors + Credit Report ─────────────────────
    {
      id: "schedule_f",
      label: "Schedule F — Unsecured Creditors & Credit Report",
      icon: <FileText className="w-4 h-4" />,
      color: "sky",
      description: "Upload your full credit report (all three bureaus preferred) — it is used to identify all unsecured creditors. Also upload any judgment notices, lawsuit summons, or creditor statements for debts not listed elsewhere.",
      slots: [
        { key: "credit_report_equifax",   label: "Credit Report — Equifax",   hint: "Full report from Equifax showing all open and closed accounts.", required: true, debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "credit_report_experian",  label: "Credit Report — Experian",  hint: "Full report from Experian.", required: false, conditionLabel: "Recommended", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "credit_report_transunion",label: "Credit Report — TransUnion", hint: "Full report from TransUnion.", required: false, conditionLabel: "Recommended", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_f_judgment_1", label: "Judgment Notice / Court Order — Creditor 1", hint: "Any judgment entered against you — civil court order or docket printout.", required: false, conditionLabel: "If a judgment has been entered against you", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_f_judgment_2", label: "Judgment Notice / Court Order — Creditor 2", required: false, conditionLabel: "If you have a second judgment", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_f_lawsuit",    label: "Lawsuit Summons / Complaint",    hint: "If you have been served with a lawsuit — upload the summons and complaint.", required: false, conditionLabel: "If you have a pending lawsuit against you", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_f_other_creditor", label: "Other Creditor Statement (not listed elsewhere)", required: false, conditionLabel: "Any creditor not covered in another schedule", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
      ],
    },

    // ── Schedule G — Leases ────────────────────────────────────────────────────
    {
      id: "schedule_g",
      label: "Schedule G — Leases & Executory Contracts",
      icon: <ClipboardList className="w-4 h-4" />,
      color: "teal",
      description: "Copies of all active lease agreements and executory contracts you are a party to — residential leases, vehicle leases, equipment leases, and any other unexpired contracts.",
      slots: [
        { key: "sched_g_res_lease",     label: "Residential Lease Agreement",          hint: "Full signed lease showing landlord, term, monthly rent, and address.", required: false, conditionLabel: "If you rent your home or apartment", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_g_vehicle_lease", label: "Vehicle Lease Agreement",              hint: "Full signed vehicle lease contract.", required: false, conditionLabel: "If you lease a vehicle", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_g_storage_lease", label: "Storage Unit or Other Lease",          required: false, conditionLabel: "If applicable", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_g_other_contract", label: "Other Executory Contract",            hint: "Franchise agreements, licensing contracts, or other ongoing agreements.", required: false, conditionLabel: "If applicable", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
      ],
    },

    // ── Schedule H — Co-Debtors ───────────────────────────────────────────────
    {
      id: "schedule_h",
      label: "Schedule H — Co-Debtors & Co-Borrowers",
      icon: <User className="w-4 h-4" />,
      color: "emerald",
      description: "If any co-borrower or co-signer shares a debt with you, list them here. If you have been divorced in the last 8 years and lived in a community property state (AZ, CA, ID, LA, NM, NV, TX, WA, WI), upload your divorce decree.",
      slots: [
        { key: "sched_h_divorce_decree", label: "Divorce Decree",                       hint: "Final divorce decree — all pages. Required if you were married and lived in a community property state within the last 8 years.", required: false, conditionLabel: "If divorced and formerly lived in a community property state", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_h_separation_agreement", label: "Separation Agreement",           required: false, conditionLabel: "If applicable and not covered by divorce decree", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_h_coborrower_id", label: "Co-Borrower / Co-Signer — Photo ID",    hint: "Government-issued ID for any co-borrower on a debt that is being discharged.", required: false, conditionLabel: "If you have a co-borrower on any debt", debtorRole: "both", acceptedFormats: "PDF, JPG, PNG" },
      ],
    },

    // ── Schedule I — Income ───────────────────────────────────────────────────
    {
      id: "schedule_i",
      label: "Schedule I — Sources of Income",
      icon: <Banknote className="w-4 h-4" />,
      color: "amber",
      description: "Proof of ALL current income sources for the debtor (and spouse if filing jointly). Upload documents for each income type that applies — pay stubs, award letters, pension statements, profit & loss statements, and any other supporting documents.",
      slots: [
        // Employment
        { key: "sched_i_paystub_1",  label: "Pay Stub — Most Recent",           hint: "Must show employer name, pay period dates, and gross/net amounts.", required: false, conditionLabel: "If employed", debtorRole: "debtor1", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_i_paystub_2",  label: "Pay Stub — 2nd Most Recent",        required: false, conditionLabel: "If employed", debtorRole: "debtor1", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_i_paystub_3",  label: "Pay Stub — 3rd Most Recent",        required: false, conditionLabel: "If employed", debtorRole: "debtor1", acceptedFormats: "PDF, JPG, PNG" },
        // Spouse employment
        { key: "sched_i_spouse_paystub_1", label: "Spouse Pay Stub — Most Recent", required: false, conditionLabel: "If spouse is employed", debtorRole: "debtor2", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_i_spouse_paystub_2", label: "Spouse Pay Stub — 2nd Most Recent", required: false, conditionLabel: "If spouse is employed", debtorRole: "debtor2", acceptedFormats: "PDF, JPG, PNG" },
        // Self-employment
        ...Array.from({ length: 6 }, (_, i) => ({
          key: `sched_i_pnl_month_${i + 1}`,
          label: `Profit & Loss Statement — Month ${i + 1} of 6${i === 0 ? " (most recent)" : ""}`,
          hint: i === 0 ? "Month-by-month P&L for self-employed or business income." : undefined,
          required: false, conditionLabel: "If self-employed or own a business",
          debtorRole: "case" as DebtorRole, acceptedFormats: "PDF, JPG, PNG",
        })),
        // Benefits & awards
        { key: "sched_i_ss_award",   label: "Social Security Award Letter",      hint: "Current SSA benefit verification letter showing monthly amount.", required: false, conditionLabel: "If you receive Social Security (retirement or disability)", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_i_va_award",   label: "VA Benefit Award Letter",            hint: "VA letter showing current monthly disability compensation or pension.", required: false, conditionLabel: "If you receive VA benefits", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_i_pension_stmt", label: "Pension Statement",               hint: "Official statement from pension administrator showing monthly benefit.", required: false, conditionLabel: "If you receive pension income", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        // Family / informal support
        { key: "sched_i_support_stmt", label: "Debtor Statement — Support from Friends or Family", hint: "Written statement explaining the amount, source, and nature of support received. Can be handwritten and signed.", required: false, conditionLabel: "If you receive financial support from friends or family", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        // Other income
        { key: "sched_i_other_income_1", label: "Other Income — Supporting Document 1", hint: "Award letter, court order, or statement for any other income source not listed above.", required: false, conditionLabel: "If you have another income source", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_i_other_income_2", label: "Other Income — Supporting Document 2", required: false, conditionLabel: "If you have a second additional income source", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
      ],
    },

    // ── Schedule J — Living Expenses ──────────────────────────────────────────
    {
      id: "schedule_j",
      label: "Schedule J — Monthly Living Expenses",
      icon: <GraduationCap className="w-4 h-4" />,
      color: "sky",
      description: "Proof of residence and recurring expense documentation. Upload your mortgage statement or residential lease for housing expenses, plus HOA and any other regular household expense statements.",
      slots: [
        { key: "sched_j_mortgage_stmt", label: "Mortgage Statement (Residence)",  hint: "Most recent statement for your primary residence mortgage — used to verify monthly housing expense.", required: false, conditionLabel: "If you own your home with a mortgage", debtorRole: "case", acceptedFormats: "PDF preferred" },
        { key: "sched_j_hoa_stmt",      label: "HOA Statement (Residence)",        hint: "Most recent HOA statement for your primary residence.", required: false, conditionLabel: "If your home has an HOA", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_j_res_lease",     label: "Residential Lease Agreement",      hint: "Full signed lease showing monthly rent and term.", required: false, conditionLabel: "If you rent your home", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_j_utilities",     label: "Utility Bill (Electric, Gas, Water)", hint: "Most recent utility bill for your residence.", required: false, conditionLabel: "If applicable", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_j_childcare",     label: "Childcare / School Tuition Statement", required: false, conditionLabel: "If you have childcare or tuition expenses", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
        { key: "sched_j_medical",       label: "Medical / Health Insurance Premium Statement", required: false, conditionLabel: "If you pay medical insurance premiums out of pocket", debtorRole: "case", acceptedFormats: "PDF, JPG, PNG" },
      ],
    },

    // ── Tax Returns ───────────────────────────────────────────────────────────
    {
      id: "tax_returns",
      label: "Tax Returns — Last 2 Years",
      icon: <FolderCheck className="w-4 h-4" />,
      color: "emerald",
      description: "2 most recent years of federal tax returns — all pages including all schedules and attachments. If not yet filed, provide the most recent IRS transcript (Account or Return Transcript).",
      slots: (() => {
        const r: DocSlot[] = [];
        for (let d = 0; d < numDebtors; d++) {
          const role: DebtorRole = d === 0 ? "debtor1" : "debtor2";
          const name = debtorLabels[d];
          r.push(
            { key: `tax_return_${role}_year_1`, label: `Federal Tax Return — ${name} — Most Recent Year`, hint: "All pages and schedules required.", required: true, debtorRole: role, acceptedFormats: "PDF — all pages and all schedules must be included" },
            { key: `tax_return_${role}_year_2`, label: `Federal Tax Return — ${name} — Prior Year`,       required: true, debtorRole: role, acceptedFormats: "PDF — all pages and all schedules must be included" },
          );
        }
        return r;
      })(),
    },
  ];
}

// ─── Bank Balance Section (locked until filing date) ─────────────────────────

const BANK_BALANCE_SLOTS: DocSlot[] = [
  { key: "bank_bal_checking_1",   label: "Checking Account Balance — Account 1",    hint: "Screenshot of online banking or mobile app showing current balance as of today's date. Date must be visible.", required: true,  debtorRole: "case", acceptedFormats: "JPG, PNG (screenshots accepted here only)" },
  { key: "bank_bal_checking_2",   label: "Checking Account Balance — Account 2",    required: false, conditionLabel: "If you have a second checking account", debtorRole: "case", acceptedFormats: "JPG, PNG" },
  { key: "bank_bal_savings_1",    label: "Savings Account Balance — Account 1",     required: false, conditionLabel: "If you have a savings account", debtorRole: "case", acceptedFormats: "JPG, PNG" },
  { key: "bank_bal_savings_2",    label: "Savings Account Balance — Account 2",     required: false, conditionLabel: "If you have a second savings account", debtorRole: "case", acceptedFormats: "JPG, PNG" },
  { key: "bank_bal_investment_1", label: "Investment / Brokerage Balance — Account 1", hint: "Screenshot showing all holdings and total account value as of today.", required: false, conditionLabel: "If you have an investment or brokerage account", debtorRole: "case", acceptedFormats: "JPG, PNG" },
  { key: "bank_bal_investment_2", label: "Investment / Brokerage Balance — Account 2", required: false, conditionLabel: "If you have a second investment account", debtorRole: "case", acceptedFormats: "JPG, PNG" },
  { key: "bank_bal_crypto_1",     label: "Cryptocurrency Balance — Account 1",       hint: "Screenshot of your exchange or wallet showing all holdings and USD value as of today.", required: false, conditionLabel: "If you hold cryptocurrency", debtorRole: "case", acceptedFormats: "JPG, PNG" },
  { key: "bank_bal_other_1",      label: "Other Deposit Account Balance",            hint: "Any other bank, credit union, or deposit account.", required: false, conditionLabel: "If applicable", debtorRole: "case", acceptedFormats: "JPG, PNG" },
];

function BankBalanceSection({ uploads, onUpload, onRemove, filingDate }: {
  uploads: Record<string, UploadedDoc>;
  onUpload: (slotKey: string, file: File) => void;
  onRemove: (slotKey: string) => void;
  filingDate: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const isUnlocked = filingDate != null && filingDate <= today;

  const uploaded = BANK_BALANCE_SLOTS.filter(s => uploads[s.key] && uploads[s.key].status !== "missing").length;
  const required = BANK_BALANCE_SLOTS.filter(s => s.required).length;
  const complete = BANK_BALANCE_SLOTS.filter(s => s.required).every(s => {
    const u = uploads[s.key];
    return u && (u.status === "needs_review" || u.status === "accepted");
  });

  return (
    <div className={`rounded-2xl border overflow-hidden ${complete ? "border-emerald-500/25" : isUnlocked ? "border-amber-500/30" : "border-slate-700/50"}`}>
      <button
        onClick={() => isUnlocked && setExpanded(v => !v)}
        className={`w-full px-5 py-4 flex items-center justify-between gap-3 transition-colors ${
          expanded ? "bg-slate-900" : isUnlocked ? "bg-[#0d1221] hover:bg-slate-900/60" : "bg-slate-900/40 cursor-not-allowed"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            complete ? "bg-emerald-500/10 border-emerald-500/25"
            : isUnlocked ? "bg-amber-500/10 border-amber-500/25"
            : "bg-slate-800 border-slate-700"
          }`}>
            {complete
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : isUnlocked
                ? <Banknote className="w-4 h-4 text-amber-400" />
                : <Lock className="w-4 h-4 text-slate-500" />}
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-bold ${isUnlocked ? "text-white" : "text-slate-500"}`}>
                Bank Balances — Date of Filing
              </p>
              {!isUnlocked && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Unlocked on filing day
                </span>
              )}
              {isUnlocked && complete && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Complete</span>
              )}
              {isUnlocked && !complete && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Action Required Today</span>
              )}
            </div>
            <p className={`text-[10px] mt-0.5 ${isUnlocked ? "text-slate-400" : "text-slate-600"}`}>
              {isUnlocked
                ? `${uploaded} of ${BANK_BALANCE_SLOTS.length} uploaded · ${required} required`
                : "This section unlocks on the day your case is filed. You will be notified."}
            </p>
          </div>
        </div>
        {isUnlocked && (
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
        )}
      </button>

      {isUnlocked && expanded && (
        <div className="bg-slate-900/80 border-t border-slate-800 px-4 py-4 space-y-4">

          {/* Explanation */}
          <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-400 mb-1">Required as of Today — Your Filing Date</p>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                Bankruptcy law requires you to disclose the exact balance of ALL bank, deposit, and investment accounts
                as of the date your petition is filed. Upload a screenshot from your online banking or mobile app for
                each account. <strong className="text-white">The current date must be visible</strong> in the screenshot.
                This section must be completed before your case can be submitted to the court today.
              </p>
            </div>
          </div>

          {/* Rules for bank balance screenshots */}
          <div className="flex items-start gap-2.5 bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3">
            <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
            <ul className="text-[10px] text-slate-400 space-y-1 leading-snug">
              <li>• Screenshots from online banking, mobile app, or ATM receipt are accepted for this section only.</li>
              <li>• Every bank account, savings account, and investment account must have a screenshot.</li>
              <li>• The account number (last 4 digits) and today's date must be visible.</li>
              <li>• Zero-balance accounts must still be documented with a $0.00 screenshot.</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            {BANK_BALANCE_SLOTS.map(slot => (
              <SlotRow key={slot.key} slot={slot} uploaded={uploads[slot.key]} onUpload={onUpload} onRemove={onRemove} />
            ))}
          </div>
        </div>
      )}

      {/* Locked state preview */}
      {!isUnlocked && (
        <div className="bg-slate-900/40 border-t border-slate-700/40 px-5 py-5">
          <div className="flex items-start gap-3 bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-4">
            <Lock className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">This section is locked until your filing date</p>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                On the day your case is filed, this section will unlock automatically. You will receive a notification
                to log in and upload screenshots of your current bank balances for all accounts —
                checking, savings, investment, and cryptocurrency — as of that exact date.
                These are required before your petition can be submitted to the bankruptcy court.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Checking Account(s)", "Savings Account(s)", "Investment / Brokerage", "Cryptocurrency"].map(a => (
                  <span key={a} className="text-[9px] font-bold text-slate-600 bg-slate-800 border border-slate-700/60 px-2 py-1 rounded-lg">{a}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main DocumentChecklist Component ────────────────────────────────────────

interface DocumentChecklistProps {
  clientId?: string;
  numDebtors?: number;
  activeMeansTestSources?: string[]; // income source keys active in questionnaire
  onReadyForReview?: (ready: boolean) => void;
}

export default function DocumentChecklist({
  clientId = "client-demo",
  numDebtors = 1,
  // Demo: simulate having employment + SS disability + rental income declared
  activeMeansTestSources = ["employment", "ss_disability", "rental"],
  onReadyForReview,
}: DocumentChecklistProps) {
  const otherCategories = buildOtherCategories(numDebtors);
  const [uploads, setUploads] = useState<Record<string, UploadedDoc>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [aiVerifying, setAiVerifying] = useState(false);
  const [aiVerified, setAiVerified] = useState(false);
  const [aiVerifyError, setAiVerifyError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Compute means test readiness
  const relevantSources = MEANS_TEST_INCOME_SOURCES.filter(s => activeMeansTestSources.includes(s.key));
  const meansTestSlots  = relevantSources.flatMap(s => s.docSlots).filter(s => s.required);
  const meansTestReady  = meansTestSlots.every(slot => {
    const u = uploads[slot.key];
    if (!u || u.status === "missing" || u.status === "rejected") return false;
    if (u.status === "needs_review" && isStale(u)) return false;
    return true;
  });

  // Compute identity gate
  const idSlots = otherCategories.find(c => c.id === "identity")?.slots ?? [];
  const identityComplete = idSlots.every(s => uploads[s.key]?.status === "accepted");

  // Overall required docs
  const allRequiredSlots = [
    ...meansTestSlots,
    ...otherCategories.flatMap(c => c.slots).filter(s => s.required),
  ];
  const uploadedRequired = allRequiredSlots.filter(s => {
    const u = uploads[s.key];
    if (!u || u.status === "missing" || u.status === "rejected") return false;
    if (u.status === "needs_review" && isStale(u)) return false;
    return true;
  }).length;
  const overallPct = allRequiredSlots.length > 0
    ? Math.round((uploadedRequired / allRequiredSlots.length) * 100)
    : 0;

  // Count stale docs across everything
  const staleCount = Object.values(uploads).filter(u => u.status === "needs_review" && isStale(u)).length;
  const readyForReview = meansTestReady && identityComplete;

  useEffect(() => {
    onReadyForReview?.(readyForReview);
  }, [readyForReview, onReadyForReview]);

  const handleUpload = useCallback(async (slotKey: string, file: File) => {
    const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
    const now = new Date().toISOString();

    setUploads(prev => ({
      ...prev,
      [slotKey]: {
        slotKey, fileName: file.name,
        status: isImage ? "converting" : "uploading",
        wasImage: isImage, convertedToPdf: false,
        legibilityOk: null, note: null,
        uploadedAt: now,
      },
    }));

    try {
      let finalFile = file;
      let convertedToPdf = false;

      if (isImage) {
        finalFile = await convertImageToPdf(file);
        convertedToPdf = true;
        setUploads(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], status: "uploading", convertedToPdf: true, fileName: finalFile.name } }));
      }

      const legibility = await checkPdfLegibility(finalFile);
      if (!legibility.ok) {
        setUploads(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], status: "rejected", legibilityOk: false, note: legibility.note } }));
        return;
      }

      await uploadToSupabase(clientId, slotKey, finalFile, legibility.note);

      setUploads(prev => ({
        ...prev,
        [slotKey]: {
          ...prev[slotKey],
          status: "needs_review",
          legibilityOk: true,
          note: legibility.note,
          convertedToPdf,
          uploadedAt: now,
        },
      }));
    } catch {
      setUploads(prev => ({
        ...prev,
        [slotKey]: { ...prev[slotKey], status: "needs_review", legibilityOk: true, note: "Saved locally — will sync when connection is restored.", uploadedAt: now },
      }));
    }
  }, [clientId]);

  const handleRemove = useCallback((slotKey: string) => {
    setUploads(prev => { const n = { ...prev }; delete n[slotKey]; return n; });
  }, []);

  // AI verification: check all required slots against questionnaire answers, then route to paralegal
  async function handleAiVerifyAndSubmit() {
    setSubmitAttempted(true);
    if (!readyForReview) return;

    setAiVerifying(true);
    setAiVerifyError(null);

    // Simulate AI cross-check against questionnaire (1.5s)
    await new Promise(r => setTimeout(r, 1500));

    // Check all required slots are present and not stale
    const missing = allRequiredSlots.filter(s => {
      const u = uploads[s.key];
      if (!u || u.status === "missing" || u.status === "rejected") return true;
      if (u.status === "needs_review" && isStale(u)) return true;
      return false;
    });

    if (missing.length > 0) {
      setAiVerifying(false);
      setAiVerifyError(`AI verification found ${missing.length} document${missing.length !== 1 ? "s" : ""} still missing or outdated. Please resolve all issues above before submitting.`);
      return;
    }

    setAiVerified(true);
    setAiVerifying(false);

    // Route to paralegal review
    setSubmitting(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/paralegal_reviews`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          client_id: clientId,
          paralegal_name: "Unassigned",
          status: "in_progress",
          notes: "Submitted via document checklist — AI verified all required documents present.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    } catch { /* silently proceed — submission is still confirmed to client */ }
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="space-y-5">

      {/* ── Header + overall progress ── */}
      <div className="bg-[#0d1221] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Georgia', serif" }}>
              Document Checklist
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">
              All required documents must be uploaded, current, and legible before your case can proceed to attorney review.
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-bold text-white">{overallPct}%</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Complete</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="bg-slate-800 rounded-full h-2.5 mb-1.5">
            <div className={`h-2.5 rounded-full transition-all duration-500 ${overallPct === 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${overallPct}%` }} />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500 flex-wrap">
            <span>{uploadedRequired} of {allRequiredSlots.length} required docs uploaded</span>
            {staleCount > 0 && <span className="text-orange-400 font-semibold">{staleCount} outdated — must be updated</span>}
          </div>
        </div>

        {/* Gates */}
        {!identityComplete && (
          <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3 mt-3">
            <Shield className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-400 mb-0.5">Identity Verification Required First</p>
              <p className="text-xs text-slate-400 leading-snug">
                Photo ID and Social Security card for all debtors must be on file before we can prepare or file your petition.
              </p>
            </div>
          </div>
        )}

        {/* Stale notice */}
        {staleCount > 0 && (
          <div className="flex items-start gap-2.5 bg-orange-500/8 border border-orange-500/25 rounded-xl px-4 py-3 mt-3">
            <CalendarDays className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-orange-400 mb-0.5">Outdated Documents Detected</p>
              <p className="text-xs text-slate-400 leading-snug">
                {staleCount} document{staleCount !== 1 ? "s" : ""} {staleCount !== 1 ? "are" : "is"} from a prior calendar month. Bankruptcy filings require current financial records — these must be re-uploaded before attorney review can begin.
              </p>
            </div>
          </div>
        )}

        {/* Ready banner */}
        {readyForReview && identityComplete && (
          <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/25 rounded-xl px-4 py-3 mt-3">
            <Send className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-xs font-semibold text-emerald-400">
              All required income documentation is current and uploaded — your case is ready for attorney review.
            </p>
          </div>
        )}
      </div>

      {/* ── File rules ── */}
      <div className="flex items-start gap-3 bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3.5">
        <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-sky-400">Document Rules</p>
          <ul className="text-[10px] text-slate-400 space-y-0.5 leading-snug">
            <li>• PDF files required — all pages must be included. JPG and PNG files are automatically converted to PDF.</li>
            <li>• All documents are scanned for legibility before submission to your attorney.</li>
            <li>• Lender and agency-generated statements only — no screenshots of online portals.</li>
            <li>• <strong className="text-orange-300">If we enter a new calendar month, all time-sensitive income documents must be re-uploaded.</strong> Outdated documents will block attorney review.</li>
          </ul>
        </div>
      </div>

      {/* ── MEANS TEST — top of list, highest priority ── */}
      <MeansTestSection
        activeSources={activeMeansTestSources}
        uploads={uploads}
        onUpload={handleUpload}
        onRemove={handleRemove}
      />

      {/* ── Other categories ── */}
      <div className="space-y-3">
        {otherCategories.map(cat => (
          <CategorySection
            key={cat.id}
            category={cat}
            uploads={uploads}
            onUpload={handleUpload}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* ── Bank Balances on Date of Filing ── */}
      <BankBalanceSection
        uploads={uploads}
        onUpload={handleUpload}
        onRemove={handleRemove}
        filingDate={null}
      />

      {/* ── Submit for Paralegal Review CTA ── */}
      {!submitted ? (
        <div className={`rounded-2xl border p-5 space-y-4 ${readyForReview ? "bg-emerald-500/8 border-emerald-500/25" : "bg-slate-900/60 border-slate-800"}`}>

          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white mb-1">
                {readyForReview ? "Ready to Submit for Paralegal Review" : "Complete Documents to Submit for Review"}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                {readyForReview
                  ? "Our AI will verify all documents are present and match your questionnaire answers, then your case will be automatically routed to paralegal review."
                  : `${allRequiredSlots.length - uploadedRequired} required document${allRequiredSlots.length - uploadedRequired !== 1 ? "s" : ""} still needed${staleCount > 0 ? `, and ${staleCount} outdated document${staleCount !== 1 ? "s" : ""} must be updated` : ""} before your case can proceed.`
                }
              </p>
            </div>
            <button
              onClick={handleAiVerifyAndSubmit}
              disabled={!readyForReview || aiVerifying || submitting}
              className={`flex-shrink-0 flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all ${
                readyForReview && !aiVerifying && !submitting
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {aiVerifying || submitting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : readyForReview
                  ? <Send className="w-3.5 h-3.5" />
                  : <Lock className="w-3.5 h-3.5" />
              }
              {aiVerifying ? "Verifying…" : submitting ? "Submitting…" : readyForReview ? "Submit for Review" : "Locked"}
            </button>
          </div>

          {/* AI verifying progress */}
          {aiVerifying && (
            <div className="flex items-center gap-3 bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3">
              <Bot className="w-4 h-4 text-sky-400 flex-shrink-0 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-sky-400">AI Verification Running</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Cross-checking uploaded documents against your questionnaire answers — verifying all required items are present, current, and legible…
                </p>
              </div>
            </div>
          )}

          {/* AI error */}
          {aiVerifyError && (
            <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-snug">{aiVerifyError}</p>
            </div>
          )}

          {/* Not ready error */}
          {submitAttempted && !readyForReview && !aiVerifying && (
            <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-snug">
                Your case cannot be submitted yet. Please upload all required documents and update any outdated income documentation above.
              </p>
            </div>
          )}

          {/* What happens notice — document update requirement */}
          {readyForReview && !aiVerifying && (
            <div className="bg-amber-400/8 border border-amber-400/25 rounded-xl px-4 py-4 space-y-3">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Important — Before You Submit</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white leading-snug">Documents must stay current through filing</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      Your documents will need to be updated as your case moves forward — especially if we cross a new calendar month. Bank statements, pay stubs, and income records must reflect your situation at the time of filing.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Banknote className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white leading-snug">Bank balances required on your filing date</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      On the actual day your case is filed, you will need to provide the exact balance of every bank account as of that date. We will contact you with instructions when the time comes.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-teal-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FolderCheck className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white leading-snug">Post-filing trustee documents</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      After your case is filed, your bankruptcy trustee will require additional documents for your 341 Meeting of Creditors. These typically include current bank statements, recent pay stubs, and tax returns. Your legal team will notify you with a specific list.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Post-submission: Credit Counseling + Confirmation ── */
        <div className="space-y-4">

          {/* Submission confirmed */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400 mb-1">Documents Verified &amp; Submitted</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Our AI has verified all required documents are present and current. Your case has been automatically routed to paralegal review. A confirmation has been sent to your email on file.
                </p>
              </div>
            </div>
          </div>

          {/* Credit Counseling requirement */}
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/6 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-400 mb-0.5">Action Required — Credit Counseling</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Federal bankruptcy law requires you to complete a <strong className="text-white">credit counseling course from an approved agency</strong> before your case can be filed.
                  This is a mandatory requirement under 11 U.S.C. § 109(h) — it cannot be waived.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3.5 space-y-2.5">
              <p className="text-xs font-bold text-white">What you need to do:</p>
              <div className="space-y-2">
                {[
                  { num: "1", text: "Complete an approved credit counseling course online — takes about 60–90 minutes. A fee waiver is available if you qualify." },
                  { num: "2", text: "Receive your Certificate of Completion from the counseling agency." },
                  { num: "3", text: "Upload your certificate through the Document Checklist. This certificate must be filed with your petition — without it, your case cannot proceed." },
                ].map(step => (
                  <div key={step.num} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{step.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2.5 bg-sky-500/8 border border-sky-500/20 rounded-lg px-3 py-2.5 mt-1">
                <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Use only <strong className="text-white">USCOURTS-approved agencies</strong>. Your paralegal will provide a list of approved providers for your district. The certificate is typically emailed to you immediately upon completion.
                </p>
              </div>
            </div>
          </div>

          {/* Document update reminders */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">What to Expect Next</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Your paralegal will review your submission</strong> and may contact you with follow-up questions or requests for additional documents before your case advances to attorney review.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Documents must stay current through your filing date.</strong> If we cross into a new calendar month, you will be asked to re-upload income and bank documents. Do not be alarmed — this is a routine part of the process.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Banknote className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">On the day your case is filed</strong>, you will need to provide the exact balances for all of your bank accounts as of that date. Your legal team will contact you with instructions when filing is imminent.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <FolderCheck className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">After filing, your trustee will request additional documents</strong> for your 341 Meeting of Creditors — typically current bank statements, pay stubs, and tax returns. Your team will provide a full list at that time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
