// Shared department-portal entry gate.
//
// Mirrors the Intake Portal's PortalLogin pattern (staff list → 4-digit PIN
// numpad) so the Legal Department Portal and Accounting Portal use the same
// flow. The staff source is the SAME `staff_members` table the intake portal
// uses; consumers pass a `classifyStaff` predicate that returns a department
// user-type label (e.g., "Paralegal", "Accounting Admin") or null to exclude.
//
// PIN handling is a DEV PLACEHOLDER — every department / every user uses the
// shared 4-digit PIN "7894". This is intentional for the prototype and is NOT
// written to the database; the real per-user PIN check lives in
// LegalAdminPortal's PortalLogin (verifies against `staff_members.intake_pin`)
// and should be replaced here with a real auth integration before launch.
//
// NO DB writes from this component.

import { useEffect, useState } from "react";
import { Briefcase, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";

// DEV PLACEHOLDER PIN — replace with real per-user auth before launch.
const DEV_SHARED_PIN = "7894";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Raw row shape this component reads from `staff_members`. */
export interface DepartmentStaffRow {
  id: string;
  name: string;
  role: string | null;                  // 'admin'|'attorney'|'paralegal'|'intake_staff'|'accounting'
  intake_portal_role: string | null;    // legal_admin|attorney|attorney_super_admin|super_admin
  title: string | null;
  is_active: boolean;
}

/** Session payload passed back to the parent portal on successful login. */
export interface DepartmentPortalSession {
  id: string;
  name: string;
  /** Department-specific user-type label, e.g. "Paralegal", "Accounting Admin". */
  user_type: string;
  title: string | null;
}

export interface DepartmentPortalLoginProps {
  /** Title displayed in the gate (e.g. "Legal Department Portal"). */
  title: string;
  /** Optional subtitle line under the title. */
  subtitle?: string;
  /**
   * Returns the department user-type label for a staff row, or null if the
   * staffer should be excluded from this department's list. The intake portal
   * uses `intake_portal_role`; departments slice the same staff_members rows
   * by `role` (+ `intake_portal_role`/`title` where helpful).
   */
  classifyStaff: (s: DepartmentStaffRow) => string | null;
  /** Called when a staff row is selected and the correct PIN is entered. */
  onLogin: (session: DepartmentPortalSession) => void;
  /** Hex accent color (e.g. "#B8945F" gold, "#818CF8" indigo, "#B91C1C" red). */
  accent?: string;
  /** Optional empty-state hint when classifyStaff filters to no rows. */
  emptyHint?: string;
}

interface DisplayRow extends DepartmentStaffRow {
  user_type: string;
}

/**
 * Friendly label for an `intake_portal_role` value — used when the department
 * classifier yields no matches and we fall back to the Intake Portal's
 * effective staff list.
 */
function intakeRoleLabel(role: string | null): string {
  switch (role) {
    case "attorney_super_admin": return "Attorney / Super Admin";
    case "super_admin":          return "Super Admin";
    case "attorney":             return "Attorney";
    case "legal_admin":          return "Legal Admin";
    default:                     return "Staff";
  }
}

export default function DepartmentPortalLogin({
  title, subtitle, classifyStaff, onLogin,
  accent = "#B8945F",
  emptyHint,
}: DepartmentPortalLoginProps) {
  const [staffList, setStaffList] = useState<DisplayRow[]>([]);
  const [selected, setSelected]   = useState<DisplayRow | null>(null);
  const [pin, setPin]             = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [checking, setChecking]   = useState(false);
  // True when the department classifier matched no rows and we fell back
  // to the Intake Portal's effective staff list. Drives the in-list banner.
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_members?is_active=eq.true&order=name.asc&select=id,name,role,intake_portal_role,title,is_active`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
      );
      const rows: DepartmentStaffRow[] = r.ok ? await r.json() : [];
      if (cancelled) return;

      // First pass — try the department classifier.
      const matched: DisplayRow[] = [];
      for (const row of rows) {
        const user_type = classifyStaff(row);
        if (user_type) matched.push({ ...row, user_type });
      }

      if (matched.length > 0) {
        setStaffList(matched);
        setUsingFallback(false);
      } else {
        // TODO Phase B (planned staff-setup model): replace this fallback
        // with real per-department membership. Once staff_members carries
        // a department/role assignment for Legal + Accounting, drop this
        // branch and let classifyStaff drive the list directly.
        //
        // FALLBACK: show the SAME staff the Intake Portal shows — every
        // active staff member with an `intake_portal_role` set. This keeps
        // the gate usable until department assignment lands; the same staff
        // currently appear in Legal and Accounting.
        const fallback: DisplayRow[] = rows
          .filter(r => r.intake_portal_role != null)
          .map(r => ({ ...r, user_type: intakeRoleLabel(r.intake_portal_role) }));
        setStaffList(fallback);
        setUsingFallback(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // classifyStaff is a prop; consumers should pass a stable reference
    // (typically a module-level function) so this effect doesn't re-fire.
  }, [classifyStaff]);

  function handlePinDigit(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === 4) {
      setChecking(true);
      setTimeout(() => {
        if (selected && next === DEV_SHARED_PIN) {
          onLogin({
            id: selected.id,
            name: selected.name,
            user_type: selected.user_type,
            title: selected.title,
          });
        } else {
          setError("Incorrect PIN. Please try again.");
          setPin("");
          setChecking(false);
        }
      }, 400);
    }
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1));
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F0F0E' }}>
      <div className="w-full max-w-sm">
        <div className="mb-10" style={{ paddingLeft: '2px' }}>
          <Briefcase style={{ width: 24, height: 24, color: '#FAFAF7', strokeWidth: 1.5 }} />
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#FAFAF7', marginTop: 12 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: '#6B6B66', marginTop: 4 }}>{subtitle}</p>
          )}
          {!selected && (
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent, textAlign: 'center', marginTop: 40 }}>
              Select your name to continue
            </p>
          )}
        </div>

        {!selected ? (
          <div>
            {loading ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#6B6B66' }} />
              </div>
            ) : staffList.length === 0 ? (
              <div className="py-6 text-center">
                <p style={{ fontSize: 13, color: '#6B6B66', lineHeight: 1.5 }}>
                  {emptyHint ?? "No staff available for this portal yet."}
                </p>
              </div>
            ) : (
              <div>
                {usingFallback && (
                  <div style={{
                    border: '1px dashed #3A3A36',
                    background: '#1A1A18',
                    padding: '10px 12px',
                    marginBottom: 12,
                    borderRadius: 4,
                  }}>
                    <p style={{ fontSize: 11, color: '#B8945F', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Department assignment not set up yet
                    </p>
                    <p style={{ fontSize: 11, color: '#6B6B66', lineHeight: 1.5 }}>
                      Showing the same active staff as the Intake Portal until the staff-setup model lands.
                    </p>
                  </div>
                )}
                {staffList.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s); setPin(""); setError(""); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 0',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #2A2A28',
                      borderTop: idx === 0 ? '1px solid #2A2A28' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-left 150ms ease-out',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderLeft = `2px solid ${accent}`; (e.currentTarget as HTMLButtonElement).style.paddingLeft = '10px'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderLeft = 'none'; (e.currentTarget as HTMLButtonElement).style.paddingLeft = '0'; }}
                  >
                    <div style={{ width: 36, height: 36, background: '#2A2A28', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, fontWeight: 500, color: '#FAFAF7' }}>
                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: '#FAFAF7', lineHeight: 1.3 }}>{s.name}</p>
                      <p style={{ fontSize: 12, color: '#6B6B66', marginTop: 2 }}>{s.user_type}</p>
                    </div>
                    <ChevronRight style={{ width: 16, height: 16, color: '#3A3A36', strokeWidth: 1.5 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <button onClick={() => { setSelected(null); setPin(""); setError(""); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B6B66', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <ArrowLeft style={{ width: 14, height: 14, strokeWidth: 1.5 }} /> Back
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '1px solid #2A2A28', borderBottom: '1px solid #2A2A28' }}>
              <div style={{ width: 36, height: 36, background: '#2A2A28', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, fontWeight: 500, color: '#FAFAF7' }}>
                  {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, color: '#FAFAF7' }}>{selected.name}</p>
                <p style={{ fontSize: 12, color: '#6B6B66', marginTop: 2 }}>{selected.user_type}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-5">Enter your 4-digit PIN</p>
              <div className="flex justify-center gap-4 mb-6">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pin.length > i
                      ? checking ? "bg-emerald-400 border-emerald-400" : "bg-white border-white"
                      : "bg-transparent border-slate-600"
                  }`} />
                ))}
              </div>
              {error && (
                <p className="text-xs text-red-400 text-center mb-4 font-semibold">{error}</p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {["1","2","3","4","5","6","7","8","9","",  "0","⌫"].map((k, i) => (
                  k === "" ? <div key={i} /> :
                  <button key={i}
                    onClick={() => k === "⌫" ? handleBackspace() : handlePinDigit(k)}
                    disabled={checking}
                    className={`h-14 rounded-2xl text-lg font-bold transition-all ${
                      k === "⌫"
                        ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                        : "bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-600 border border-slate-700/60"
                    } disabled:opacity-40`}>
                    {k}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-700 text-center mt-5">
                Dev placeholder PIN — same for every user during the prototype.
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-700 mt-8">Secure staff portal — authorized access only</p>
      </div>
    </div>
  );
}

// ─── Department classifier presets ───────────────────────────────────────────
//
// Both classifiers slice the same `staff_members` rows used by the intake
// portal. There is no dedicated `legal_portal_role` / `accounting_portal_role`
// column today, so we map from the base `role` value (+ `intake_portal_role`
// where it adds resolution).
//
// TODO Phase B: when the staff-setup model adds per-department roles
// (legal_portal_user_type, accounting_portal_user_type) flip these to read
// from those columns directly.

/**
 * Legal department: Paralegal, Attorney, Supervising Attorney.
 *   - role='paralegal'                                            → "Paralegal"
 *   - role='attorney' + intake_portal_role='attorney_super_admin' → "Supervising Attorney"
 *   - role='attorney' (otherwise)                                  → "Attorney"
 *   - role='admin'                                                  → "Supervising Attorney"
 *     (firm seed treats `admin` as a managing attorney — e.g. Sarah Kim.)
 */
export function classifyLegalStaff(s: DepartmentStaffRow): string | null {
  if (s.role === "paralegal") return "Paralegal";
  if (s.role === "attorney") {
    return s.intake_portal_role === "attorney_super_admin"
      ? "Supervising Attorney"
      : "Attorney";
  }
  if (s.role === "admin") return "Supervising Attorney";
  return null;
}

/**
 * Accounting department: Accounting Admin, Accounting Manager.
 * The Admin vs Manager distinction ties to the planned staff-setup model
 * (not built yet) — until then everyone with role='accounting' is labeled
 * "Accounting Admin." When a sub-role column lands, flip the label based on
 * that column.
 */
export function classifyAccountingStaff(s: DepartmentStaffRow): string | null {
  if (s.role === "accounting") return "Accounting Admin";
  return null;
}
