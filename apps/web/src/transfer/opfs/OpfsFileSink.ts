import { CHUNK_SIZE } from "@riftsend/protocol";
import type { FileSink } from "../FileSink";
import { OpfsSinkWorkerClient } from "./OpfsSinkWorkerClient";
import { OpfsSinkErrorCode, type FileId } from "@riftsend/shared";
import { OpfsSinkError } from "./OpfsSinkError";

export class OpfsFileSink implements FileSink<Blob> {
  private readonly sinkClient = new OpfsSinkWorkerClient();
  private isDisposed = false;

  public constructor(fileId: FileId, fileSize: number, isResume: boolean) {
    this.sinkClient.initialize(fileId, fileSize, isResume);
  }

  public async writeChunk(
    index: number,
    data: ArrayBuffer,
  ): Promise<{
    buffered: Promise<void>;
    flushed: Promise<void>;
  }> {
    if (this.isDisposed) {
      throw new OpfsSinkError(OpfsSinkErrorCode.SINK_DISPOSED, "OPFS sink was disposed");
    }

    return await this.sinkClient.write(index * CHUNK_SIZE, data);
  }

  public async complete(): Promise<Blob> {
    if (this.isDisposed) {
      throw new OpfsSinkError(OpfsSinkErrorCode.SINK_DISPOSED, "OPFS sink was disposed");
    }

    return new Blob([await this.sinkClient.read()], { type: "application/octet-stream" });
  }

  public async abort(): Promise<void> {
    if (this.isDisposed) {
      throw new OpfsSinkError(OpfsSinkErrorCode.SINK_DISPOSED, "OPFS sink was disposed");
    }

    await this.sinkClient.delete();

    this.sinkClient.dispose();
  }

  public dispose() {
    if (this.isDisposed) {
      return;
    }

    this.sinkClient.dispose();

    this.isDisposed = true;
  }
}
