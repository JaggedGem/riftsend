# Riftsend Detailed Implementation Plan

This is the full step-by-step development plan for Riftsend.

The goal of this document is to describe exactly what to build, in what order, and which folders/files to work in. It intentionally avoids application source code. Treat it as an execution checklist for yourself or for an agentic coding assistant.

---

## Important rule

Do not build the final protocol first.

Build in this order:

1. Repository skeleton.
2. WebSocket signaling.
3. WebRTC hello-world.
4. Raw small file transfer.
5. Backpressure.
6. Control/data channel split.
7. App-level encryption.
8. Blocks and frames.
9. Receiver storage.
10. Resume.
11. Compression.
12. TURN fallback.
13. Hardening, testing, and polish.

Each stage should produce a working checkpoint before the next stage begins.

---

## Phase 0 — Repository foundation

### Goal

Create a clean monorepo structure with documentation and GitHub setup files.

### Work in

- Repository root.
- `docs/`
- `.github/`

### Create folders

- `apps/`
- `apps/web/`
- `apps/signaling/`
- `packages/`
- `packages/protocol/`
- `packages/shared/`
- `docs/`
- `.github/`
- `.github/ISSUE_TEMPLATE/`
- `.github/workflows/`

### Create root files

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `.gitignore`
- `.editorconfig`
- `.npmrc`
- `pnpm-workspace.yaml`
- `package.json`
- `LICENSE`, after choosing a license

### Create docs files

- `docs/architecture.md`
- `docs/protocol.md`
- `docs/security.md`
- `docs/roadmap.md`
- `docs/repo-setup.md`
- `docs/implementation-plan.md`

### Create GitHub files

- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/workflows/ci.yml`

### What to do

1. Choose the final project name or keep the working name `Riftsend`.
2. Update every placeholder project-name reference if you choose a different name.
3. Pick a license before making the repo public.
4. Keep CI manual-only until the packages/apps actually exist and root scripts are stable.
5. Commit the documentation and repo setup files as the initial commit.

### Done when

- The repo has a clear README.
- The repo has architecture, protocol, security, roadmap, setup, and implementation docs.
- The folder structure exists.
- GitHub issue and PR templates exist.
- No implementation code is required yet.

---

## Phase 1 — Create the web app shell

### Goal

Create the initial browser app with placeholder sender and receiver screens.

### Work in

- `apps/web/`
- `apps/web/src/`
- `apps/web/src/app/`
- `apps/web/src/components/`

### Files/folders to create or configure

- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/app/App.tsx`
- `apps/web/src/app/routes.tsx`, if you use a router
- `apps/web/src/components/TransferShell.tsx`
- `apps/web/src/components/SenderPanel.tsx`
- `apps/web/src/components/ReceiverPanel.tsx`
- `apps/web/src/components/StatusCard.tsx`

### What to do

1. Initialize the web app as a Vite React TypeScript app.
2. Set up a simple app layout with two modes: sender and receiver.
3. Add a route or UI switch for sender mode.
4. Add a route or UI switch for receiver mode.
5. Add placeholder cards for connection status, selected file, transfer progress, and logs.
6. Add a simple development log panel so WebRTC and signaling events can be seen during early testing.
7. Do not implement real file transfer yet.
8. Do not implement encryption yet.
9. Do not add complex styling yet.

### Done when

- The frontend runs locally.
- You can open sender and receiver views.
- The UI has obvious placeholders for future state.
- The app has no transfer logic yet.

---

## Phase 2 — Create the signaling server shell

### Goal

Create a minimal server that accepts WebSocket connections.

### Work in

- `apps/signaling/`
- `apps/signaling/src/`

### Files/folders to create or configure

- `apps/signaling/package.json`
- `apps/signaling/tsconfig.json`
- `apps/signaling/src/index.ts`
- `apps/signaling/src/config.ts`
- `apps/signaling/src/logger.ts`
- `apps/signaling/src/messageTypes.ts`

### What to do

1. Initialize the signaling app as a TypeScript Node or Bun service.
2. Add a WebSocket server.
3. Add startup configuration for host, port, and allowed frontend origin.
4. Add basic connection logging.
5. Add basic JSON message parsing.
6. Add safe handling for invalid JSON.
7. Add a basic error response shape.
8. Do not implement rooms yet.
9. Do not implement WebRTC-specific forwarding yet.

### Done when

- The signaling server starts locally.
- The frontend can connect to the WebSocket server.
- Invalid messages do not crash the server.
- Connections and disconnections are logged.

---

## Phase 3 — Add room-based signaling

### Goal

Allow exactly one sender and one receiver to join a temporary room and exchange JSON messages.

### Work in

- `apps/signaling/src/rooms.ts`
- `apps/signaling/src/messageTypes.ts`
- `apps/signaling/src/index.ts`
- `apps/web/src/signaling/`

### Files/folders to create

