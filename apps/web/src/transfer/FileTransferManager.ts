import type { WebRTCConnection } from "../webrtc/WebRTCConnection.js";

export class FileTransferManager {
  private readonly connection: WebRTCConnection;
  private readonly fileHandlers = new Set<
    (file: ArrayBuffer, name: string) => void
  >();

  constructor(connection: WebRTCConnection) {
    this.connection = connection;
  }

  onFileReceived(
    handler: (file: ArrayBuffer, name: string) => void,
  ): () => void {
    this.fileHandlers.add(handler);
    return () => this.fileHandlers.delete(handler);
  }

  sendFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.connection.sendData(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  }
}