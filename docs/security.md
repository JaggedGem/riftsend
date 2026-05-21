# Riftsend Security Model

This document defines Riftsend's security goals, trust assumptions, threat model, encryption design, metadata exposure, abuse controls, and security checklist.

Riftsend is not just a file-transfer app. Its main value is that files are encrypted before leaving the sender browser and can be transferred without uploading plaintext file data to an application server.

---

## 1. Security goals

Riftsend aims to provide:

- End-to-end encrypted file contents.
- Server cannot decrypt transferred files.
- TURN relay cannot decrypt transferred files.
- File chunks are authenticated against tampering.
- Resume cannot silently corrupt output files.
- Wrong transfer key causes decryption failure.
- Metadata leakage is minimized where practical.
- Temporary rooms expire quickly.
- Relay abuse is limited through temporary credentials and rate limiting.

---

## 2. Non-goals and limitations

Riftsend does not initially guarantee:

- Sender identity verification beyond possession of the share link/key.
- Protection if the sender shares the link with the wrong person.
- Protection if the receiver device is compromised.
- Protection if malicious browser extensions read page data.
- Complete metadata privacy from network observers.
- Perfect anonymity.
- Secure long-term cloud storage.
- Multi-device account security.
- Cryptographic deniability.

Important limitation:

```txt
Anyone with the full share link, including the URL fragment key, can attempt to receive the file while the transfer is active.
```

---

## 3. Trust model

### Trusted

- Sender browser runtime, assuming no malicious extensions or malware.
- Receiver browser runtime, assuming no malicious extensions or malware.
- Browser cryptography APIs.
- Correct implementation of the app's cryptographic protocol.

### Untrusted or semi-trusted

- Signaling server.
- TURN relay.
- Network path.
- Wi-Fi/router/internet providers.
- Other users in the same network.
- Logs and analytics systems.

### Not trusted with file contents

- Application server.
- TURN server.
- Hosting provider.
- CDN.
- Database.
- Observability pipeline.

---

## 4. Assets to protect

Primary assets:

- File contents.
- File encryption keys.
- Master transfer secret.
- Decrypted blocks in memory.
- Partial received file in local storage.

Secondary assets:

- File names.
- File sizes.
- MIME types.
- Transfer timing.
- IP addresses.
- Room IDs.
- Connection mode.
- Transfer progress.

---

## 5. Potential attackers

### Passive network observer

Can observe network traffic but cannot modify it.

May learn:

- IP addresses.
- Timing.
- Approximate transfer size.
- Whether TURN is used.

Should not learn:

- File contents.
- File encryption key.

### Active network attacker

Can modify, drop, replay, or inject packets.

Mitigations:

- WebRTC transport security.
- App-level AES-GCM authentication.
- Manifest authentication.
- Nonce uniqueness.
- Protocol validation.

### Malicious signaling server

Can:

- Drop signaling messages.
- Delay messages.
- Try to connect wrong peers.
- Observe room IDs and signaling metadata.

Should not be able to:

- Decrypt file contents.
- Derive transfer key.

Potential risk:

- If the signaling server can perform a man-in-the-middle attack and the app does not authenticate keys/peers properly, it may interfere with peer connection setup.

Mitigations:

- Put master secret in URL fragment, not on server.
- Authenticate manifest and file blocks with keys derived from master secret.
- Future: encrypt signaling payloads using fragment key.
- Future: show short authentication string for human verification.
- Future: use PAKE for code-based pairing.

### Malicious TURN relay

Can:

- Relay encrypted traffic.
- Drop or slow traffic.
- Observe bandwidth and timing.

Should not be able to:

- Decrypt file contents.
- Modify chunks without detection.

Mitigations:

- App-level encryption.
- AES-GCM authentication.
- Final file verification.

### Attacker with full share link

Can:

- Join the room while active.
- Attempt to receive the file.
- Decrypt if they have the URL fragment key.

Mitigations:

- Make room one-sender/one-receiver.
- Expire rooms quickly.
- Sender confirmation before transfer begins.
- Optional receiver fingerprint/SAS.
- Optional transfer PIN or PAKE.

### Malicious receiver

Can:

- Receive the file if sender approves.
- Save or redistribute file.

Cannot be prevented by cryptography after transfer is intentionally completed.

---

## 6. Security guarantees

If implemented correctly, Riftsend should guarantee:

```txt
A party without the transfer secret cannot decrypt transferred file blocks.
```

```txt
A TURN relay cannot read file contents.
```

```txt
A modified encrypted block fails authentication during decryption.
```

```txt
A block cannot be silently moved to a different fileId/blockIndex if those values are included in AAD.
```

```txt
Resume cannot mark a block verified unless it was decrypted, decompressed if needed, written, and checkpointed.
```

---

## 7. Encryption design

### 7.1 Master secret

The sender generates a 256-bit random `masterSecret`.

The share URL contains:

```txt
https://riftsend.app/r/<roomId>#key=<base64url-masterSecret>
```

