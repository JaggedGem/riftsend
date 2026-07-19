import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import type { WebRTCConnection } from "@/webrtc/WebRTCConnection";
import type { FileSource } from "./FileSource";
import { buildChunk } from "@riftsend/protocol";
import type { TransferId } from "@riftsend/shared";

type OutgoingFileTransferEvents = {
  started: void;
  progress: { bytesSent: number; totalBytes: number };
  completed: void;
  failed: { error: Error };
  cancelled: void;
};

type IncomingFileTransferEvents = {
  started: void;
  progress: { bytesSent: number; totalBytes: number };
  completed: void;
  failed: { error: Error };
  cancelled: void;
};

export class OutgoingFileTransfer extends TypedEventEmitter<OutgoingFileTransferEvents> {
  constructor(
    private readonly connection: WebRTCConnection,
    private readonly protocolVersion: number,
    private readonly fileSource: FileSource,
    public readonly transferId: TransferId,
  ) {
    super();
  }

  private sendChunk(chunkIndex: number, payload: ArrayBuffer): void {
    const chunk = buildChunk(this.protocolVersion, this.transferId, chunkIndex, payload);

    this.connection.sendData(chunk);
  }

  async start() {
    for await (const rawChunk of this.fileSource.readChunks()) {
      this.sendChunk(rawChunk.index, rawChunk.data);
    }
  }
}

export class IncomingFileTransfer extends TypedEventEmitter<IncomingFileTransferEvents> {
  constructor(
    private readonly connection: WebRTCConnection,
    private readonly protocolVersion: number,
    public readonly transferId: TransferId,
  ) {
    super();
  }
}
