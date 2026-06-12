// Ambient module declarations for locked legacy .jsx files that TypeScript
// can't infer types from. Per the standing rule, the actual .jsx files
// (BankruptcyIntake.jsx + bankruptcy-information-and-document-
// questionnaire(1).jsx) must NEVER be modified — this file silences TS7016
// without touching them.
//
// Covers any import whose specifier ends in `.jsx`. Extension-less imports
// (e.g. `import X from './BankruptcyIntake'`) are handled by a sibling
// `.d.ts` shim (src/BankruptcyIntake.d.ts) — wildcard ambient declarations
// only match when the specifier itself ends in the wildcard suffix.

declare module "*.jsx" {
  import type { ComponentType } from "react";
  // Locked .jsx files have no exported prop types — `any` props lets
  // existing call sites compile while keeping the JSX-element shape so
  // TS accepts the component as a JSX tag.
  const Component: ComponentType<any>;
  export default Component;
}