The fragment after `#` is intended to be read by the client app and not sent to the server as part of the HTTP request.

### 7.2 Key derivation

Derive multiple keys from the master secret:

```txt
fileKey = HKDF(masterSecret, "riftsend:file-encryption:v1")
controlKey = HKDF(masterSecret, "riftsend:control-encryption:v1")
manifestKey = HKDF(masterSecret, "riftsend:manifest-auth:v1")
resumeKey = HKDF(masterSecret, "riftsend:resume:v1")
```

Reason:

- Prevents one key being reused for unrelated purposes.
- Makes future protocol extension safer.
- Helps keep encryption/authentication domains separated.

### 7.3 File block encryption

Each block is encrypted independently.

```txt
plaintext block
  ↓ optional compression
payload
  ↓ AES-GCM(fileKey, nonce, aad)
encrypted block
```

Properties:

- Independent block encryption supports resume.
- AEAD authentication detects tampering.
- AAD binds metadata to encrypted content.

### 7.4 Nonce rules

AES-GCM nonce reuse with the same key is dangerous.

Rules:

- Never reuse the same `(key, nonce)` pair.
- Nonce must be deterministic or random in a way that avoids collisions.
- Block index should be included in nonce or AAD.
- File-specific random nonce prefix is recommended.

Recommended construction:

```txt
nonce = fileNoncePrefix[8 bytes] || blockIndex[4 bytes big-endian]
```

Limit:

- This supports up to 2^32 blocks per file for a single file nonce prefix.
- At 4 MiB per block, that is extremely large, but protocol limits should still be documented.

### 7.5 AAD contents

AAD should include:

```txt
protocolVersion
transferId
manifestHash
fileId
blockIndex
originalOffset
originalLength
compressionAlgorithm
compressedLength
```

This prevents subtle attacks like:

- Swapping blocks.
- Moving block from one file to another.
- Changing compression metadata.
- Changing expected length.

---

## 8. Manifest security

The manifest contains sensitive metadata:

- File names.
- File sizes.
- MIME types.
- Last modified timestamps.
- Block counts.
- Compression/encryption settings.

MVP may send the manifest over the WebRTC control channel after connection, but it should still be authenticated.

Recommended:

- Compute `manifestHash`.
- Authenticate manifest with `manifestKey`.
- Include `manifestHash` in every block's AAD.

Future:

- Encrypt the manifest over the control channel using `controlKey`.

---

## 9. Signaling security

Signaling server should be treated as untrusted.

The signaling server should only handle:

- Room join.
- Peer presence.
- SDP offer/answer forwarding.
- ICE candidate forwarding.

It should not receive:

- File contents.
- File keys.
- Full share URL fragments.
- Plaintext transfer control messages after WebRTC opens.

Recommended server logging policy:

```txt
Do not log full URLs.
Do not log URL fragments.
Do not log SDP contents unless debug mode is explicitly enabled.
Do not log ICE candidates in production unless necessary.
Do not log file metadata.
```

Future hardening:

- Encrypt signaling payloads using a key derived from the URL fragment secret.
- Add short authentication string display.
- Add PAKE-based code pairing.

---

## 10. TURN security

TURN relay is required for reliability on strict networks.

Risks:

- Relay bandwidth abuse.
- Metadata leakage through timing/size.
- Relay operator can drop/slow traffic.

Mitigations:

- Temporary TURN credentials.
- Short credential TTL.
- Rate limits.
- Bandwidth quotas.
- App-level encryption.
- Direct/relayed indicator in UI.

The TURN server must never have access to:

- Master secret.
- Derived file keys.
- Plaintext file data.

---

## 11. Compression security

Compression must happen before encryption if used.

```txt
plaintext → compress → encrypt → send
```

Never:

```txt
plaintext → encrypt → compress
```

Security nuance:

- Compression can leak information through compressed size in some chosen-input scenarios.
- This is most dangerous when attacker-controlled data is compressed together with secrets.

Riftsend mitigation:

- Compress file blocks only.
- Do not compress protocol secrets with file data.
- Do not mix hidden secrets into compressed user file payloads.
- Authenticate compression metadata in AAD.

---

## 12. Local storage security

Receiver partial files may be stored locally in OPFS.

Risks:

- Partial received plaintext may exist on disk in browser-managed storage after decryption.
- Another user of the same OS account could potentially access browser profile data.
- Browser storage may persist after transfer failure.

Mitigations:

- Clearly tell user resume data is stored locally.
- Delete OPFS partial data after successful export.
- Provide “delete partial transfer” option.
- Consider storing encrypted partial blocks instead of plaintext in future.

MVP likely writes plaintext verified blocks to OPFS after decryption/decompression. This is acceptable if documented, but encrypted-at-rest partial storage is a possible future improvement.

---

## 13. Metadata privacy

Riftsend should minimize metadata, but cannot eliminate all metadata.

Potentially exposed metadata:

- IP addresses to signaling server and/or TURN server.
- Timing and bandwidth patterns.
- Approximate file size through total transferred bytes.
- Connection mode.
- Room existence.

