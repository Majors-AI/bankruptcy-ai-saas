import { useState, useMemo } from "react";
import { X, TrendingUp, TrendingDown, Minus, CreditCard as Edit3, Save, RotateCcw, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { sendSmsEmail } from "../../lib/sendGate";

const PERIOD_TO_MONTHLY: Record<string, number> = {
  Weekly: 4.333,
  "Bi-Weekly": 2.167,
  "Semi-Monthly": 2,
  Monthly: 1,
};

function srcMonthly(s: Record<string, unknown>): number {
  if (s.sourceType === "selfEmployment") {
    return (parseFloat(s.businessGrossIncome as string) || 0) - (parseFloat(s.businessExpenses as string) || 0);
  }
  const factor = PERIOD_TO_MONTHLY[s.payFrequency as string] ?? 1;
  const base = (parseFloat(s.grossPerPeriod as string) || 0) * factor;
  if (s.receiveBonus === "yes" && s.bonusIncludedInIncome !== "yes") {
    return base + (parseFloat(s.bonusGross as string) || 0) / 12;
  }
  return base;
}

function srcLabel(s: Record<string, unknown>): string {
  if (s.sourceType === "selfEmployment") return (s.businessName as string) || "Self-Employment";
  return (s.employerName as string) || "Employer";
}

function srcTypeTag(s: Record<string, unknown>): { label: string; cls: string } {
  if (s.sourceType === "selfEmployment") return { label: "SE", cls: "bg-amber-500/20 text-amber-300" };
  return { label: "W2", cls: "bg-green-500/20 text-green-300" };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const OTHER_INCOME_FIELDS: { label: string; key: string; isSS: boolean; isVA?: boolean }[] = [
  { label: "SS Retirement", key: "dSsRetirement", isSS: true },
  { label: "SS Disability (SSDI)", key: "dSsDisability", isSS: true },
  { label: "VA Disability Compensation", key: "dVeterans", isSS: false, isVA: true },
  { label: "Military / Veterans Retirement Pay", key: "dVeteransRetirement", isSS: false },
  { label: "Unemployment", key: "dUnemployment", isSS: false },
  { label: "Workers Comp", key: "dWorkersComp", isSS: false },
  { label: "Pension / Retirement", key: "dPension", isSS: false },
  { label: "Rental Income", key: "dRental", isSS: false },
  { label: "Alimony Received", key: "dAlimony", isSS: false },
  { label: "Child Support Received", key: "dChildSupport", isSS: false },
  { label: "Family Support", key: "dFamilySupport", isSS: false },
  { label: "Royalties", key: "dRoyalties", isSS: false },
  { label: "Investment Income", key: "dInvestment", isSS: false },
  { label: "Other Income", key: "dOtherIncome", isSS: false },
];

const EXPENSE_FIELDS: { label: string; key: string; group: string }[] = [
  { label: "Rent / Mortgage", key: "expRentMortgage", group: "Housing" },
  { label: "Property Tax", key: "expPropTax", group: "Housing" },
  { label: "HOA Fees", key: "expHoa", group: "Housing" },
  { label: "Home Maintenance", key: "expHomeMaintenance", group: "Housing" },
  { label: "Electric / Gas", key: "expElectricGas", group: "Utilities" },
  { label: "Water / Sewer", key: "expWaterSewer", group: "Utilities" },
  { label: "Phone", key: "expPhone", group: "Utilities" },
  { label: "Internet", key: "expInternet", group: "Utilities" },
  { label: "Food / Groceries", key: "expFood", group: "Living" },
  { label: "Household Supplies", key: "expHouseholdSupplies", group: "Living" },
  { label: "Clothing", key: "expClothing", group: "Living" },
  { label: "Personal Care", key: "expPersonalCare", group: "Living" },
  { label: "Gas / Fuel", key: "expGasFuel", group: "Transportation" },
  { label: "Car Maintenance", key: "expCarMaintenance", group: "Transportation" },
  { label: "Public Transit", key: "expPublicTransit", group: "Transportation" },
  { label: "Medical / Dental", key: "expMedical", group: "Health" },
  { label: "Health Insurance", key: "expInsHealth", group: "Health" },
  { label: "Life Insurance", key: "expInsLife", group: "Insurance" },
  { label: "Vehicle Insurance", key: "expInsVehicle", group: "Insurance" },
  { label: "Home Insurance", key: "expInsHome", group: "Insurance" },
  { label: "Other Insurance", key: "expInsOther", group: "Insurance" },
  { label: "Childcare", key: "expChildcare", group: "Family" },
  { label: "Child Education", key: "expChildEducation", group: "Family" },
  { label: "Alimony Paid", key: "expAlimonyPaid", group: "Family" },
  { label: "Support of Others", key: "expSupportOthers", group: "Family" },
  { label: "Charitable Giving", key: "expCharitable", group: "Other" },
  { label: "Recreation", key: "expRecreation", group: "Other" },
  { label: "Additional Taxes", key: "expAddlTaxes", group: "Other" },
  { label: "Gov. Fines / Fees", key: "expGovFines", group: "Other" },
  { label: "Other Expenses", key: "expOther", group: "Other" },
];

const CHANGE_REASONS = [
  { value: "correction_by_debtor", label: "Correction by Debtor" },
  { value: "over_irs_standard", label: "Over the IRS Living Standard" },
  { value: "other", label: "Other" },
];

interface Props {
  mode: "income" | "expenses" | "both";
  chapter: "7" | "13";
  fd: Record<string, unknown>;
  submissionId?: string;
  draftId?: string;
  clientName?: string;
  clientEmail?: string;
  staffName?: string;
  onClose: () => void;
  onSave?: (updatedFd: Record<string, unknown>) => void;
}

export default function IncomeExpenseModal({
  mode,
  chapter,
  fd,
  submissionId,
  draftId,
  clientName = "Client",
  clientEmail,
  staffName = "Staff",
  onClose,
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [changeReason, setChangeReason] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);

  const isJoint = fd.filingType === "joint" || fd.filingType === "individual-nonfiling-spouse";
  const debtorSrcs = (fd.debtorSources as Array<Record<string, unknown>>) ?? [];
  const spouseSrcs = isJoint ? ((fd.spouseSources as Array<Record<string, unknown>>) ?? []) : [];
  const vehicles = (fd.vehicles as Array<Record<string, unknown>>) ?? [];

  const getValue = (key: string) => {
    if (editing && key in editValues) return editValues[key];
    return (fd[key] as string) ?? "";
  };

  const debtorWages = debtorSrcs.reduce((a, s) => a + srcMonthly(s), 0);
  const spouseWages = spouseSrcs.reduce((a, s) => a + srcMonthly(s), 0);

  const otherItems = OTHER_INCOME_FIELDS.map(f => ({
    label: f.label,
    key: f.key,
    isSS: f.isSS,
    isVA: f.isVA || false,
    amount: parseFloat(getValue(f.key)) || 0,
  }));

  const otherItemsWithValue = otherItems.filter(i => i.amount > 0);
  const ssTotal = otherItemsWithValue.filter(i => i.isSS).reduce((a, i) => a + i.amount, 0);
  const vaTotal = otherItemsWithValue.filter(i => i.isVA).reduce((a, i) => a + i.amount, 0);
  const nonCmiTotal = ssTotal + vaTotal;
  const totalGross = debtorWages + spouseWages + otherItems.reduce((a, i) => a + i.amount, 0);
  const cmiTotal = totalGross - nonCmiTotal;

  const vehiclePayments = vehicles.reduce((a, v) => a + (parseFloat(v.monthlyPayment as string) || 0), 0);

  const expenseItems = EXPENSE_FIELDS.map(f => ({
    label: f.label,
    key: f.key,
    group: f.group,
    amount: parseFloat(getValue(f.key)) || 0,
  }));

  const expenseItemsWithValue = expenseItems.filter(i => i.amount > 0);
  const totalExpenses = expenseItemsWithValue.reduce((a, i) => a + i.amount, 0) + vehiclePayments;
  const dmi = totalGross - totalExpenses;

  const expenseGroups = useMemo(() => {
    const groups: Record<string, typeof expenseItems> = {};
    for (const item of expenseItems) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [editValues, fd]);

  const groupOrder = ["Housing", "Utilities", "Living", "Transportation", "Health", "Insurance", "Family", "Other"];

  const showIncome = mode === "income" || mode === "both";
  const showExpenses = mode === "expenses" || mode === "both";

  const title = mode === "income"
    ? `Schedule I — Income (Ch. ${chapter})`
    : mode === "expenses"
    ? `Schedule J — Expenses (Ch. ${chapter})`
    : `Schedule I & J — Income & Expenses (Ch. ${chapter})`;

  function startEdit() {
    const initial: Record<string, string> = {};
    for (const f of OTHER_INCOME_FIELDS) {
      initial[f.key] = (fd[f.key] as string) ?? "";
    }
    for (const f of EXPENSE_FIELDS) {
      initial[f.key] = (fd[f.key] as string) ?? "";
    }
    setEditValues(initial);
    setChangeReason("");
    setChangeNote("");
    setSaveResult(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditValues({});
    setChangeReason("");
    setChangeNote("");
  }

  async function handleSave() {
    if (!changeReason) return;
    setSaving(true);
    setSaveResult(null);

    const changedFields: Record<string, { from: string | null; to: string }> = {};
    for (const [key, newVal] of Object.entries(editValues)) {
      const oldVal = (fd[key] as string) ?? "";
      if (oldVal !== newVal) {
        changedFields[key] = { from: oldVal || null, to: newVal };
      }
    }

    const updatedFd = { ...fd, ...editValues };

    try {
      if (submissionId) {
        await supabase
          .from("intake_submissions")
          .update({ form_data: updatedFd })
          .eq("id", submissionId);
      }
      if (draftId) {
        await supabase
          .from("intake_drafts")
          .update({ form_data: updatedFd })
          .eq("id", draftId);
      }

      const reasonLabel = CHANGE_REASONS.find(r => r.value === changeReason)?.label ?? changeReason;
      const summary = `${mode === "income" ? "Income" : mode === "expenses" ? "Expenses" : "Income & Expenses"} adjusted — ${reasonLabel}${changeNote ? `: ${changeNote}` : ""}`;

      await supabase.from("case_activity_logs").insert({
        submission_id: submissionId ?? null,
        draft_id: draftId ?? null,
        activity_type: mode === "income" ? "income_edit" : mode === "expenses" ? "expense_edit" : "income_expense_edit",
        actor: staffName,
        summary,
        detail: {
          changed_fields: changedFields,
          chapter,
          mode,
        },
        change_reason: changeReason,
        change_reason_note: changeNote,
        client_notified: !!clientEmail,
      });

      if (clientEmail) {
        const fieldCount = Object.keys(changedFields).length;
        const emailBody = `Dear ${clientName},\n\nYour case file has been updated by our office. The following adjustment was made to your ${mode === "income" ? "income (Schedule I)" : mode === "expenses" ? "monthly expenses (Schedule J)" : "income and expenses (Schedule I & J)"} for your Chapter ${chapter} case:\n\nReason: ${reasonLabel}${changeNote ? `\nNotes: ${changeNote}` : ""}\n\n${fieldCount} field(s) were adjusted. If you have questions about this change, please contact our office.\n\nThank you,\nThe Legal Team`;
        await sendSmsEmail({
          recipientType: "client",
          submissionId: submissionId ?? null,
          actor: staffName || "Legal team",
          summary: `Case File Update — Schedule ${mode === "income" ? "I" : mode === "expenses" ? "J" : "I & J"} Adjusted`,
          payload: { channel: "email", to: clientEmail, name: clientName, subject: `Case File Update — Schedule ${mode === "income" ? "I" : mode === "expenses" ? "J" : "I & J"} Adjusted`, message: emailBody },
        });
      }

      setSaveResult("success");
      setEditing(false);
      if (onSave) onSave(updatedFd);
    } catch {
      setSaveResult("error");
    } finally {
      setSaving(false);
    }
  }

  const canSave = changeReason !== "" && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Monthly figures{editing ? " — Edit mode" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors"
              >
                <Edit3 size={11} />
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-semibold transition-colors"
                >
                  <RotateCcw size={11} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-colors"
                >
                  <Save size={11} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Save result banner */}
        {saveResult === "success" && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-green-500/10 border-b border-green-500/30 text-green-300 text-[12px]">
            <CheckCircle size={13} />
            Changes saved{clientEmail ? " and client notified by email." : "."}
          </div>
        )}
        {saveResult === "error" && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border-b border-red-500/30 text-red-300 text-[12px]">
            <AlertTriangle size={13} />
            Failed to save. Please try again.
          </div>
        )}

        {/* Edit — reason selector */}
        {editing && (
          <div className="px-5 py-3 bg-amber-500/5 border-b border-amber-500/20 flex-shrink-0 space-y-2">
            <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Reason for Change (required)</p>
            <div className="flex gap-2 flex-wrap">
              {CHANGE_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setChangeReason(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    changeReason === r.value
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <input
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
              placeholder="Additional notes (optional)..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[12px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
            />
            {!changeReason && (
              <p className="text-[10px] text-amber-400/80">Select a reason before saving.</p>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* ── SCHEDULE I ── */}
          {showIncome && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-green-400" />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Schedule I — Gross Income by Source</span>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 overflow-hidden">
                {debtorSrcs.length > 0 && (
                  <div className="px-4 py-3 border-b border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Debtor (W2 / SE — edit via intake form)</p>
                    <div className="space-y-2">
                      {debtorSrcs.map((s, i) => {
                        const tag = srcTypeTag(s);
                        const amt = srcMonthly(s);
                        return (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${tag.cls}`}>{tag.label}</span>
                              <span className="text-[12px] text-slate-300 truncate">{srcLabel(s)}</span>
                            </div>
                            <span className="text-[12px] font-semibold text-white flex-shrink-0 ml-3">{fmt(amt)}/mo</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[11px] font-bold pt-2 mt-2 border-t border-slate-700/30">
                      <span className="text-slate-400">Debtor Subtotal</span>
                      <span className="text-white">{fmt(debtorWages)}/mo</span>
                    </div>
                  </div>
                )}

                {isJoint && spouseSrcs.length > 0 && (
                  <div className="px-4 py-3 border-b border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Spouse / Non-Filing Spouse (edit via intake form)</p>
                    <div className="space-y-2">
                      {spouseSrcs.map((s, i) => {
                        const tag = srcTypeTag(s);
                        const amt = srcMonthly(s);
                        return (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${tag.cls}`}>{tag.label}</span>
                              <span className="text-[12px] text-slate-300 truncate">{srcLabel(s)}</span>
                            </div>
                            <span className="text-[12px] font-semibold text-white flex-shrink-0 ml-3">{fmt(amt)}/mo</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[11px] font-bold pt-2 mt-2 border-t border-slate-700/30">
                      <span className="text-slate-400">Spouse Subtotal</span>
                      <span className="text-white">{fmt(spouseWages)}/mo</span>
                    </div>
                  </div>
                )}

                {/* Other income — editable */}
                <div className="px-4 py-3 border-b border-slate-700/30">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Other Income</p>
                  {editing ? (
                    <div className="space-y-2">
                      {OTHER_INCOME_FIELDS.map(f => (
                        <div key={f.key} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {f.isSS && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-500/20 text-blue-300 flex-shrink-0">SS</span>}
                            {f.isVA && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 flex-shrink-0">VA</span>}
                            <span className="text-[12px] text-slate-300 truncate">{f.label}</span>
                            {(f.isSS || f.isVA) && <span className="text-[10px] text-slate-600 italic flex-shrink-0">Non-CMI</span>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[11px] text-slate-500">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editValues[f.key] ?? ""}
                              onChange={e => setEditValues(v => ({ ...v, [f.key]: e.target.value }))}
                              placeholder="0"
                              className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-[12px] text-white text-right focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {otherItemsWithValue.length > 0 ? otherItemsWithValue.map((item, i) => {
                        const isNonCmi = item.isSS || item.isVA;
                        return (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {item.isSS && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-500/20 text-blue-300 flex-shrink-0">SS</span>}
                              {item.isVA && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 flex-shrink-0">VA</span>}
                              <span className={`text-[12px] ${isNonCmi ? "text-slate-500" : "text-slate-300"}`}>{item.label}</span>
                              {isNonCmi && <span className="text-[10px] text-slate-600 italic">Non-CMI</span>}
                            </div>
                            <span className={`text-[12px] font-semibold flex-shrink-0 ml-3 ${isNonCmi ? "text-slate-500" : "text-white"}`}>{fmt(item.amount)}/mo</span>
                          </div>
                        );
                      }) : (
                        <p className="text-[12px] text-slate-600 italic">No other income reported</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 bg-slate-800/60">
                  {nonCmiTotal > 0 && (
                    <div className="space-y-1.5 mb-3 pb-3 border-b border-slate-700/60">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300 font-semibold">Total CMI Income (Means Test)</span>
                        <span className="text-slate-100 font-bold">{fmt(cmiTotal)}/mo</span>
                      </div>
                      {ssTotal > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-blue-400/80">Social Security (Non-CMI)</span>
                          <span className="text-blue-400/80 font-semibold">{fmt(ssTotal)}/mo</span>
                        </div>
                      )}
                      {vaTotal > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-amber-400/80">VA Disability (Non-CMI)</span>
                          <span className="text-amber-400/80 font-semibold">{fmt(vaTotal)}/mo</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between text-[13px] font-bold">
                    <span className="text-white">{nonCmiTotal > 0 ? "Total with Non-CMI Income" : "Total Gross Monthly Income"}</span>
                    <span className="text-green-300">{fmt(totalGross)}/mo</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SCHEDULE J ── */}
          {showExpenses && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={13} className="text-red-400" />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Schedule J — Monthly Expenses</span>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 overflow-hidden">
                {groupOrder.map(group => {
                  const items = expenseGroups[group];
                  if (!items || items.length === 0) return null;
                  const groupTotal = editing
                    ? items.reduce((a, i) => a + (parseFloat(editValues[i.key] ?? (fd[i.key] as string) ?? "0") || 0), 0)
                    : items.filter(i => i.amount > 0).reduce((a, i) => a + i.amount, 0);
                  if (!editing && groupTotal === 0) return null;
                  return (
                    <div key={group} className="px-4 py-3 border-b border-slate-700/30 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{group}</p>
                        <span className="text-[10px] text-slate-500 font-semibold">{fmt(groupTotal)}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((item) => (
                          editing ? (
                            <div key={item.key} className="flex items-center justify-between gap-3">
                              <span className="text-[12px] text-slate-300">{item.label}</span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[11px] text-slate-500">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editValues[item.key] ?? ""}
                                  onChange={e => setEditValues(v => ({ ...v, [item.key]: e.target.value }))}
                                  placeholder="0"
                                  className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-[12px] text-white text-right focus:outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          ) : item.amount > 0 ? (
                            <div key={item.key} className="flex items-center justify-between">
                              <span className="text-[12px] text-slate-300">{item.label}</span>
                              <span className="text-[12px] font-semibold text-white">{fmt(item.amount)}/mo</span>
                            </div>
                          ) : null
                        ))}
                      </div>
                    </div>
                  );
                })}

                {!editing && expenseItemsWithValue.length === 0 && vehiclePayments === 0 && (
                  <div className="px-4 py-6 text-center text-[12px] text-slate-500">No expenses reported</div>
                )}

                {vehiclePayments > 0 && (
                  <div className="px-4 py-3 border-b border-slate-700/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-slate-300">Vehicle Loan Payment{vehicles.length > 1 ? "s" : ""} ({vehicles.length})</span>
                      <span className="text-[12px] font-semibold text-white">{fmt(vehiclePayments)}/mo</span>
                    </div>
                  </div>
                )}

                <div className="px-4 py-3 bg-slate-800/60">
                  <div className="flex justify-between text-[13px] font-bold">
                    <span className="text-white">Total Monthly Expenses</span>
                    <span className="text-red-300">{fmt(totalExpenses)}/mo</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DMI SUMMARY ── */}
          {showIncome && showExpenses && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Minus size={13} className="text-slate-400" />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Disposable Monthly Income</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-400">Total Gross Monthly Income</span>
                  <span className="text-green-300 font-semibold">{fmt(totalGross)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-mono">−</span>
                    <span className="text-slate-400">Total Monthly Expenses</span>
                  </div>
                  <span className="text-red-300 font-semibold">({fmt(totalExpenses)})</span>
                </div>
                <div className="flex justify-between text-[14px] font-bold pt-2 border-t border-slate-700/40">
                  <span className="text-white">Disposable Monthly Income (DMI)</span>
                  <span className={dmi >= 100 ? "text-green-400" : dmi >= 0 ? "text-amber-400" : "text-red-400"}>{fmt(dmi)}/mo</span>
                </div>
                {dmi > 0 && (
                  <div className="flex justify-between text-[11px] text-slate-500 pl-3">
                    <span>× 60 months</span>
                    <span className="text-slate-400 font-semibold">{fmt(dmi * 60)} pool</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
