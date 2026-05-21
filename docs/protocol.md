# Riftsend Protocol Specification

This document defines the application protocol used by Riftsend clients for signaling, transfer negotiation, encrypted data transfer, resume, and completion.

The protocol is intentionally versioned. Early prototypes may implement only a subset of this specification.

---

## 1. Protocol layers

Riftsend has three protocol layers:

```txt
1. Signaling Protocol
   Browser ↔ Signaling Server ↔ Browser
   Used before WebRTC connection exists.

2. Control Protocol
   Sender Browser ↔ Receiver Browser
   Sent over WebRTC control RTCDataChannel.

3. Data Protocol
   Sender Browser ↔ Receiver Browser
   Sent over WebRTC data RTCDataChannel.
```

---

## 2. Transport channels

### 2.1 Signaling channel

Transport:

```txt
WebSocket
```

Purpose:

- Create/join temporary rooms.
- Forward SDP offers.
- Forward SDP answers.
- Forward ICE candidates.
- Notify peer join/leave events.

The signaling server should not process file-transfer control messages after WebRTC is established, unless future fallback modes are explicitly designed.

### 2.2 WebRTC control channel

Label:

```txt
control
```

Recommended configuration:

```ts
ordered: true;
```

Purpose:

- Protocol hello.
- Manifest exchange.
- Accept/reject.
- Resume state.
- ACKs.
- Requests.
- Pause/resume/cancel.
- Error handling.
- Completion.

Encoding:

```txt
UTF-8 JSON
```

Later versions may encrypt control messages at the application layer.

### 2.3 WebRTC data channel

Label:

```txt
data
```

Recommended configuration:

```ts
ordered: false;
```

Reliability:

```txt
Reliable delivery should be used for file transfer.
```

Purpose:

- Encrypted binary frames.

Encoding:

```txt
Binary ArrayBuffer frames
```

---

## 3. Versioning

Every control message must include either:

```json
{ "v": 1 }
```

or be wrapped by a versioned envelope:

```json
{
  "v": 1,
  "type": "hello",
  "payload": {}
}
```

Recommended MVP envelope:

```ts
export type ControlEnvelope<TPayload = unknown> = {
  v: 1;
  type: string;
  transferId?: string;
  messageId: string;
  sentAt: number;
  payload: TPayload;
};
```

Rules:

- Unknown major versions must be rejected.
- Unknown message types must produce a protocol error.
- New optional fields may be ignored by older compatible clients.
- Required field changes require a new protocol version.

---

## 4. Identifiers

### 4.1 `roomId`

Used only by signaling.

Properties:

- Short-lived.
- Random or human-friendly.
- Not a secret by itself.
- Used to rendezvous sender and receiver.

Example:

```txt
blue-river-91
```

### 4.2 `transferId`

Identifies a transfer session.

Properties:

- Random 128-bit or 256-bit identifier.
- Included in manifest and AAD.
- Used for resume checkpoint lookup.

Example:

```txt
01HR4J6G3YZQK12X4H6N6A1MBB
```

### 4.3 `fileId`

Integer identifier for a file inside a transfer.

MVP:

```txt
Only fileId 0 is required.
```

Future:

```txt
Multiple files and folders may use fileId 0..N.
```

### 4.4 `blockIndex`

Integer index of a block within a file.

```txt
blockIndex = floor(originalOffset / blockSize)
```

### 4.5 `frameIndex`

Integer index of a frame within an encrypted block.

```txt
0 <= frameIndex < frameCount
```

---

## 5. Units: files, blocks, and frames

```txt
File
  contains blocks

Block
  unit of reading, compression, encryption, verification, and resume

Frame
  unit of WebRTC DataChannel transmission
```

Recommended defaults:

```txt
blockSize = 4 MiB
frameSize = 256 KiB
```

Rationale:

- Blocks are large enough for meaningful compression.
- Blocks are bounded enough for memory safety.
- Frames are small enough for stable DataChannel transmission.
- Resume can work at block granularity.

