// Shared client search bar — name AND/OR phone.
//
// Reuses the SAME predicate the LegalAdminPortal leads filter uses
// (name.toLowerCase().includes(q) || email.toLowerCase().includes(q) ||
// phone.includes(q)). Operates on a `leads` array passed in by the parent —
// the same array the dashboard + NewLeadInline already have in memory, so
// no extra fetches.
//
// Used on:
//   - IntakeDashboard header (above the "Existing Client Leads" button).
//   - NewLeadInline header (top of the new-lead window).
//
// NO DB writes. Pure UI.
//
// TODO Phase B: the search currently sees only `intake_leads`. When the
// `clients` table becomes a first-class read here, hand a second array
// in and merge results — keep the shape so callers don't change.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronRight, User } from "lucide-react";

export interface ClientSearchLead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status?: string | null;
  chapter_interest?: number | null;
}

export interface ClientSearchBarProps {
  leads: ClientSearchLead[];
  /** Called when the user picks a row. */
  onOpen: (lead: ClientSearchLead) => void;
  /** Optional callback when the user requests a broader search (Enter on no-match). */
  onBrowseAll?: () => void;
  /** Width hint; defaults to a wide search input. */
  className?: string;
  /** Optional placeholder override. */
  placeholder?: string;
}

const MAX_RESULTS = 8;

export default function ClientSearchBar({
  leads, onOpen, onBrowseAll, className = "", placeholder,
}: ClientSearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (e.target instanceof Node && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches = useMemo<ClientSearchLead[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Same predicate the leads-table filter uses elsewhere in the portal.
    return leads
      .filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [leads, query]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2A2A28] bg-[#1A1A18] focus-within:border-[#B8945F]/60">
        <Search className="w-3.5 h-3.5 text-[#6B6B66] flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search clients by name or phone"}
          className="flex-1 bg-transparent text-xs text-[#FAFAF7] placeholder-[#6B6B66] outline-none"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="text-[#6B6B66] hover:text-[#FAFAF7] flex-shrink-0"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-[#2A2A28] bg-[#1A1A18] shadow-2xl max-h-80 overflow-y-auto">
          {matches.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-[11px] text-[#6B6B66] italic">No matches.</p>
              {onBrowseAll && (
                <button
                  onClick={() => { setOpen(false); onBrowseAll(); }}
                  className="mt-2 text-[10px] font-semibold text-[#B8945F] hover:text-[#FAFAF7] transition-colors"
                >
                  Browse all client leads →
                </button>
              )}
            </div>
          ) : (
            <ul>
              {matches.map(l => (
                <li key={l.id}>
                  <button
                    onClick={() => { setOpen(false); setQuery(""); onOpen(l); }}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[#2A2A28] transition-colors border-b border-[#2A2A28] last:border-b-0"
                  >
                    <User className="w-3.5 h-3.5 text-[#6B6B66] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#FAFAF7] truncate">{l.full_name}</p>
                      <p className="text-[10px] text-[#6B6B66] truncate mt-0.5">
                        {l.phone ?? l.email ?? "—"}
                        {l.status && <span className="ml-1">· {l.status}</span>}
                        {l.chapter_interest && <span className="ml-1">· Ch.{l.chapter_interest}</span>}
                      </p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#3A3A36] mt-1 flex-shrink-0" />
                  </button>
                </li>
              ))}
              {leads.length > matches.length && onBrowseAll && (
                <li>
                  <button
                    onClick={() => { setOpen(false); onBrowseAll(); }}
                    className="w-full px-3 py-2 text-left text-[10px] font-semibold text-[#B8945F] hover:bg-[#2A2A28] transition-colors"
                  >
                    Browse all client leads →
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dedup helpers ───────────────────────────────────────────────────────────

/**
 * Reduce a phone string to its digits only, take the last 10 (US standard,
 * ignores country code), and return that. Empty string when fewer than 10
 * digits — callers can compare equality safely without false-positive
 * matches between short partial values.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.slice(-10);
}