- `apps/web/src/signaling/signalingClient.ts`
- `apps/web/src/signaling/signalingTypes.ts`
- `apps/signaling/src/rooms.ts`
- `apps/signaling/src/roomTypes.ts`

### What to do

1. Define a room as a temporary in-memory structure.
2. Give each room a room ID, sender socket, receiver socket, creation time, and last activity time.
3. Allow a client to join as sender or receiver.
4. Reject a second sender or second receiver in the same room.
5. Notify the existing peer when the other peer joins.
6. Forward generic signaling payloads from sender to receiver and receiver to sender.
7. Remove a peer from the room when their socket closes.
8. Expire empty or inactive rooms.
9. Add simple rate limits for room creation and message frequency later, but leave advanced abuse controls for hardening.

### Done when

- Two browser tabs can join the same room.
- The sender tab can send a JSON payload to the receiver tab.
- The receiver tab can send a JSON payload to the sender tab.
- The server does not store any file metadata.

---

## Phase 4 — WebRTC hello-world

### Goal

Establish a WebRTC DataChannel between two browser tabs through the signaling server.

### Work in

- `apps/web/src/webrtc/`
- `apps/web/src/signaling/`
- `apps/web/src/components/`

### Files/folders to create

- `apps/web/src/webrtc/createPeerConnection.ts`
- `apps/web/src/webrtc/webrtcTypes.ts`
- `apps/web/src/webrtc/peerEvents.ts`
- `apps/web/src/webrtc/iceServers.ts`
- `apps/web/src/webrtc/connectionState.ts`

### What to do

1. Add a WebRTC connection manager for sender mode.
2. Add a WebRTC connection manager for receiver mode.
3. On the sender side, create a peer connection.
4. On the sender side, create one DataChannel named `hello` or `control`.
5. On the sender side, create an offer and send it through signaling.
6. On the receiver side, receive the offer and set it as the remote description.
7. On the receiver side, create an answer and send it through signaling.
8. On the sender side, receive the answer and set it as the remote description.
9. Exchange ICE candidates through the existing room signaling.
10. Show connection state changes in the UI log panel.
11. When the DataChannel opens, send a simple text message from sender to receiver.
12. Display the received message in the receiver UI.
13. Do not add files yet.
14. Do not add encryption yet.

### Done when

- Two tabs connect through WebRTC.
- A DataChannel opens.
- The sender sends a text message.
- The receiver displays the message.
- Connection failures are shown in the UI log panel.

---

## Phase 5 — Basic file selection and manifest preview

### Goal

Let the sender select one file and send file metadata to the receiver over the control channel.

### Work in

- `apps/web/src/components/`
- `apps/web/src/transfer/`
- `apps/web/src/protocol/`

### Files/folders to create

- `apps/web/src/transfer/fileSelection.ts`
- `apps/web/src/transfer/fileMetadata.ts`
- `apps/web/src/protocol/controlMessages.ts`
- `apps/web/src/components/FileDropZone.tsx`
- `apps/web/src/components/IncomingTransferCard.tsx`

### What to do

1. Add a drag-and-drop file picker to sender mode.
2. Store the selected file object in sender state.
3. Extract safe metadata: name, size, MIME hint, and last modified timestamp.
4. Send a simple manifest message over the control channel.
5. Display the incoming file name and size on the receiver side.
6. Add receiver accept and reject buttons.
7. Only begin data transfer after the receiver accepts.
8. Do not send file bytes yet.

### Done when

- Sender can select one file.
- Receiver sees an incoming transfer card.
- Receiver can accept or reject.
- Sender sees whether the receiver accepted.

---

## Phase 6 — Raw small file transfer

### Goal

Transfer one small file with simple chunks and reconstruct it into a downloadable Blob on the receiver side.

### Work in

- `apps/web/src/transfer/`
- `apps/web/src/webrtc/`
- `apps/web/src/components/`

### Files/folders to create

- `apps/web/src/transfer/rawChunkSender.ts`
- `apps/web/src/transfer/rawChunkReceiver.ts`
- `apps/web/src/transfer/progress.ts`
- `apps/web/src/components/TransferProgress.tsx`

### What to do

1. Choose an initial simple chunk size such as 64 KiB.
2. On sender accept, read the selected file incrementally using slices.
3. Send each slice as a binary DataChannel message.
4. On the receiver side, collect binary messages in order.
5. Track received bytes.
6. Update the progress UI.
7. When all bytes are received, create a Blob from the received pieces.
8. Present a download action for the reconstructed file.
9. Do not support huge files yet.
10. Do not support resume yet.
11. Do not add encryption yet.

### Done when

- A small text file transfers correctly.
- A small image transfers correctly.
- A medium test file transfers correctly.
- Progress reaches 100%.
- Receiver can download the final file.

---

## Phase 7 — Add DataChannel backpressure

### Goal

Prevent the sender from overwhelming the browser’s DataChannel buffer.

### Work in