---

## 6. Signaling protocol

### 6.1 Message envelope

```ts
export type SignalingEnvelope<TPayload = unknown> = {
  v: 1;
  type: string;
  roomId?: string;
  clientId?: string;
  messageId: string;
  sentAt: number;
  payload: TPayload;
};
```

### 6.2 `join-room`

Client → Server

```json
{
  "v": 1,
  "type": "join-room",
  "roomId": "blue-river-91",
  "messageId": "msg_001",
  "sentAt": 1770000000000,
  "payload": {
    "role": "sender"
  }
}
```

Payload:

```ts
type JoinRoomPayload = {
  role: "sender" | "receiver";
};
```

Server behavior:

- Create room if it does not exist.
- Reject if room is full.
- Reject invalid role.
- Attach client to room.
- Notify existing peer.

### 6.3 `room-joined`

Server → Client

```json
{
  "v": 1,
  "type": "room-joined",
  "roomId": "blue-river-91",
  "messageId": "msg_002",
  "sentAt": 1770000000001,
  "payload": {
    "clientId": "client_sender_1",
    "role": "sender",
    "peerPresent": false,
    "expiresAt": 1770000900000
  }
}
```

### 6.4 `peer-joined`

Server → Client

```json
{
  "v": 1,
  "type": "peer-joined",
  "roomId": "blue-river-91",
  "messageId": "msg_003",
  "sentAt": 1770000000100,
  "payload": {
    "role": "receiver"
  }
}
```

### 6.5 `signal`

Client → Server → Peer

Used to forward WebRTC payloads.

```json
{
  "v": 1,
  "type": "signal",
  "roomId": "blue-river-91",
  "messageId": "msg_004",
  "sentAt": 1770000000200,
  "payload": {
    "kind": "offer",
    "data": {
      "type": "offer",
      "sdp": "..."
    }
  }
}
```

Allowed `kind` values:

```ts
type SignalKind = "offer" | "answer" | "ice-candidate";
```

### 6.6 `peer-left`

Server → Client

```json
{
  "v": 1,
  "type": "peer-left",
  "roomId": "blue-river-91",
  "messageId": "msg_005",
  "sentAt": 1770000000300,
  "payload": {
    "reason": "disconnect"
  }
}
```

### 6.7 `signaling-error`

Server → Client

```json
{
  "v": 1,
  "type": "signaling-error",
  "messageId": "msg_006",
  "sentAt": 1770000000400,
  "payload": {
    "code": "ROOM_FULL",
    "message": "Room already has sender and receiver."
  }
}
```

---

## 7. Control protocol

### 7.1 Control message envelope

```ts
export type ControlEnvelope<TPayload = unknown> = {
  v: 1;
  type: ControlMessageType;
  transferId?: string;
  messageId: string;
  sentAt: number;
  payload: TPayload;
};
```

Message types:

```ts
type ControlMessageType =
  | "hello"
  | "manifest"
  | "accept"
  | "reject"
  | "have"
  | "request"
  | "ack"
  | "pause"
  | "resume"
  | "cancel"
  | "complete"
  | "ping"
  | "pong"
  | "stats"
  | "error";
```

---

## 8. `hello`

Exchanged after control channel opens.

```json
{
  "v": 1,
  "type": "hello",
  "messageId": "ctrl_001",
  "sentAt": 1770000001000,
  "payload": {
    "role": "sender",
    "protocolVersion": 1,
    "client": {
      "name": "riftsend-web",
      "version": "0.1.0"
    },
    "features": [
      "aes-gcm",
      "hkdf-sha-256",
      "block-frame-v1",
      "resume-v1",
      "compression-none",
      "compression-gzip"
    ],
    "limits": {
      "maxControlMessageBytes": 65536,
      "preferredBlockSize": 4194304,
      "preferredFrameSize": 262144
    }
  }
}
```

Rules:

