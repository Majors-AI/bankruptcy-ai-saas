// Regression test — every <SigningReview ...> mount site in the codebase
// must be wrapped in <RulesAuditProvider> in the same JSX block, because
// SigningReview's children (LongFormDeductionPanel, Ch13Eligibility)
// call useRulesAudit() which throws if no provider ancestor exists.
//
// The throw fires only when isLawyer === true (LongFormDeductionPanel's
// outer `if (!props.isLawyer)` short-circuits otherwise), so the latent
// bug was invisible until a lawyer opened a signing-review surface. This
// test locks the invariant at the structural level — the test breaks the
// moment someone adds a new <SigningReview ...> mount without the wrap,
// regardless of whether anyone manually exercises the lawyer path.
//
// ─── Why a static source-grep test instead of a runtime render test ──────
//
// A render test would mount each entry point and assert no throw. That
// requires @testing-library/react + jsdom/happy-dom, which the repo does
// not currently include — adding them just for this one regression class
// is scope creep. The structural test gives equivalent regression
// coverage for the actual bug class (a missing wrap) at the cost of not
// catching runtime-only failures inside SigningReview's deeper tree. The
// trade-off is documented; upgrade to render tests when broader React
// testing infra lands.
//
// ─── How the source files reach the test ────────────────────────────────
//
// Vite's `import.meta.glob` with `{ query: '?raw', import: 'default',
// eager: true }` inlines file contents at build time — no node:fs, no
// `@types/node` requirement, works inside vitest because vitest is built
// on Vite. Re-evaluated every test run; reflects the current working
// tree.
//
// Updating this test:
//   - A new <SigningReview ...> mount site is added → extend
//     KNOWN_ENTRY_POINTS (which re-applies the wrap assertion) AND, if
//     the new mount is in a file not already in SOURCE_FILES, add it to
//     the import.meta.glob list below.
//   - An existing entry point moves → update its `anchor` regex.

import { describe, test, expect } from "vitest";

// Vite reads these files raw at build time. The pattern list must
// include every file referenced by KNOWN_ENTRY_POINTS and by the
// catch-all mount-count scan below.
const SOURCE_FILES = import.meta.glob<string>(
  [
    "/src/App.tsx",
    "/src/LegalDepartmentPortal.tsx",
    "/src/LegalAdminPortal.tsx",
  ],
  { query: "?raw", import: "default", eager: true },
);

function srcOf(rel: string): string {
  const key = `/${rel}`;
  const content = SOURCE_FILES[key];
  if (!content) {
    throw new Error(
      `Source not loaded by import.meta.glob: ${rel}. Add it to the SOURCE_FILES pattern list at the top of this test file.`,
    );
  }
  return content;
}

// ─── Known entry points and the JSX block to look at in each ────────────

interface EntryPoint {
  name: string;
  file: string;
  /** Regex that captures a SINGLE JSX block containing the mount site,
   *  used to scope the wrap check. Must match exactly one block per
   *  entry point. */
  anchor: RegExp;
}

const KNOWN_ENTRY_POINTS: ReadonlyArray<EntryPoint> = [
  {
    name: "App.tsx view=signing_review (Ch.7 portal)",
    file: "src/App.tsx",
    // Captures the entire `if (view === 'signing_review') { return (...) }`
    // block — from the predicate down to the closing ErrorBoundary.
    anchor: /view === 'signing_review'\)\s*\{[\s\S]*?<\/ErrorBoundary>/,
  },
  {
    name: "App.tsx view=signing_review_ch13 (Ch.13 portal)",
    file: "src/App.tsx",
    anchor: /view === 'signing_review_ch13'\)\s*\{[\s\S]*?<\/ErrorBoundary>/,
  },
  {
    name: "LegalDepartmentPortal section=signing_review (embedded)",
    file: "src/LegalDepartmentPortal.tsx",
    // The whole RulesAuditProvider section-body wrap. If the wrap is
    // removed, the anchor stops matching and the test fails immediately
    // with "anchor did not match" — which is the intended signal.
    anchor: /<RulesAuditProvider>[\s\S]*?section === "signing_review"[\s\S]*?<\/RulesAuditProvider>/,
  },
];

