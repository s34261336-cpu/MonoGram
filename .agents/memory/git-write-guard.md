---
name: Replit Git write guard
description: Local Git write operations may require an explicit environment override in this Replit workspace.
---

Mutating Git commands can be blocked before changing files or `.git/config`, with an error mentioning `.git/config.lock`. Read-only status, remote, and log commands do not require an override.

**Why:** During the requested MonoGram import, GitHub remote setup was blocked once; a read-only check confirmed nothing had partially changed, and retrying the explicitly authorized remote/fetch/reset commands with the override succeeded.

**How to apply:** For user-authorized Git writes, prefix each mutating command with `DANGEROUSLY_ALLOW_GIT=1`. Before a reset, verify the working tree is clean and that replacing the current branch is part of the user's request. Avoid broad cleanup commands.