- Both peers must exchange `hello` before manifest transfer.
- If required features do not overlap, transfer fails.
- Feature negotiation should choose the safest common set.

---

## 9. `manifest`

Sender → Receiver

```json
{
  "v": 1,
  "type": "manifest",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_002",
  "sentAt": 1770000002000,
  "payload": {
    "manifest": {
      "version": 1,
      "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
      "createdAt": 1770000000000,
      "blockSize": 4194304,
      "frameSize": 262144,
      "encryption": {
        "algorithm": "AES-GCM",
        "kdf": "HKDF-SHA-256",
        "nonceMode": "fileNonce-blockIndex"
      },
      "compression": {
        "mode": "none",
        "algorithms": ["none"]
      },
      "files": [
        {
          "fileId": 0,
          "name": "movie.mp4",
          "size": 7340032000,
          "mime": "video/mp4",
          "lastModified": 1770000000000,
          "blockCount": 1751
        }
      ]
    }
  }
}
```

Rules:

- Manifest must be authenticated.
- Manifest hash should be stored in checkpoints.
- Receiver must reject impossible values, such as negative sizes or excessive block sizes.

---

## 10. `accept`

Receiver → Sender

```json
{
  "v": 1,
  "type": "accept",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_003",
  "sentAt": 1770000003000,
  "payload": {
    "acceptedFiles": [0],
    "storage": {
      "mode": "opfs",
      "resumeSupported": true
    }
  }
}
```

---

## 11. `reject`

Receiver → Sender

```json
{
  "v": 1,
  "type": "reject",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_004",
  "sentAt": 1770000003000,
  "payload": {
    "reason": "user-rejected"
  }
}
```

---

## 12. `have`

Receiver → Sender

Used for resume.

```json
{
  "v": 1,
  "type": "have",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_005",
  "sentAt": 1770000010000,
  "payload": {
    "files": [
      {
        "fileId": 0,
        "verifiedBlocks": [
          [0, 120],
          [122, 300]
        ]
      }
    ]
  }
}
```

Range format:

```txt
[startInclusive, endInclusive]
```

Rules:

- Only verified blocks should be reported.
- Incomplete blocks should not be listed in MVP.
- Sender should treat reported ranges as hints and may re-send if unsure.

---

## 13. `request`

Receiver → Sender

Used to request missing blocks explicitly.

```json
{
  "v": 1,
  "type": "request",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_006",
  "sentAt": 1770000011000,
  "payload": {
    "files": [
      {
        "fileId": 0,
        "blocks": [[301, 400]]
      }
    ]
  }
}
```

---

## 14. `ack`

Receiver → Sender

```json
{
  "v": 1,
  "type": "ack",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_007",
  "sentAt": 1770000012000,
  "payload": {
    "files": [
      {
        "fileId": 0,
        "verifiedBlocks": [[0, 320]]
      }
    ],
    "receivedBytes": 1346371584
  }
}
```

Recommended ACK strategy:

- ACK periodically, not every frame.
- ACK verified block ranges.
- ACK after durable checkpoint write when possible.

---

## 15. `pause` and `resume`

Either peer may pause.

```json
{
  "v": 1,
  "type": "pause",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_008",
  "sentAt": 1770000013000,
  "payload": {
    "reason": "user"
  }
}
```

```json
{
  "v": 1,
  "type": "resume",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_009",
  "sentAt": 1770000014000,
  "payload": {}
}
```

Rules:

- Pause should stop scheduling new frames.
- Already buffered DataChannel frames may still arrive.
- Receiver should continue processing frames already received.

---

## 16. `cancel`

Either peer may cancel.

```json
{
  "v": 1,
  "type": "cancel",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_010",
  "sentAt": 1770000015000,
  "payload": {
    "reason": "user-cancelled"
  }
}
```

Rules:

- Sender stops reading/sending.
- Receiver may ask user whether to delete partial data.
- Local checkpoint may be removed unless user wants to keep partial transfer.

---

## 17. `complete`

Receiver → Sender

