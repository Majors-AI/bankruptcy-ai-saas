// Firm-level consult settings — Phase A stub.
//
// Hardcoded for the MLG pilot. A later phase reads these per-firm from a
// firm_settings table (or columns on `firms`) keyed off the current admin's
// firm_id. Until then, every caller in the app reads from this module so the
// migration to a DB-backed source is a one-file swap.
//
// What this drives today:
//   - ConsultSchedulerPanel: which modality options the admin can pick.
//   - NewLeadInline: the default modality stamped onto a freshly-booked consult.
//
// Surface 2 (client self-schedule) will read the same settings so the
// debtor-facing flow shows the same modality choices the firm allows.

export type ConsultModality = "phone" | "video" | "in_person";

export interface FirmSettings {
  /** When false, the in-person modality option is hidden from every surface. */
  allowInPersonConsults: boolean;
  /** Pre-selected modality for new consults — must be enabled by other flags. */
  defaultModality: ConsultModality;
}

export const firmSettings: FirmSettings = {
  allowInPersonConsults: false,
  defaultModality: "phone",
};

/** Modality options the firm currently offers, in display order. */
export function availableModalities(): ConsultModality[] {
  const opts: ConsultModality[] = ["phone", "video"];
  if (firmSettings.allowInPersonConsults) opts.push("in_person");
  return opts;
}

export function modalityLabel(m: ConsultModality): string {
  switch (m) {
    case "phone":     return "Phone";
    case "video":     return "Video";
    case "in_person": return "In Person";
  }
}
