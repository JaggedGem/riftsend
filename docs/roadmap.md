# Riftsend Development Roadmap

This roadmap defines the recommended build order for Riftsend. The goal is to avoid overengineering too early while still moving toward the final architecture: browser-based, end-to-end encrypted, resumable, high-speed file transfer using WebRTC.

---

## 1. Development principles

### 1.1 Build the network path first

Do not start with compression, WASM, perfect UI, or advanced resume.

First prove:

```txt
Two browsers can connect and exchange data through WebRTC.
```

### 1.2 Add complexity only after the previous layer works

Correct order:

```txt
Signaling
  → WebRTC connection
  → raw file transfer
  → backpressure
  → control/data channels
  → encryption
  → blocks/frames
  → OPFS storage
  → resume
  → compression
  → TURN
  → polish
```

### 1.3 Keep the server boring

The signaling server should be tiny.

It should:

- Create temporary rooms.
- Forward offer/answer/ICE payloads.
- Issue temporary TURN credentials.
- Expire rooms.
- Enforce rate limits.

It should not:

- Store files.
- Process file chunks.
- Know file keys.
- Become a file-hosting backend.

### 1.4 Benchmark before optimizing

Do not add WASM until TypeScript/Web Crypto/native APIs are measured.

Good future WASM candidates:

- BLAKE3 hashing.
- zstd compression.
- Archive generation.

---

## 2. Milestone overview

```txt
M0: Repository and docs
M1: Signaling server
M2: WebRTC hello-world
M3: Raw small-file transfer
M4: Backpressure and transfer stability
M5: Control/data channel separation
M6: App-level encryption
M7: Versioned protocol
M8: Blocks and frames
M9: OPFS receiver storage
M10: Resume
M11: Compression
M12: TURN fallback
M13: Polished MVP UI
M14: Security hardening
M15: Public alpha
```

---

## 3. M0 — Repository and docs

### Goal

Create the project structure and capture the architecture before implementation.

### Tasks

- [ ] Create monorepo.
- [ ] Create frontend app.
- [ ] Create signaling server app.
- [ ] Create shared protocol package.
- [ ] Add TypeScript config.
- [ ] Add linting/formatting.
- [ ] Add docs folder.
- [ ] Add `architecture.md`.
- [ ] Add `protocol.md`.
- [ ] Add `security.md`.
- [ ] Add `roadmap.md`.

### Suggested structure

```txt
riftsend/
  apps/
    web/
    signaling/
  packages/
    protocol/
    shared/
  docs/
    architecture.md
    protocol.md
    security.md
    roadmap.md
```

### Done when

- [ ] `pnpm install` works.
- [ ] Frontend dev server starts.
- [ ] Signaling server starts.
- [ ] Docs exist in repo.

---

## 4. M1 — Signaling server

### Goal

Two browser tabs can join the same room and exchange JSON through the server.

### Features

- Temporary rooms.
- Sender/receiver roles.
- Max two peers per room.
- Message forwarding.
- Peer join/leave events.
- Room expiration.

### Tasks

- [ ] Define signaling message types.
- [ ] Implement WebSocket server.
- [ ] Implement room registry.
- [ ] Implement `join-room`.
- [ ] Implement `room-joined`.
- [ ] Implement `peer-joined`.
- [ ] Implement `signal` forwarding.
- [ ] Implement `peer-left`.
- [ ] Implement room cleanup timer.
- [ ] Add basic server logs.

### Test

Open two tabs:

```txt
Tab A joins room as sender.
Tab B joins room as receiver.
Tab A sends JSON.
Tab B receives JSON.
Tab B sends JSON.
Tab A receives JSON.
```

### Done when

- [ ] JSON messages are forwarded between peers.
- [ ] Third peer is rejected.
- [ ] Room expires after timeout.

---

## 5. M2 — WebRTC hello-world

### Goal

Two browser tabs create a WebRTC DataChannel and send a text message directly.

