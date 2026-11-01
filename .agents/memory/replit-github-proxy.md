---
name: Replit GitHub proxy
description: Why a GitHub remote may show Replit's internal proxy hostname.
---

GitHub remotes can be transparently rewritten to `github.replit.internal` in this Replit environment. This is expected when the path still points to the intended repository.

**Why:** Git confirmed the host is Replit's secure GitHub proxy during the MonoGram import.

**How to apply:** If `git remote -v` shows this hostname, verify the repository path and tracking status before changing the remote.
