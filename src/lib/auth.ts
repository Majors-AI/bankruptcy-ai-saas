// BAN-35 — Platform-level role helpers.
//
// Mirrors the platform_role Postgres enum defined in
// 20260527020000_firms_and_user_profiles.sql. Keep these strings in sync.
//
// NOTE: this is distinct from staff_members.intake_portal_role (the PIN-login
// scheme used inside LegalAdminPortal). The intake_portal_role still applies
// inside that portal; PlatformRole applies across the whole app once Supabase
// auth is wired up. During the transition we map intake_portal_role values to
// PlatformRole values at the integration point (see CaseAcceptanceFlow usage).

export type PlatformRole =
  | 'super_admin_bankruptcy_ai'
  | 'firm_super_admin'
  | 'attorney'
  | 'legal_admin'
  | 'paralegal'
  | 'intake'
  | 'accounting'
  | 'client';

// Type guards
export function isAttorney(role: PlatformRole | null | undefined): boolean {
  return role === 'attorney';
}

export function isFirmStaff(role: PlatformRole | null | undefined): boolean {
  if (!role) return false;
  return (
    role === 'firm_super_admin' ||
    role === 'attorney' ||
    role === 'legal_admin' ||
    role === 'paralegal' ||
    role === 'intake' ||
    role === 'accounting'
  );
}

export function isBankruptcyAISuperAdmin(role: PlatformRole | null | undefined): boolean {
  return role === 'super_admin_bankruptcy_ai';
}

// Capability checks. UI uses these to enable/disable controls; the database
// layer should re-check via RLS once policies are tightened (separate PR).
export function canAcceptCase(role: PlatformRole | null | undefined): boolean {
  return role === 'attorney';
}

export function canQuoteFee(role: PlatformRole | null | undefined): boolean {
  return role === 'attorney';
}

export function canSetPaymentPlan(role: PlatformRole | null | undefined): boolean {
  return role === 'attorney' || role === 'legal_admin';
}

export function canRequestClarification(role: PlatformRole | null | undefined): boolean {
  return role === 'attorney';
}

// Map the intake_portal_role values from staff_members to PlatformRole values.
// Used by LegalAdminPortal when handing off into CaseAcceptanceFlow (BAN-35
// transition — once Supabase auth + user_profiles is the source of truth, this
// mapper goes away).
export function mapIntakePortalRoleToPlatformRole(
  intakePortalRole: string | null | undefined,
): PlatformRole | null {
  switch (intakePortalRole) {
    case 'super_admin':
      return 'firm_super_admin';
    case 'attorney_super_admin':
      return 'firm_super_admin';
    case 'attorney':
      return 'attorney';
    case 'legal_admin':
      return 'legal_admin';
    case 'paralegal':
      // PIN-gate paralegals resolve to the paralegal PlatformRole — the
      // single-department wall in portalAccess.ts then routes them only
      // to the Legal Department portal.
      return 'paralegal';
    default:
      return null;
  }
}