### Features

- `RTCPeerConnection` creation.
- SDP offer/answer exchange.
- ICE candidate exchange.
- DataChannel open.
- Text message transfer.

### Tasks

- [ ] Build `SignalingClient`.
- [ ] Build `PeerConnectionManager`.
- [ ] Sender creates DataChannel.
- [ ] Sender creates offer.
- [ ] Receiver receives offer.
- [ ] Receiver creates answer.
- [ ] Both exchange ICE candidates.
- [ ] DataChannel opens.
- [ ] Sender sends `hello`.
- [ ] Receiver displays `hello`.

### Test

```txt
Open sender tab.
Open receiver tab.
Wait for connection.
Sender sends hello.
Receiver sees hello.
```

### Done when

- [ ] DataChannel opens reliably on same machine/two tabs.
- [ ] DataChannel opens between two different devices on same network.

---

## 6. M3 — Raw small-file transfer

### Goal

Send one small file with no encryption, no resume, no OPFS.

### Features

- File picker.
- File metadata message.
- Fixed-size chunks.
- Receiver reconstructs Blob in memory.
- Download link generated at end.

### Tasks

- [ ] Add file input/drop zone.
- [ ] Send file metadata.
- [ ] Slice file into 64 KiB chunks.
- [ ] Send chunks over DataChannel.
- [ ] Receiver stores chunks in array.
- [ ] Receiver creates Blob at completion.
- [ ] Receiver downloads file.
- [ ] Add basic progress bar.

### Test files

- [ ] 1 KB text file.
- [ ] 5 MB image.
- [ ] 100 MB generated file.

### Done when

- [ ] Received file hash matches original hash for small files.
- [ ] UI shows progress.

---

## 7. M4 — Backpressure and transfer stability

### Goal

Prevent browser memory blowups during large sends.

### Features

- Use `bufferedAmount`.
- Use `bufferedAmountLowThreshold`.
- Sender waits before overfilling buffer.
- Speed calculation.

### Tasks

- [ ] Implement `waitForBufferLow()`.
- [ ] Add configurable high/low water marks.
- [ ] Track send speed.
- [ ] Track receive speed.
- [ ] Track memory behavior manually.
- [ ] Test with larger files.

### Suggested values

```txt
HIGH_WATER = 16 MiB
LOW_WATER = 4 MiB
```

### Done when

- [ ] Sending a 1 GB file does not cause uncontrolled memory growth.
- [ ] Transfer speed is visible.
- [ ] UI remains responsive.

---

## 8. M5 — Control/data channel separation

### Goal

Separate metadata/control messages from file bytes.

### Channels

```txt
control: ordered JSON messages
data: binary transfer frames
```

### Tasks

- [ ] Create `control` RTCDataChannel.
- [ ] Create `data` RTCDataChannel.
- [ ] Move metadata to control channel.
- [ ] Keep binary chunks on data channel.
- [ ] Add `hello` message.
- [ ] Add `manifest` message.
- [ ] Add `accept` message.
- [ ] Add `cancel` message.
- [ ] Add `error` message.

### Done when

- [ ] Receiver sees incoming transfer before bytes are sent.
- [ ] Receiver can accept/reject.
- [ ] Sender does not send file data until accepted.

---

## 9. M6 — App-level encryption

### Goal

Encrypt file data before it enters WebRTC.

### Features

- Master secret generation.
- Share link with key in URL fragment.
- HKDF key derivation.
- AES-GCM encryption.
- Per-chunk or per-block authentication.
- Wrong-key failure.

### Tasks

- [ ] Generate 256-bit master secret.
- [ ] Encode secret as base64url.
- [ ] Put secret in URL fragment.
- [ ] Receiver reads secret from fragment.
- [ ] Derive file key using HKDF.
- [ ] Encrypt outgoing payloads with AES-GCM.
- [ ] Decrypt incoming payloads.
- [ ] Add AAD.
- [ ] Add nonce generation.
- [ ] Add wrong-key test.
- [ ] Add tamper test.