```json
{
  "v": 1,
  "type": "complete",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_011",
  "sentAt": 1770000020000,
  "payload": {
    "files": [
      {
        "fileId": 0,
        "verified": true,
        "size": 7340032000
      }
    ]
  }
}
```

---

## 18. `error`

Either peer → Other peer

```json
{
  "v": 1,
  "type": "error",
  "transferId": "01HR4J6G3YZQK12X4H6N6A1MBB",
  "messageId": "ctrl_012",
  "sentAt": 1770000021000,
  "payload": {
    "code": "DECRYPT_FAILED",
    "message": "Could not decrypt block 42.",
    "fatal": true
  }
}
```

Error codes:

```txt
UNSUPPORTED_PROTOCOL
UNSUPPORTED_FEATURES
MANIFEST_INVALID
MANIFEST_AUTH_FAILED
USER_REJECTED
STORAGE_QUOTA_EXCEEDED
OPFS_UNAVAILABLE
FILE_READ_FAILED
FRAME_INVALID
FRAME_TOO_LARGE
BLOCK_REASSEMBLY_FAILED
DECRYPT_FAILED
DECOMPRESS_FAILED
HASH_MISMATCH
CONNECTION_LOST
TRANSFER_CANCELLED
INTERNAL_ERROR
```

---

## 19. Binary data frame format

All integer fields are big-endian.

MVP frame layout:

```txt
Offset  Size    Field
0       4       Magic bytes: "RIFT"
4       1       Protocol version: 1
5       1       Frame type: 1 = DATA
6       2       Header length in bytes
8       16      Transfer ID bytes or transfer hash prefix
24      4       File ID
28      8       Block index
36      4       Frame index
40      4       Frame count
44      8       Original file offset
52      4       Original block length
56      4       Encrypted block length
60      4       Frame payload offset in encrypted block
64      4       Frame payload length
68      1       Compression algorithm: 0 none, 1 gzip
69      12      AES-GCM nonce
81      N       Frame payload bytes
```

Notes:

- `frame payload bytes` are a slice of the encrypted block.
- The AES-GCM auth tag belongs to the encrypted block output.
- The receiver must reassemble all frame payloads for a block before decrypting the block.
- Later versions may use CBOR or a compact header encoding.

---

## 20. Block encryption

### 20.1 Input

For each block:

```txt
originalBlockBytes
fileId
blockIndex
originalOffset
originalLength
compressionAlgorithm
```

### 20.2 Optional compression

```txt
if compression enabled and useful:
  payload = compress(originalBlockBytes)
else:
  payload = originalBlockBytes
```

### 20.3 Nonce

AES-GCM requires unique nonce per key.

Recommended construction:

```txt
nonce = fileNonce[0..7] || uint32_be(blockIndex)
```

Where:

- `fileNonce` is random per file or per transfer/file key.
- `blockIndex` must never repeat for the same file key.
- If more than 2^32 blocks are possible, use a wider counter or derive per-file/per-range keys.

### 20.4 AAD

Additional Authenticated Data should include:

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

AAD is not encrypted, but it is authenticated. If any AAD value changes, decryption must fail.

### 20.5 Output

```txt
encryptedBlock = AES-GCM(fileKey, nonce, payload, aad)
```

The encrypted block is then split into frames.

---

## 21. Key derivation

Input:

```txt
masterSecret = random 256-bit secret from URL fragment or PAKE result
```

Derive:

```txt
rootKey = import masterSecret
fileKey = HKDF(rootKey, "riftsend:file-encryption:v1")
controlKey = HKDF(rootKey, "riftsend:control-encryption:v1")
manifestKey = HKDF(rootKey, "riftsend:manifest-auth:v1")
resumeKey = HKDF(rootKey, "riftsend:resume:v1")
```

MVP may only use `fileKey` first, but the derivation plan should exist early.

---

## 22. Compression protocol

MVP:

```txt
compression = none
```

Future:

