# Contributing to Riftsend

Thanks for considering contributing.

Riftsend is security-sensitive software. Even small changes can affect privacy, encryption, resume correctness, or transfer reliability. Please keep changes focused and explain the impact clearly.

## Development principles

- Keep the signaling server small.
- Do not send file contents to the application server.
- Do not log secrets.
- Do not log URL fragments.
- Validate untrusted messages.
- Prefer simple working milestones over premature optimization.
- Benchmark before adding WASM or complex performance features.
- Update docs when changing protocol, security, storage, or connection behavior.

## Before opening a pull request

Please check:

- The change has a clear purpose.
- The affected files/folders are listed in the PR.
- Security/privacy implications are explained.
- Protocol compatibility implications are explained.
- Resume behavior is considered if transfer logic changed.
- Tests or manual verification notes are included.

## Areas that need extra care

- `apps/web/src/crypto/`
- `apps/web/src/transfer/`
- `apps/web/src/storage/`
- `apps/web/src/webrtc/`
- `packages/protocol/`
- `apps/signaling/src/turnCredentials.ts`

## Reporting security issues

Do not open a public GitHub issue for security vulnerabilities. See `SECURITY.md`.
