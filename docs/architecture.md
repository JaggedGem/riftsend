# Riftsend Architecture

> Working name: **Riftsend**. Replace this name everywhere if the final product name changes.

Riftsend is a browser-based, end-to-end encrypted file transfer platform designed for direct peer-to-peer transfer across the internet. The app should transfer file bytes directly between two browsers whenever possible, fall back to an encrypted TURN relay when direct peer-to-peer connectivity fails, support very large files, and eventually support resumable transfers and optional compression.

This document explains the overall system architecture: components, responsibilities, data flow, browser APIs, network paths, storage model, and development constraints.

---

## 1. Core product goals

Riftsend should provide:

- **No account required** for the core sender-to-receiver flow.
- **End-to-end encrypted file transfer** where the server never receives the file decryption key.
- **Direct peer-to-peer transfer** using WebRTC when network conditions allow it.
- **Encrypted relay fallback** using TURN when direct connectivity is impossible.
- **Large-file support** by reading, processing, and writing data incrementally.
- **Resume support** using local checkpoints and verified block ranges.
- **Maximum practical speed** through DataChannel backpressure, worker-based processing, and adaptive block/frame handling.
- **Honest privacy UX** that clearly distinguishes direct P2P from relayed E2EE transfer.

---

## 2. Non-goals for the first MVP

The first MVP should not include:

- User accounts.
- Cloud storage.
- Long-term file hosting.
- Multi-recipient broadcast.
- Permanent transfer history synced to a server.
- Folder transfer with archive generation.
- Mobile native apps.
- WASM compression/hash modules.
- Perfect browser support for every edge case.

These can be added later, after the core transfer engine is reliable.

---

## 3. System components

```txt
Sender Browser
  - UI
  - File picker / drag-and-drop
  - WebRTC connection manager
  - Transfer engine
  - Crypto engine
  - Worker pipeline
  - Local progress state

Receiver Browser
  - UI
  - WebRTC connection manager
  - Transfer engine
  - Crypto engine
  - Worker pipeline
  - OPFS partial storage
  - IndexedDB checkpoint storage
  - Final file export

Signaling Server
  - Temporary rooms
  - Sender/receiver rendezvous
  - SDP offer/answer forwarding
  - ICE candidate forwarding
  - Optional temporary TURN credentials
  - Room expiration
  - Abuse/rate limiting

TURN Server
  - Relay fallback for WebRTC when direct connectivity fails
  - Sees encrypted transport bytes only
  - Should never receive file keys
  - Should use temporary credentials
```

---

## 4. High-level transfer modes

### 4.1 Direct P2P mode

Preferred path:

```txt
Sender Browser ─────────────────────────────► Receiver Browser
```

Properties:

- Fastest path in many cases.
- No file data goes through the application server.
- Server only helps with signaling.
- File chunks are app-level encrypted before being sent.

### 4.2 Relayed E2EE mode

Fallback path:

```txt
Sender Browser ─────► TURN Relay ─────► Receiver Browser
```

Properties:

- Used when NAT/firewall conditions prevent direct connectivity.
- Relay forwards encrypted WebRTC traffic.
- App-level encryption still prevents the relay from reading files.
- More expensive because server bandwidth is consumed.
- Should be clearly shown in the UI.

Suggested UI text:

```txt
Using encrypted relay because direct P2P failed.
Your file is still encrypted before leaving this browser.
```

---

## 5. What the server sees

The signaling server may see:

- Room ID.
- Connection timestamps.
- Client IP addresses.
- User agent strings, depending on logging.
- Signaling message sizes/timing.
- Whether a sender and receiver connected.
- Whether TURN credentials were requested.

The signaling server should not see:

- File contents.
- File decryption keys.
- Plaintext file chunks.
- Plaintext transfer secret.
- Ideally, plaintext filenames or file sizes.

The TURN server may see:

- Client IP addresses.
- Packet sizes and timing.
- Total relayed bandwidth.
- Encrypted WebRTC traffic.

The TURN server should not see:

- File contents.
- File decryption keys.
- Plaintext chunks.

---

## 6. Browser APIs used

### WebRTC

Used for peer-to-peer networking.

Primary APIs:

- `RTCPeerConnection`
- `RTCDataChannel`
- `RTCSessionDescription`
- ICE candidate handling
- `getStats()` for diagnostics and connection mode detection

### WebSocket

Used between browser and signaling server.

Responsibilities:

- Join room.
- Forward SDP offer.
- Forward SDP answer.
- Forward ICE candidates.
- Notify peers of disconnection.

### Web Crypto API

Used for:

- Random key generation.
- HKDF key derivation.
- AES-GCM encryption/decryption.
- SHA-256 hashing initially.

### File and Blob APIs

Used for:

- Reading user-selected files.
- Slicing large files into bounded blocks.
- Avoiding whole-file memory loading.

### Web Workers

Used for heavy work:

- File reading loop.
- Optional compression.
- Encryption/decryption.
- Hashing.
- Frame creation/parsing.
- OPFS writes when possible.

### IndexedDB

Used for metadata and checkpoints:

- Transfer manifest.
- Verified block ranges.
- Resume state.
- Local transfer settings.

### OPFS

Origin Private File System is used for receiver-side partial file staging.

Used for:

- Writing received blocks by offset.
- Preserving incomplete transfers across refresh.
- Avoiding huge memory use.

### File System Access API

Used where available for:

- Writing final output to a user-selected file path.
- Potentially streaming directly to a destination file.

Fallbacks are needed because browser support varies.

---

## 7. Main runtime architecture

```txt
UI Layer
  ↓ commands / state updates
Transfer Controller
  ↓
WebRTC Manager ───── Signaling Client
  ↓
Control Channel / Data Channel
  ↓
Worker Pipeline
  ↓
Crypto / Compression / Storage
```

### 7.1 UI Layer

Responsible for:

- File selection.
- Share link display.
- Accept/reject transfer UI.
- Progress display.
- Speed and ETA.
- Connection status.
- Error messages.
- Pause/resume/cancel controls.

The UI should not contain protocol logic.

### 7.2 Transfer Controller

Responsible for:

- Managing transfer state machine.
- Sending/receiving control messages.
- Starting/stopping workers.
- Coordinating resume.
- Handling pause/cancel/failure.

### 7.3 WebRTC Manager

Responsible for:

- Creating `RTCPeerConnection`.
- Creating/receiving DataChannels.
- Creating offer/answer.
- Handling ICE candidates.
- Tracking connection state.
- Detecting relay/direct mode where possible.

### 7.4 Worker Pipeline

Responsible for:

- Reading blocks from files.
- Compressing blocks if enabled.
- Encrypting/decrypting blocks.
- Splitting/reassembling frames.
- Hashing blocks/files.
- Writing blocks to OPFS.

---

## 8. Sender flow

```txt
1. Sender opens app.
2. Sender selects file.
3. App generates transferId, roomId, and masterSecret.
4. App creates share link with key in URL fragment.
5. Sender joins signaling room.
6. Sender creates RTCPeerConnection.
7. Sender creates control and data RTCDataChannels.
8. Sender creates SDP offer.
9. Sender sends offer through signaling server.
10. Sender sends ICE candidates through signaling server.
11. Sender receives answer and remote ICE candidates.
12. WebRTC connection opens.
13. Sender derives encryption keys from masterSecret.
14. Sender sends hello over control channel.
15. Sender sends encrypted/authenticated manifest.
16. Receiver accepts.
17. Sender worker reads file blocks.
18. Sender optionally compresses each block.
19. Sender encrypts each block.
20. Sender splits encrypted block into frames.
21. Sender sends frames with backpressure.
22. Sender processes ACKs.
23. Sender resends missing blocks if requested.
24. Sender completes transfer and closes connection.
```

---

## 9. Receiver flow

