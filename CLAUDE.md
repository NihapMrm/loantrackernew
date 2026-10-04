# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

LoanTracker: an **offline-only** personal loan tracker (money lent = `GIVEN`, borrowed = `TAKEN`). React 18 + TypeScript + Vite SPA, wrapped for Android with Capacitor 8 (`com.nihap.loantracker`), also shipped as a PWA. No backend, no login, no network calls. All data is on-device.

Full docs: [docs/SRS.md](docs/SRS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ERD.md](docs/ERD.md), [docs/USE_CASES.md](docs/USE_CASES.md), [docs/MINDMAP.md](docs/MINDMAP.md).

## Commands

```sh
npm run dev           # Vite dev server on :8080
npm run build         # production build to dist/
npm run lint          # ESLint
npm test              # Vitest (jsdom)
npx cap sync android  # copy dist/ into the Android project
npx cap open android  # open in Android Studio
```

Run `npm run build` before `npx cap sync`. Release signing creds come from `android/local.properties` (never commit them).

## Layout

- `src/App.tsx` — providers, `HashRouter`, security gate (`LockScreen` when locked), mobile `BottomNav` vs `DesktopSidebar`, all routes.
- `src/lib/db.ts` — Dexie schema `LoanTrackerDB` v1: `people`, `accounts`, `loans`, `payments`. `generateId()` = `crypto.randomUUID()`, `nowISO()`.
- `src/hooks/useLoans.ts` — people/loans/payments queries + mutations, `calculateBalance`, `calculateTotals`, status recalculation.
- `src/hooks/useAccounts.ts` — accounts CRUD, `ACCOUNT_ICONS`.
- `src/hooks/useSettings.ts`, `usePinnedLoans.ts` — `localStorage` + custom window event for cross-component sync.
- `src/lib/security.tsx` — PIN (SHA-256 in localStorage) + biometric; native only; re-locks on app `pause`.
- `src/lib/formatting.ts` — `formatAmount`, `formatDate`; always use these for display.
- `src/pages/` — one file per route. `Settings.tsx` does export/import/clear directly on Dexie.
- `src/components/SwipeableLoanCard.tsx` — swipe actions, long-press pin, haptics.
- `src/components/ui/` — shadcn/ui primitives. Add new ones with the shadcn CLI style; don't hand-edit unless needed.

## Conventions

- Data access goes through hooks using TanStack Query (`useQuery` / `useMutation`). After a write, invalidate the right keys (`['loans']`, `['loan']`, `['people']`, `['person', id]`, `['accounts']`, `['account', id]`) and show a `sonner` toast.
- DB rows store dates as ISO strings; hooks convert to `Date`. `db.ts` types = raw rows, `useLoans.ts` types = enriched.
- Loan `status` is stored. Any code that changes payments **must** recompute it: PAID if paid ≥ amount, PARTIAL if paid > 0, else OPEN.
- Form validation uses Zod schemas defined at the top of each form page.
- Import alias `@/` → `src/`. Styling: Tailwind utility classes + `cn()` from `@/lib/utils`.
- Guard native-only code with `Capacitor.isNativePlatform()`.
- Schema change: add `this.version(2).stores({...}).upgrade(...)` in `db.ts`; never edit version 1.
- Keep pages self-contained; inline small sub-components in the page file (existing style).

## Gotchas

- `HashRouter` is required for the Capacitor WebView. Don't switch to `BrowserRouter`.
- Use `recalcStatus(loanId)` (in `useLoans.ts`) after any change to payments or loan amount; never hand-roll status logic. `deriveStatus` is the pure rule.
- Deleting a person cascades to their loans and payments; deleting an account nulls `account_id` on its loans. Both run in Dexie transactions.
- Loan edit saves `amount`, `account_id`, `due_date`, `notes` only; person and type are immutable.
- Import validates with Zod, confirms in a dialog, then wipes all tables and bulk-adds (single transaction).
- For `<input type="date">` values use `todayISODate()` (local time), not `toISOString()`.
- `.env` is gitignored and unused. Don't reintroduce a backend or cloud dependency.
- Default currency is `Rs.`; settings live in `localStorage` key `lt_settings`.
- Remaining caveats: SRS section 9.
