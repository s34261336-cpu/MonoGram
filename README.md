# MonoGram

Responsive Russian-language messenger with Supabase authentication, direct chats, channels, and realtime presence.

## Run locally

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the environment, then run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/telegram-messenger run dev
```

Build the frontend with:

```bash
pnpm run build
```

## Deploy to Vercel

Import `s34261336-cpu/MonoGram` from GitHub into Vercel with the repository root (`.`) as the project root. `vercel.json` sets the install command, build command, static output directory, and SPA route fallback.

Add these environment variables in the Vercel project settings for Production and Preview deployments:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (the legacy `SUPABASE_ANON_KEY` is also accepted)

Apply `supabase/schema.sql` to the Supabase project and add the Vercel production and preview URLs to Supabase Auth's allowed redirect URLs. The Vercel build serves the static frontend; authentication, app data, and realtime presence use Supabase.

## Deploy to Render

The repository includes a `render.yaml` Blueprint for the MonoGram static web app. In Render, choose **New > Blueprint**, connect this GitHub repository, and confirm the generated `monogram` static site. Render installs the workspace dependencies, builds the Vite app, and serves its SPA routes.

When Render asks for environment values, set:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Apply `supabase/schema.sql` to the Supabase project, then add the Render URL assigned after the first deploy to Supabase Auth's allowed redirect URLs. Email confirmation delivery must also be enabled in Supabase; Render does not send those emails. Do not put a Supabase service-role key in this static app.

The Blueprint intentionally deploys only the web app: MonoGram uses Supabase directly for authentication, data, and realtime updates, so the separate API Server artifact is not required for this site.

## Behavior and limits

- Sign-in uses Supabase email and password authentication.
- Direct messages, channels, and reactions are stored in Supabase.
- Online status and database updates use Supabase Realtime.
- File and voice controls are visual demo actions; media is not uploaded or stored.
