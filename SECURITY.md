# Security Policy

Riftsend is planned as an end-to-end encrypted file transfer project. Security reports are welcome.

## Supported versions

The project is currently in planning/prototype stage. No production-supported version exists yet.

## Reporting a vulnerability

Do not report security vulnerabilities through public GitHub issues.

Use one of these channels once configured:

- GitHub private vulnerability reporting, if enabled.
- A dedicated security email address, once added by the maintainer.

Until a real contact is configured, treat this file as a placeholder and do not publish the project as production-ready.

## Security-sensitive areas

Please pay special attention to:

- URL fragment transfer key handling.
- Key derivation.
- AES-GCM nonce uniqueness.
- Authenticated metadata.
- Manifest authentication.
- Signaling message validation.
- TURN credential issuance.
- OPFS/IndexedDB cleanup.
- Resume correctness.
- File verification before completion.

## Current security status

Not independently audited.

Do not claim the project is suitable for high-risk or highly sensitive transfers until the implementation has been reviewed and tested.