```txt
1. Receiver opens share link.
2. App reads transfer key from URL fragment.
3. Receiver joins signaling room.
4. Receiver receives SDP offer.
5. Receiver creates RTCPeerConnection.
6. Receiver sets remote offer.
7. Receiver creates SDP answer.
8. Receiver sends answer through signaling server.
9. Receiver exchanges ICE candidates.
10. WebRTC connection opens.
11. Receiver derives encryption keys from masterSecret.
12. Receiver receives hello.
13. Receiver receives manifest.
14. Receiver displays incoming transfer UI.
15. Receiver accepts.
16. Receiver creates or opens OPFS partial file.
17. Receiver receives frames.
18. Receiver reassembles frames into encrypted blocks.
19. Receiver decrypts blocks.
20. Receiver decompresses blocks if needed.
21. Receiver writes original block bytes to the correct offset.
22. Receiver updates checkpoint in IndexedDB.
23. Receiver ACKs verified blocks.
24. Receiver verifies final file hash.
25. Receiver exports/saves final file.
26. Receiver deletes temporary local state.
```

---

## 10. Data pipeline

### Sender pipeline

```txt
File
  ↓
Read fixed-size block
  ↓
Optional compression
  ↓
Encrypt block with AES-GCM
  ↓
Split encrypted block into frames
  ↓
Send frames through RTCDataChannel
```

### Receiver pipeline

```txt
Receive frames
  ↓
Reassemble encrypted block
  ↓
Decrypt block
  ↓
Optional decompression
  ↓
Write original bytes at file offset
  ↓
Save checkpoint
  ↓
ACK block
```

---

## 11. Blocks and frames

Use two different units:

```txt
Block = processing unit
Frame = network send unit
```

Suggested defaults:

```txt
blockSize = 4 MiB
frameSize = 256 KiB
```

Why this split exists:

- Compression works better on larger blocks.
- Encryption/authentication can happen per block.
- Resume can work at block level.
- DataChannel messages remain reasonably sized.
- Receiver memory use is bounded.

Initial simplification:

```txt
If a block is incomplete after disconnect, discard it and request the full block again.
```

Later improvement:

```txt
Support frame-level resume inside incomplete blocks.
```

---

## 12. Backpressure strategy

The sender must not call `dataChannel.send()` in an unbounded loop.

Use:

```txt
RTCDataChannel.bufferedAmount
RTCDataChannel.bufferedAmountLowThreshold
```

Recommended initial values:

```txt
HIGH_WATER = 16 MiB
LOW_WATER = 4 MiB
```

Sender behavior:

```txt
Before sending another frame:
  if bufferedAmount > HIGH_WATER:
    wait for bufferedamountlow event
  send next frame
```

Backpressure is required for:

- Stable memory use.
- Large files.
- Mobile devices.
- Slow receiver links.
- Slow relay paths.

---

## 13. Storage architecture

### Sender storage

Sender does not need to copy the file. It uses the browser `File` handle and reads slices as needed.

Sender may store:

- Transfer metadata.
- Manifest.
- ACKed block ranges.
- UI progress.

### Receiver storage

Receiver should not keep file data in memory.

Receiver stores:

- Partial file bytes in OPFS.
- Transfer checkpoint in IndexedDB.
- Verified block ranges.
- Manifest hash.
- Temporary frame/block state in memory.

### Final export

Possible strategies:

1. OPFS staging → final browser download.
2. OPFS staging → File System Access API save.
3. Direct File System Access API write where supported.

MVP can use OPFS staging plus final download/export.

---

## 14. Resume architecture

Resume is based on verified block ranges.

Receiver stores:

```json
{
  "transferId": "...",
  "manifestHash": "...",
  "files": {
    "0": {
      "verifiedBlocks": [
        [0, 120],
        [122, 300]
      ],
      "opfsPath": "transfers/<transferId>/file-0.part"
    }
  }
}
```

On reconnect:

```txt
1. Peers reconnect through signaling/WebRTC.
2. Receiver loads checkpoint.
3. Receiver sends HAVE message.
4. Sender calculates missing block ranges.
5. Sender sends only missing blocks.
6. Receiver verifies final file.
```

