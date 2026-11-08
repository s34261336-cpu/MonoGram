---
name: Stale workflow listeners
description: Recovery guidance when a Replit artifact workflow reports EADDRINUSE while an earlier process still serves requests.
---

When an artifact workflow fails with `EADDRINUSE`, the prior server process may still be alive even if the workflow state says failed. Check the configured port and confirm which process owns it before stopping anything. Stop only the stale process group for the affected artifact, then restart its managed workflow once and verify through the shared proxy.

**Why:** During the MonoGram import, retrying a workflow started a second server while the earlier process remained alive; the first server still returned 200 responses, but the managed workflow was marked failed.

**How to apply:** Diagnose the listener and process command first. Do not use broad process-kill commands or add a competing manual workflow for an artifact.