### Done when

- [ ] File transfers correctly with right key.
- [ ] File fails to decrypt with wrong key.
- [ ] Modified ciphertext fails to decrypt.

---

## 10. M7 — Versioned protocol

### Goal

Replace ad-hoc messages with documented protocol messages.

### Tasks

- [ ] Create `packages/protocol`.
- [ ] Define TypeScript types for signaling messages.
- [ ] Define TypeScript types for control messages.
- [ ] Define manifest schema.
- [ ] Add runtime validation.
- [ ] Add message versioning.
- [ ] Add protocol error codes.
- [ ] Add unit tests for validation.

### Done when

- [ ] Every message has a version.
- [ ] Invalid messages are rejected safely.
- [ ] Protocol types are shared by web and signaling apps.

---

## 11. M8 — Blocks and frames

### Goal

Switch transfer engine to processing blocks and sending frames.

### Design

```txt
block = compression/encryption/resume unit
frame = network send unit
```

Suggested sizes:

```txt
blockSize = 4 MiB
frameSize = 256 KiB
```

### Tasks

- [ ] Implement block reader.
- [ ] Implement block encryption.
- [ ] Implement frame splitter.
- [ ] Implement binary frame header.
- [ ] Implement frame parser.
- [ ] Implement block reassembler.
- [ ] Implement block decryptor.
- [ ] Implement block-level ACK.
- [ ] Add tests for frame parsing.
- [ ] Add tests for reassembly.

### Done when

- [ ] A file transfers using block/frame logic.
- [ ] Receiver can reassemble and decrypt blocks.
- [ ] ACKs are block-based.

---

## 12. M9 — OPFS receiver storage

### Goal

Receive large files without keeping all bytes in memory.

### Features

- OPFS partial file creation.
- Write blocks by offset.
- Metadata in IndexedDB.
- Export final file.

### Tasks

- [ ] Create storage abstraction.
- [ ] Implement OPFS writer.
- [ ] Implement IndexedDB metadata store.
- [ ] Write decrypted blocks to OPFS.
- [ ] Track verified block ranges.
- [ ] Export final file after completion.
- [ ] Delete temporary data after success.
- [ ] Handle quota errors.

### Done when

- [ ] Receiver can receive a multi-GB file without storing it in memory.
- [ ] Refresh does not immediately lose partial OPFS file.
- [ ] Quota errors are shown clearly.

---

## 13. M10 — Resume

### Goal

Continue a transfer after disconnect or refresh.

### Features

- Checkpoints.
- Verified block ranges.
- `have` message.
- Missing block calculation.
- Resume after reload.

### Tasks

- [ ] Save checkpoint after verified blocks.
- [ ] Load checkpoint on receiver startup.
- [ ] Compare manifest hash.
- [ ] Send `have` message.
- [ ] Sender calculates missing ranges.
- [ ] Sender sends missing blocks only.
- [ ] Discard incomplete blocks in MVP.
- [ ] Add resume UI.
- [ ] Add tests for range merging.
- [ ] Add disconnect/reconnect manual tests.

### Manual test

```txt
Start 2 GB transfer.
Kill receiver tab at 40%.
Reopen same link.
Reconnect.
Receiver sends HAVE.
Sender continues from missing blocks.
Final file verifies.
```

### Done when

- [ ] Resume works after receiver refresh.
- [ ] Resume works after temporary WebRTC disconnect.
- [ ] Final file hash matches.

---

## 14. M11 — Compression

### Goal

Optionally reduce bytes sent for compressible files.

### MVP compression strategy

```txt
mode = auto
algorithm = gzip
unit = independent block
minSavingsPercent = 5
```

### Tasks