- `apps/web/src/webrtc/`
- `apps/web/src/transfer/`

### Files/folders to create

- `apps/web/src/webrtc/backpressure.ts`
- `apps/web/src/transfer/sendQueue.ts`

### What to do

1. Define a high-water threshold for the DataChannel send buffer.
2. Define a low-water threshold for resuming sends.
3. Before sending each binary message, check the DataChannel buffered amount.
4. If the buffer is above the high-water threshold, pause reading/sending.
5. Resume when the DataChannel fires a low-buffer event.
6. Add UI logging when the sender is throttled by backpressure.
7. Test with increasingly large files.
8. Confirm that memory usage does not grow without bound.

### Done when

- A large file can be sent without the sender tab’s memory growing uncontrollably.
- The sender pauses and resumes naturally based on DataChannel buffer state.
- The progress UI continues updating.

---

## Phase 8 — Split control and data channels

### Goal

Separate JSON protocol messages from binary file data.

### Work in

- `apps/web/src/webrtc/`
- `apps/web/src/protocol/`
- `apps/web/src/transfer/`

### Files/folders to create or update

- `apps/web/src/webrtc/dataChannels.ts`
- `apps/web/src/protocol/controlMessages.ts`
- `apps/web/src/protocol/messageRouter.ts`
- `apps/web/src/transfer/transferSession.ts`

### What to do

1. Create a reliable ordered control channel.
2. Create a separate data channel for binary payloads.
3. Route all JSON messages through the control channel.
4. Route all file bytes through the data channel.
5. Add message validation for control messages.
6. Add clear handling for unsupported message types.
7. Keep the raw chunk transfer working after the split.

### Done when

- Metadata, accept/reject, progress, and completion messages use the control channel.
- Binary chunks use the data channel.
- File transfer still works.

---

## Phase 9 — Create shared protocol package

### Goal

Move protocol definitions out of the app and into a shared package.

### Work in

- `packages/protocol/`
- `apps/web/src/protocol/`
- `apps/signaling/src/messageTypes.ts`

### Files/folders to create

- `packages/protocol/package.json`
- `packages/protocol/tsconfig.json`
- `packages/protocol/src/messages.ts`
- `packages/protocol/src/manifest.ts`
- `packages/protocol/src/frames.ts`
- `packages/protocol/src/constants.ts`
- `packages/protocol/src/validation.ts`

### What to do

1. Define the protocol version constant.
2. Define signaling message shapes.
3. Define control message shapes.
4. Define manifest shape.
5. Define frame header shape.
6. Define validation helpers for all incoming protocol messages.
7. Update the web app to use protocol definitions from `packages/protocol`.
8. Update the signaling server to use shared signaling message definitions.
9. Ensure the signaling server still does not need to understand file-transfer internals beyond forwarding payloads.

### Done when

- Protocol message definitions live in one shared place.
- The web app imports protocol definitions from `packages/protocol`.
- The signaling server imports only the signaling-related definitions it needs.

---

## Phase 10 — Add app-level key generation and URL fragment sharing

### Goal

Generate a transfer secret in the sender browser and share it through the URL fragment.

### Work in

- `apps/web/src/crypto/`
- `apps/web/src/app/`
- `apps/web/src/components/`
- `packages/protocol/src/`

### Files/folders to create

- `apps/web/src/crypto/random.ts`
- `apps/web/src/crypto/encoding.ts`
- `apps/web/src/crypto/keys.ts`
- `apps/web/src/app/shareLink.ts`
- `apps/web/src/components/ShareLinkCard.tsx`

### What to do

1. Generate a random room ID.
2. Generate a high-entropy master secret in the browser.
3. Encode the master secret in URL-safe form.
4. Build a share link containing the room ID in the path and the secret in the URL fragment.
5. On the receiver side, parse the room ID from the path.
6. On the receiver side, parse the secret from the fragment.
7. Validate that the fragment exists before attempting to join as receiver.
8. Never send the fragment secret to the signaling server.
9. Never log the secret to the UI log panel or console.

### Done when

- Sender can create a share link.
- Receiver can open the link and recover the secret client-side.
- The signaling server never receives the secret.

---

## Phase 11 — Add key derivation

### Goal

Derive separate purpose-specific keys from the master secret.

### Work in

- `apps/web/src/crypto/`
- `packages/protocol/src/constants.ts`

### Files/folders to create or update

- `apps/web/src/crypto/hkdf.ts`
- `apps/web/src/crypto/transferKeys.ts`
- `apps/web/src/crypto/keyLabels.ts`

### What to do

1. Import the master secret into Web Crypto as key material.
2. Derive a file encryption key.
3. Derive a control message encryption key, even if encrypted control messages are delayed to a later phase.
4. Derive a manifest authentication or encryption key.
5. Define clear labels for each derived key purpose.
6. Ensure both sender and receiver derive the same keys from the same master secret.
7. Add tests or debug checks that compare non-secret key fingerprints between peers without exposing the keys.
8. Do not use one raw master secret directly for everything.

