# CLAUDE.md

Project conventions and design system for this repo. Claude Code should treat this
as authoritative and follow it on every task unless the prompt says otherwise.

## Stack

- Next.js 14 (App Router, Server Components by default; `"use client"` only when needed)
- TypeScript, strict mode — no `any` without a comment explaining why
- Tailwind CSS + shadcn/ui as the component foundation
- Supabase (Postgres + Auth + RLS) for data and auth
- AWS S3 for document/file storage (access via signed URLs, never public buckets)
- Plaid (financial data), SendGrid (email), Twilio (SMS) for integrations

## Design system — read before building any UI

1. **Component-library first.** Use the 21st.dev `magic` MCP and existing shadcn/ui
   components as the base. Do not hand-roll buttons, inputs, dialogs, tables, or other
   primitives that already exist. Compose, don't reinvent.
2. **Match existing tokens.** Pull colors, spacing, radius, and typography from
   `/styles` (or `tailwind.config.ts` / `globals.css`). If a token is missing, add it
   there — never hardcode hex values inline.
3. **No generic AI look.** Avoid default purple gradients, neon glows, and the
   "everything is a card with a drop shadow" pattern. Favor restraint: clear hierarchy,
   generous whitespace, one accent color used deliberately.
4. **Professional, trustworthy tone.** This is legal/financial software for clients in
   debt and attorneys reviewing sensitive matters. Calm, legible, confidence-inspiring —
   not playful.

## Visual standards

- Type scale: a small, consistent set (e.g. text-sm body, text-base/lg for emphasis,
  text-xl+ for page titles). Don't introduce one-off sizes.
- Spacing: stick to the Tailwind 4px scale (`gap-2`, `p-4`, `space-y-6`). No arbitrary
  pixel values unless matching a mockup.
- Color: neutral base (slate/zinc), one accent, plus semantic colors for
  success/warning/error/info. Define them as tokens, reference by name.
- Density: comfortable, not cramped. Tables and queues are read by staff all day —
  optimize for scanability over fitting more rows.

## Every component must handle

- **States:** loading, empty, error, and success — not just the happy path.
- **Responsiveness:** works at mobile, tablet, and desktop widths.
- **Accessibility:** keyboard navigable, visible focus rings, real labels on inputs,
  sufficient contrast, `aria-*` where shadcn doesn't already provide it.
- **Forms:** validate inline, disable submit while pending, show server errors clearly.

## Build workflow

For any non-trivial screen:

1. If a mockup or reference image is provided (e.g. in `/design`), implement to match it.
   If not, sketch the layout in prose first and confirm before coding a large screen.
2. Pull components from the `magic` MCP / shadcn rather than building from scratch.
3. Wire data with proper loading and error handling.
4. Self-review against this file before declaring done: states covered? tokens used?
   accessible? responsive?

## Stack conventions

- Server Components for data fetching; keep client components lean and interactive-only.
- Data access goes through typed helpers, not inline `fetch` scattered in components.
- Supabase: assume Row Level Security is on. Never bypass RLS with the service-role key
  in client-reachable code. Service-role keys live server-side only.
- S3: serve files through short-lived signed URLs. No public objects, no keys in the
  client bundle.
- Secrets (Supabase service key, Plaid, SendGrid, Twilio, AWS) live in env vars and are
  never logged, committed, or rendered to the client.

## Compliance-aware UI (this product specifically)

This software operates under bankruptcy/debt-relief rules. The UI must reflect that —
flag rather than silently skip these:

- **Attorney approval gates.** Any binding or outbound client/creditor communication
  (settlement offers, negotiation messages, filings) must route through an explicit
  attorney-review/approval step in the UI. Never auto-send binding communications
  without an approval action.
- **Required disclosures.** Where regulated disclosures apply (e.g. debt-relief agency /
  §528, FCRA/credit-pull consent), the disclosure and consent capture must be present in
  the flow — don't drop it for a cleaner screen. If unsure whether a screen needs one,
  surface the question rather than omitting.
- **UPL separation.** Keep attorney-only functions visually and functionally distinct
  from staff/client functions; don't blur role boundaries in shared components.

If a requested change would weaken any of the above, say so before implementing it.

## Don't

- Don't introduce a new UI library or CSS framework alongside Tailwind/shadcn.
- Don't add heavy dependencies for things the stack already does.
- Don't ship a screen with only the happy path wired up.
- Don't put secrets, PII, or signed URLs in URL query strings or logs.
- Don't take a "quick fix" that creates worse downstream problems — raise it instead.
