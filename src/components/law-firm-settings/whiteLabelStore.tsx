// White-label / branding store.
//
// One source of truth for the firm's logo + global color scheme + the
// per-department color schemes that OVERRIDE the global within a single
// department's views. The same per-department scheme is editable from two
// places — White Label (firm-wide list) and inside each Department's own
// settings — and both surfaces read/write through this provider.
//
// Color values stay inside the project's existing token vocabulary (we keep
// the same dark base palette the rest of the Law Firm Settings UI uses).
// What changes per-scheme is the ACCENT family — the small set of color
// roles every section consumes via CSS variables. No ad-hoc hex codes
// outside the scheme definitions below.
//
// SCAFFOLD persistence: state lives in memory only. TODO:
//   - new table firm_branding (firm_id, logo_url, global_scheme jsonb,
//     per_department_scheme jsonb, updated_at, updated_by)
//   - upload pipeline: Supabase Storage bucket `firm_logos`; URL written back
//     into firm_branding.logo_url
//   - the existing src/admin/FirmBrandingPanel.tsx scaffold lands here once
//     this store ships.

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode, type CSSProperties,
} from "react";

// ─── Token vocabulary ───────────────────────────────────────────────────────
//
// Every visual surface in Law Firm Settings consumes these four roles. We
// expose them as CSS custom properties (--lfs-accent, etc.) so a department's
// scope can simply set the variables on its wrapper element; child Tailwind
// classes that read `var(--lfs-accent)` pick up the override.

export interface ColorScheme {
  /** Primary accent — buttons, active tabs, focus rings. */
  accent: string;
  /** Softer accent — borders, secondary chips. */
  accentMuted: string;
  /** Background tone on cards inside this scope. */
  surface: string;
  /** Border tone inside this scope. */
  border: string;
}

// Built-in scheme presets. Names match the existing palette the rest of the
// portal uses; we did not invent new colors — we picked the same families
// that already appear across cards/buttons/badges.
export const SCHEME_PRESETS: Array<{ key: string; label: string; scheme: ColorScheme }> = [
  { key: "amber",    label: "Amber (default)", scheme: { accent: "#B8945F", accentMuted: "#3A2F1E", surface: "#1A1A18", border: "#2A2A28" } },
  { key: "indigo",   label: "Indigo",          scheme: { accent: "#818CF8", accentMuted: "#1E1B3A", surface: "#0F1226", border: "#272A4A" } },
  { key: "emerald",  label: "Emerald",         scheme: { accent: "#34D399", accentMuted: "#0B2E25", surface: "#0F1A18", border: "#1F3A33" } },
  { key: "sky",      label: "Sky",             scheme: { accent: "#38BDF8", accentMuted: "#0B2436", surface: "#0F1820", border: "#1F3043" } },
  { key: "rose",     label: "Rose",            scheme: { accent: "#FB7185", accentMuted: "#2E1218", surface: "#1A1014", border: "#3A1F26" } },
  { key: "slate",    label: "Slate (neutral)", scheme: { accent: "#94A3B8", accentMuted: "#1E293B", surface: "#0F172A", border: "#1E293B" } },
];

export const DEFAULT_SCHEME: ColorScheme = SCHEME_PRESETS[0].scheme;

// ─── Store shape ────────────────────────────────────────────────────────────

interface WhiteLabelState {
  /** Firm logo — URL or data URL. null = use the default firm-name text. */
  logoUrl: string | null;
  /** Display name shown in headers when there's no logo. */
  firmName: string;
  /** The single firm-wide scheme. */
  globalScheme: ColorScheme;
  /** Per-department override; falls back to globalScheme when absent. */
  departmentSchemes: Record<string, ColorScheme>;
}

interface WhiteLabelApi extends WhiteLabelState {
  setLogo(url: string | null): void;
  setFirmName(name: string): void;
  setGlobalScheme(scheme: ColorScheme): void;
  setDepartmentScheme(deptId: string, scheme: ColorScheme | null): void;
  /** Resolves the effective scheme for a department (override → global). */
  resolveScheme(deptId?: string | null): ColorScheme;
}

const Ctx = createContext<WhiteLabelApi | null>(null);

export function WhiteLabelProvider({
  children, initialFirmName = "Majors Law Group",
}: { children: ReactNode; initialFirmName?: string }) {
  const [state, setState] = useState<WhiteLabelState>({
    logoUrl: null,
    firmName: initialFirmName,
    globalScheme: DEFAULT_SCHEME,
    departmentSchemes: {},
  });

  const setLogo = useCallback((url: string | null) => {
    setState(prev => ({ ...prev, logoUrl: url }));
    // TODO Phase B — upload + persist to firm_branding.logo_url.
  }, []);
  const setFirmName = useCallback((name: string) => {
    setState(prev => ({ ...prev, firmName: name }));
  }, []);
  const setGlobalScheme = useCallback((scheme: ColorScheme) => {
    setState(prev => ({ ...prev, globalScheme: scheme }));
  }, []);
  const setDepartmentScheme = useCallback((deptId: string, scheme: ColorScheme | null) => {
    setState(prev => {
      const next = { ...prev.departmentSchemes };
      if (scheme === null) delete next[deptId];
      else next[deptId] = scheme;
      return { ...prev, departmentSchemes: next };
    });
  }, []);
  const resolveScheme = useCallback((deptId?: string | null) => {
    if (deptId && state.departmentSchemes[deptId]) return state.departmentSchemes[deptId];
    return state.globalScheme;
  }, [state.departmentSchemes, state.globalScheme]);

  const api: WhiteLabelApi = useMemo(() => ({
    ...state, setLogo, setFirmName, setGlobalScheme, setDepartmentScheme, resolveScheme,
  }), [state, setLogo, setFirmName, setGlobalScheme, setDepartmentScheme, resolveScheme]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWhiteLabel(): WhiteLabelApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWhiteLabel must be used inside WhiteLabelProvider");
  return v;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** CSS variables for one scope — apply with style={schemeCss(scheme)}. */
export function schemeCss(scheme: ColorScheme): CSSProperties {
  return {
    // Cast to keep TS happy with custom CSS properties.
    ["--lfs-accent" as string]:        scheme.accent,
    ["--lfs-accent-muted" as string]:  scheme.accentMuted,
    ["--lfs-surface" as string]:       scheme.surface,
    ["--lfs-border" as string]:        scheme.border,
  };
}

/** Find the preset key for a scheme, if it matches one — for the picker. */
export function presetKeyFor(scheme: ColorScheme): string | null {
  return SCHEME_PRESETS.find(p =>
    p.scheme.accent === scheme.accent
    && p.scheme.accentMuted === scheme.accentMuted
    && p.scheme.surface === scheme.surface
    && p.scheme.border === scheme.border,
  )?.key ?? null;
}