- [ ] Add compression metadata to manifest.
- [ ] Add compression feature negotiation.
- [ ] Implement file-type skip list.
- [ ] Implement first-block sample compression.
- [ ] Implement per-block compression.
- [ ] Authenticate compression metadata in AAD.
- [ ] Implement decompression on receiver.
- [ ] Show compression savings in UI.
- [ ] Add tests with text files and video files.

### Skip compression for

```txt
mp4, mkv, mp3, jpg, png, webp, zip, rar, 7z, pdf, docx, xlsx, pptx
```

### Try compression for

```txt
txt, csv, json, xml, sql, log, md, html, css, js, ts
```

### Done when

- [ ] Large text-like files transfer with fewer bytes.
- [ ] Already-compressed files are skipped.
- [ ] Compression does not break resume.

---

## 15. M12 — TURN fallback

### Goal

Make transfers work across restrictive networks.

### Features

- coturn deployment.
- Temporary TURN credentials.
- Client fetches credentials.
- ICE uses STUN + TURN.
- UI shows direct/relayed mode.

### Tasks

- [ ] Deploy coturn.
- [ ] Add TURN secret to server environment.
- [ ] Add `/api/turn-credentials` endpoint.
- [ ] Generate time-limited TURN credentials.
- [ ] Add credentials to `RTCPeerConnection` config.
- [ ] Add forced relay dev mode.
- [ ] Add connection mode indicator.
- [ ] Add TURN bandwidth monitoring.

### Manual tests

- [ ] Same machine tabs.
- [ ] Same Wi-Fi two devices.
- [ ] Different home networks.
- [ ] Mobile hotspot.
- [ ] VPN on/off.
- [ ] Forced relay.

### Done when

- [ ] Transfer works in forced relay mode.
- [ ] UI clearly shows relayed E2EE transfer.
- [ ] Temporary credentials expire correctly.

---

## 16. M13 — Polished MVP UI

### Goal

Make the app usable by real people.

### Sender UI states

```txt
idle
file_selected
waiting_for_receiver
connecting
waiting_for_accept
transferring
paused
completed
failed
cancelled
```

### Receiver UI states

```txt
loading_link
connecting
incoming_transfer
preparing_storage
transferring
verifying
saving
completed
failed
cancelled
```

### Required UI elements

- File name.
- File size.
- Connection status.
- Direct/relayed mode.
- E2EE status.
- Transfer speed.
- ETA.
- Progress bar.
- Resume status.
- Compression status.
- Pause/resume/cancel buttons.
- Error messages.

### UX copy examples

```txt
Your file is encrypted before leaving this browser.
```

```txt
Direct P2P connection established.
```

```txt
Using encrypted relay because direct P2P failed.
```

```txt
Resume data is stored locally in this browser.
```

### Done when

- [ ] Non-technical user can send and receive a file.
- [ ] Error states are understandable.
- [ ] Privacy claims are accurate.

---

## 17. M14 — Security hardening

### Goal

Make MVP safe enough for limited public testing.

### Tasks

- [ ] Add strict CSP.
- [ ] Add message size limits.
- [ ] Add frame size limits.
- [ ] Add room rate limits.
- [ ] Add WebSocket rate limits.
- [ ] Add temporary TURN credentials.
- [ ] Add server logging policy.
- [ ] Add dependency audit.
- [ ] Add tampered-frame tests.
- [ ] Add wrong-key tests.
- [ ] Add nonce uniqueness tests.
- [ ] Add XSS review for filenames.
- [ ] Add privacy page.
- [ ] Add threat model page.

### Done when

- [ ] Known critical security footguns are addressed.
- [ ] Public claims match actual implementation.
- [ ] Abuse of signaling/TURN is limited.

---

## 18. M15 — Public alpha

### Goal

Release to a small group of real users.

### Scope

- One sender.
- One receiver.
- One file.
- E2EE.
- Resume.
- Direct/relayed mode.
- No accounts.

### Alpha checklist

