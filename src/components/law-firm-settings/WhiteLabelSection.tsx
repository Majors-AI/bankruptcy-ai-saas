// White Label — firm logo + global color scheme + per-department schemes.
//
// Mirroring: the per-department picker here writes to the same
// WhiteLabelStore that each Department's own settings reads, so editing in
// either place is the single source.

import { useState } from "react";
import { Image, Upload, X } from "lucide-react";
import { useWhiteLabel, schemeCss } from "./whiteLabelStore";
import { useDepartmentStore } from "../department-management/store";
import ColorSchemeEditor from "./ColorSchemeEditor";

export default function WhiteLabelSection() {
  const wl = useWhiteLabel();
  const deptStore = useDepartmentStore();
  const [draftName, setDraftName] = useState(wl.firmName);

  function onLogoFile(file: File | null) {
    if (!file) { wl.setLogo(null); return; }
    // Scaffold: data URL so the preview works without a backend. Real
    // implementation pushes to Supabase Storage and saves the URL.
    const reader = new FileReader();
    reader.onload = () => wl.setLogo(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-5">
      {/* ── Firm identity ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0F0F0E] border border-[#2A2A28] flex items-center justify-center">
            <Image className="w-4 h-4" style={{ color: "var(--lfs-accent)" }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#FAFAF7]">Firm identity</h3>
            <p className="text-[11px] text-[#6B6B66] mt-0.5 leading-relaxed">
              Logo + display name shown in headers across every client- and staff-facing surface.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Logo */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B66] mb-1.5">Firm logo</p>
            <div className="rounded-lg border border-dashed border-[#2A2A28] bg-[#0F0F0E] p-4">
              <div
                className="rounded border border-[#2A2A28] flex items-center justify-center mb-3"
                style={{ minHeight: 96, background: "#0F0F0E" }}
              >
                {wl.logoUrl
                  ? <img src={wl.logoUrl} alt="Firm logo" className="max-h-24 max-w-full object-contain" />
                  : <span className="text-[12px] font-serif text-[#FAFAF7]">{wl.firmName}</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded border cursor-pointer"
                  style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
                >
                  <Upload className="w-3 h-3" /> Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => onLogoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {wl.logoUrl && (
                  <button
                    onClick={() => wl.setLogo(null)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B6B66] border border-[#2A2A28] px-2.5 py-1 rounded hover:text-white"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#6B6B66] italic mt-2 leading-snug">
                {/* TODO Phase B — Supabase Storage upload + firm_branding.logo_url save. */}
                Preview uses an in-memory data URL. Production upload to Supabase Storage lands with persistence.
              </p>
            </div>
          </div>

          {/* Firm name */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B66] mb-1.5">Display name</p>
            <div className="flex items-center gap-2">
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                className="flex-1 bg-[#0F0F0E] border border-[#2A2A28] text-[12px] text-[#FAFAF7] rounded px-2 py-1.5"
              />
              <button
                onClick={() => wl.setFirmName(draftName.trim() || wl.firmName)}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded border"
                style={{ borderColor: "var(--lfs-accent)", color: "#FAFAF7", background: "color-mix(in srgb, var(--lfs-accent) 22%, transparent)" }}
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-[#6B6B66] italic mt-2">
              Shown in headers when no logo is uploaded; also appears in client emails.
            </p>
          </div>
        </div>
      </section>

      {/* ── Global color scheme ───────────────────────────────────────── */}
      <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
        <ColorSchemeEditor label="Global color scheme" />
      </section>

      {/* ── Per-department schemes ────────────────────────────────────── */}
      <section className="rounded-xl border border-[#2A2A28] bg-[#1A1A18] p-5">
        <h3 className="text-sm font-semibold text-[#FAFAF7] mb-1">Per-department color schemes</h3>
        <p className="text-[11px] text-[#6B6B66] mb-4 leading-relaxed">
          Each department's scheme overrides the global scheme inside that department's
          views only. The same control appears at the top of each department's settings —
          edits in either place share one source.
        </p>
        <div className="space-y-4">
          {deptStore.departments.map(d => {
            const effective = wl.resolveScheme(d.id);
            return (
              <div
                key={d.id}
                className="rounded border p-4"
                style={{ ...schemeCss(effective), background: "var(--lfs-surface)", borderColor: "var(--lfs-border)" }}
              >
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <p className="text-sm font-semibold" style={{ color: "#FAFAF7" }}>{d.label}</p>
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--lfs-accent)" }}>
                    {wl.departmentSchemes[d.id] ? "department override" : "inherits global"}
                  </span>
                </div>
                <ColorSchemeEditor departmentId={d.id} label="" />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
