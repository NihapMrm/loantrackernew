# LoanTracker

An **offline-only** personal loan tracker. Record money you lent (`GIVEN`) or borrowed (`TAKEN`), log payments against each loan, and see at a glance what you will receive and what you owe.

There is no backend, no login, no sync and no analytics. All data lives on your device (IndexedDB). It ships as an Android app (Capacitor, `com.nihap.loantracker`) and as an installable PWA.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Building the Android app](#building-the-android-app)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Data and backups](#data-and-backups)
- [Security and privacy](#security-and-privacy)
- [Testing](#testing)
- [Documentation](#documentation)
- [Known limitations](#known-limitations)

## Features

**Dashboard**
- Time-of-day greeting, **To Receive** and **To Pay** totals.
- Pinned loans shown in their own section above the tabs.
- **Receive** (GIVEN) and **Pay** (TAKEN) tabs listing unpaid loans, newest first.
- Loan cards with a progress bar (paid / amount).

**People**
- Add, edit and delete counterparties. Deleting a person also deletes their loans and payments (one transaction).

**Loans**
- Create loans in either direction, with an optional account, due date and notes.
- Editing a loan saves amount, account, due date and notes. Person and type are fixed once created.
- Status is calculated automatically: `PAID` when paid ≥ amount, `PARTIAL` when paid > 0, otherwise `OPEN`.

**Payments**
- Partial or full payments with a date and notes.
- Swipe a loan card for quick actions (mark paid, mark unpaid, undo last payment). Long-press to pin. Haptic feedback on native.

**Accounts**
- Group lent money by account (wallet, bank, cash, and so on) with an icon. Deleting an account keeps its loans and clears their account.

**Settings**
- Currency symbol and position (default `Rs.`), number locale, date format, haptics on/off.
- Export, import and clear all data.
- PIN and biometric lock (Android only).

**Platform**
- Mobile bottom navigation, desktop sidebar.
- Installable PWA, Android app, animated splash screen.

## Tech stack

| Area | Choice |
|---|---|
| UI | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS 3, shadcn/ui (Radix), Framer Motion |
| Data | Dexie 4 (IndexedDB), TanStack Query 5 |
| Forms | React Hook Form, Zod |
| Routing | React Router 6 (`HashRouter`) |
| Native | Capacitor 8 (app, filesystem, haptics, share, splash screen), `capacitor-native-biometric` |
| PWA | `vite-plugin-pwa` |
| Tests | Vitest (jsdom) |

## Getting started

Requires Node.js 18+ and npm.

```sh
npm install
npm run dev        # http://localhost:8080
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 8080 |
| `npm run build` | Production build into `dist/` |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest in watch mode |

## Building the Android app

```sh
npm run build            # always build first
npx cap sync android     # copy dist/ into the Android project
npx cap open android     # open in Android Studio, then run or build a release
```

Release signing credentials are read from `android/local.properties`. Never commit this file.

## Project structure

```
src/
  App.tsx                 providers, HashRouter, lock gate, nav, all routes
  main.tsx                entry point
  lib/
    db.ts                 Dexie schema (LoanTrackerDB v1), generateId, nowISO
    formatting.ts         formatAmount, formatDate (always use for display)
    security.tsx          PIN (SHA-256) and biometric lock, native only
    utils.ts              cn() helper
  hooks/
    useLoans.ts           people, loans, payments queries and mutations,
                          calculateBalance, calculateTotals, recalcStatus
    useAccounts.ts        accounts CRUD, ACCOUNT_ICONS
    useSettings.ts        settings in localStorage (lt_settings)
    usePinnedLoans.ts     pinned loans in localStorage
  pages/                  one file per route
  components/
    SwipeableLoanCard.tsx swipe actions, long-press pin, haptics
    layout/               BottomNav, DesktopSidebar, MobileLayout
    ui/                   shadcn/ui primitives
  test/                   Vitest tests
android/                  Capacitor Android project
docs/                     specification and design documents
public/                   PWA manifest and icons
```

### Routes

| Path | Page |
|---|---|
| `/` | Dashboard |
| `/people`, `/person/:id` | People list, person detail |
| `/add-person`, `/edit-person/:id` | Person form |
| `/add-loan`, `/edit-loan/:id`, `/loan/:id` | Loan form, loan detail |
| `/add-payment/:loanId` | Add payment |
| `/accounts`, `/account/:id` | Accounts list, account detail |
| `/add-account`, `/edit-account/:id` | Account form |
| `/settings` | Settings, backup, security |

## How it works

- **Data access** goes through hooks built on TanStack Query. After every write the hook invalidates the right query keys and shows a `sonner` toast.
- **Storage format:** dates are stored as ISO strings and converted to `Date` by the hooks. `db.ts` holds raw row types, `useLoans.ts` holds enriched types.
- **Loan status is stored**, not computed on read. Any code that changes payments or a loan amount must call `recalcStatus(loanId)`. `deriveStatus` is the pure rule.
- **Cascades** run in Dexie transactions: deleting a person removes their loans and payments, and deleting an account sets `account_id` to `null` on its loans.
- **Schema changes:** add `this.version(2).stores({...}).upgrade(...)` in `db.ts`. Never edit version 1.
- **`HashRouter` is required** for the Capacitor WebView. Do not switch to `BrowserRouter`.
- **Date inputs:** use `todayISODate()` (local time), not `toISOString()`, for `<input type="date">` values.
- **Native-only code** is guarded with `Capacitor.isNativePlatform()`.

## Data and backups

Settings → Data provides:

- **Export:** writes `loantracker-backup-YYYY-MM-DD.json` and opens the share sheet on Android or downloads it in a browser.
- **Import:** validates the file with Zod, asks for confirmation, then replaces all data in a single transaction. If validation fails, nothing is written.
- **Clear:** deletes all data after confirmation.

Backup format (`version: 1`):

```json
{
  "exportedAt": "2026-10-06T08:36:21.644Z",
  "version": 1,
  "people":   [{ "id", "name", "phone", "notes", "created_at", "updated_at" }],
  "accounts": [{ "id", "name", "description", "icon", "created_at", "updated_at" }],
  "loans":    [{ "id", "person_id", "account_id", "amount", "type", "status",
                "due_date", "notes", "created_at", "updated_at" }],
  "payments": [{ "id", "loan_id", "amount", "payment_date", "notes", "created_at" }]
}
```

Rules enforced on import: `amount` must be positive, `type` is `GIVEN` or `TAKEN`, `status` is `OPEN`, `PARTIAL` or `PAID`, and every payment must have a non-empty `loan_id`. A payment without a `loan_id` makes the whole import fail.

Backups are plain JSON and are **not encrypted**. Keep them somewhere safe.

## Security and privacy

- No network calls, no accounts, no telemetry. Data never leaves the device unless you export it.
- On Android you can set a 4-digit PIN (stored only as a SHA-256 hash) and optionally enable biometric unlock.
- The app locks at start and every time it is sent to the background. After 3 wrong PINs, input is blocked for 30 seconds, and the lockout survives a restart.
- The PIN is a casual lock, not strong protection (unsalted hash of 4 digits).
- Security settings are hidden in the browser/PWA.
- See the [privacy policy](docs/privacy.html).

## Testing

```sh
npm test
```

`src/test/loans.test.ts` covers the status rule, balance and totals. Run `npm run lint` and `npm run build` before opening a pull request.

## Documentation

- [SRS](docs/SRS.md): full specification and known issues
- [Architecture](docs/ARCHITECTURE.md)
- [ERD](docs/ERD.md)
- [Use cases](docs/USE_CASES.md)
- [Mind map](docs/MINDMAP.md)
- [Privacy policy](docs/privacy.html)
- [CLAUDE.md](CLAUDE.md): notes for AI coding assistants

## Known limitations

- No interest calculation, per-loan currency, reminders, multi-device sync or multi-user sharing.
- "Mark unpaid" and "Undo last" swipe actions run without confirmation by design.
- Backups are unencrypted JSON.
- `package-lock.json` and `bun.lockb` may still list the removed Supabase package until `npm install` is re-run.

See SRS section 9 for the full list.
