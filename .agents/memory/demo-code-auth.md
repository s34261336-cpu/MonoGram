---
name: Demo-code login
description: Keep the Mono demo-code sign-in simple to deploy.
---

Keep the on-screen demo-code sign-in. Do not add SMS delivery or require a separate code-delivery service unless the user asks.

**Why:** The user asked to keep the code while avoiding more configuration after the separate Render deployment could not find its API service.

**How to apply:** Prefer a same-origin frontend/API deployment and minimal environment variables for authentication.