---

## 15. Compression architecture

Compression is optional and should be automatic.

Rule:

```txt
Compress before encryption.
Never compress after encryption.
```

MVP:

```txt
compression = none
```

Later:

```txt
compression = auto
algorithm = gzip via CompressionStream
blockSize = 4 MiB
minSavingsPercent = 5%
```

Compression decision:

- Skip known already-compressed formats.
- Try sample compression for unknown formats.
- Compress only if savings are meaningful.
- Compression metadata is authenticated as part of encryption AAD.

---

## 16. Deployment architecture

Recommended deployment:

```txt
Static frontend:
  Cloudflare Pages, Vercel, Netlify, or similar

Signaling server:
  VPS, Fly.io, Railway, Render, Hetzner, etc.

TURN server:
  VPS with high bandwidth
  coturn
```

Important:

- Signaling and TURN do not have to run on the same server.
- TURN bandwidth can become expensive.
- TURN should use temporary credentials.
- Logs should avoid storing sensitive metadata.

---

## 17. Observability and diagnostics

Collect locally visible diagnostics:

- Connection state.
- ICE connection state.
- DataChannel state.
- Direct vs relay mode where detectable.
- Current send speed.
- Current receive speed.
- DataChannel buffered amount.
- Blocks sent/received/verified.
- Compression savings.
- Retry count.

Server metrics:

- Active rooms.
- Room creation rate.
- WebSocket connections.
- Signaling messages per room.
- TURN credential requests.
- TURN bandwidth from coturn metrics/logs.

Do not log:

- Transfer secret.
- Full share URL with fragment.
- File contents.
- Plaintext filenames if avoidable.

---

## 18. Major technical risks

### Browser storage limits

OPFS is not truly unlimited. The app must handle quota errors gracefully.

### Browser compatibility

WebRTC is broadly available, but OPFS, File System Access API, and Compression Streams have varying support and behavior.

### TURN costs

Relay mode can consume large bandwidth. Abuse controls are mandatory before public launch.

### Crypto misuse

Nonce reuse or unauthenticated metadata would be serious bugs.

### Resume correctness

Incorrect checkpoint handling can corrupt output files.

### Memory usage

Unbounded frame buffering can crash tabs.

---

## 19. Architecture decisions

### ADR-001: Use TypeScript as the primary language

Reason:

- Browser APIs are JavaScript/TypeScript APIs.
- WebRTC, Web Crypto, OPFS, File API, and workers are naturally controlled from TypeScript.
- Type safety helps protocol code.

### ADR-002: Use WebRTC DataChannels for transfer

Reason:

- Peer-to-peer data transport in browsers.
- Avoids server-hosted file upload/download for direct mode.
- Supports relay fallback via TURN.

### ADR-003: Add app-level encryption

Reason:

- Clear E2EE model.
- TURN/signaling infrastructure remains untrusted.
- File chunks remain encrypted before leaving sender app code.

### ADR-004: Use blocks and frames

Reason:

- Blocks are good for compression/encryption/resume.
- Frames are good for DataChannel send size and backpressure.

### ADR-005: Add WASM only after benchmarking

Reason:

- Web Crypto and native browser APIs may be enough for MVP.
- WASM increases build complexity.
- Good candidates later: BLAKE3, zstd, archive generation.

---

## 20. Architecture checklist for MVP

- [ ] WebSocket signaling server.
- [ ] Temporary room system.
- [ ] WebRTC offer/answer exchange.
- [ ] ICE candidate forwarding.
- [ ] Control and data DataChannels.
- [ ] File manifest.
- [ ] Backpressure-aware sending.
- [ ] AES-GCM app-level encryption.
- [ ] Block/frame pipeline.
- [ ] Receiver OPFS staging.
- [ ] IndexedDB checkpoints.
- [ ] Resume via HAVE message.
- [ ] Final file verification.
- [ ] Direct/relay UI indicator.
- [ ] TURN fallback.
- [ ] Basic security and privacy docs.