### Done when

- Both peers derive matching purpose-specific keys.
- The app can detect missing or invalid transfer secrets early.
- No secret key material is logged.

---

## Phase 12 — Add encrypted chunk transfer

### Goal

Encrypt each raw transfer chunk before sending it.

### Work in

- `apps/web/src/crypto/`
- `apps/web/src/transfer/`
- `packages/protocol/src/`

### Files/folders to create

- `apps/web/src/crypto/aesGcm.ts`
- `apps/web/src/crypto/nonces.ts`
- `apps/web/src/transfer/encryptedChunkSender.ts`
- `apps/web/src/transfer/encryptedChunkReceiver.ts`

### What to do

1. Create a deterministic nonce strategy that guarantees no repeated nonce for the same key.
2. Include transfer ID, file ID, chunk index, and length information as authenticated metadata.
3. Encrypt each chunk before sending.
4. Send enough non-secret metadata for the receiver to decrypt and place the chunk correctly.
5. Decrypt each chunk on the receiver side.
6. Fail closed if decryption fails.
7. Add a visible wrong-key error state.
8. Add a tamper test by modifying received bytes in development mode and confirming decryption fails.
9. Keep the rest of the raw transfer flow working.

### Done when

- File transfer works with app-level encryption.
- Wrong key causes failure.
- Tampered data causes failure.
- No plaintext file bytes are sent over the data channel.

---

## Phase 13 — Move from chunks to blocks and frames

### Goal

Introduce the final processing model: blocks for encryption/resume/compression and frames for network sending.

### Work in

- `packages/protocol/src/frames.ts`
- `packages/protocol/src/manifest.ts`
- `apps/web/src/transfer/`
- `apps/web/src/crypto/`

### Files/folders to create

- `apps/web/src/transfer/blockReader.ts`
- `apps/web/src/transfer/blockEncryptor.ts`
- `apps/web/src/transfer/frameWriter.ts`
- `apps/web/src/transfer/frameReader.ts`
- `apps/web/src/transfer/blockReassembler.ts`
- `apps/web/src/transfer/blockAck.ts`

### What to do

1. Define block size in the manifest.
2. Define frame size in the manifest.
3. Read files in blocks rather than small chunks.
4. Encrypt a complete block as one encrypted payload.
5. Split the encrypted block into frames small enough for stable DataChannel sending.
6. Include block index, frame index, and total frame count in frame metadata.
7. On the receiver side, collect frames by block.
8. When all frames for a block arrive, reassemble the encrypted block.
9. Decrypt the full block.
10. Write or buffer the plaintext block depending on current storage phase.
11. ACK completed blocks rather than individual frames.
12. Discard incomplete blocks on reconnect for the first version.

### Done when

- Transfer works using block encryption and frame sending.
- The receiver can reassemble, decrypt, and ACK blocks.
- The sender can track block-level progress.

---

## Phase 14 — Move heavy work into Web Workers

### Goal

Prevent file reading, encryption, hashing, compression, and storage work from freezing the UI.

### Work in

- `apps/web/src/workers/`
- `apps/web/src/transfer/`
- `apps/web/src/crypto/`

### Files/folders to create

- `apps/web/src/workers/senderWorker.ts`
- `apps/web/src/workers/receiverWorker.ts`
- `apps/web/src/workers/workerMessages.ts`
- `apps/web/src/workers/workerClient.ts`

### What to do

1. Move sender-side block reading and encryption into a worker.
2. Move receiver-side decryption and block processing into a worker.
3. Define worker message types for starting, pausing, canceling, progress updates, errors, and completion.
4. Transfer ArrayBuffers between main thread and worker where appropriate.
5. Keep WebRTC DataChannel ownership on the main thread unless a later design proves worker-based WebRTC support is suitable and stable for your target browsers.
6. Ensure UI remains responsive during large transfers.
7. Add cancellation handling across main thread and worker.

### Done when

- Large transfers do not freeze the UI.
- Sender and receiver workers report progress.
- Cancelling a transfer stops worker activity cleanly.

---

## Phase 15 — Add receiver-side OPFS storage

### Goal

Stop keeping received file data in memory and write verified blocks to browser storage.

### Work in

- `apps/web/src/storage/`
- `apps/web/src/transfer/`
- `apps/web/src/workers/`

### Files/folders to create

- `apps/web/src/storage/opfs.ts`
- `apps/web/src/storage/partialFiles.ts`
- `apps/web/src/storage/storageErrors.ts`
- `apps/web/src/transfer/receiverStorage.ts`

### What to do

1. Detect OPFS support.
2. Create a transfer-specific OPFS directory.
3. Create a partial file for each incoming file.
4. When a block is decrypted, write it at its original file offset.
5. Track written block ranges.
6. Handle insufficient quota errors clearly.
7. Add fallback behavior for unsupported browsers later, but keep OPFS as the first serious target.
8. Remove the earlier memory-only receiver path for large files.

