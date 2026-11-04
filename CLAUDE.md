# MW Chat

Self-hosted live chat for Michael Winter's two sites (westchesterguy.com, the
hub, and westchesterhorseproperties.com). Visitors chat through `public/widget.js`
and the `/embed` page; Michael answers in the admin app under `/admin`. See
README.md for setup.

## Rules

1. **Run `npm run build` before every push.** It applies migrations first and
   skips them when no database is configured.
2. **Migrations are append-only.** New schema goes in a new numbered file in
   `db/migrations/`. Applied files are never edited.
3. **Row level security stays on, with no policies.** Only this app's server
   touches the tables, as the database owner. Supabase's public API must see
   nothing.
4. **Never invent facts about Michael.** Contact details in `src/lib/sites.ts`
   mirror the sites' own `lib/site.ts`; change them there first.
5. **No secrets in the repo.** The session-signing key and push keys are made
   on first use and kept in the `settings` table.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Postgres via
Postgres.js v4 (Supabase, pooled, `prepare: false`) · Web Push · Resend.

## Where things live

- `db/migrations/` and `scripts/migrate.mjs`: schema, applied at build
- `src/lib/`: database, visitor identity, admin sign-in, push, email, guards
- `src/app/api/v/`: visitor endpoints (the widget and chat window)
- `src/app/api/admin/`: admin endpoints, all behind `adminGuard`
- `src/components/ChatWindow.tsx`: the visitor's chat window
- `src/components/chat/`: the message thread, reply bar and message state both sides share
- `src/components/ui/`: icons, avatar, switch, bottom sheet, menu
- `src/components/admin/`: the admin app
- `public/widget.js`: the loader the sites include; `public/sw.js`: notifications

## Local testing

PostgreSQL 16 runs locally; point `POSTGRES_URL` at it. Next replaces
`x-forwarded-for` locally, so a test IP header shows up as 127.0.0.1; on Vercel
the real client IP and the `x-vercel-ip-*` location headers come from Vercel.
