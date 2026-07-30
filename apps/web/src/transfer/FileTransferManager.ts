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
import { getProtocolConfig } from "@/config/config.js";
import {
  getBatchId,
  getFileId,
  type BatchId,
  type FileId,
  type TransferId,
  createTransferId,
} from "@riftsend/shared";
import { NotifyingQueue } from "./NotifyingQueue.js";
import { TypedEventEmitter } from "@/events/TypedEventEmitter.js";
import { OutgoingFileTransfer, IncomingFileTransfer } from "./FileTransfer.js";
import { BrowserFileSource } from "./BrowserFileSource.js";
import { ControlTransport } from "@/transport/ControlTransport.js";
import { FileTransferManagerError, FileTransferManagerErrorCode } from "./errors.js";
import { BrowserFileSink } from "./BrowserFileSink.js";

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

type FileTransfer = OutgoingFileTransfer | IncomingFileTransfer;

type TransferMapping = {
  fileId: FileId;
  transferId: TransferId;
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
  private readonly config = getProtocolConfig();

  private nextTransferId: TransferId = createTransferId(0);

  // todo: add expiration/cancellation for both maps
  private readonly pendingOutgoingBatches = new Map<BatchId, PendingBatch>();
  private readonly pendingIncomingBatches = new Map<BatchId, FileOffer[]>();

  private readonly sendQueue = new NotifyingQueue<OutgoingFileTransfer>();
  private readonly transfers = new Map<TransferId, FileTransfer>();

  private readonly controlTransport: ControlTransport;

  private readonly handleSendQueueAvailable = () => {
    this.processSendQueue().catch((error) => {
      this.emit("error", error);
    });
  };

  public constructor(connection: WebRTCConnection) {
    super();

    this.connection = connection;

    this.controlTransport = new ControlTransport(
      this.connection.sendControl,
      this.handleControlChannelMessage,
    );

    this.connection.on("controlChannelMessage", this.controlTransport.handleMessage);

    this.sendQueue.on("available", this.handleSendQueueAvailable);
  }

  /**
   * Registers a handler for received files.
   *
   * @returns A cleanup function that removes the handler when called.
   */
  // onFileReceived(handler: (file: ArrayBuffer, name: string) => void) {}

  private allocateTransferId(): TransferId {
    const id = this.nextTransferId;

    this.nextTransferId = createTransferId(id + 1);

    return id;
  }

  public async offerFiles(files: File[]) {
    const pendingBatch: PendingBatch = new Map();

    const batchOffer = this.buildBatchOffer(files, pendingBatch);

    await this.controlTransport.sendWithRetry(batchOffer, "sending the batch offer");

    this.pendingOutgoingBatches.set(batchOffer.batchId, pendingBatch);
  }

  private buildBatchOffer(files: File[], pendingBatch: PendingBatch): BatchOffer {
    const batchId = getBatchId();

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

    const batchOffer: BatchOffer = {
      type: "batch-offer",
      protocolVersion: this.config.protocolVersion,
      batchId: batchId,
      files: fileOffers,
    };

    return batchOffer;
  }

  private handleControlChannelMessage = (message: ControlMessage) => {
    switch (message.type) {
      case "batch-offer": {
        this.emit("batchOfferMessage", message);

        this.pendingIncomingBatches.set(message.batchId, message.files);
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
        break;
      }

      default: {
        this.emit(
          "error",
          new FileTransferManagerError(
            FileTransferManagerErrorCode.UNSUPPORTED_MESSAGE,
            `Received unsupported control message type: ${message.type}`,
          ),
        );

        break;
      }
    }
  };

  /**
   * Sender function
   * @param message
   * @returns
   */
  private async handleBatchResponseMessage(message: BatchResponse) {
    const batchOffer = this.pendingOutgoingBatches.get(message.batchId);

    if (!batchOffer) {
      this.emit(
        "error",
        new FileTransferManagerError(
          FileTransferManagerErrorCode.UNKNOWN_BATCH,
          "The batch response received does not reference a sent batch offer",
        ),
      );

      return;
    }

    const acceptedFiles = message.accepted.reduce<PendingOutgoingFile[]>((acc, fileId) => {
      const file = batchOffer.get(fileId);

      if (!file) {
        this.emit(
          "error",
          new FileTransferManagerError(
            FileTransferManagerErrorCode.UNKNOWN_FILE_ID,
            `Peer accepted unknown file ${fileId}`,
          ),
        );

        return acc;
      }

      acc.push(file);

      return acc;
    }, []);

    const transfers = await this.initializeTransfers(message.batchId, acceptedFiles);

    transfers.forEach((transfer) => {
      this.sendQueue.enqueue(transfer);
    });

    this.pendingOutgoingBatches.delete(message.batchId);
  }

  /**
   * Sender function
   * @param batchId
   */
  private async initializeTransfers(batchId: BatchId, acceptedFiles: PendingOutgoingFile[]) {
    const mappings = this.createMappings(
      acceptedFiles.map((pendingFile) => pendingFile.offer.fileId),
    );

    const transferMappingsMessage = this.createTransferMappingsMessage(batchId, mappings);

    await this.controlTransport.sendWithRetry(
      transferMappingsMessage,
      "sending the transfer mappings",
    );

    const transfers = this.createTransfers(acceptedFiles, mappings);

    return transfers;
  }

  private createTransferMappingsMessage(
    batchId: BatchId,
    mappings: TransferMapping[],
  ): BatchTransferMappings {
    const transferMappings: BatchTransferMappings = {
      type: "batch-transfer-mappings",
      protocolVersion: this.config.protocolVersion,
      batchId,
      mappings,
    };

    return transferMappings;
  }

  private createTransfers(
    acceptedFiles: PendingOutgoingFile[],
    mappings: TransferMapping[],
  ): OutgoingFileTransfer[] {
    const transferIds = new Map(mappings.map(({ fileId, transferId }) => [fileId, transferId]));

    return acceptedFiles.map((pendingFile) => {
      const transferId = transferIds.get(pendingFile.offer.fileId);

      if (!transferId) {
        throw new FileTransferManagerError(
          FileTransferManagerErrorCode.UNKNOWN_FILE_ID,
          `Received an accepted file "${pendingFile.offer.fileId}" without a corresponding transfer mapping. The transfer cannot be initialized.`,
        );
      }

      const transfer = new OutgoingFileTransfer(
        this.connection,
        this.config.protocolVersion,
        new BrowserFileSource(pendingFile.file, pendingFile.offer.fileId),
        transferId,
      );

      this.registerTransfer(transfer);

      return transfer;
    });
  }

  private createMappings(acceptedFileIds: FileId[]): TransferMapping[] {
    return acceptedFileIds.map((fileId) => {
      return { fileId, transferId: this.allocateTransferId() };
    });
  }

  /**
   * Receiver function
   * @param message
   * @returns
   */
  private handleTransferMappingsMessage(message: BatchTransferMappings) {
    const pendingBatch = this.pendingIncomingBatches.get(message.batchId);

    if (!pendingBatch) {
      throw new FileTransferManagerError(
        FileTransferManagerErrorCode.UNKNOWN_BATCH,
        "The batch referenced by the transfer mappings does not exist",
      );
    }

    const filesById: Map<FileId, FileOffer> = new Map(
      pendingBatch.map((file) => [file.fileId, file]),
    );

    try {
      this.validateTransferMappings(filesById, message.mappings);
    } catch (error) {
      this.emit("error", error);

      return;
    }

    message.mappings.forEach((mapping) => {
      this.registerTransfer(
        new IncomingFileTransfer(
          this.connection,
          this.config.protocolVersion,
          mapping.transferId,
          filesById.get(mapping.fileId)!, // has ! added because it is validated at runtime with validateTransferMappings
          new BrowserFileSink(),
        ),
      );
    });

    this.pendingIncomingBatches.delete(message.batchId);
  }

  private validateTransferMappings(
    pendingFiles: Map<FileId, FileOffer>,
    mappings: TransferMapping[],
  ) {
    for (const mapping of mappings) {
      if (!pendingFiles.has(mapping.fileId)) {
        throw new FileTransferManagerError(
          FileTransferManagerErrorCode.UNKNOWN_FILE_ID,
          "No file with the specified file id exists in the referenced batch",
        );
      }
    }
  }

  private processSendQueue = async () => {
    while (!this.sendQueue.isEmpty) {
      const transfer = this.sendQueue.dequeue();

      if (!transfer) {
        throw new FileTransferManagerError(
          FileTransferManagerErrorCode.EMPTY_FILE_SEND_QUEUE,
          "Cannot process send queue: queue is empty",
        );
      }

      const fileStartMessage: TransferStart = {
        type: "transfer-start",
        protocolVersion: this.config.protocolVersion,
        transferId: transfer.id,
      };

      try {
        await this.controlTransport.sendWithRetry(fileStartMessage, "sending transfer start");
      } catch (error) {
        transfer.fail(error);

        continue;
      }

      // todo: wait for transfer-started before starting the transfer
      transfer.start();
    }
  };

  public async acceptFiles(batchId: BatchId, acceptedFileIds: FileId[]) {
    const batchResponse = this.buildOfferResponse(batchId, acceptedFileIds);

    await this.controlTransport.sendWithRetry(batchResponse, "sending the batch response");
  }

  private buildOfferResponse(batchId: BatchId, acceptedFileIds: FileId[]) {
    const batchOfferResponse: BatchResponse = {
      type: "batch-response",
      protocolVersion: this.config.protocolVersion,
      batchId: batchId,
      accepted: acceptedFileIds,
    };

    return batchOfferResponse;
  }

  private registerTransfer(transfer: FileTransfer) {
    this.transfers.set(transfer.id, transfer);

    transfer.on("completed", () => {
      this.transfers.delete(transfer.id);
    });

    transfer.on("failed", () => {
      this.transfers.delete(transfer.id);
    });

    transfer.on("cancelled", () => {
      this.transfers.delete(transfer.id);
    });
  }

  public dispose() {
    this.pendingOutgoingBatches.clear();
    this.pendingIncomingBatches.clear();
    this.transfers.clear();

    this.controlTransport.dispose();

    this.connection.off("controlChannelMessage", this.controlTransport.handleMessage);

    this.sendQueue.off("available", this.handleSendQueueAvailable);

    this.clearAll();
  }

  public get pendingIncomingOffers(): ReadonlyMap<BatchId, readonly FileOffer[]> {
    return this.pendingIncomingBatches;
  }

  public get pendingIncomingFiles(): readonly FileOffer[] {
    return [...this.pendingIncomingBatches.values()].flat();
  }

  public get activeTransfers(): ReadonlyMap<TransferId, FileTransfer> {
    return this.transfers;
  }

  public get pendingOutgoingOffers(): ReadonlyMap<BatchId, readonly FileOffer[]> {
    return new Map(
      [...this.pendingOutgoingBatches.entries()].map(([batchId, files]) => [
        batchId,
        [...files.values()].map(({ offer }) => offer),
      ]),
    );
  }
}
