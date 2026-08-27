# OBL — Our Business Ledger

A local-only, single-user income & expense tracker for small family-run businesses.

**Tagline:** Your family business, on your phone.

## What it is

- **Local-only**: all data stays on the phone (IndexedDB). No backend, no cloud,
  works fully offline.
- **Single owner**: one device, one person keeping the books for the family business.
- **Separate from TSL**: this is an independent app with no shared code with
  Temple Seva Ledger.

## Features (v1)

- Add income & expense (amount, date, main category, sub-category, notes)
- Category manager — add/edit/hide income & expense main + sub categories
- Home screen with today's income/expense and month profit, quick-add
- Day or month views of entries with running totals
- Profit view (income − expense)
- Backup/export & restore (JSON file with images embedded)

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Build:

```bash
npm run build    # outputs to dist/, installable PWA
```

## Scope (v1 core)

F1 Add expense & income · F2 Category manager · F3 Today + quick-add
F4 Day/month views · F5 Profit view · F6 Backup/restore

Deferred to v2: credit tracking, stock, daily reminders, insights, receipt photos,
local lock.

See `../local-ledger-requirements.md` for the full requirements doc.