### Done when

- Receiver can store large incoming files without holding the entire file in memory.
- Received blocks are written to OPFS by offset.
- Storage errors are shown clearly.

---

## Phase 16 — Add IndexedDB checkpoints

### Goal

Persist transfer metadata and verified block ranges so interrupted transfers can resume.

### Work in

- `apps/web/src/storage/`
- `apps/web/src/transfer/`

### Files/folders to create

- `apps/web/src/storage/indexedDb.ts`
- `apps/web/src/storage/checkpoints.ts`
- `apps/web/src/storage/checkpointTypes.ts`
- `apps/web/src/transfer/rangeSet.ts`, or use `packages/shared/src/rangeSet.ts`

### What to do

1. Store transfer ID, manifest hash, file metadata, OPFS partial file paths, and verified block ranges.
2. Update checkpoints periodically, not after every tiny event.
3. Store only what is needed to resume.
4. Do not store file decryption keys in IndexedDB unless you make an explicit product/security decision to do so.
5. On receiver page load, detect whether a checkpoint exists for the current transfer ID.
6. Show the receiver that a partial transfer is available to resume.
7. Add cleanup for completed or canceled transfers.

### Done when

- Receiver progress survives a page refresh.
- The app can find partial transfers by transfer ID.
- Completed transfers clean up temporary metadata and storage.

---

## Phase 17 — Add block-level resume

### Goal

Resume interrupted transfers by requesting only missing verified blocks.

### Work in

- `packages/protocol/src/messages.ts`
- `apps/web/src/transfer/`
- `apps/web/src/storage/`

### Files/folders to create or update

- `apps/web/src/transfer/resumeSender.ts`
- `apps/web/src/transfer/resumeReceiver.ts`
- `apps/web/src/transfer/blockScheduler.ts`
- `packages/shared/src/rangeSet.ts`

### What to do

1. Add a `have` control message containing verified block ranges.
2. Add a `request` control message for missing block ranges.
3. On reconnect, receiver loads checkpoint and sends `have`.
4. Sender compares `have` ranges with the manifest block count.
5. Sender schedules only missing blocks.
6. If a block was partially received but not verified, treat it as missing.
7. Continue sending from the first missing block.
8. Test by killing the receiver tab mid-transfer and reopening the same link.
9. Test by killing the sender tab and making the user restart sending with the same file if your UX supports it.
10. Make clear in the UI when resume is available and when it is not.

### Done when

- A transfer can resume after receiver refresh.
- The sender does not resend verified blocks.
- The final file is correct after a resumed transfer.

---

## Phase 18 — Add final file verification

### Goal

Verify that the reconstructed file exactly matches what the sender intended to send.

### Work in

- `apps/web/src/crypto/`
- `apps/web/src/transfer/`
- `packages/protocol/src/manifest.ts`

### Files/folders to create

- `apps/web/src/crypto/hash.ts`
- `apps/web/src/transfer/fileVerifier.ts`

### What to do

1. Decide whether the sender computes a final file hash before transfer, during transfer, or as part of a streaming pipeline.
2. Add final hash information to the manifest when available.
3. On the receiver side, compute the final hash after all blocks are written.
4. Compare receiver-computed hash with sender-provided authenticated hash.
5. If the hash matches, mark the file complete.
6. If the hash fails, report corruption and request re-transfer or missing ranges depending on your protocol capabilities.
7. Consider later replacing SHA-256 with BLAKE3 if hashing becomes a bottleneck.

### Done when

- Completed files are verified.
- Corruption is detected.
- The UI distinguishes transfer completion from verification completion.

---

## Phase 19 — Add final file export

### Goal

Let the receiver save the verified file outside OPFS.

### Work in

- `apps/web/src/storage/`
- `apps/web/src/components/`
- `apps/web/src/transfer/`

### Files/folders to create

- `apps/web/src/storage/exportFile.ts`
- `apps/web/src/components/SaveFileButton.tsx`
- `apps/web/src/components/CompletedTransferCard.tsx`

### What to do

1. Detect support for the File System Access API.
2. For supported browsers, allow the user to choose a save location.
3. Copy the verified file from OPFS to the chosen location.
4. For unsupported browsers, provide a fallback download path for files that the browser can handle.
5. Show clear limitations when a fallback cannot support very large files safely.
6. Clean up OPFS partial files only after successful export or explicit user confirmation.

### Done when

- Receiver can save the completed file.
- OPFS cleanup is safe.
- Unsupported browser limitations are clear.

---

## Phase 20 — Add compression metadata, but keep compression disabled

### Goal

Prepare the protocol for compression without changing the data pipeline yet.

### Work in

- `packages/protocol/src/manifest.ts`
- `packages/protocol/src/frames.ts`
- `apps/web/src/transfer/`

### Files/folders to create or update