```txt
compression = per-block
algorithm = gzip
```

Rules:

- Compression happens before encryption.
- Compression metadata is authenticated in AAD.
- Each block is compressed independently.
- Blocks may individually choose `none` or `gzip`.
- Receiver must use the algorithm specified and authenticated for that block.

Compression decision metadata:

```json
{
  "compression": {
    "mode": "per-block",
    "algorithm": "gzip",
    "minSavingsPercent": 5,
    "blockSize": 4194304
  }
}
```

---

## 23. Resume protocol

### 23.1 Checkpoint storage

Receiver stores:

```json
{
  "transferId": "...",
  "manifestHash": "...",
  "createdAt": 1770000000000,
  "updatedAt": 1770000010000,
  "files": {
    "0": {
      "size": 7340032000,
      "blockSize": 4194304,
      "verifiedBlocks": [[0, 120]],
      "opfsPath": "transfers/<transferId>/0.part"
    }
  }
}
```

### 23.2 Resume flow

```txt
1. Peers reconnect.
2. Control channel opens.
3. Both send hello.
4. Sender sends manifest.
5. Receiver compares manifestHash with local checkpoint.
6. If compatible, receiver sends have.
7. Sender calculates missing ranges.
8. Sender sends missing blocks.
```

### 23.3 Incomplete block handling

MVP rule:

```txt
Only fully decrypted, decompressed, written, and checkpointed blocks count as verified.
Incomplete blocks are discarded on resume.
```

Future:

```txt
Persist frame-level progress for incomplete blocks.
```

---

## 24. Transfer state machines

### 24.1 Sender states

```txt
idle
file_selected
waiting_for_receiver
connecting
connected
waiting_for_accept
transferring
paused
completed
cancelled
failed
```

### 24.2 Receiver states

```txt
idle
loading_link
connecting
waiting_for_manifest
awaiting_user_accept
preparing_storage
transferring
paused
verifying
saving
completed
cancelled
failed
```

---

## 25. Example full transfer

```txt
Sender selects file.
Sender creates room and key.
Receiver opens link.
Peers exchange offer/answer/ICE via signaling.
DataChannels open.
Sender sends hello.
Receiver sends hello.
Sender sends manifest.
Receiver accepts.
Sender reads block 0.
Sender encrypts block 0.
Sender splits block 0 into frames.
Receiver receives all block 0 frames.
Receiver decrypts block 0.
Receiver writes block 0.
Receiver ACKs block 0.
Repeat for all blocks.
Receiver verifies final file.
Receiver sends complete.
Peers close.
```

---

## 26. Validation rules

Receivers must reject:

- Unknown protocol versions.
- Unsupported required features.
- Negative file sizes.
- Excessive block sizes.
- Excessive frame sizes.
- Duplicate frame indices with conflicting data.
- Frame payload larger than declared.
- Block with missing frames.
- Decryption failure.
- Decompression failure.
- Hash mismatch.

Senders must reject:

- ACKs for unknown files.
- ACKs beyond block count.
- Requests beyond block count.
- Resume attempts with mismatched transfer IDs.
- Control messages before hello/manifest sequence.

---

## 27. MVP subset

The first production-like MVP should implement:

```txt
Signaling:
  join-room
  room-joined
  peer-joined
  signal
  peer-left
  signaling-error

Control:
  hello
  manifest
  accept
  reject
  ack
  have
  request
  cancel
  complete
  error

Data:
  encrypted block frames

Encryption:
  AES-GCM per block
  HKDF-derived file key

Resume:
  block-level only

Compression:
  none
```

---

## 28. Future protocol extensions

Potential future features:

- PAKE-based short transfer codes.
- Encrypted signaling payloads.
- Multi-file and folder manifests.
- Per-block gzip compression.
- zstd compression via WASM.
- BLAKE3 file hashing via WASM.
- Frame-level resume.
- Multi-receiver transfer.
- QR-code pairing.
- Local network discovery.
- Native app peers.
