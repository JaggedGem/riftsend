import { FileDatabaseError } from "./FileDatabaseError";
import { FileDatabaseErrorCode, type FileId } from "@riftsend/shared";
import { FileMetadataSchema, type FileMetadata } from "@riftsend/protocol";

const METADATA_KEY = "metadata";

export class FileDatabase {
  private db: IDBDatabase;

  public static async create(
    fileId: FileId,
    options: { includeChunksStore: boolean },
  ): Promise<FileDatabase> {
    const dbName = `riftsend-file-${fileId}`;

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

  private constructor(
    db: IDBDatabase,
    private readonly hasChunksStore: boolean,
  ) {
    this.db = db;
  }

  public async getMetadata(): Promise<FileMetadata> {
    const transaction = this.db.transaction("meta", "readonly");
    const request = transaction.objectStore("meta").get(METADATA_KEY);

    return new Promise<FileMetadata>((resolve, reject) => {
      request.onsuccess = () => {
        if (typeof request.result === "undefined") {
          return reject(
            new FileDatabaseError(
              FileDatabaseErrorCode.FILE_METADATA_NOT_FOUND,
              "The file metadata is missing from the store",
            ),
          );
        }

        const parseResult = FileMetadataSchema.safeParse(request.result);

        if (!parseResult.success) {
          return reject(
            new FileDatabaseError(
              FileDatabaseErrorCode.INVALID_FILE_METADATA,
              "The stored file metadata does not match the expected structure",
              { cause: parseResult.error },
            ),
          );
        }

        resolve(parseResult.data);
      };

      request.onerror = (event) => {
        reject(
          new FileDatabaseError(
            FileDatabaseErrorCode.FILE_METADATA_READ_FAILED,
            "Failed to read file metadata from the store",
            { cause: event },
          ),
        );
      };
    });
  }

  public async saveMetadata(record: Partial<Omit<FileMetadata, "fileId">>): Promise<void> {
    try {
      const current = await this.getMetadata();

      const transaction = this.db.transaction("meta", "readwrite");

      return new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore("meta").put(
          {
            ...current,
            ...record,
          },
          METADATA_KEY,
        );

        request.onerror = (event) => {
          reject(
            new FileDatabaseError(
              FileDatabaseErrorCode.FILE_METADATA_WRITE_FAILED,
              "Failed to write file metadata to the store",
              { cause: event },
            ),
          );
        };

        transaction.oncomplete = () => resolve();

        transaction.onerror = (event) => {
          reject(
            new FileDatabaseError(
              FileDatabaseErrorCode.FILE_METADATA_WRITE_FAILED,
              "Failed to write file metadata to the store",
              { cause: event },
            ),
          );
        };

        transaction.onabort = (event) => {
          reject(
            new FileDatabaseError(
              FileDatabaseErrorCode.FILE_METADATA_WRITE_FAILED,
              "The metadata transaction was aborted",
              { cause: event },
            ),
          );
        };
      });
    } catch (error) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.FILE_METADATA_WRITE_FAILED,
        "Failed to update file metadata",
        { cause: error },
      );
    }
  }

  public async writeChunk(index: number, data: Blob) {
    if (!this.hasChunksStore) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.CHUNKS_STORE_NOT_AVAILABLE,
        "Cannot write a chunk because this database does not include a chunks store",
      );
    }
  }
}
