# InsurUp CLI

A comprehensive, automation-friendly command-line interface for the
[InsurUp](https://insurup.com) insurance platform, built on
[`@insurup/sdk`](https://www.npmjs.com/package/@insurup/sdk) and
[Bun](https://bun.sh).

- **Two auth flows** — machine-to-machine (client credentials) and browser login
  (authorization code + PKCE).
- **Secure by default** — tokens and the M2M secret are stored in the OS keychain
  (`Bun.secrets`: macOS Keychain, libsecret, Windows Credential Manager).
- **All 18 SDK modules** — customers, vehicles, properties, policies, proposals,
  cases, agents, agent users/branches/roles/setup, OAuth clients, insurance,
  coverage, templates, languages, files, webhooks.
- **Scriptable** — `--json` on every command, stable exit codes, env-var auth,
  reads request bodies from flags / files / stdin.

## Install

The CLI is distributed three ways:

```bash
# 1. Run via Bun (no install) — requires Bun >= 1.3
bunx @insurup/cli --help

# 2. Standalone binary (no runtime required) — from GitHub Releases
#    macOS/Linux/Windows builds are attached to each release.
curl -L https://github.com/InsurUp/cli/releases/latest/download/insurup-darwin-arm64 -o insurup
chmod +x insurup && ./insurup --version

# 3. Homebrew
brew install InsurUp/insurup/cli
```

> The npm package runs on **Bun** (it uses `Bun.secrets`/`Bun.serve`). For
> environments without Bun, use the standalone binary or Homebrew.

## Quick start

```bash
# Browser login (authorization code + PKCE)
insurup auth login --client-id <your-client-id> --save

# …or machine-to-machine (great for CI)
insurup auth login --m2m --client-id <id> --client-secret <secret> --save

# Who am I?
insurup auth whoami

# Do things
insurup customers list --json
insurup customers get <id>
insurup insurance companies
```

## Authentication

### Browser (interactive)

```bash
insurup auth login --client-id <id>
```

Opens your browser, captures the redirect on a local loopback server, and stores
the resulting tokens (with refresh) in the OS keychain. Use `--no-browser` on a
headless box to print the URL instead.

### Machine-to-machine (automation)

```bash
# Interactive once, secret cached in the keychain:
insurup auth login --m2m --client-id <id> --save

# Fully stateless (CI) — nothing is stored, login happens per invocation:
export INSURUP_CLIENT_ID=...
export INSURUP_CLIENT_SECRET=...
insurup customers list --json
```

### Commands

| Command | Description |
| --- | --- |
| `auth login [--m2m] [--no-browser] [--save]` | Log in (browser or M2M) |
| `auth status` | Show session status (no network) |
| `auth whoami` | Show the authenticated identity |
| `auth token` | Print a valid access token (`$(insurup auth token)`) |
| `auth logout [--forget-secret]` | Clear the stored session |

### Configuration & profiles

Settings resolve with precedence **flags → environment → config file → defaults**.
Use `--profile <name>` (or `INSURUP_PROFILE`) to keep multiple environments side
by side. Non-secret settings live in `~/.config/insurup/config.json`; secrets only
ever live in the OS keychain.

| Env var | Meaning |
| --- | --- |
| `INSURUP_CLIENT_ID` | OAuth client id |
| `INSURUP_CLIENT_SECRET` | M2M client secret |
| `INSURUP_AUTH_SERVER` | Authorization server (default `https://auth.insurup.com`) |
| `INSURUP_API_URL` | API base URL |
| `INSURUP_SCOPES` | Space/comma-separated scopes |
| `INSURUP_PROFILE` | Active profile |
| `INSURUP_TOKEN_ENDPOINT` / `INSURUP_AUTHORIZATION_ENDPOINT` | Explicit endpoints (skip OIDC discovery) |

## Usage

Commands follow `insurup <module> <verb> [args] [flags]`. Reads map to SDK
getters; writes take a body via `--data`:

```bash
# Inline JSON, a file, or stdin
insurup customers create --data '{"type":"INDIVIDUAL","fullName":"Jane Doe"}'
insurup customers create --data @customer.json
echo '{"type":"INDIVIDUAL"}' | insurup customers create --data -

# Pagination (cursor-based)
insurup customers list --first 20
insurup customers list --first 20 --after <cursor>

# Live proposal updates over SignalR (until Ctrl-C)
insurup proposals watch <proposal-id> --json
```

### Modules

`customers` · `vehicles` · `properties` · `policies` · `proposals` · `cases` ·
`agents` · `agent-branches` · `agent-roles` · `agent-setup` · `agent-users` ·
`oauth-clients` · `insurance` · `coverage` · `templates` · `languages` · `files` ·
`webhooks`

Run `insurup <module> --help` to see each module's verbs.

## Automation

- `--json` — machine-readable output on stdout (human status/errors go to stderr).
- `--quiet` — suppress non-essential output. `--no-color` / `NO_COLOR` disable color.
- **Exit codes:** `0` ok · `1` generic · `2` usage/validation · `3` auth ·
  `4` not found · `5` API/server error.

```bash
if insurup customers get "$ID" --json > customer.json; then
  jq .fullName customer.json
else
  case $? in 3) echo "login first";; 4) echo "no such customer";; esac
fi
```

## Development

```bash
bun install
bun run dev -- --help        # run from source
bun run typecheck
bun run lint
bun test                     # unit + integration
bun test --coverage          # enforces 90% line/function floors (bunfig.toml)
bun run compile              # standalone binary -> dist/insurup
```

Tests use Bun's runner with an in-memory keychain and a mock OAuth + API server
(`Bun.serve`), so nothing touches the real keychain or production API.

## Deployment

Releases are **draft-driven** (via [Release Drafter](https://github.com/release-drafter/release-drafter)):

1. **CI** (`ci.yml`) runs lint, typecheck, coverage, and a compile smoke check on every push/PR.
2. **Release Drafter** (`release-drafter.yml`) keeps a **draft GitHub Release** up to
   date as PRs merge — the changelog and next version are derived from PR **labels**
   (`feature`/`enhancement` → minor, `bug`/`fix`/`chore`/… → patch, `breaking` → major).
3. **Publishing the draft** (in the GitHub Releases UI) creates the tag and triggers
   `publish.yml`, which:
   - bumps `package.json` to the release version and commits it back to `main`,
   - **publishes `@insurup/cli` to npm** (`NPM_TOKEN`),
   - cross-compiles macOS/Linux/Windows binaries + `SHA256SUMS` and attaches them, and
   - updates the **`InsurUp/homebrew-insurup`** tap formula via
     `packaging/homebrew/update-tap.sh` (when `HOMEBREW_TAP_TOKEN` is set).

To cut a release: review the draft at **Releases → Draft**, then click **Publish**.

> Required secret: `NPM_TOKEN`. Optional: `HOMEBREW_TAP_TOKEN` (a PAT with push
> access to the tap). macOS binaries are unsigned by default; add
> codesign/notarization to `publish.yml` to avoid Gatekeeper prompts.

## License

[MIT](LICENSE)
