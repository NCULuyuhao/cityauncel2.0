/**
 * CityAuncel maintainability notes
 * 檔案用途：前端離線/延遲保護佇列，把重要寫入暫存在 localStorage，API 失敗時保留後續重送機會。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { ApiRequestError, authHeaders, requestJson } from "./apiClient";

type PendingWriteMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type PendingWriteInput = {
  path: string;
  method: PendingWriteMethod;
  body?: unknown;
  dedupeKey?: string;
};

export type PendingWriteItem = PendingWriteInput & {
  id: string;
  ownerKey?: string;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  lastError?: string;
};

// pending queue 依瀏覽器保存；同一台平板切換帳號時會再用 ownerKey 避免重送到別人帳號。
const QUEUE_KEY = "cityauncel_pending_writes_v1";
let flushPromise: Promise<void> | null = null;

function readQueue(): PendingWriteItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isPendingWriteItem) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingWriteItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // If storage is full, the in-memory API call still proceeds; the caller will surface the original error.
  }
}

function currentQueueOwnerKey() {
  if (typeof window === "undefined") return "guest";

  try {
    const raw = window.localStorage.getItem("cityauncel_user");
    if (!raw) return "guest";
    const user = JSON.parse(raw) as Record<string, unknown>;
    return String(user.id ?? user.username ?? user.email ?? "guest");
  } catch {
    return "guest";
  }
}

function isPendingWriteItem(value: unknown): value is PendingWriteItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PendingWriteItem>;
  return (
    typeof item.id === "string" &&
    typeof item.path === "string" &&
    typeof item.method === "string" &&
    typeof item.createdAt === "number" &&
    typeof item.updatedAt === "number" &&
    typeof item.retryCount === "number"
  );
}

function createId() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `pending_${Date.now()}_${random}`;
}

// dedupeKey 用來合併同一筆狀態的重複寫入，例如地圖草稿連續自動保存只保留最新版。
export function enqueuePendingWrite(input: PendingWriteInput): string {
  const queue = readQueue();
  const now = Date.now();
  const ownerKey = currentQueueOwnerKey();
  const existingIndex = input.dedupeKey
    ? queue.findIndex((item) => item.dedupeKey === input.dedupeKey && (!item.ownerKey || item.ownerKey === ownerKey))
    : -1;

  if (existingIndex >= 0) {
    const existing = queue[existingIndex];
    queue[existingIndex] = {
      ...existing,
      ...input,
      updatedAt: now,
      lastError: undefined,
    };
    writeQueue(queue);
    return existing.id;
  }

  const item: PendingWriteItem = {
    ...input,
    id: createId(),
    ownerKey,
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
  };
  queue.push(item);
  writeQueue(queue);
  return item.id;
}

export function removePendingWrite(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function removePendingWritesByDedupeKey(dedupeKey: string) {
  const ownerKey = currentQueueOwnerKey();
  writeQueue(
    readQueue().filter(
      (item) => item.dedupeKey !== dedupeKey || (item.ownerKey && item.ownerKey !== ownerKey),
    ),
  );
}

function markPendingWriteFailed(id: string, error: unknown) {
  const queue = readQueue();
  const index = queue.findIndex((item) => item.id === id);
  if (index < 0) return;

  queue[index] = {
    ...queue[index],
    retryCount: queue[index].retryCount + 1,
    updatedAt: Date.now(),
    lastError: error instanceof Error ? error.message : String(error),
  };
  writeQueue(queue);
}

function isPermanentQueueError(item: PendingWriteItem, error: unknown) {
  if (!(error instanceof ApiRequestError)) return false;
  if (item.path === "/api/suspect-votes" && error.status === 409) return true;
  return error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429;
}

async function sendPendingWrite(token: string, item: PendingWriteItem) {
  await requestJson<unknown>(item.path, {
    method: item.method,
    headers: authHeaders(token),
    body: item.body === undefined ? undefined : JSON.stringify(item.body),
  });
}

// 先入佇列再送 API：即使送出中途斷線，localStorage 仍保留一筆可重試資料。
export async function requestJsonWithPending<T>(
  token: string,
  input: PendingWriteInput,
  timeoutMs?: number,
): Promise<T> {
  const pendingId = enqueuePendingWrite(input);

  try {
    const response = await requestJson<T>(
      input.path,
      {
        method: input.method,
        headers: authHeaders(token),
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
      },
      timeoutMs,
    );
    removePendingWrite(pendingId);
    return response;
  } catch (error) {
    markPendingWriteFailed(pendingId, error);
    throw error;
  }
}

// flush 只處理目前登入者的資料，避免多人共用裝置時把前一位學生的失敗請求送出。
export async function flushPendingWrites(token: string): Promise<void> {
  if (!token || flushPromise) return flushPromise ?? Promise.resolve();

  flushPromise = (async () => {
    const ownerKey = currentQueueOwnerKey();

    while (true) {
      const item = readQueue().find((candidate) => !candidate.ownerKey || candidate.ownerKey === ownerKey);
      if (!item) return;

      try {
        await sendPendingWrite(token, item);
        removePendingWrite(item.id);
      } catch (error) {
        if (isPermanentQueueError(item, error)) {
          removePendingWrite(item.id);
          continue;
        }
        markPendingWriteFailed(item.id, error);
        return;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

export function getPendingWriteCount() {
  return readQueue().length;
}
