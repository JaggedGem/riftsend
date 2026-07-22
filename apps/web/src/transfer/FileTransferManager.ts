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
import { ControlTransport } from "@/transport/ControlTransport.js";
import { FileTransferManagerError, FileTransferManagerErrorCode } from "./errors.js";
import { ControlTransportError, ControlTransportErrorCode } from "@/transport/errors.js";

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

type RetryableError = ControlTransportError & {
  code: ControlTransportErrorCode.QUEUE_LIMIT_REACHED | ControlTransportErrorCode.SEND_FAILED;
};

const isRetryable = (error: unknown): error is RetryableError => {
  return (
    error instanceof ControlTransportError &&
    (error.code === ControlTransportErrorCode.QUEUE_LIMIT_REACHED ||
      error.code === ControlTransportErrorCode.SEND_FAILED)
  );
};

type FatalError = ControlTransportError & {
  code:
    ControlTransportErrorCode.TRANSPORT_DISPOSED | ControlTransportErrorCode.MAX_RETRIES_EXCEEDED;
};

const isFatal = (error: unknown): error is FatalError => {
  return (
    error instanceof ControlTransportError &&
    (error.code === ControlTransportErrorCode.TRANSPORT_DISPOSED ||
      error.code === ControlTransportErrorCode.MAX_RETRIES_EXCEEDED)
  );
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
  private readonly config = getConfig();

  private nextTransferId: TransferId = createTransferId(0);

  private readonly batchOffersSent = new Map<BatchId, PendingBatch>();
  private readonly batchOffersReceived = new Map<BatchId, FileOffer[]>();

  private readonly sendQueue = new FileSendQueue<OutgoingFileTransfer>();
  private readonly transfers = new Map<TransferId, OutgoingFileTransfer | IncomingFileTransfer>();

  private readonly controlTransport: ControlTransport;

  constructor(connection: WebRTCConnection) {
    super();

    this.connection = connection;

    this.controlTransport = new ControlTransport(
      this.config,
      this.connection.sendControl,
      this.handleControlChannelMessage,
    );

    this.connection.on("controlChannelMessage", this.controlTransport.handleMessage);

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

  public async offerFiles(files: File[]) {
    const batchOffer = this.buildBatchOffer(files);

    this.sendBatchOffer(batchOffer);
  }

  private buildBatchOffer(files: File[]): BatchOffer {
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
      protocolVersion: this.config.protocolVersion,
      batchId: batchId,
      files: fileOffers,
    };

    return batchOffer;
  }

  private async sendBatchOffer(batchOffer: BatchOffer) {
    try {
      await this.controlTransport.send(batchOffer);
    } catch (error) {
      if (isFatal(error)) {
        throw new FileTransferManagerError(
          FileTransferManagerErrorCode.FATAL_ERROR,
          "A fatal error occurred while sending the batch offer",
          {
            cause:
              error instanceof Error
                ? error
                : new FileTransferManagerError(
                    FileTransferManagerErrorCode.UNKNOWN_ERROR,
                    "An unknown error occurred",
                  ),
          },
        );
      }

      if (!isRetryable(error)) {
        throw new FileTransferManagerError(
          FileTransferManagerErrorCode.UNKNOWN_ERROR,
          "An unexpected error occurred while sending the batch offer",
          {
            cause:
              error instanceof Error
                ? error
                : new FileTransferManagerError(
                    FileTransferManagerErrorCode.UNKNOWN_ERROR,
                    "An unknown error occurred",
                  ),
          },
        );
      }

      if (error.code === ControlTransportErrorCode.QUEUE_LIMIT_REACHED) {
        setTimeout(() => {
          void this.sendBatchOffer(batchOffer);
        }, this.config.sendRetryDelay);

        return;
      }

      const controlChannel = this.connection.getControlChannel();

      if (!controlChannel || controlChannel.readyState !== "open") {
        throw new FileTransferManagerError(
          FileTransferManagerErrorCode.FATAL_ERROR,
          "The control data channel closed unexpectedly while sending the batch offer",
          {
            cause: error,
          },
        );
      }

      if (controlChannel.bufferedAmount < controlChannel.bufferedAmountLowThreshold) {
        throw new FileTransferManagerError(
          FileTransferManagerErrorCode.FATAL_ERROR,
          "The batch offer could not be sent even though the control channel was not under backpressure",
          {
            cause: error,
          },
        );
      }

      const retry = () => {
        controlChannel.removeEventListener("bufferedamountlow", retry);

        void this.sendBatchOffer(batchOffer);
      };

      controlChannel.addEventListener("bufferedamountlow", retry, { once: true });
    }
  }

  private handleControlChannelMessage(message: ControlMessage) {
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
  private handleBatchResponseMessage(message: BatchResponse) {
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
  private sendTransferMappings(
    batchId: BatchId,
    acceptedFiles: PendingOutgoingFile[],
  ): OutgoingFileTransfer[] {
    const transfers: OutgoingFileTransfer[] = [];

    const mappings = acceptedFiles.map((pendingFile) => {
      const mapping = {
        fileId: pendingFile.offer.fileId,
        transferId: this.allocateTransferId(),
      };

      const outgoingFileTransfer = new OutgoingFileTransfer(
        this.connection,
        this.config.protocolVersion,
        new BrowserFileSource(pendingFile.file, mapping.fileId),
        mapping.transferId,
      );

      this.transfers.set(mapping.transferId, outgoingFileTransfer);

      transfers.push(outgoingFileTransfer);

      return mapping;
    });

    const transferMappingsMessage: BatchTransferMappings = {
      type: "batch-transfer-mappings",
      protocolVersion: this.config.protocolVersion,
      batchId,
      mappings,
    };

    this.controlTransport.send(transferMappingsMessage).catch((error) => {
      throw new FileTransferManagerError(
        FileTransferManagerErrorCode.MAPPINGS_SEND_FAILED,
        "Failed sending the transfer mappings. Make sure that the control channel is open",
        {
          cause:
            error instanceof Error
              ? error
              : new FileTransferManagerError(
                  FileTransferManagerErrorCode.UNKNOWN_ERROR,
                  "An unknown error occurred",
                ),
        },
      );
    });

    return transfers;
  }

  /**
   * Receiver function
   * @param message
   * @returns
   */
  private handleTransferMappingsMessage(message: BatchTransferMappings) {
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
        new IncomingFileTransfer(this.connection, this.config.protocolVersion, mapping.transferId),
      );
    });
  }

  private async processSendQueue() {
    const transfer = this.sendQueue.dequeue();

    if (!transfer) {
      console.warn("Cannot process send queue: queue is empty");
      return;
    }

    const fileStartMessage: TransferStart = {
      type: "transfer-start",
      protocolVersion: this.config.protocolVersion,
      transferId: transfer.transferId,
    };

    if (!this.controlTransport.send(fileStartMessage)) {
      console.warn("Cannot send transfer start message. Check if the control channel is open");

      this.sendQueue.enqueue(transfer);

      return;
    }

    transfer.start();
  }
}
