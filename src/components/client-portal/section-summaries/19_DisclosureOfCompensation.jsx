import React from "react";
import { FileSignature, Info, Lock } from "lucide-react";
import ConfirmFooter from "./ConfirmFooter";

/* Disclosure of Compensation of Attorney for Debtor — Official Form 2030.
   Signed/filed by the ATTORNEY (11 U.S.C. § 329(a), Fed. R. Bankr. P. 2016(b)).

   READ-ONLY PREVIEW for the client. The fee figures, case type, source of
   payment, fee-sharing posture, included/excluded services, and the
   attorney-fee balance are all entered by the firm in the system
   (AccountingPortal / case fee record). This component renders what the
   firm has saved to data.disclosureOfCompensation; if nothing is on file
   yet, it falls back to the per-case-type firm preset (a sample fee
   schedule). The client cannot edit any field here — they review the
   preview and confirm they understand what their attorney will sign and
   file on their behalf.

   ── Data source (today) ────────────────────────────────────────────────
   • data.disclosureOfCompensation.{caseType, agreed, received, source,
       sourceName, sourceRelationship, shared, services, excluded}
   • Fallback PRESETS keyed by data.disclosureOfCompensation.caseType or
       data.petition.chapter ("13" → ch13; else → ch7).

   ── Backend wiring (TODO BAN-XX) ───────────────────────────────────────
   The AccountingPortal fee record is the authoritative source of agreed +
   received amounts. When the firm posts a payment / changes the case fee
   schedule there, that update must MIRROR to
   data.disclosureOfCompensation.{agreed, received} so this preview reflects
   the current attorney-fee balance. Until that mirror lands, the firm's
   AllAnswersView write path on the attorney-review surface is the manual
   bridge.

   <DisclosureOfCompensation
     data={questionnaireData}
     onChange={() => {}}                  // unused in read-only mode
     confirmed={summaryConfirmed}
     onConfirm={onSummaryConfirm}
   /> */

