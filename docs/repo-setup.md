# Repository Setup Guide

This document explains the GitHub and local repository setup for Riftsend.

It is intentionally separate from the implementation plan. This file focuses on repository hygiene, tooling, community files, issue templates, and project organization.

---

## 1. Create the GitHub repository

Recommended repository name options:

- `riftsend`
- `veildrop`
- `shardline`
- `ghostpier`
- `hushline`

Recommended visibility while building the first prototype:

- Private, if you want to iterate without pressure.
- Public, if you want feedback early and are comfortable with unfinished code.

Recommended description:

> Browser-based end-to-end encrypted peer-to-peer file transfer with resumable large-file support.

Recommended topics:

- `webrtc`
- `p2p`
- `e2ee`
- `file-transfer`
- `typescript`
- `webcrypto`
- `rtcdatachannel`
- `opfs`
- `turn`

---

## 2. Add root repository files

Create or keep these files at the repository root:

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `.gitignore`
- `.editorconfig`
- `.npmrc`
- `pnpm-workspace.yaml`
- `package.json`
- `LICENSE`

The generated pack includes all except a final real `LICENSE`. Choose the license intentionally before publishing.

---

## 3. Choose a license

Recommended choice depends on your goal.

### If you want maximum adoption

Choose MIT.

Pros:

- Simple.
- Familiar.
- Easy for others to use.

Cons:

- Others can make closed-source forks.

### If you want hosted forks to stay open

Choose AGPL-3.0.

Pros:

- Strong protection for a web app/service.
- Hosted modified versions generally need to provide source.

Cons:

- Some companies avoid AGPL projects.

### If you want a balanced option

Choose MPL-2.0.

Pros:

- File-level copyleft.
- More permissive than GPL/AGPL.

Cons:

- Less strict for full-project openness.

Action:

- Use GitHub’s license picker or add a `LICENSE` file manually.
- Update the README license section after choosing.

---

## 4. Recommended branch strategy

Use this simple branch model:

- `main`: stable, protected.
- `develop`: optional, only if you prefer a staging branch.
- `feature/<short-name>`: new features.
- `fix/<short-name>`: bug fixes.
- `docs/<short-name>`: documentation changes.
- `chore/<short-name>`: tooling or maintenance.

For a solo project, you can skip `develop` and merge feature branches directly into `main` through pull requests.

---

## 5. Branch protection

Enable branch protection after the first CI workflow is stable.

Recommended rules for `main`:

- Require pull request before merging.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Prevent force pushes.
- Prevent deletions.

Optional rules:

- Require signed commits.
- Require linear history.
- Require review from code owners once contributors exist.

---

## 6. GitHub Issues setup

Use issue templates for:

- Bug reports.
- Feature requests.
- Security-sensitive reports should not be filed publicly.

The generated pack includes:

- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`

Use labels such as:

- `bug`
- `feature`
- `docs`
- `security`
- `protocol`
- `webrtc`
- `crypto`
- `storage`
- `signaling`
- `good first issue`
- `needs reproduction`

---

## 7. Pull request template

The generated pack includes:

- `.github/pull_request_template.md`

Every pull request should answer:

- What changed?
- Why did it change?
- Which folders/files were touched?
- How was it tested?
- Does it affect security, privacy, protocol compatibility, or resume behavior?

---

## 8. GitHub Actions

The generated pack includes a conservative starter workflow:

- `.github/workflows/ci.yml`

Initially, it is configured for manual runs only so it does not fail before the monorepo is fully initialized.

Once Phase 1 is complete, update it to run on:

- pushes to `main`
- pull requests into `main`

The CI should eventually check:

- install
- formatting
- linting
- type checking
- unit tests
- protocol tests
- crypto tests
- storage tests

---

## 9. Local development prerequisites

Recommended tools:

- Node.js LTS.
- pnpm.
- Git.
- A modern Chromium-based browser.
- Firefox for compatibility testing.
- Optional: Docker for coturn/local infrastructure later.

Avoid adding Docker, TURN, compression, or WASM before the basic WebRTC DataChannel works.

---

## 10. Initial local setup order

1. Initialize pnpm workspace.
2. Create `apps/web` using Vite React TypeScript.
3. Create `apps/signaling` using TypeScript and a WebSocket library.
4. Create `packages/protocol` for shared protocol types and validators.
5. Create `packages/shared` for shared utilities.
6. Add scripts at the root for formatting, linting, type checking, testing, and dev startup.
7. Only then enable CI on pull requests.

---

## 11. Secrets and environment variables

Do not commit real secrets.

Use local `.env` files for:

- signaling server port
- public app URL
- TURN realm
- TURN shared secret
- rate-limit configuration

Keep a safe example file later:

- `.env.example`

Do not include actual TURN credentials in frontend code. The backend should issue temporary credentials.

---

## 12. Recommended GitHub repository settings

Enable:

- Issues.
- Discussions, if you want design feedback.
- Dependabot alerts.
- Secret scanning, if available.
- Branch protection after CI is stable.

Disable or postpone:

- Wiki, unless you plan to maintain it.
- GitHub Pages, unless you use it for docs.

---

## 13. Milestone setup

Create GitHub milestones matching the roadmap:

1. WebRTC Hello World.
2. Raw File Transfer.
3. Backpressure and Control Channel.
4. App-Level Encryption.
5. Blocks and Frames.
6. OPFS Storage.
7. Resume.
8. Compression.
9. TURN Fallback.
10. Public Alpha.

---

## 14. Project board columns

Use a simple board:

- Backlog.
- Ready.
- In Progress.
- Review.
- Blocked.
- Done.

For each issue, include:

- target phase
- affected component
- testing notes
- security/privacy impact if any

---

## 15. Pre-public checklist

Before making the repo public or announcing it:

- Choose and add a license.
- Fill in real contact/security policy details.
- Ensure README privacy claims are accurate.
- Remove placeholder text.
- Ensure no secrets are committed.
- Verify the app does not log transfer keys.
- Verify the server does not store file metadata unnecessarily.
- Add screenshots or a basic demo GIF only after the first MVP exists.
- Add clear warnings if the project has not been security reviewed.