// ─── Per-entry-point: assert RulesAuditProvider wraps SigningReview ─────

describe("RulesAuditProvider invariant — every SigningReview mount must be wrapped", () => {
  for (const ep of KNOWN_ENTRY_POINTS) {
    test(ep.name, () => {
      const src = srcOf(ep.file);
      const blockMatch = src.match(ep.anchor);
      expect(
        blockMatch,
        `Anchor regex did not match in ${ep.file}. The entry point may have moved — update KNOWN_ENTRY_POINTS.anchor.`,
      ).not.toBeNull();
      const block = blockMatch![0];

      // The block MUST contain a <SigningReview opening tag — otherwise
      // the anchor matched the wrong region.
      expect(
        block,
        `Anchor regex for ${ep.name} matched a JSX block that does not contain <SigningReview. Check the anchor.`,
      ).toMatch(/<SigningReview/);

      // The provider must open BEFORE <SigningReview and close AFTER it
      // (textually — JSX nesting is preserved by the source order).
      const providerOpenIdx  = block.indexOf("<RulesAuditProvider>");
      const signingIdx       = block.indexOf("<SigningReview");
      const providerCloseIdx = block.indexOf("</RulesAuditProvider>");

      expect(
        providerOpenIdx,
        `<RulesAuditProvider> opening tag missing in ${ep.name}. SigningReview's lawyer path will throw "useRulesAudit must be used inside RulesAuditProvider" at runtime.`,
      ).toBeGreaterThan(-1);
      expect(
        providerCloseIdx,
        `</RulesAuditProvider> closing tag missing in ${ep.name}.`,
      ).toBeGreaterThan(-1);
      expect(
        signingIdx,
        `<SigningReview ...> not found in ${ep.name} block.`,
      ).toBeGreaterThan(providerOpenIdx);
      expect(
        providerCloseIdx,
        `</RulesAuditProvider> appears BEFORE <SigningReview ...> in ${ep.name} — the wrap is broken.`,
      ).toBeGreaterThan(signingIdx);
    });
  }

  // ─── Catch-all: total <SigningReview ...> JSX mount count must equal
  //     the number of known entry points. If someone adds a new mount
  //     site, this test fails and forces them to either update
  //     KNOWN_ENTRY_POINTS (which re-runs the per-EP wrap assertion) or
  //     consciously bump EXPECTED_MOUNT_COUNT below.
  test("no unknown <SigningReview ...> mount sites in src/", () => {
    const FILES_TO_SCAN = [
      "src/App.tsx",
      "src/LegalDepartmentPortal.tsx",
      "src/LegalAdminPortal.tsx",
    ];

    // Count JSX mount sites only — exclude TS type references like
    // `SigningReviewRow`, import lines, and `<SigningReviewProps`. The
    // pattern below matches `<SigningReview ` (with whitespace) or
    // `<SigningReview\n` or `<SigningReview/>` — i.e. opening JSX tags,
    // NOT type identifiers.
    let totalMounts = 0;
    const mountRegex = /<SigningReview(?=[\s/>])/g;
    for (const f of FILES_TO_SCAN) {
      const src = srcOf(f);
      const matches = src.match(mountRegex);
      totalMounts += matches ? matches.length : 0;
    }

    expect(
      totalMounts,
      `Mount-site count drift: found ${totalMounts} <SigningReview ...> JSX mounts across ${FILES_TO_SCAN.join(
        ", ",
      )}, expected ${KNOWN_ENTRY_POINTS.length}. ` +
        `Either a mount was added (extend KNOWN_ENTRY_POINTS so it's checked for the RulesAuditProvider wrap) ` +
        `or a mount was removed (drop the obsolete entry).`,
    ).toBe(KNOWN_ENTRY_POINTS.length);
  });
});
