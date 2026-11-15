# SUPR Control Sphere mockup

Interactive web mockup of the momentum **Control Sphere** (formerly Attack Star) for PROJECT SUPR. This is a design tool, not the game.

**Live site:** https://raelzarin.github.io/supr-control-sphere/

This repository holds only the static app. It includes the baked default move catalog (names, stances, timings, and links from the game data) so the mockup runs without a server. It does **not** include saved builds, presets, tokens, or any credentials.

## Sync across devices

The app works immediately in local-only mode (saves stay in this browser). To sync builds and presets between your phone and computer:

1. Open **Settings** on the site.
2. Paste a GitHub token that can only read and write gists (see below) and, if you have one, your gist ID.
3. Save. The token is stored only in that browser's localStorage and is sent only to `api.github.com`.

Use the same token and gist ID on each device. If you paste a token and leave the gist ID blank, the app will look for an existing gist titled `SUPR Control Sphere saved state`, or create a secret one on first save.

## Create a gist-only token

Fine-grained (preferred):

1. On GitHub, click your avatar → **Settings**.
2. Scroll to **Developer settings** → **Personal access tokens** → **Fine-grained tokens**.
3. **Generate new token**.
4. Name it `Control Sphere sync` and pick an expiration (90 days is a good default).
5. Resource owner: your account. **Repository access: None**.
6. Under **Permissions** → **Account permissions**, set **Gists** to **Read and write**. Leave every other permission at **No access**.
7. Generate the token, copy it once, and paste it into the app's Settings. Do not commit it or send it in chat.

Classic token fallback: **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**. Note `Control Sphere sync`. Check **only** the `gist` scope. Generate, copy, paste into Settings.

## Local development

Serve this folder as static files (for example `python3 -m http.server`) and open `/`. There is no Node API on GitHub Pages. A separate Tailscale-hosted Node server can still be used when that host is awake; this site does not depend on it.

## License / scope

Private saved state lives in a secret gist, not in this repo. Do not open a pull request that adds tokens, gist IDs, `state.json`, or `.secret` files.
