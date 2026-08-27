export type TxType = "INCOME" | "EXPENSE";

export type Category = {
  id: number;
  type: TxType;
  name: string;
  parentId: number | null;
  sortOrder: number;
  hidden: number; // 0 or 1
};

export type Transaction = {
  id: number;
  type: TxType;
  categoryId: number | null;
  subcategoryId: number | null;
  amount: number;
  date: string; // YYYY-MM-DD
  notes: string;
  mediaIds: number[]; // references to Media records
  createdAt: string; // ISO
};

export type Media = {
  id: number;
  blob: Blob;
  mime: string;
  filename: string;
  createdAt: string;
};

const DB_NAME = "obl";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("categories")) {
        const s = db.createObjectStore("categories", { keyPath: "id", autoIncrement: true });
        s.createIndex("type", "type", { unique: false });
      }
      if (!db.objectStoreNames.contains("transactions")) {
        const s = db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
        s.createIndex("date", "date", { unique: false });
        s.createIndex("type", "type", { unique: false });
      }
      if (!db.objectStoreNames.contains("media")) {
        db.createObjectStore("media", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const db = {
  async allCategories(): Promise<Category[]> {
    return tx("categories", "readonly", (s) => s.getAll() as IDBRequest<Category[]>);
  },

  async addCategory(cat: Omit<Category, "id">): Promise<number> {
    return tx("categories", "readwrite", (s) => s.add(cat) as IDBRequest<number>);
  },

  async updateCategory(cat: Category): Promise<IDBValidKey> {
    return tx("categories", "readwrite", (s) => s.put(cat));
  },

  async allTransactions(): Promise<Transaction[]> {
    return tx("transactions", "readonly", (s) => s.getAll() as IDBRequest<Transaction[]>);
  },

  async addTransaction(trx: Omit<Transaction, "id" | "createdAt">): Promise<number> {
    const record = { ...trx, createdAt: new Date().toISOString() };
    return tx("transactions", "readwrite", (s) => s.add(record) as IDBRequest<number>);
  },

  async updateTransaction(trx: Transaction): Promise<IDBValidKey> {
    return tx("transactions", "readwrite", (s) => s.put(trx));
  },

  async deleteTransaction(id: number): Promise<void> {
    return tx("transactions", "readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
  },

  async addMedia(record: Omit<Media, "id" | "createdAt">): Promise<number> {
    const full = { ...record, createdAt: new Date().toISOString() };
    return tx("media", "readwrite", (s) => s.add(full) as IDBRequest<number>);
  },

  async allMedia(): Promise<Media[]> {
    return tx("media", "readonly", (s) => s.getAll() as IDBRequest<Media[]>);
  },

  async getMedia(id: number): Promise<Media | undefined> {
    return tx("media", "readonly", (s) => s.get(id) as IDBRequest<Media | undefined>);
  },

  async deleteMedia(id: number): Promise<void> {
    return tx("media", "readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
  },
};

export type ExportData = {
  app: "OBL";
  version: 1;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  media: { id: number; mime: string; filename: string; data: string }[]; // base64 blobs
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportData(): Promise<ExportData> {
  const [categories, transactions, media] = await Promise.all([
    db.allCategories(),
    db.allTransactions(),
    db.allMedia(),
  ]);
  const mediaExp = await Promise.all(
    media.map(async (m) => ({
      id: m.id,
      mime: m.mime,
      filename: m.filename,
      data: await blobToBase64(m.blob),
    })),
  );
  return { app: "OBL", version: 1, exportedAt: new Date().toISOString(), categories, transactions, media: mediaExp };
}

export async function importData(data: ExportData): Promise<void> {
  if (data.app !== "OBL") throw new Error("Not an OBL backup file");
  await openDb().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const t = db.transaction(["categories", "transactions", "media"], "readwrite");
      t.objectStore("categories").clear();
      t.objectStore("transactions").clear();
      t.objectStore("media").clear();
      data.categories.forEach((c) => t.objectStore("categories").put(c));
      data.transactions.forEach((x) => t.objectStore("transactions").put(x));
      data.media.forEach((m) =>
        t.objectStore("media").put({
          id: m.id,
          blob: base64ToBlob(m.data, m.mime),
          mime: m.mime,
          filename: m.filename,
        }),
      );
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  });
}
