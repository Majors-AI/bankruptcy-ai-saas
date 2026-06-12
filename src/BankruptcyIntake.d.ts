// Sibling .d.ts shim for the extension-less `./BankruptcyIntake` import
// at App.tsx:2. The underlying file is the locked `BankruptcyIntake.jsx`
// (never modify) — this shim gives TS a declaration to resolve the
// import against. The component itself is typed `unknown` because the
// .jsx has no exported prop interface; consumers cast or pass through.

import type { ComponentType } from "react";

declare const BankruptcyIntake: ComponentType<any>;
export default BankruptcyIntake;
