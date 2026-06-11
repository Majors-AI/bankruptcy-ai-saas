// Reusable color-scheme editor — mounts in two places:
//   1. White Label section (firm-wide list of department schemes)
//   2. Each department's settings (single inline picker for that dept)
//
// Both surfaces write to the same WhiteLabelStore so the setting stays a
// single source.

import { useState } from "react";
import { Palette } from "lucide-react";
import {
  DEFAULT_SCHEME, SCHEME_PRESETS, presetKeyFor, schemeCss,
  useWhiteLabel, type ColorScheme,
} from "./whiteLabelStore";

interface Props {
  /** When set, the editor is in "department" mode — picks override the
   *  global scheme for that department. Pass null/undefined for global mode
   *  (used inside White Label's global card). */
  departmentId?: string | null;
  /** Optional override label shown above the picker. */
  label?: string;
}

export default function ColorSchemeEditor({ departmentId, label }: Props) {
  const wl = useWhiteLabel();
  const scope = departmentId ?? null;
  const isDept = scope !== null;
  const current: ColorScheme = isDept
    ? (wl.departmentSchemes[scope] ?? wl.globalScheme)
    : wl.globalScheme;
  const usingGlobal = isDept && !wl.departmentSchemes[scope];
  const presetKey = presetKeyFor(current);
  const [custom, setCustom] = useState<ColorScheme>(current);
  const [showCustom, setShowCustom] = useState(false);

  function applyPreset(scheme: ColorScheme) {
    if (isDept) wl.setDepartmentScheme(scope, scheme);
    else wl.setGlobalScheme(scheme);
    setCustom(scheme);
  }

  function inherit() {
    if (isDept) wl.setDepartmentScheme(scope, null);
  }

  function applyCustom() {
    if (isDept) wl.setDepartmentScheme(scope, custom);
    else wl.setGlobalScheme(custom);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Palette className="w-3.5 h-3.5" style={{ color: "var(--lfs-accent)" }} />
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#FAFAF7" }}>
          {label ?? (isDept ? "Department color scheme" : "Global color scheme")}
        </p>
        {usingGlobal && (
          <span className="text-[10px] uppercase tracking-widest text-[#6B6B66] border border-[#2A2A28] px-1.5 py-0.5 rounded">
            inherits global
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {SCHEME_PRESETS.map(p => {
          const selected = !usingGlobal && presetKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.scheme)}
              className={`inline-flex items-center gap-2 text-[11px] font-semibold px-2.5 py-1.5 rounded border ${
                selected ? "border-[var(--lfs-accent)] text-[#FAFAF7]" : "border-[#2A2A28] text-[#6B6B66] hover:border-[#3A3A36]"
              }`}
              style={selected ? { background: "color-mix(in srgb, var(--lfs-accent) 18%, transparent)" } : undefined}
            >
              <span
                className="inline-block w-3 h-3 rounded-full border border-[#2A2A28]"
                style={{ background: p.scheme.accent }}
              />
              {p.label}
            </button>
          );
        })}
        {isDept && (
          <button
            type="button"
            onClick={inherit}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded border ${
              usingGlobal ? "border-[var(--lfs-accent)] text-[#FAFAF7]" : "border-[#2A2A28] text-[#6B6B66] hover:border-[#3A3A36]"
            }`}
          >
            Inherit global
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowCustom(s => !s)}
          className="text-[11px] font-semibold px-2.5 py-1.5 rounded border border-[#2A2A28] text-[#6B6B66] hover:border-[#3A3A36]"
        >
          {showCustom ? "Hide custom" : "Custom…"}
        </button>
      </div>

      {showCustom && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded border border-[#2A2A28] bg-[#0F0F0E] p-3">
          {([
            ["accent",       "Accent"],
            ["accentMuted",  "Accent (muted)"],
            ["surface",      "Surface"],
            ["border",       "Border"],
          ] as const).map(([k, lbl]) => (
            <label key={k} className="block min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B6B66] mb-1">{lbl}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={custom[k]}
                  onChange={e => setCustom(c => ({ ...c, [k]: e.target.value }))}
                  className="h-7 w-9 rounded border border-[#2A2A28] bg-transparent"
                />
                <input
                  type="text"
                  value={custom[k]}
                  onChange={e => setCustom(c => ({ ...c, [k]: e.target.value }))}
                  className="flex-1 min-w-0 bg-[#1A1A18] border border-[#2A2A28] text-[11px] text-[#FAFAF7] rounded px-2 py-1 font-mono"
                />
              </div>
            </label>
          ))}
          <div className="col-span-2 sm:col-span-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCustom(DEFAULT_SCHEME)}
              className="text-[10px] text-[#6B6B66] hover:text-white"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={applyCustom}
              className="text-[11px] font-semibold px-2.5 py-1 rounded border"
              style={{ borderColor: "var(--lfs-accent)", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)", color: "#FAFAF7" }}
            >
              Apply custom
            </button>
          </div>
        </div>
      )}

      {/* Live preview — small swatch chip stack styled with the candidate
          scheme so the firm sees the impact before confirming. */}
      <div className="mt-3 rounded border border-[#2A2A28] p-3" style={{ ...schemeCss(current), background: "var(--lfs-surface)", borderColor: "var(--lfs-border)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--lfs-accent)" }}>
            Preview
          </span>
          <button
            type="button"
            className="text-[11px] font-semibold px-2.5 py-1 rounded border"
            style={{ background: "var(--lfs-accent)", color: "#0F0F0E", borderColor: "var(--lfs-accent)" }}
          >
            Primary action
          </button>
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded border"
            style={{ borderColor: "var(--lfs-accent)", color: "var(--lfs-accent)" }}
          >
            Active chip
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded border"
            style={{ borderColor: "var(--lfs-border)", color: "#6B6B66" }}
          >
            Neutral
          </span>
        </div>
      </div>

      <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
        {/* TODO Phase B — persistence:
              - upsert into firm_branding.per_department_scheme jsonb
              - mirror invalidation: department viewers re-read on save */}
        Scheme persists across surfaces inside the Law Firm Settings build. Saves to
        firm_branding land with the persistence wiring.
      </p>
    </div>
  );
}
