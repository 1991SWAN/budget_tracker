# SmartPenny Development Setup

## Scope

This document covers the SmartPenny app in this repository root. The local `codex/` folder is a separate workspace and is not required to run the app.

## Requirements

- Node.js 20 or newer
- npm

## Environment

Create a local environment file such as `.env` and provide these values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
```

Notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are read by [dbClient.ts](/Users/apple/macWork/macCoding/vivecoding/02_codex/05_smartpenny_codex/services/dbClient.ts).
- `GEMINI_API_KEY` is forwarded through [vite.config.ts](/Users/apple/macWork/macCoding/vivecoding/02_codex/05_smartpenny_codex/vite.config.ts) for the Gemini client used by [geminiService.ts](/Users/apple/macWork/macCoding/vivecoding/02_codex/05_smartpenny_codex/services/geminiService.ts).

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The Vite dev server runs on `http://0.0.0.0:3000` by default.

## Verify

```bash
npm test
npm run build
```

## Main Entry Points

- [index.tsx](/Users/apple/macWork/macCoding/vivecoding/02_codex/05_smartpenny_codex/index.tsx)
- [App.tsx](/Users/apple/macWork/macCoding/vivecoding/02_codex/05_smartpenny_codex/App.tsx)
- [useAppController.ts](/Users/apple/macWork/macCoding/vivecoding/02_codex/05_smartpenny_codex/hooks/useAppController.ts)