const PRESETS = {
  ch7: { label: "Regular Chapter 7", agreed: 1800, received: 1800, note: "Flat fee — paid in full before filing (pre-petition Chapter 7 fees cannot be financed post-petition as a dischargeable balance)." },
  bifurcated: { label: "Bifurcated Chapter 7", agreed: 2200, received: 0, note: "Pre-petition portion $0; the balance is financed under a SEPARATE post-petition fee agreement and is not a pre-petition debt." },
  ch13: { label: "Chapter 13", agreed: 4500, received: 500, note: "Presumptively-reasonable (\"no-look\") fee; the balance is paid through the confirmed Chapter 13 plan." },
};
const SERVICES = [
  { k: "a", label: "Analysis of the debtor's financial situation and advice on whether to file" },
  { k: "b", label: "Preparation and filing of the petition, schedules, statement of affairs, and plan" },
  { k: "c", label: "Representation at the meeting of creditors and confirmation hearing (and adjournments)" },
  { k: "d", label: "Representation in adversary proceedings and other contested matters" },
];
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DisclosureOfCompensation({ data = {}, confirmed, onConfirm }) {
  const saved = data.disclosureOfCompensation || {};
  // Case type: saved → petition.chapter ("13" maps to ch13) → ch7.
  const caseType = saved.caseType || (String(data.petition?.chapter) === "13" ? "ch13" : "ch7");
  const preset = PRESETS[caseType] || PRESETS.ch7;

  // Pull from saved (firm-entered) values; fall back to preset (firm fee
  // schedule). The client can't change either here.
  const agreed = saved.agreed != null ? Number(saved.agreed) : preset.agreed;
  const received = saved.received != null ? Number(saved.received) : preset.received;
  const balance = Math.max(0, agreed - received);

  const source = saved.source || "Debtor";
  const sourceName = (saved.sourceName || "").trim();
  const sourceRelationship = (saved.sourceRelationship || "").trim();
  const shared = !!saved.shared;
  const services = saved.services || { a: true, b: true, c: true, d: false };
  const excluded = saved.excluded ?? "Adversary proceedings; non-dischargeability or relief-from-stay litigation (billed separately).";

  const sourceLine = source === "Other"
    ? (sourceName
        ? `${sourceName}${sourceRelationship ? ` (${sourceRelationship})` : ""}`
        : "Other — name pending (your attorney will fill this in before filing)")
    : "Debtor";

  return (
    <div className="docp">
      <Style />
      <h1><FileSignature size={21} style={{ verticalAlign: -3, marginRight: 8 }} />Disclosure of Compensation of Attorney</h1>
      <div className="form">Official Form 2030 · signed &amp; filed by the attorney · 11 U.S.C. § 329(a), Rule 2016(b)</div>

      {/* Plain-English explanation card — what this filing is and why the
          client can't edit it. */}
      <div className="explain">
        <div className="explain-h"><Info size={13} style={{ verticalAlign: -2, marginRight: 6 }} />What you're looking at</div>
        <p>
          This is a <b>preview</b> of the <b>Disclosure of Compensation</b> your attorney
          will sign and file with your case. Federal law requires the attorney to disclose
          to the court exactly what they've agreed to charge you, what they've already been
          paid, and the source of any payments — so the court can confirm the fee is
          reasonable.
        </p>
        <p>
          The figures below are auto-filled from your firm's fee record.{" "}
          <b>You cannot edit this form</b> — when your firm records a payment or updates
          your fee agreement, the balance below updates automatically. If anything looks
          wrong, contact your attorney.
        </p>
      </div>

      <div className="card readonly">
        <div className="ph">Case type — sets the fee schedule</div>
        <div className="ro-row">
          <Lock size={11} style={{ flexShrink: 0, color: "#94a3b8" }} />
          <span className="ro-label">{preset.label}</span>
        </div>
        <div className="micro"><Info size={11} style={{ verticalAlign: -1 }} /> {preset.note}</div>
      </div>

      <div className="card readonly">
        <div className="ph">1 · Compensation</div>
        <div className="feerow"><span>For legal services, I have agreed to accept</span><span className="amt">{money(agreed)}</span></div>
        <div className="feerow"><span>Prior to filing this statement I have received (paid by client)</span><span className="amt">{money(received)}</span></div>
        <div className="feerow total"><span>Balance Due</span><span className="amt big">{money(balance)}</span></div>
        <div className="micro">
          <Info size={11} style={{ verticalAlign: -1 }} /> Balance is auto-calculated from the firm's accounting record. As payments
          post, the balance shown here will decrease accordingly.
        </div>
      </div>

      <div className="card readonly">
        <div className="ph">2–3 · Source of compensation</div>
        <div className="ro-row">
          <Lock size={11} style={{ flexShrink: 0, color: "#94a3b8" }} />
          <span className="ro-label">{sourceLine}</span>
        </div>
        <div className="micro">
          Source of compensation paid and to be paid: <b>{sourceLine}</b>.
        </div>
      </div>

      <div className="card readonly">
        <div className="ph">4 · Fee sharing</div>
        <div className="ro-row">
          <Lock size={11} style={{ flexShrink: 0, color: "#94a3b8" }} />
          <span className="ro-label">
            {shared ? "Shared with others (agreement + names attached to filed form)" : "Not shared outside the firm"}
          </span>
        </div>
      </div>

      <div className="card readonly">
        <div className="ph">5 · Services included for the fee</div>
        {SERVICES.map((s) => (
          <div key={s.k} className="ro-line">
            <span className={"dot " + (services[s.k] ? "on" : "off")}>{services[s.k] ? "✓" : "—"}</span>
            <span className={"ro-line-label " + (services[s.k] ? "" : "muted")}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="card readonly">
        <div className="ph">6 · Services excluded from the fee</div>
        <div className="ro-text">{excluded || <span className="muted">None specified.</span>}</div>
      </div>

      <div className="summary">
        <div className="sum-h"><FileSignature size={16} /> Certification</div>
        <div className="sum-row"><span className="sum-q">Case type</span><span className="sum-a">{preset.label}</span></div>
        <div className="sum-row"><span className="sum-q">Agreed fee</span><span className="sum-a">{money(agreed)}</span></div>
        <div className="sum-row"><span className="sum-q">Paid by client (pre-filing)</span><span className="sum-a">{money(received)}</span></div>
        <div className="sum-row"><span className="sum-q">Balance due</span><span className="sum-a yes">{money(balance)}</span></div>
        <div className="sum-row"><span className="sum-q">Source</span><span className="sum-a">{sourceLine}</span></div>
        <div className="sign">
          I certify the foregoing is a complete statement of the agreement for payment to me for
          representing the debtor(s) in this case. Signed and filed by the attorney; the same fee
          figures flow to SOFA (payments to anyone consulted about bankruptcy).
        </div>
      </div>

      <ConfirmFooter
        confirmed={confirmed}
        onConfirm={onConfirm}
        sectionLabel="this fee disclosure (review only — your attorney files it)"
      />
    </div>
  );
}

function Style() {
  return <style>{`
    .docp * { box-sizing:border-box; }
    .docp {
      --accent:#fbbf24; --bg:#0d1221; --bg-2:#111827; --line:#1e293b; --line-soft:#162132;
      --ink:#e2e8f0; --muted:#94a3b8; --good:#4ade80; --good-bg:rgba(74,222,128,.12);
      --serif:'Fraunces',ui-serif,Georgia,'Times New Roman',serif;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
      color:var(--ink); background:transparent; padding:0; max-width:820px; margin:16px auto 0; }
    .docp h1 { font-family:var(--serif); font-weight:600; font-size:23px; margin:0; color:#fff; }
    .docp .form { color:var(--muted); font-size:13px; margin-top:2px; }
    .docp .explain { background:rgba(59,130,246,.06); border:1px solid rgba(59,130,246,.30); border-radius:10px; padding:13px 16px; margin-top:14px; font-size:12.5px; line-height:1.55; color:var(--ink); }
    .docp .explain p { margin:0 0 8px; } .docp .explain p:last-child { margin-bottom:0; }
    .docp .explain b { color:#fff; }
    .docp .explain-h { font-family:var(--serif); font-weight:600; font-size:13px; color:#93c5fd; text-transform:uppercase; letter-spacing:.04em; margin-bottom:7px; }
    .docp .card { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:6px 18px 14px; margin-top:14px; }
    .docp .card.readonly { background:rgba(15,23,42,.55); }
    .docp .ph { font-family:var(--serif); font-size:13px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 10px; border-bottom:1px solid var(--line); margin-bottom:10px; }
    .docp .micro { font-size:12px; color:var(--muted); margin-top:9px; line-height:1.5; } .docp .micro b { color:var(--ink); }
    .docp .ro-row { display:flex; gap:8px; align-items:center; padding:8px 11px; border:1px solid var(--line); border-radius:8px; background:var(--bg-2); font-size:13.5px; }
    .docp .ro-label { color:var(--ink); font-weight:500; }
    .docp .ro-line { display:flex; gap:9px; align-items:flex-start; padding:7px 11px; margin-bottom:5px; border:1px solid var(--line-soft); border-radius:7px; background:rgba(17,24,39,.55); }
    .docp .ro-line .dot { font-weight:700; font-size:13px; min-width:14px; text-align:center; }
    .docp .ro-line .dot.on { color:var(--good); } .docp .ro-line .dot.off { color:#475569; }
    .docp .ro-line-label { font-size:13px; color:var(--ink); }
    .docp .ro-line-label.muted { color:#64748b; text-decoration:line-through; }
    .docp .ro-text { font-size:13px; color:var(--ink); background:var(--bg-2); border:1px solid var(--line); border-radius:8px; padding:10px 12px; line-height:1.5; }
    .docp .ro-text .muted { color:var(--muted); font-style:italic; }
    .docp .feerow { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:9px 0; border-bottom:1px solid var(--line-soft); font-size:13.5px; }
    .docp .feerow:last-child { border-bottom:none; } .docp .feerow.total { font-weight:700; font-size:15px; padding-top:12px; }
    .docp .amt { font-weight:600; white-space:nowrap; color:var(--ink); }
    .docp .amt.big { color:var(--accent); font-family:var(--serif); font-size:20px; }
    .docp .summary { background:var(--bg); border:1px solid var(--accent); border-radius:12px; padding:16px 18px; margin-top:16px; }
    .docp .sum-h { font-family:var(--serif); font-weight:600; font-size:16px; display:flex; gap:8px; align-items:center; margin-bottom:8px; color:#fff; }
    .docp .sum-row { display:flex; justify-content:space-between; gap:14px; font-size:13.5px; padding:8px 0; border-bottom:1px solid var(--line-soft); } .docp .sum-q { font-weight:600; color:var(--ink); } .docp .sum-a { font-weight:600; color:var(--muted); } .docp .sum-a.yes { color:var(--accent); }
    .docp .sign { font-size:12.5px; color:var(--ink); background:var(--bg-2); border:1px solid var(--line); border-radius:8px; padding:11px 13px; margin-top:12px; line-height:1.5; }
  `}</style>;
}
