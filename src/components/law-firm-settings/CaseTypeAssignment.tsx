// Case-type assignment — per-department configuration of which staff are
// eligible for a (state × chapter) combination. Acts as a FILTER on the
// auto-assign engine: only eligible staff are considered, then the existing
// strength-score + workload + follow-up rules pick the winner.
//
// In-memory state today; persistence TODO (new table
// staff_case_type_eligibility (staff_id, department_id, state, chapter)).

import { useState, createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { ListFilter, Plus, X } from "lucide-react";
import { useDepartmentStore } from "../department-management/store";
import { titleLabel } from "../department-management/seedData";
import type { ViewerRole, DepartmentId } from "../department-management/types";

export type ChapterCode = "7" | "11" | "12" | "13";

export const CHAPTER_OPTIONS: ChapterCode[] = ["7", "11", "12", "13"];

export const ALL_STATE_CODES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export interface Eligibility {
  staffId: string;
  departmentId: DepartmentId;
  state: string;     // 2-letter code
  chapter: ChapterCode;
}

interface CaseTypeApi {
  eligibilities: Eligibility[];
  add(e: Eligibility): void;
  remove(staffId: string, departmentId: DepartmentId, state: string, chapter: ChapterCode): void;
  /** Returns the list of eligible staff IDs for a (dept, state, chapter). */
  filterEligible(deptId: DepartmentId, state: string, chapter: ChapterCode, candidateIds: string[]): string[];
}

const Ctx = createContext<CaseTypeApi | null>(null);

export function CaseTypeProvider({ children }: { children: ReactNode }) {
  const [eligibilities, setEligibilities] = useState<Eligibility[]>([]);

  const add = useCallback<CaseTypeApi["add"]>((e) => {
    setEligibilities(prev => {
      if (prev.some(x => x.staffId === e.staffId && x.departmentId === e.departmentId && x.state === e.state && x.chapter === e.chapter)) {
        return prev;
      }
      return [...prev, e];
    });
  }, []);

  const remove = useCallback<CaseTypeApi["remove"]>((staffId, departmentId, state, chapter) => {
    setEligibilities(prev => prev.filter(x =>
      !(x.staffId === staffId && x.departmentId === departmentId && x.state === state && x.chapter === chapter)
    ));
  }, []);

  const filterEligible = useCallback<CaseTypeApi["filterEligible"]>((deptId, state, chapter, candidateIds) => {
    const allowed = new Set(
      eligibilities
        .filter(e => e.departmentId === deptId && e.state === state && e.chapter === chapter)
        .map(e => e.staffId),
    );
    if (allowed.size === 0) return candidateIds; // no rules = open to all
    return candidateIds.filter(id => allowed.has(id));
  }, [eligibilities]);

  const api: CaseTypeApi = useMemo(() => ({ eligibilities, add, remove, filterEligible }),
    [eligibilities, add, remove, filterEligible]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCaseType(): CaseTypeApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCaseType must be used inside CaseTypeProvider");
  return v;
}

// ─── UI ────────────────────────────────────────────────────────────────────

interface Props {
  departmentId: DepartmentId;
  viewerRole: ViewerRole;
}

export default function CaseTypeAssignmentSection({ departmentId, viewerRole }: Props) {
  const ct = useCaseType();
  const store = useDepartmentStore();
  const candidates = store.staff.filter(s => s.departmentIds.includes(departmentId));
  const canEdit =
    viewerRole === "law_firm_owner"
    || viewerRole === "super_admin"
    || (viewerRole === "department_supervisor"
        && store.departments.find(d => d.id === departmentId)?.supervisorId === store.actor.id);

  const [staffId, setStaffId] = useState<string>("");
  const [state, setState] = useState<string>(ALL_STATE_CODES[0]);
  const [chapter, setChapter] = useState<ChapterCode>("7");

  function add() {
    if (!staffId) return;
    ct.add({ staffId, departmentId, state, chapter });
  }

  const rows = ct.eligibilities.filter(e => e.departmentId === departmentId);

  return (
    <div className="rounded-lg border border-[#2A2A28] bg-[#0F0F0E] p-4">
      <div className="flex items-center gap-2 mb-2">
        <ListFilter className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FAFAF7]">Case-type assignment</p>
      </div>
      <p className="text-[11px] text-[#6B6B66] mb-3 leading-relaxed">
        Configure which staff handle which (state × chapter). Acts as a FILTER on the
        auto-assign engine — only eligible staff enter the strength-score ranking. Empty
        rules = open to everyone in the department.
      </p>

      {canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
          <select value={staffId} onChange={e => setStaffId(e.target.value)} className={inputCls}>
            <option value="">— pick staff —</option>
            {candidates.map(c => <option key={c.id} value={c.id}>{c.name} · {titleLabel(c.title)}</option>)}
          </select>
          <select value={state} onChange={e => setState(e.target.value)} className={inputCls}>
            {ALL_STATE_CODES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={chapter} onChange={e => setChapter(e.target.value as ChapterCode)} className={inputCls}>
            {CHAPTER_OPTIONS.map(c => <option key={c} value={c}>Chapter {c}</option>)}
          </select>
          <button
            onClick={add}
            disabled={!staffId}
            className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded border disabled:opacity-50"
            style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
          >
            <Plus className="w-3 h-3" /> Add rule
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-[11px] text-[#6B6B66] italic">No rules — open to everyone in this department.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(r => {
            const staff = store.staff.find(s => s.id === r.staffId);
            return (
              <li key={`${r.staffId}-${r.state}-${r.chapter}`} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#1A1A18] border border-[#2A2A28]">
                <p className="text-[11px] text-[#FAFAF7]">
                  <span className="font-semibold">{staff?.name ?? r.staffId}</span>
                  <span className="text-[#6B6B66]"> · {r.state} · Chapter {r.chapter}</span>
                </p>
                {canEdit && (
                  <button
                    onClick={() => ct.remove(r.staffId, departmentId, r.state, r.chapter)}
                    className="text-[#6B6B66] hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        {/* TODO Phase B — persistence to staff_case_type_eligibility + plumbing
            into the auto-assign engine's pre-filter step. */}
        Filter wires into auto-assign once the engine accepts an eligibilityIds set.
      </p>
    </div>
  );
}

const inputCls = "w-full bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1.5";
