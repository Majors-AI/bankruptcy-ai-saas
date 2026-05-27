export const CASE_TYPES = [
  { value: "ch7_regular",    label: "Ch. 7 Regular",      sub: "Filing fee separate — paid before signing appointment" },
  { value: "ch7_bifurcated", label: "Ch. 7 Bifurcated",   sub: "Court filing fee rolled into attorney fee" },
  { value: "ch13_flat_fee",  label: "Ch. 13 Flat Fee",    sub: "$13 filing fee paid before filing; portion upfront, rest through plan" },
  { value: "limited_scope",  label: "Limited Scope",      sub: "Flat fee, defined scope of services (e.g. debt negotiation)" },
];

export const CHAPTER_FILING_FEES: Record<string, number> = {
  ch7_regular:    338,
  ch7_bifurcated: 338,
  ch13_flat_fee:  313,
  limited_scope:  0,
};

export const ATTORNEY_FEES: Record<string, number> = {
  ch7_regular:    1500,
  ch7_bifurcated: 1838,
  ch13_flat_fee:  4000,
  limited_scope:  750,
};

// Standard online credit counseling provider fee (§ 109(h))
export const CREDIT_COUNSELING_FEE = 20;
