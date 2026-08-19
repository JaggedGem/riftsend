import type { FileId } from "@riftsend/shared";
import { FileDatabaseError } from "./FileDatabaseError";
import { FileDatabaseErrorCode } from "@riftsend/shared";

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
}
