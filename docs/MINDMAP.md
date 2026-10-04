# LoanTracker — System Mind Map

A one-page overview of everything the system is and does. Diagrams use [Mermaid](https://mermaid.js.org/) and render on GitHub and in VS Code (with a Mermaid preview extension).

```mermaid
mindmap
  root((LoanTracker))
    Purpose
      Track money lent to people GIVEN
      Track money borrowed from people TAKEN
      100% offline, single user, single device
    Core Entities
      Person
        name, phone, notes
      Account
        name, description, icon
        Groups GIVEN loans by funding source
      Loan
        amount, type, status, due date, notes
        Status OPEN / PARTIAL / PAID
      Payment
        amount, date, notes
        Drives loan status
    Screens
      Dashboard
        Greeting + totals To Receive / To Pay
        Pinned loans
        Tabs Receive / Pay
      People
        Search by name
        Per-person balances
      Person Detail
        Loans for one person
        Edit / delete person
      Loan Detail
        Payment history
        Edit / delete loan, delete payment
      Accounts
        Outstanding GIVEN balance per account
      Account Detail
        Open GIVEN loans for one account
      Forms
        Add/Edit Person
        Add/Edit Loan
        Add/Edit Account
        Add Payment
      Settings
        Display preferences
        Export / Import backup
        PIN + biometric lock
        Clear all data
    Interactions
      Swipe left on loan card
        Add payment
        Mark paid with confetti
        Mark unpaid
        Undo last payment
      Long press to pin / unpin
      Peek animation hints swipe
      Haptic feedback
      Android back button
    Security
      4-digit PIN SHA-256 hashed
      Biometric unlock fingerprint / face / iris
      Re-lock on app pause
      3 failed attempts then 30 s lockout
    Storage
      IndexedDB via Dexie
        people, accounts, loans, payments
      localStorage
        lt_settings
        lt_pinned_loans
        app_security_pin
        app_biometric_enabled
      JSON backup file
    Tech Stack
      React 18 + TypeScript
      Vite 5 + SWC
      Tailwind CSS + shadcn/ui Radix
      TanStack Query
      Framer Motion
      Zod validation
      date-fns
      Capacitor 8 Android
      PWA via vite-plugin-pwa
    Platforms
      Android APK / AAB com.nihap.loantracker
      Installable PWA
      Desktop browser with sidebar layout
```

## Reading guide

| Branch | Detail document |
|---|---|
| Core Entities, Storage | [ERD.md](ERD.md) |
| Screens, Tech Stack, Platforms | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Interactions, Security | [USE_CASES.md](USE_CASES.md) |
| Everything, with requirements | [SRS.md](SRS.md) |
