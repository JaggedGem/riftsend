import type { WebRTCConnection } from "@/webrtc/WebRTCConnection.js";
import {
  buildChunk,
  type BatchOffer,
  type BatchResponse,
  type ControlMessage,
  type FileOffer,
} from "@riftsend/protocol";
import { getConfig } from "@/config/config.js";
import { getBatchId, type BatchId, type FileId } from "@riftsend/shared";
import { Queue } from "@/queue/Queue.js";
import { TypedEventEmitter } from "@/events/TypedEventEmitter.js";

type FileTransferEvents = {
  batchOfferMessage: BatchOffer;
  batchResponseMessage: BatchResponse;
};

/**
 * Manages file transfers over a WebRTC data channel.
 *
 * Currently a minimal skeleton — reads a file as ArrayBuffer and sends it
 * over the unordered data channel. Future iterations will add chunked
 * transfer, backpressure, progress tracking, and receiver-side reconstruction.
 */
export class FileTransferManager extends TypedEventEmitter<FileTransferEvents> {
  private readonly connection: WebRTCConnection;
  private readonly protocolVersion = getConfig().protocolVersion;
  private readonly batchOffersSent = new Map<BatchId, Map<FileId, FileOffer>>();
  private readonly batchOffersReceived = new Map<BatchId, FileOffer[]>();
  private readonly sendQueue = new Queue<FileOffer>();

  constructor(connection: WebRTCConnection) {
    super();

    this.connection = connection;
    this.connection.on("controlChannelMessage", this.handleControlChannelMessage);
  }

  /**
   * Registers a handler for received files.
   *
   * @returns A cleanup function that removes the handler when called.
   */
  // onFileReceived(handler: (file: ArrayBuffer, name: string) => void) {}

  /**
   * Reads a file via FileReader and sends its contents over the data channel.
   *
   * The file name is not currently transmitted — this is a placeholder for
   * the future manifest-based protocol.
   */

  sendBatchOffer(files: FileOffer[]) {
    const batchOffer: BatchOffer = {
      type: "batch-offer",
      protocolVersion: this.protocolVersion,
      batchId: getBatchId(),
      files,
    };

    this.batchOffersSent.set(batchOffer.batchId, new Map(files.map((file) => [file.fileId, file])));

    this.connection.sendControl(batchOffer);
  }

  handleControlChannelMessage(message: ControlMessage) {
    switch (message.type) {
      case "batch-offer": {
        this.emit("batchOfferMessage", message);

        this.batchOffersReceived.set(message.batchId, message.files);
        break;
      }

      case "batch-response": {
        this.emit("batchResponseMessage", message);

        this.handleBatchResponseMessage(message);
        break;
      }
    }
  }

  handleBatchResponseMessage(message: BatchResponse) {
    const batchOffer = this.batchOffersSent.get(message.batchId);

    if (!batchOffer) {
      console.warn("The batch response received does not reference a sent batch offer");
      return;
    }

    const acceptedFiles = message.accepted.flatMap((fileId) => {
      const file = batchOffer.get(fileId);

      if (!file) {
        console.warn(`Peer accepted unknown file ${fileId}`);
        return [];
      }

      return [file];
    });

    this.sendQueue.enqueue(...acceptedFiles);
  }

  sendChunk(
    protocolVersion: number,
    fileId: number,
    chunkIndex: number,
    payload: ArrayBuffer,
  ): void {
    const chunk = buildChunk(protocolVersion, fileId, chunkIndex, payload);

    this.connection.sendData(chunk);
  }
}