- `apps/web/src/transfer/compressionDecision.ts`
- `apps/web/src/transfer/compressionTypes.ts`

### What to do

1. Add compression fields to the manifest.
2. Add compression fields to block metadata.
3. Add support for `compression: none` everywhere.
4. Ensure compression metadata is included in authenticated metadata for encryption.
5. Verify that transfers still work with compression disabled.

### Done when

- The protocol can describe compression state.
- All transfers still use `none`.
- No behavior changes yet.

---

## Phase 21 — Add automatic per-block compression

### Goal

Compress only blocks where compression is worth the CPU cost.

### Work in

- `apps/web/src/transfer/`
- `apps/web/src/workers/`
- `apps/web/src/compression/`

### Files/folders to create

- `apps/web/src/compression/compressBlock.ts`
- `apps/web/src/compression/decompressBlock.ts`
- `apps/web/src/compression/shouldCompress.ts`
- `apps/web/src/compression/compressionStats.ts`

### What to do

1. Implement a compression decision step before encryption.
2. Skip compression for obviously compressed file types.
3. For uncertain files, compress a sample or first block and measure savings.
4. Only use compression if the output is meaningfully smaller.
5. Store original length and compressed length in block metadata.
6. Encrypt the compressed payload.
7. On the receiver side, decrypt first, then decompress.
8. Write the original decompressed block to the correct file offset.
9. Show compression savings in the UI.
10. Add an option to disable compression for debugging.

### Done when

- Text-like files transfer with reduced bytes.
- Already-compressed files skip compression.
- Resume still works because blocks are independently compressed.
- Decompression errors fail clearly.

---

## Phase 22 — Add connection mode detection

### Goal

Show whether the WebRTC connection is direct or relayed.

### Work in

- `apps/web/src/webrtc/`
- `apps/web/src/components/`

### Files/folders to create

- `apps/web/src/webrtc/connectionStats.ts`
- `apps/web/src/components/ConnectionModeBadge.tsx`

### What to do

1. Read WebRTC stats after connection establishment.
2. Determine whether the selected candidate pair is host, server-reflexive, peer-reflexive, or relay where available.
3. Map the result to user-friendly labels.
4. Show `Direct P2P` when the connection is direct.
5. Show `Relayed, still end-to-end encrypted` when TURN is used.
6. Avoid making privacy claims based on stats you cannot reliably determine.

### Done when

- The UI shows a connection mode badge.
- Forced relay testing displays a relayed status.
- Direct local testing displays a direct status when detectable.

---

## Phase 23 — Add TURN credential endpoint

### Goal

Allow WebRTC to use a TURN relay without exposing permanent TURN credentials.

### Work in

- `apps/signaling/src/`
- `apps/web/src/webrtc/`

### Files/folders to create

- `apps/signaling/src/turnCredentials.ts`
- `apps/signaling/src/httpApi.ts`
- `apps/web/src/webrtc/fetchIceServers.ts`

### What to do

1. Add configuration for TURN server URL, realm, and shared secret.
2. Create an endpoint that returns temporary TURN credentials.
3. Ensure credentials expire quickly.
4. Add rate limiting to the endpoint.
5. Update the frontend to request ICE server configuration before creating the peer connection.
6. Include STUN and TURN entries in the peer connection config.
7. Add a developer option to force relay mode for testing.
8. Do not place permanent TURN secrets in frontend code.

### Done when

- Clients receive temporary TURN credentials.
- WebRTC can connect using relay-only mode in development.
- The UI shows relayed connection mode when relay-only mode is forced.

---

## Phase 24 — Add transfer controls

### Goal

Let users pause, resume, cancel, and retry transfers cleanly.

### Work in

- `apps/web/src/transfer/`
- `apps/web/src/components/`
- `packages/protocol/src/messages.ts`

### Files/folders to create or update

- `apps/web/src/transfer/transferControls.ts`
- `apps/web/src/components/TransferActions.tsx`
- `apps/web/src/transfer/transferStateMachine.ts`

### What to do

1. Define transfer states clearly.
2. Add pause behavior that stops scheduling new blocks but does not destroy connection state.
3. Add resume behavior that continues scheduling blocks.
4. Add cancel behavior that stops workers, closes channels, and offers cleanup.
5. Add retry behavior for failed connection setup.
6. Ensure both peers are notified when a transfer is canceled.
7. Ensure canceled transfers do not leave confusing partial state unless the user chooses to keep it.

### Done when

- Pause and resume work during active transfer.
- Cancel stops activity on both peers.
- The UI never shows contradictory states.

---

## Phase 25 — Add robust error handling

### Goal

Make failures understandable and recoverable.

### Work in

- `apps/web/src/errors/`
- `apps/web/src/components/`
- `apps/signaling/src/`

### Files/folders to create

- `apps/web/src/errors/errorTypes.ts`
- `apps/web/src/errors/userMessages.ts`
- `apps/web/src/components/ErrorPanel.tsx`
- `apps/signaling/src/errors.ts`

