import { FileDatabaseError } from "./FileDatabaseError";
import { FileDatabaseErrorCode, type FileId } from "@riftsend/shared";
import { FileMetadataSchema, type FileMetadata } from "@riftsend/protocol";

export class FileDatabase {
  private db: IDBDatabase;

  public static async create(
    fileId: FileId,
    options?: { includeChunksStore?: boolean },
  ): Promise<FileDatabase> {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const dbOpenRequest = indexedDB.open(`riftsend-file-${fileId}`);

        dbOpenRequest.onsuccess = () => {
          resolve(dbOpenRequest.result);
        };

        dbOpenRequest.onerror = (event) => {
          reject(event);
        };

        dbOpenRequest.onupgradeneeded = () => {
          const db = dbOpenRequest.result;

          db.createObjectStore("meta");

          if (options?.includeChunksStore) {
            db.createObjectStore("chunks", { keyPath: "index" });
          }
        };
      });

      const store = new FileDatabase(db);

      return store;
    } catch (error) {
      throw new FileDatabaseError(
        FileDatabaseErrorCode.INITIALIZATION_FAILED,
        "An error occurred while trying to create a new file database",
        { cause: error },
      );
    }
  }

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  public async getMetadata(): Promise<FileMetadata> {
    const transaction = this.db.transaction("meta");

    const request = transaction.objectStore("meta").openCursor();

    return new Promise<FileMetadata>((resolve, reject) => {
      request.onsuccess = () => {
        if (typeof request.result?.value === "undefined") {
          return reject(
            new FileDatabaseError(
              FileDatabaseErrorCode.FILE_METADATA_NOT_FOUND,
              "The file metadata is missing from the store",
            ),
          );
        }

        const parseResult = FileMetadataSchema.safeParse(request.result.value);

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
        return reject(
          new FileDatabaseError(
            FileDatabaseErrorCode.FILE_METADATA_READ_FAILED,
            "Failed to read file metadata from the store",
            { cause: event },
          ),
        );
      };
    });
  }
}
