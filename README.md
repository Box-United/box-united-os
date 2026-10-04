# Box United OS

Internal operations platform for Box United / The Boxing Club.

## Tech Stack

- **React 19 + TypeScript** — frontend
- **Vite 8 + Tailwind CSS v4** — build + styling
- **Supabase** — auth (Google OAuth), Postgres database, RLS

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in VITE_SUPABASE_ANON_KEY from your Supabase project dashboard

# 3. Apply database schema
# Run each file in supabase/migrations/ in order (001 → 014) in the Supabase
# SQL editor. When a new migration lands, run just that file.
# Project: kfdyvfxkguhcydbjyjgt

# 4. Enable Google OAuth in Supabase
# Auth → Providers → Google → enable, paste Client ID + Secret

# 5. Start dev server
npm run dev
```

## Phase 1 Features

| Feature | Description |
|---|---|
| **Login** | Google sign-in via Supabase Auth, restricted to @boxunited.org |
| **Dashboard** | Per-person view with navy-gradient "Needs You" hero card |
| **Quarterly Rocks** | Up to 3 rocks per quarter; on-track / off-track / done status |
| **Personal Tasks** | Daily / weekly / monthly toggle task board |
| **Team Board** | Shared kanban (To Do → In Progress → Done) with cross-assignment |

## Design System

Matches the Lovable cockpit:
- **Fonts:** Archivo (headings) + Inter (body)
- **Sidebar:** `#0B1E39` navy rail
- **Brand blue:** `#2563EB`
- **Page background:** `#EEF2F7`
- **Cards:** white, 14px radius, soft shadow
- **Status pills:** color-coded inline badges
- **Needs You hero:** navy-to-blue gradient card

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | `https://kfdyvfxkguhcydbjyjgt.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Found in Supabase → Settings → API |