### What to do

1. Define error categories: signaling, WebRTC, crypto, storage, protocol, network, user cancellation, unsupported browser.
2. Map technical errors to user-readable messages.
3. Include recovery suggestions where possible.
4. Avoid exposing secrets in error messages.
5. Add error reporting hooks for future telemetry, but do not send file names or secrets.
6. Add timeout handling for room wait, connection setup, inactive transfer, and missing frames.

### Done when

- Common failures produce clear UI messages.
- The app does not silently hang on connection failure.
- Errors do not leak secrets.

---

## Phase 26 — Add tests for shared utilities and protocol

### Goal

Test the parts of the system that are easiest to break.

### Work in

- `packages/shared/`
- `packages/protocol/`
- `apps/web/src/crypto/`
- `apps/web/src/transfer/`

### Files/folders to create

- `packages/shared/src/rangeSet.test.ts`
- `packages/protocol/src/messages.test.ts`
- `packages/protocol/src/frames.test.ts`
- `apps/web/src/crypto/aesGcm.test.ts`
- `apps/web/src/transfer/blockScheduler.test.ts`

### What to do

1. Test range merging and subtraction.
2. Test manifest validation.
3. Test frame metadata validation.
4. Test block scheduling from verified ranges.
5. Test nonce uniqueness rules.
6. Test wrong-key decryption failure.
7. Test tampered metadata decryption failure.
8. Test resume calculations.

### Done when

- Core protocol and transfer utilities have automated tests.
- Important security-sensitive behavior is covered.

---

## Phase 27 — Add browser integration tests

### Goal

Test the actual browser-to-browser behavior.

### Work in

- `apps/web/`
- `tests/`

### Files/folders to create

- `tests/e2e/`
- `tests/e2e/webrtc-hello.spec.ts`
- `tests/e2e/small-file-transfer.spec.ts`
- `tests/e2e/resume-transfer.spec.ts`

### What to do

1. Create a repeatable way to open sender and receiver pages in two browser contexts.
2. Test signaling room join.
3. Test WebRTC hello-world.
4. Test small encrypted transfer.
5. Test interrupted transfer and resume.
6. Mark unreliable network tests separately from deterministic unit tests.
7. Keep manual browser testing as part of the process because WebRTC behavior varies.

### Done when

- Basic flows can be tested automatically.
- Manual compatibility testing is still documented.

---

## Phase 28 — Add benchmarking tools

### Goal

Measure performance before adding WASM or advanced optimizations.

### Work in

- `apps/web/src/bench/`
- `apps/web/src/app/`
- `apps/web/src/components/`

### Files/folders to create

- `apps/web/src/bench/benchmarkPage.tsx`
- `apps/web/src/bench/readBenchmark.ts`
- `apps/web/src/bench/encryptionBenchmark.ts`
- `apps/web/src/bench/compressionBenchmark.ts`
- `apps/web/src/bench/storageBenchmark.ts`
- `apps/web/src/bench/dataChannelBenchmark.ts`

### What to do

1. Add a hidden development benchmark page.
2. Measure file read speed.
3. Measure AES-GCM encryption speed.
4. Measure AES-GCM decryption speed.
5. Measure OPFS write speed.
6. Measure compression speed and ratio.
7. Measure DataChannel throughput.
8. Record average speed, peak speed, CPU impact, and memory usage where possible.
9. Use results to decide whether WASM hashing or compression is justified.

### Done when

- You can identify the real bottleneck instead of guessing.
- WASM decisions are benchmark-driven.

---

## Phase 29 — Add optional WASM modules only if needed

### Goal

Use WASM only for proven hot paths.

### Work in

- `packages/`
- `apps/web/src/crypto/`
- `apps/web/src/compression/`

### Possible folders to create later

- `packages/blake3-wasm/`
- `packages/zstd-wasm/`

### What to do

1. Review benchmark results.
2. If hashing is too slow, add BLAKE3 through a maintained WASM package or custom Rust package.
3. If compression is too slow or gzip ratio is poor, add zstd through WASM.
4. Keep WASM behind capability wrappers.
5. Keep Web Crypto AES-GCM as the default unless there is a strong reason to replace it.
6. Ensure WASM modules do not block initial app load unnecessarily.

### Done when

- WASM exists only where it improves real measured performance.
- The app still works without optional WASM where possible.

---

## Phase 30 — UI polish and product flow

### Goal

Make the app understandable to normal users.

### Work in

- `apps/web/src/components/`
- `apps/web/src/app/`
- `apps/web/src/styles/`

### Files/folders to create or update

- `apps/web/src/components/Hero.tsx`
- `apps/web/src/components/TransferStatus.tsx`
- `apps/web/src/components/SecurityExplainer.tsx`
- `apps/web/src/components/ConnectionExplainer.tsx`
- `apps/web/src/components/ResumeNotice.tsx`
- `apps/web/src/components/UnsupportedBrowserNotice.tsx`

