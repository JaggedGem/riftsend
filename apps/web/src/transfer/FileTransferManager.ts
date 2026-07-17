import type { WebRTCConnection } from "../webrtc/WebRTCConnection.js";

/**
 * Manages file transfers over a WebRTC data channel.
 *
 * Currently a minimal skeleton — reads a file as ArrayBuffer and sends it
 * over the unordered data channel. Future iterations will add chunked
 * transfer, backpressure, progress tracking, and receiver-side reconstruction.
 */
export class FileTransferManager {
  private readonly connection: WebRTCConnection;
  private readonly fileHandlers = new Set<(file: ArrayBuffer, name: string) => void>();

  constructor(connection: WebRTCConnection) {
    this.connection = connection;
  }

  /**
   * Registers a handler for received files.
   *
   * @returns A cleanup function that removes the handler when called.
   */
  onFileReceived(handler: (file: ArrayBuffer, name: string) => void): () => void {
    this.fileHandlers.add(handler);
    return () => this.fileHandlers.delete(handler);
  }

  /**
   * Reads a file via FileReader and sends its contents over the data channel.
   *
   * The file name is not currently transmitted — this is a placeholder for
   * the future manifest-based protocol.
   */
  sendFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.connection.sendData(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  }
}
