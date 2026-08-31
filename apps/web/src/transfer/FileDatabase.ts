import { FileDatabaseError } from "./FileDatabaseError";
import { FileDatabaseErrorCode, type FileId } from "@riftsend/shared";
import { FileMetadataSchema, type FileMetadata } from "@riftsend/protocol";

const METADATA_KEY = "metadata";

export class FileDatabase {
  private db: IDBDatabase;
  private isDisposed = false;

  private static getDbName(fileId: FileId): string {
    return `riftsend-file-${fileId}`;
  }

  public static async create(
    fileId: FileId,
    options: { includeChunksStore: boolean },
  ): Promise<FileDatabase> {
    const dbName = this.getDbName(fileId);

    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = (version?: number) => {
          const request =
            version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);

          request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains("meta")) {
              db.createObjectStore("meta");
            }

            if (options.includeChunksStore && !db.objectStoreNames.contains("chunks")) {
              db.createObjectStore("chunks", { keyPath: "index" });
            }
          };

          request.onsuccess = () => {
            const db = request.result;

            if (options.includeChunksStore && !db.objectStoreNames.contains("chunks")) {
              const version = db.version;
              db.close();
              open(version + 1);
              return;
            }

            resolve(db);
          };

          request.onerror = () => {
            reject(request.error);
          };
        };

        open();
      });

      return new FileDatabase(db, db.objectStoreNames.contains("chunks"));
    } catch (error) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.INITIALIZATION_FAILED,
        "An error occurred while trying to create the file database",
        { cause: error },
      );
    }
  }

  public static async deleteForFile(fileId: FileId): Promise<void> {
    const dbName = this.getDbName(fileId);

    const request = indexedDB.deleteDatabase(dbName);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(
          new FileDatabaseError(
            FileDatabaseErrorCode.DELETION_FAILED,
            "An error occurred while trying to delete the file database",
            { cause: request.error },
          ),
        );
      };

      request.onblocked = () => {
        console.log(`Delete for file with id: ${fileId} was blocked by another request`);
      };
    });
  }

  private constructor(
    db: IDBDatabase,
    private readonly hasChunksStore: boolean,
  ) {
    this.db = db;
  }

  private promisifyRequest<T>(
    request: IDBRequest<T>,
    makeError: (cause: unknown) => FileDatabaseError,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(makeError(request.error));
    });
  }

  private promisifyTransaction(
    transaction: IDBTransaction,
    makeError: (cause: unknown) => FileDatabaseError,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(makeError(transaction.error));
      transaction.onabort = () => reject(makeError(transaction.error));
    });
  }

  public async getMetadata(): Promise<FileMetadata> {
    if (this.isDisposed) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.DISPOSED,
        "The database connection was already closed",
      );
    }

    const transaction = this.db.transaction("meta", "readonly");
    const request = transaction.objectStore("meta").get(METADATA_KEY);

    const result = await this.promisifyRequest(
      request,
      (cause) =>
        new FileDatabaseError(
          FileDatabaseErrorCode.FILE_METADATA_READ_FAILED,
          "Failed to read file metadata from the store",
          { cause },
        ),
    );

    if (typeof result === "undefined") {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.FILE_METADATA_NOT_FOUND,
        "The file metadata is missing from the store",
      );
    }

    const parseResult = FileMetadataSchema.safeParse(result);

    if (!parseResult.success) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.INVALID_FILE_METADATA,
        "The stored file metadata does not match the expected structure",
        { cause: parseResult.error },
      );
    }

    return parseResult.data;
  }

  public async saveMetadata(record: Partial<Omit<FileMetadata, "fileId">>): Promise<void> {
    if (this.isDisposed) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.DISPOSED,
        "The database connection was already closed",
      );
    }

    try {
      const current = await this.getMetadata();

      const transaction = this.db.transaction("meta", "readwrite");
      const done = this.promisifyTransaction(transaction, (cause) => {
        return new FileDatabaseError(
          FileDatabaseErrorCode.FILE_METADATA_WRITE_FAILED,
          "Failed to write file metadata to the store",
          { cause },
        );
      });

      transaction.objectStore("meta").put(
        {
          ...current,
          ...record,
        },
        METADATA_KEY,
      );

      return done;
    } catch (error) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.FILE_METADATA_WRITE_FAILED,
        "Failed to update file metadata",
        { cause: error },
      );
    }
  }

  public async writeChunk(index: number, data: Blob): Promise<void> {
    if (this.isDisposed) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.DISPOSED,
        "The database connection was already closed",
      );
    }

    if (!this.hasChunksStore) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.CHUNKS_STORE_NOT_AVAILABLE,
        "Cannot write a chunk because this database does not include a chunks store",
      );
    }

    if (!Number.isFinite(index) || index < 0) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.CHUNK_WRITE_FAILED,
        `Invalid chunk index: ${index}`,
      );
    }

    const transaction = this.db.transaction("chunks", "readwrite");
    const done = this.promisifyTransaction(
      transaction,
      (cause) =>
        new FileDatabaseError(
          FileDatabaseErrorCode.CHUNK_WRITE_FAILED,
          "Failed to write the chunk to the store",
          { cause },
        ),
    );

    transaction.objectStore("chunks").put(data, index);

    return done;
  }

  public async getChunk(index: number): Promise<Blob | undefined> {
    if (this.isDisposed) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.DISPOSED,
        "The database connection was already closed",
      );
    }

    if (!this.hasChunksStore) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.CHUNKS_STORE_NOT_AVAILABLE,
        "Cannot read a chunk because this database does not include a chunks store",
      );
    }

    if (!Number.isFinite(index) || index < 0) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.CHUNK_READ_FAILED,
        `Invalid chunk index: ${index}`,
      );
    }

    const transaction = this.db.transaction("chunks", "readonly");

    const request = transaction.objectStore("chunks").get(index);

    return this.promisifyRequest(
      request,
      (cause) =>
        new FileDatabaseError(
          FileDatabaseErrorCode.CHUNK_READ_FAILED,
          "Failed to read the chunk from the store",
          { cause },
        ),
    );
  }

  public async readAllChunksOrdered(): Promise<Blob> {
    if (this.isDisposed) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.DISPOSED,
        "The database connection was already closed",
      );
    }

    if (!this.hasChunksStore) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.CHUNKS_STORE_NOT_AVAILABLE,
        "Cannot read all of the chunks because this database does not include a chunks store",
      );
    }

    const blobParts: Blob[] = [];
    let expectedIndex = 0;
    let cursorError: FileDatabaseError | undefined;

    const transaction = this.db.transaction("chunks", "readonly");

    const request = transaction.objectStore("chunks").openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        return;
      }

      if (cursor.key !== expectedIndex) {
        cursorError = new FileDatabaseError(
          FileDatabaseErrorCode.MISSING_CHUNK,
          `Expected chunk ${expectedIndex}, found ${String(cursor.key)}`,
        );

        transaction.abort();

        return;
      }

      blobParts.push(cursor.value);
      expectedIndex++;

      cursor.continue();
    };

    await this.promisifyTransaction(
      transaction,
      (cause) =>
        cursorError ??
        new FileDatabaseError(FileDatabaseErrorCode.READ_FAILED, "Failed to read chunks", {
          cause,
        }),
    );

    return new Blob(blobParts);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.db.close();

    this.isDisposed = true;
  }
}
