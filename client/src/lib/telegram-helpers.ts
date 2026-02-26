import type { LocalAccount } from "@/lib/localStore";
import type { AccountStatus } from "@/lib/accountStatus";
import type { ProjectData } from "@/lib/projectStorage";

export type TelegramAccount = LocalAccount & {
  name: string;
  status: AccountStatus;
  hashtags?: string[];
  effectiveStatus?: AccountStatus;
};

export type TelegramProcess = {
  pid: number;
  name: string;
  path: string;
};

export type TelegramProjectTuple = [string, ProjectData];

export function stableAccountId(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
  }
  return Math.abs(hash) || 1;
}

export function getTelegramBatchSize(telegramThreads: string | undefined): number {
  const raw = String(telegramThreads || "1").trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function shuffleArray(values: number[]) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

export function buildProfileList(start: number, end: number, mix: boolean): number[] {
  const list: number[] = [];
  for (let i = start; i <= end; i += 1) {
    list.push(i);
  }
  if (mix) {
    shuffleArray(list);
  }
  return list;
}

export function normalizeText(value: unknown): string {
  return String(value ?? "").toLowerCase().trim();
}

function normalizePath(value: unknown): string {
  return normalizeText(value).replace(/\\/g, "/").replace(/\/+/g, "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractProfileNumberFromText(value: unknown): number | null {
  const text = normalizeText(value);
  const m = text.match(/\btg\s*(\d+)\b/i);
  if (!m) return null;
  const num = Number(m[1]);
  return Number.isFinite(num) ? num : null;
}

export function normalizeHashtag(value: string): string {
  return value.trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, "");
}

export function isSystemGeneratedNote(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return /(?:\([^)]+\)\s*-\s*(?:active|inactive|blocked))(?:\s*\([^)]+\))?$/i.test(text);
}

export function hasUserNotes(account: Partial<TelegramAccount>): boolean {
  const text = String(account?.notes ?? "").trim();
  if (!text) return false;
  return !isSystemGeneratedNote(text);
}

export function getAccountHashtags(account: Partial<TelegramAccount>): string[] {
  const raw = Array.isArray(account?.hashtags) ? account.hashtags : [];
  const normalized = raw
    .map((tag) => normalizeHashtag(String(tag ?? "")))
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(normalized));
}

export function processBelongsToAccount(
  account: Partial<TelegramAccount>,
  process: Partial<TelegramProcess>
): boolean {
  const accountName = normalizeText(account?.name);
  const accountPath = normalizePath(String(account?.notes || "").split(" (")[0]);
  const processPath = normalizePath(process?.path);
  const processName = normalizeText(process?.name);
  const accountProfile =
    extractProfileNumberFromText(accountName) ??
    extractProfileNumberFromText(accountPath);
  const processProfile =
    extractProfileNumberFromText(processPath) ??
    extractProfileNumberFromText(processName);

  if (accountProfile !== null && processProfile !== null) {
    return accountProfile === processProfile;
  }

  if (accountPath && processPath) {
    if (processPath === accountPath || processPath.startsWith(`${accountPath}/`)) {
      return true;
    }
  }

  if (!accountName) return false;
  const namePattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(accountName)}([^a-z0-9]|$)`, "i");
  return namePattern.test(processPath) || namePattern.test(processName);
}

export function findPidForAccount(
  account: Partial<TelegramAccount>,
  runningProcesses: Partial<TelegramProcess>[],
  usedPids: Set<number>
): number | null {
  for (const process of runningProcesses) {
    const pid = Number(process?.pid);
    if (!Number.isFinite(pid) || usedPids.has(pid)) continue;
    if (processBelongsToAccount(account, process)) {
      return pid;
    }
  }
  return null;
}