File metadata exposure depends on implementation:

- If manifest is plaintext on control channel, receiver sees it, and local WebRTC transport protects it in transit.
- If signaling server never sees manifest, server does not learn filenames.
- If control messages are app-level encrypted, metadata exposure is reduced further.

Recommended:

- Do not send file metadata through signaling.
- Send manifest only peer-to-peer after DataChannel opens.
- Encrypt/authenticate manifest in future.

---

## 14. Authentication model

MVP authentication is link possession.

The full share link contains:

```txt
roomId + masterSecret fragment
```

This means:

- The link acts like a bearer secret.
- Anyone with the link can attempt to receive.
- Sender should explicitly approve receiver before transfer starts.

Future improvements:

- Short authentication string display.
- QR code pairing.
- PAKE code pairing.
- Optional one-time PIN.
- Device fingerprint display.

---

## 15. Abuse prevention

Public deployment requires abuse controls.

Signaling server controls:

- Room creation rate limit per IP.
- WebSocket connection rate limit.
- Max active rooms per IP.
- Max room lifetime.
- Max message size.
- Max messages per second.

TURN controls:

- Temporary credentials.
- Short TTL.
- Per-IP bandwidth limits if possible.
- Monitoring for relay abuse.
- Relay-only disabled unless required by client.

Application controls:

- No public searchable rooms.
- No server-side file storage.
- No anonymous upload hosting.
- Clear cancellation and reporting path if needed.

---

## 16. Web security hardening

### 16.1 Content Security Policy

Use a strict CSP.

Example direction:

```txt
default-src 'self';
script-src 'self';
connect-src 'self' wss://signaling.riftsend.app turn: turns: stun:;
img-src 'self' data: blob:;
style-src 'self' 'unsafe-inline';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
```

Adjust for actual deployment needs.

### 16.2 XSS prevention

XSS is extremely dangerous because page JavaScript has access to transfer keys and decrypted data.

Rules:

- Avoid rendering untrusted HTML.
- Escape filenames in UI.
- Avoid dangerous React patterns like `dangerouslySetInnerHTML`.
- Use strict dependencies.
- Audit packages.
- Use CSP.

### 16.3 Dependency security

- Keep dependencies minimal.
- Avoid unnecessary crypto packages.
- Prefer Web Crypto for MVP.
- Audit any WASM crypto/compression dependency.
- Pin versions for production.

---

## 17. Error handling security

Do not leak secrets in errors.

Bad:

```txt
Failed with key abc123...
```

Good:

```txt
Could not decrypt block. The link may be invalid or data may be corrupted.
```

Do not log:

- Master secret.
- Derived keys.
- Decrypted data.
- Full share URL.
- Raw frame payloads.

---

## 18. Security checklist for MVP

### Crypto

- [ ] Master secret generated with cryptographically secure RNG.
- [ ] Key placed in URL fragment, not query string.
- [ ] HKDF used for key separation.
- [ ] AES-GCM nonce is unique per block/key.
- [ ] AAD binds block metadata.
- [ ] Decryption failure is fatal for that block.
- [ ] Manifest is hashed/authenticated.
- [ ] Final file verification exists.

### Protocol

- [ ] Version field on messages.
- [ ] Unknown versions rejected.
- [ ] Unknown message types rejected or safely ignored.
- [ ] Control message size limit.
- [ ] Frame size limit.
- [ ] Block size limit.
- [ ] Range validation.
- [ ] Duplicate/conflicting frames rejected.

### Server

- [ ] Room expiration.
- [ ] Max two peers per room.
- [ ] Rate limiting.
- [ ] No file metadata in logs.
- [ ] No URL fragments in logs.
- [ ] Temporary TURN credentials.

### Browser storage

- [ ] OPFS partials deleted after completion.
- [ ] User can delete failed partial transfers.
- [ ] Quota errors handled.
- [ ] Checkpoint consistency validated.

### UI

- [ ] Show direct vs relayed mode.
- [ ] Explain E2EE honestly.
- [ ] Warn that anyone with link can receive.
- [ ] Confirm before sending.
- [ ] Show wrong-key/decryption failure safely.

---

## 19. Pre-public security tasks

Before public alpha:

- [ ] Write full threat model.
- [ ] Add integration tests for tampered frames.
- [ ] Add tests for wrong key.
- [ ] Add tests for nonce uniqueness.
- [ ] Add tests for manifest mismatch on resume.
- [ ] Add CSP.
- [ ] Add dependency audit workflow.
- [ ] Add TURN rate limiting.
- [ ] Review logging policy.
- [ ] Perform manual XSS review.
- [ ] Get external security review if possible.

---

## 20. Future security improvements

- Encrypted control channel payloads.
- Encrypted signaling payloads.
- PAKE-based pairing.
- Short authentication string verification.
- Encrypted-at-rest partial OPFS storage.
- BLAKE3 or Merkle tree verification.
- WebAuthn/device identity for trusted devices.
- Native clients with stronger local filesystem control.
