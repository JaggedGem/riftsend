export type PeerId = string & { readonly __brand: unique symbol };
export type SessionToken = string & { readonly __brand: unique symbol };
export type RoomId = string & { readonly __brand: unique symbol };
export type JoinCode = string & { readonly __brand: unique symbol };

export interface RoomCredentials {
  roomId: RoomId;
  joinCode: JoinCode;
}
