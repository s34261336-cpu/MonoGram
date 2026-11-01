# Telegram Messenger

Responsive Telegram-inspired web messenger with a mock phone sign-in, sample chats, and live message delivery over Socket.IO. It is a demo: phone numbers are not verified, there is no SMS delivery, and messages are kept in server memory.

## Run locally

From the repository root:

```bash
pnpm install
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

In another terminal, start the web preview:

```bash
pnpm --filter @workspace/telegram-messenger run dev
```

Open the web preview. The frontend calls the API through `/api` and connects to Socket.IO at `/api/socket.io`. For a standalone production build:

```bash
pnpm run build
pnpm start
```

The Node server serves the built frontend, JSON endpoints, and the Socket.IO connection on the same port. It uses `PORT` from the environment, falling back to `3000`.

## Deploy to Render

Create a **Web Service** from the repository. Do not create a Static Site: the Node process must remain running for Socket.IO and the API.

Recommended settings:

- **Runtime:** Node
- **Build command:** `corepack enable && pnpm install --frozen-lockfile && pnpm run build`
- **Start command:** `pnpm start`
- **Health check path:** `/api/healthz`

The React/Vite frontend is available from the repository root as `client/` and remains maintained as the `telegram-messenger` app package.

Render provides `PORT` to the service. Do not set a fixed port. No database or secret is required for this demo.

## Demo behavior and limits

- The sign-in screen only stores a display name/phone locally; it does not send an SMS or authenticate an account.
- Chats and sample messages are seeded in `server/chat-store.cjs`.
- New messages are shared instantly with connected clients through Socket.IO.
- In-memory messages reset when the service restarts and are not suitable for durable production messaging.
- File and voice controls are demo UI actions; this project does not upload or store media.