### What to do

1. Make the sender flow obvious: select file, copy link, wait for receiver, transfer.
2. Make the receiver flow obvious: open link, review file, accept, save.
3. Add badges for encryption, resume, compression, and connection mode.
4. Explain direct vs relayed transfer honestly.
5. Show speed and ETA.
6. Show clear pause/cancel controls.
7. Avoid overwhelming users with protocol jargon.
8. Add detailed diagnostics behind a collapsible developer/debug section.

### Done when

- A non-technical user can complete a transfer without reading docs.
- A technical user can inspect connection/protocol diagnostics if needed.

---

## Phase 31 — Security hardening before public alpha

### Goal

Reduce obvious security and abuse risks.

### Work in

- `apps/web/src/crypto/`
- `apps/web/src/protocol/`
- `apps/signaling/src/`
- `docs/security.md`

### What to do

1. Review all privacy claims in README and UI.
2. Ensure file keys are never sent to the server.
3. Ensure URL fragment keys are never logged.
4. Ensure signaling payloads are validated.
5. Add maximum control message sizes.
6. Add maximum room lifetime.
7. Add maximum peers per room.
8. Add rate limits for room creation and signaling messages.
9. Add rate limits for TURN credential requests.
10. Ensure nonce uniqueness is tested.
11. Ensure decryption failures stop the transfer.
12. Ensure final verification occurs before claiming success.
13. Add a warning that the project has not been independently audited unless it has.

### Done when

- The threat model is documented.
- Obvious server-abuse paths are limited.
- Obvious crypto misuse risks are tested.
- Public claims are accurate.

---

## Phase 32 — Deployment preparation

### Goal

Prepare separate deployment paths for frontend, signaling server, and TURN server.

### Work in

- Repository root.
- `apps/web/`
- `apps/signaling/`
- `docs/`
- deployment-specific folders if needed.

### Files/folders to create

- `.env.example`
- `apps/web/.env.example`
- `apps/signaling/.env.example`
- `docs/deployment.md`

### What to do

1. Document required environment variables.
2. Decide where the static frontend will be hosted.
3. Decide where the signaling server will be hosted.
4. Decide where coturn will be hosted.
5. Configure CORS/origin rules carefully.
6. Configure HTTPS/WSS.
7. Configure TURN over UDP and TCP where possible.
8. Configure monitoring for signaling server uptime.
9. Configure basic logs that do not include secrets or file names unless explicitly necessary.
10. Document how to rotate TURN shared secrets.

### Done when

- You can deploy frontend and signaling server separately.
- TURN credentials are issued correctly in production.
- The app works over HTTPS.

---

## Phase 33 — Public alpha checklist

### Goal

Make the first public version usable and honest.

### Work in

- `README.md`
- `docs/`
- `apps/web/`
- GitHub repository settings.

### What to do

1. Choose and add final license.
2. Remove placeholder docs text.
3. Add screenshots or demo video only after the app works.
4. Add browser support notes.
5. Add known limitations.
6. Add security disclaimer.
7. Add privacy explanation.
8. Add contribution guidance.
9. Enable CI on pull requests.
10. Enable branch protection.
11. Create GitHub milestones and labels.
12. Test on at least Chrome, Firefox, Edge, Android Chrome, and iOS Safari where possible.
13. Test direct and relayed modes.
14. Test wrong-key and interrupted-transfer flows.

### Done when

- The public repo accurately describes what works.
- The app has no known secret leaks.
- Users can understand limitations before trusting it with important files.

---

# Recommended build order summary

Use this as the short execution checklist:

1. Root repo setup.
2. Docs setup.
3. Web app shell.
4. Signaling server shell.
5. Room signaling.
6. WebRTC hello-world.
7. File metadata preview.
8. Raw small file transfer.
9. Backpressure.
10. Control/data channel split.
11. Shared protocol package.
12. URL fragment key sharing.
13. Key derivation.
14. Encrypted chunks.
15. Blocks and frames.
16. Workers.
17. OPFS storage.
18. IndexedDB checkpoints.
19. Resume.
20. Final verification.
21. File export.
22. Compression metadata.
23. Per-block compression.
24. Connection mode detection.
25. TURN credentials.
26. Transfer controls.
27. Error handling.
28. Unit tests.
29. Browser integration tests.
30. Benchmarks.
31. Optional WASM.
32. UI polish.
33. Security hardening.
34. Deployment.
35. Public alpha.

---

# What not to do early

Do not spend early time on:

- Multi-file queues.
- Folder transfer.
- Accounts.
- Transfer history.
- zstd WASM.
- BLAKE3 WASM.
- QR-code pairing.
- Mobile app wrappers.
- Beautiful landing page.
- Complex analytics.
- Multi-recipient transfers.

Those are valuable later, but they should not come before the core WebRTC transfer engine works.
