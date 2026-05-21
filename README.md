# Riftsend

> Browser-based, end-to-end encrypted, peer-to-peer file transfer for very large files.

Riftsend aims to let one person send files directly to another person through the browser with no account, no cloud upload, strong end-to-end encryption, resumable transfers, and maximum practical speed. The app uses WebRTC DataChannels for browser-to-browser transfer, a small signaling server for connection setup, and an optional TURN relay when direct peer-to-peer connectivity is not possible.

## What this project is trying to achieve

- Send files across the internet from one browser to another.
- Keep file contents end-to-end encrypted.
- Avoid uploading files to the application server.
- Support very large files by streaming blocks instead of loading entire files into memory.
- Resume interrupted transfers using local checkpoints and verified block ranges.
- Prefer direct peer-to-peer connections, with encrypted relay fallback when required.
- Keep the core experience account-free and simple.

## Honest privacy statement

Riftsend should not claim that bytes never touch any server in every case. The accurate claim is:

> File contents are encrypted before leaving the sender browser. When direct WebRTC connectivity works, encrypted file bytes flow directly between browsers. When direct connectivity fails, encrypted bytes may pass through a TURN relay, but the relay must never receive the file decryption key.

The signaling server should only coordinate setup messages such as room membership, WebRTC offers/answers, ICE candidates, and temporary TURN credentials. It should not receive plaintext files, file keys, or persistent transfer history.

## Planned monorepo layout

```text
riftsend/
  apps/
    web/
      src/
        app/
        components/
        webrtc/
        transfer/
        crypto/
        storage/
        workers/
        protocol/
    signaling/
      src/
        index.ts
        rooms.ts
        turnCredentials.ts
        messageTypes.ts

  packages/
    protocol/
      src/
        messages.ts
        manifest.ts
        frames.ts
        constants.ts
    shared/
      src/
        result.ts
        byteUtils.ts
        rangeSet.ts

  docs/
    architecture.md
    protocol.md
    security.md
    roadmap.md
    repo-setup.md
    implementation-plan.md

  .github/
    ISSUE_TEMPLATE/
    workflows/
```

This repository intentionally separates the browser app, signaling server, and shared protocol definitions. The signaling server should remain small and should not contain file-transfer business logic.

## Major components

### Web app

Location: `apps/web/`

Responsibilities:

- Sender and receiver UI.
- File picker and drag-and-drop.
- WebRTC peer connection setup.
- Control and data channel management.
- File block reading and frame sending.
- Encryption/decryption through Web Crypto.
- OPFS and IndexedDB storage for resumable receiving.
- Transfer progress, speed, ETA, and error states.

### Signaling server

Location: `apps/signaling/`

Responsibilities:

- Create temporary rooms.
- Pair one sender and one receiver.
- Forward WebRTC offers, answers, and ICE candidates.
- Expire inactive rooms.
- Apply abuse/rate limits.
- Optionally issue temporary TURN credentials.

The signaling server must not store or inspect file contents.

### Shared protocol package

Location: `packages/protocol/`

Responsibilities:

- Versioned protocol message definitions.
- Manifest shape.
- Frame header shape.
- Protocol constants.
- Validation helpers.

### Shared utility package

Location: `packages/shared/`

Responsibilities:

- Range set utilities.
- Byte formatting utilities.
- Result/error utility types.
- Shared test helpers.

## Core protocol model

Riftsend should use three conceptual transfer units:

- **File**: the user-selected file.
- **Block**: the processing unit used for compression, encryption, verification, and resume.
- **Frame**: the network unit sent over the WebRTC DataChannel.

Recommended early defaults:

- Block size: 4 MiB.
- Frame size: 256 KiB.
- Encryption: AES-GCM through Web Crypto.
- Key derivation: HKDF-SHA-256.
- First hashing option: SHA-256.
- Later hashing option: BLAKE3 through WASM if benchmarks justify it.
- First compression option: none.
- Later compression option: per-block gzip through Compression Streams.
- Future compression option: zstd through WASM if benchmarks justify it.

## Development phases

1. Create the monorepo and documentation.
2. Build WebSocket room signaling.
3. Establish a WebRTC DataChannel between two tabs.
4. Send a small raw file with simple chunks.
5. Add backpressure.
6. Split control and data channels.
7. Add app-level encryption.
8. Move to blocks and frames.
9. Add OPFS and IndexedDB storage.
10. Add block-level resume.
11. Add optional per-block compression.
12. Add TURN relay fallback.
13. Harden security and abuse protections.
14. Add automated tests and benchmarking.
15. Polish UI and prepare public alpha.

See [`docs/implementation-plan.md`](docs/implementation-plan.md) for the full step-by-step implementation plan.

## Documentation

- [`docs/architecture.md`](docs/architecture.md): system design and component responsibilities.
- [`docs/protocol.md`](docs/protocol.md): versioned transfer protocol design.
- [`docs/security.md`](docs/security.md): threat model, privacy claims, and crypto boundaries.
- [`docs/roadmap.md`](docs/roadmap.md): milestone roadmap.
- [`docs/repo-setup.md`](docs/repo-setup.md): GitHub repository setup checklist.
- [`docs/implementation-plan.md`](docs/implementation-plan.md): detailed implementation instructions from start to finish.

## Suggested local setup

This project is planned around:

- TypeScript.
- Vite + React for the web app.
- Node.js or Bun for the signaling server.
- pnpm workspaces for monorepo management.
- WebRTC DataChannels for peer-to-peer transfer.
- Web Crypto for browser-native encryption.
- OPFS and IndexedDB for resumable receiver-side storage.
- coturn for TURN relay fallback.

The exact commands are documented in [`docs/repo-setup.md`](docs/repo-setup.md).

## Project status

Planning stage.

The first milestone is a minimal WebRTC hello-world:

- Two tabs join the same signaling room.
- One tab creates a WebRTC offer.
- The other tab creates an answer.
- ICE candidates are exchanged.
- A DataChannel opens.
- The sender sends a text message.
- The receiver displays it.

Do not begin compression, resume, or WASM work before this milestone is working.

## Security expectations

Before a public alpha, the project should have:

- A written threat model.
- Clear privacy claims.
- Temporary room expiration.
- Temporary TURN credentials.
- Input validation on signaling and protocol messages.
- Unique nonces for encrypted blocks.
- Manifest authentication.
- Final file verification.
- Wrong-key and tampered-frame tests.

Security details live in [`docs/security.md`](docs/security.md).

## License

The project is licensed under the [MIT license](LICENSE).
