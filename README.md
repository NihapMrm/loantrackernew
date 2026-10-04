# LoanTracker

Offline personal loan tracker. Record money you lent (GIVEN) or borrowed (TAKEN), log payments, see what you will receive and what you owe. All data stays on the device (IndexedDB). React + TypeScript + Vite, packaged for Android with Capacitor, also installable as a PWA.

## Run

```sh
npm install
npm run dev            # http://localhost:8080
npm run build && npx cap sync android && npx cap open android
npm test
```

Release signing credentials go in `android/local.properties` (not committed).

## Docs

- [SRS](docs/SRS.md) — full specification and known issues
- [Architecture](docs/ARCHITECTURE.md) · [ERD](docs/ERD.md) · [Use cases](docs/USE_CASES.md) · [Mind map](docs/MINDMAP.md)
- [Privacy policy](docs/privacy.html)
- [CLAUDE.md](CLAUDE.md) — notes for AI coding assistants
