import type { WebRTCConnection } from "@/webrtc/WebRTCConnection.js";
import {
  CHUNK_SIZE,
  type BatchOffer,
  type BatchResponse,
  type BatchTransferMappings,
  type ControlMessage,
  type FileOffer,
  type TransferStart,
} from "@riftsend/protocol";
import { getConfig } from "@/config/config.js";
import {
  getBatchId,
  getFileId,
  type BatchId,
  type FileId,
  type TransferId,
  createTransferId,
} from "@riftsend/shared";
import { FileSendQueue } from "./FileSendQueue.js";
import { TypedEventEmitter } from "@/events/TypedEventEmitter.js";
import { OutgoingFileTransfer, IncomingFileTransfer } from "./FileTransfer.js";
import { BrowserFileSource } from "./BrowserFileSource.js";

type PendingOutgoingFile = {
  offer: FileOffer;
  file: File;
};

type PendingBatch = Map<FileId, PendingOutgoingFile>;

type FileTransferManagerEvents = {
  batchOfferMessage: BatchOffer;
  batchResponseMessage: BatchResponse;
  batchTransferMappingsMessage: BatchTransferMappings;
};

/**
 * Manages file transfers over a WebRTC data channel.
 *
 * Currently a minimal skeleton — reads a file as ArrayBuffer and sends it
 * over the unordered data channel. Future iterations will add chunked
 * transfer, backpressure, progress tracking, and receiver-side reconstruction.
 */
export class FileTransferManager extends TypedEventEmitter<FileTransferManagerEvents> {
  private readonly connection: WebRTCConnection;
  private readonly protocolVersion = getConfig().protocolVersion;

  private nextTransferId: TransferId = createTransferId(0);

  private readonly batchOffersSent = new Map<BatchId, PendingBatch>();
  private readonly batchOffersReceived = new Map<BatchId, FileOffer[]>();

  private readonly sendQueue = new FileSendQueue<TransferId>();
  private readonly transfers = new Map<TransferId, OutgoingFileTransfer | IncomingFileTransfer>();

  constructor(connection: WebRTCConnection) {
    super();

    this.connection = connection;
    this.connection.on("controlChannelMessage", this.handleControlChannelMessage);

    this.sendQueue.on("available", this.processSendQueue);
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

  private allocateTransferId(): TransferId {
    const id = this.nextTransferId;

    this.nextTransferId = createTransferId(id + 1);

    return id;
  }

  offerFiles(files: File[]) {
    const batchId = getBatchId();
    const pendingBatch: PendingBatch = new Map();

    const fileOffers: FileOffer[] = files.map((file) => {
      const offer: FileOffer = {
        fileId: getFileId(),
        fileName: file.name,
        size: file.size,
        mimeType: file.type,
        chunkSize: CHUNK_SIZE,
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
      };

      pendingBatch.set(offer.fileId, { offer, file });

      return offer;
    });

    this.batchOffersSent.set(batchId, pendingBatch);

    const batchOffer: BatchOffer = {
      type: "batch-offer",
      protocolVersion: this.protocolVersion,
      batchId: batchId,
      files: fileOffers,
    };

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

      case "batch-transfer-mappings": {
        this.emit("batchTransferMappingsMessage", message);

        this.handleTransferMappingsMessage(message);
      }
    }
  }

  /**
   * Sender function
   * @param message
   * @returns
   */
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

    const transferIds = this.sendTransferMappings(message.batchId, acceptedFiles);

    transferIds.forEach((transferId) => {
      this.sendQueue.enqueue(transferId);
    });
  }

  /**
   * Sender function
   * @param batchId
   */
  sendTransferMappings(batchId: BatchId, acceptedFiles: PendingOutgoingFile[]): TransferId[] {
    const transferIds: TransferId[] = [];

    const mappings = acceptedFiles.map((pendingFile) => {
      const mapping = {
        fileId: pendingFile.offer.fileId,
        transferId: this.allocateTransferId(),
      };

      this.transfers.set(
        mapping.transferId,
        new OutgoingFileTransfer(
          this.connection,
          this.protocolVersion,
          new BrowserFileSource(pendingFile.file, mapping.fileId),
          mapping.transferId,
        ),
      );

      transferIds.push(mapping.transferId);

      return mapping;
    });

    const transferMappingsMessage: BatchTransferMappings = {
      type: "batch-transfer-mappings",
      protocolVersion: this.protocolVersion,
      batchId,
      mappings,
    };

    if (!this.connection.sendControl(transferMappingsMessage)) {
      throw new Error(
        "Failed sending the transfer mappings. Make sure that the control channel is open",
      );
    }

    return transferIds;
  }

  /**
   * Receiver function
   * @param message
   * @returns
   */
  handleTransferMappingsMessage(message: BatchTransferMappings) {
    const pendingBatch = this.batchOffersReceived.get(message.batchId);

    if (!pendingBatch) {
      console.warn("The batch reffered to in the transfer mappings was not sent");
      return;
    }

    message.mappings.forEach((mapping) => {
      const incomingFile = pendingBatch;

      if (!incomingFile) {
        console.warn("No file with the specified file id exists in the referenced batch");
        return;
      }

      this.transfers.set(
        mapping.transferId,
        new IncomingFileTransfer(this.connection, this.protocolVersion, mapping.transferId),
      );
    });
  }

  processSendQueue() {
    const transferId = this.sendQueue.dequeue();

    if (!transferId) {
      console.warn("Cannot process send queue: queue is empty");
      return;
    }

    const fileStartMessage: TransferStart = {
      type: "transfer-start",
      protocolVersion: this.protocolVersion,
      transferId: transferId,
    };

    this.connection.sendControl(fileStartMessage);
  }
}
