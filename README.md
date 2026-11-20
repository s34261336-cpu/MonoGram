# MonoGram

Responsive Russian-language messenger with phone sign-in, direct chats, channels, and realtime presence.

## Run locally

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_SECRET` for the API service, then run both services:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run dev
```

In a second terminal:

```bash
pnpm --filter @workspace/telegram-messenger run dev
```

Build the full app with:

```bash
pnpm run build
```

## Static hosting

The demo-code sign-in needs the `/api` server, so a static-only deployment is not enough. Use the one-service Render setup below, or configure another host to serve both the frontend and API from the same domain.

## Deploy to Render

The `render.yaml` Blueprint creates one Node web service named `monogram-fullstack`. It builds the frontend and API together, then serves both from the same address, so `/api` works without a second service or a separate API URL.

In Render, choose **New > Blueprint** and connect this repository. Add these two values when prompted:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Render generates `SESSION_SECRET` automatically. Keep the service-role key on the server; it must not be added to frontend variables. Apply `supabase/schema.sql` to the Supabase project once before using registration.

To enable the admin account, also set `ADMIN_PHONE` to its Russian phone number and `ADMIN_LOGIN_CODE` to a private random secret of at least 32 characters. Keep the secret only in server environment settings; it is never sent to the browser. The admin account is created automatically on its first successful sign-in with that phone and secret. Without both settings, admin access is disabled.

If a static Render service named `monogram` already exists, leave it in place until `monogram-fullstack` is deployed and verified. The new Blueprint uses a different name so it does not replace the existing service.

## Behavior and limits

- Sign-in and registration use a five-digit demo code shown on screen; no SMS is sent.
- New profiles receive a numeric ID; users can set a username later in profile settings.
- The configured admin can grant up to 1,000,000 stars per operation by numeric user ID.
- Demo codes expire after five minutes.
- Direct messages, channels, and reactions are stored in Supabase.
- Online status and database updates use Supabase Realtime.
- File and voice controls are visual demo actions; media is not uploaded or stored.