- [ ] Landing page.
- [ ] Transfer page.
- [ ] Receiver page.
- [ ] Error pages.
- [ ] Privacy/security explanation.
- [ ] Basic analytics without file metadata.
- [ ] Server monitoring.
- [ ] TURN monitoring.
- [ ] Feedback channel.
- [ ] Known limitations list.

### Done when

- [ ] At least 10 real-world transfers succeed.
- [ ] At least 3 network environments tested.
- [ ] Known bugs are tracked.
- [ ] No severe privacy/security bug is known.

---

## 19. Testing strategy

### Unit tests

- [ ] Range merging.
- [ ] Missing range calculation.
- [ ] Frame header encode/decode.
- [ ] Manifest validation.
- [ ] Nonce construction.
- [ ] AAD construction.
- [ ] Compression decision.
- [ ] Checkpoint serialization.

### Integration tests

- [ ] Signaling room lifecycle.
- [ ] Offer/answer forwarding.
- [ ] ICE candidate forwarding.
- [ ] DataChannel open.
- [ ] Encrypted block transfer.
- [ ] OPFS write/read.
- [ ] Resume after reconnect.

### Manual tests

- [ ] Chrome desktop.
- [ ] Firefox desktop.
- [ ] Edge desktop.
- [ ] Android Chrome.
- [ ] iOS Safari where possible.
- [ ] Same device two tabs.
- [ ] Same LAN two devices.
- [ ] Different networks.
- [ ] Forced TURN relay.

---

## 20. Benchmarking plan

Create a dev-only route:

```txt
/dev/bench
```

Benchmark:

- File read speed.
- AES-GCM encryption speed.
- AES-GCM decryption speed.
- SHA-256 hash speed.
- Compression speed.
- Decompression speed.
- OPFS write speed.
- DataChannel throughput.
- Memory usage.

Test files:

```txt
1 MB text
100 MB text/log
1 GB generated random file
1 GB CSV
5 GB video
20 GB synthetic file
```

Metrics:

```txt
average MB/s
peak MB/s
CPU pressure
memory usage
bufferedAmount behavior
compression savings
retry count
```

Use benchmark results to decide whether to add WASM.

---

## 21. Future v2 features

After MVP:

- Multi-file transfer.
- Folder transfer.
- Archive generation.
- QR code pairing.
- PAKE short-code pairing.
- Encrypted signaling.
- zstd WASM compression.
- BLAKE3 WASM hashing.
- Frame-level resume.
- Local network discovery.
- PWA install mode.
- Native desktop companion.
- Native mobile app.
- Optional account-based trusted devices.

---

## 22. Suggested GitHub labels

```txt
type:feature
type:bug
type:security
type:docs
type:test
type:refactor
area:signaling
area:webrtc
area:protocol
area:crypto
area:storage
area:ui
area:turn
area:compression
area:resume
priority:p0
priority:p1
priority:p2
```

---

## 23. Suggested first issues

1. Create monorepo structure.
2. Add architecture/protocol/security/roadmap docs.
3. Create Vite React TypeScript app.
4. Create TypeScript signaling server.
5. Implement WebSocket room join.
6. Implement message forwarding.
7. Build WebRTC hello-world page.
8. Send text message over DataChannel.
9. Add file picker.
10. Send small raw file.
11. Add progress bar.
12. Add backpressure.
13. Add control/data channels.
14. Add AES-GCM encryption.
15. Add block/frame protocol.

---

## 24. Definition of MVP complete

MVP is complete when:

- [ ] Sender can select one file.
- [ ] Sender can share a link.
- [ ] Receiver can open the link.
- [ ] Sender and receiver connect with WebRTC.
- [ ] Transfer uses app-level encryption.
- [ ] Transfer uses backpressure.
- [ ] Receiver writes large files without storing them fully in memory.
- [ ] Receiver can resume after refresh.
- [ ] Final file verifies.
- [ ] TURN fallback works.
- [ ] UI clearly communicates connection mode and encryption.
- [ ] Basic abuse prevention exists.
- [ ] Docs explain limitations honestly.
