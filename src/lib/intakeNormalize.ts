// BAN-27 Blocker 2: Portal prefill schema normalizer.
//
// Three intake shapes coexist in the database:
//   1. Old JSONB blob nested:   intake.form_data.firstName     (BankruptcyIntake.jsx pre-Phase 1)
//   2. Old direct camelCase:    intake.firstName               (BankruptcyIntake.jsx after camelCase flatten)
//   3. New snake_case columns:  intake.first_name              (ClientIntakeForm.tsx + intake_submissions schema)
//
// The portal mappers (mapIntakeToRetention in bankruptcy-information-and-document-questionnaire(1).jsx
// and buildPreFill in FullBankruptcyQuestionnaire.tsx) historically read only one shape, so submissions
// from the other forms left prefill fields empty. This normalizer returns a single camelCase view that
// each downstream mapper can rely on.
//
// We coalesce in priority order: direct camelCase → snake_case → nested form_data → undefined.
// The original intake object is spread last so any non-listed fields (e.g. array-typed *_json fields,
// per-section nested objects) flow through untouched.

type AnyRecord = Record<string, unknown>;

export function normalizeIntake(intake: AnyRecord | null | undefined): AnyRecord {
  if (!intake) return {};
  const fd = (intake.form_data as AnyRecord | undefined) || {};
  const pick = (...vals: unknown[]) => vals.find(v => v !== undefined && v !== null && v !== '');

  return {
    // Identity
    firstName:       pick(intake.firstName,       intake.first_name,        fd.firstName),
    middleName:      pick(intake.middleName,      intake.middle_name,       fd.middleName),
    lastName:        pick(intake.lastName,        intake.last_name,         fd.lastName),
    suffix:          pick(intake.suffix,                                    fd.suffix),
    // SSN: ssnLastFour is what the new intake collects (only last 4 digits);
    // ssn is the legacy field that may hold a full SSN from old intakes.
    ssn:             pick(intake.ssn,                                       fd.ssn),
    ssnLastFour:     pick(intake.ssnLastFour,     intake.ssn_last4,         fd.ssnLastFour),
    dob:             pick(intake.dob,                                       fd.dob),
    email:           pick(intake.email,                                     fd.email),
    phone:           pick(intake.phone,                                     fd.phone),
    altPhone:        pick(intake.altPhone,        intake.alt_phone,         fd.altPhone),

    // Spouse
    spouseFirstName: pick(intake.spouseFirstName, intake.spouse_first_name, fd.spouseFirstName),
    spouseLastName:  pick(intake.spouseLastName,  intake.spouse_last_name,  fd.spouseLastName),
    spouseDob:       pick(intake.spouseDob,       intake.spouse_dob,        fd.spouseDob),
    spouseEmail:     pick(intake.spouseEmail,     intake.spouse_email,      fd.spouseEmail),

    // Filing / residency
    filingType:      pick(intake.filingType,      intake.filing_type,       fd.filingType),
    chapter:         pick(intake.chapter,                                   fd.chapter),
    state:           pick(intake.state,                                     fd.state),
    county:          pick(intake.county,                                    fd.county),
    city:            pick(intake.city,                                      fd.city),
    streetAddress:   pick(intake.streetAddress,   intake.street_address,    fd.streetAddress, intake.address, fd.address),
    zipCode:         pick(intake.zipCode,         intake.zip_code,          fd.zipCode,       intake.zip,     fd.zip),

    // Household
    maritalStatus:   pick(intake.maritalStatus,   intake.marital_status,    fd.maritalStatus),
    numDependents:   pick(intake.numDependents,   intake.num_dependents,    fd.numDependents),
    dependentsJson:  pick(intake.dependentsJson,  intake.dependents_json,   fd.dependentsJson, fd.dependents_json),
    dependents:      pick(intake.dependents,      intake.dependents_json,   fd.dependents,     fd.dependents_json),

    // Real property
    ownsRealEstate:      pick(intake.ownsRealEstate,      intake.owns_real_estate,      fd.ownsRealEstate),
    realPropertiesJson:  pick(intake.realPropertiesJson,  intake.real_properties_json,  fd.realPropertiesJson, fd.real_properties_json),
    realProperties:      pick(intake.realProperties,      intake.real_properties_json,  fd.realProperties),
    realPropValue:       pick(intake.realPropValue,       intake.real_prop_value,       fd.realPropValue),
    mortgageBalance:     pick(intake.mortgageBalance,     intake.mortgage_balance,      fd.mortgageBalance),

    // Personal property
    vehiclesJson:        pick(intake.vehiclesJson,        intake.vehicles_json,         fd.vehiclesJson, fd.vehicles_json),
    vehicles:            pick(intake.vehicles,            intake.vehicles_json,         fd.vehicles),
    bankBalance:         pick(intake.bankBalance,         intake.bank_balance,          fd.bankBalance),
    retirementBalance:   pick(intake.retirementBalance,   intake.retirement_balance,    fd.retirementBalance),
    ownedBusiness:       pick(intake.ownedBusiness,       intake.owned_business,        fd.ownedBusiness),

    // Income
    incomeSourcesJson:   pick(intake.incomeSourcesJson,   intake.income_sources_json,   fd.incomeSourcesJson, fd.income_sources_json),
    incomeSources:       pick(intake.incomeSources,       intake.income_sources_json,   fd.incomeSources),

    // Preserve every other field from the original object (per-section nested objects,
    // misc *_json arrays, expense rows, etc.). Spread LAST so original keys are not
    // accidentally overwritten by the normalized aliases above (the original input
    // wins when a key already has a meaningful value).
    ...intake,
  };
}
