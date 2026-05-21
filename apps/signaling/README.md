# Riftsend Signaling Server

Location: `apps/signaling/`

This service will coordinate temporary rooms and forward WebRTC setup messages between sender and receiver.

It must not receive file contents or file decryption keys.

Primary planned responsibilities:

- WebSocket connections.
- Temporary rooms.
- Offer/answer forwarding.
- ICE candidate forwarding.
- Room expiration.
- Rate limiting.
- Temporary TURN credentials.
