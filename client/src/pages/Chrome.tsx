import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Copy, ExternalLink, Filter, Loader2, Plus, RefreshCw, Rocket, Search, SearchX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateLog, useLogs } from "@/hooks/use-dashboard";
import { useI18n } from "@/lib/i18n";
import { accountStatus, type AccountStatus } from "@/lib/accountStatus";
import { localStore, type LocalAccountMeta } from "@/lib/localStore";
import {
  closeChromeProfiles,
  closeSingleChromeProfile,
  getRunningChromeProfiles,
  launchSingleChromeProfile,
  readDirectory,
} from "@/lib/tauri-api";
import { format } from "date-fns";
import { AccountStatsWidget } from "@/components/AccountStatsWidget";
import { ProjectModal } from "@/components/ProjectModal";
import { CustomLinkModal } from "@/components/CustomLinkModal";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { DailyTasksPanel } from "@/components/DailyTasksPanel";
import { SegmentProgress } from "@/components/ui/segment-progress";

type DirectoryEntry = {
  name: string;
  path: string;
  is_dir: boolean;
};

type ChromeAccount = {
  id: number;
  name: string;
  path: string;
  status: AccountStatus;
  notes: string;
  displayName: string;
  hashtags: string[];
};

const chromeScopeKey = (folderPath: string) => `chrome:${folderPath || ""}`;
const OPEN_ALL_PROJECT = "__open_all__";

const parseChromeAccountId = (name: string): number => {
  const onlyDigits = String(name).match(/\d+/g)?.join("") ?? "";
  if (onlyDigits) {
    const parsed = Number(onlyDigits);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return 100000 + (hash % 900000);
};

export default function Chrome() {
  const { language } = useI18n();
  const { toast } = useToast();
  const { data: recentActions = [] } = useLogs();
  const { mutate: createLog } = useCreateLog();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all");
  const [accountSearch, setAccountSearch] = useState("");
  const [notesFilter, setNotesFilter] = useState<"all" | "with">("all");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [accounts, setAccounts] = useState<ChromeAccount[]>([]);
  const [runningProfiles, setRunningProfiles] = useState<Set<string>>(new Set());
  const [locallyOpenedProfiles, setLocallyOpenedProfiles] = useState<Set<string>>(new Set());
  const locallyOpenedAtRef = useRef<Map<string, number>>(new Map());
  const pendingKeepUntilRef = useRef<Map<string, number>>(new Map());
  const [pendingProfileStates, setPendingProfileStates] = useState<Map<string, boolean>>(new Map());
  const [chromeFolderPath, setChromeFolderPath] = useState("");
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");
  const [isHashtagModalOpen, setIsHashtagModalOpen] = useState(false);
  const [hashtagModalAccountId, setHashtagModalAccountId] = useState<number | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [availableProjects, setAvailableProjects] = useState<Array<{ name: string; ref_link: string }>>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startRange, setStartRange] = useState("");
  const [endRange, setEndRange] = useState("");
  const [isMix, setIsMix] = useState(true);
  const [customLinkUrl, setCustomLinkUrl] = useState<string | null>(null);
  const [isProjectSelectOpen, setIsProjectSelectOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCustomLinkModalOpen, setIsCustomLinkModalOpen] = useState(false);
  const [batchTargets, setBatchTargets] = useState<string[]>([]);
  const [batchCompleted, setBatchCompleted] = useState<Set<string>>(new Set());
  const [batchActive, setBatchActive] = useState<Set<string>>(new Set());
  const batchPreOpenedRef = useRef<Set<string>>(new Set());
  const [isBatchBusy, setIsBatchBusy] = useState(false);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const statsRefreshInFlightRef = useRef(false);

  const logAction = (message: string) => createLog({ message });

  const loadAccountsFromFolder = async (reason: "initial" | "refresh" = "refresh") => {
    const settings = localStore.getSettings();
    const folderPath = String(settings.chromeFolderPath ?? "").trim();
    setChromeFolderPath(folderPath);

    if (!folderPath) {
      setAccounts([]);
      setIsAccountsLoading(false);
      if (reason !== "initial") {
        toast({
          title: tr("Шлях не задано", "Path is not set", "Путь не задан"),
          description: tr(
            "Вкажіть шлях до папки Chrome у Налаштуваннях",
            "Set Chrome folder path in Settings",
            "Укажите путь к папке Chrome в Настройках"
          ),
          variant: "destructive",
        });
      }
      return;
    }

    setIsAccountsLoading(true);
    try {
      const entries = (await readDirectory(folderPath)) as DirectoryEntry[];
      const dirs = Array.isArray(entries)
        ? entries.filter(
            (entry) => Boolean(entry?.is_dir) && /^Profile\s+\d+$/i.test(String(entry?.name ?? "").trim())
          )
        : [];
      const scope = chromeScopeKey(folderPath);
      const metaById = localStore.getAccountMetaMap(scope);

      const nextAccounts: ChromeAccount[] = dirs.map((dir) => {
        const id = parseChromeAccountId(String(dir.name ?? ""));
        const meta = metaById.get(id);
        return {
          id,
          name: String(dir.name ?? `Profile ${id}`),
          path: String(dir.path ?? ""),
          status: accountStatus.inactive,
          notes: String(meta?.notes ?? ""),
          displayName: String(meta?.displayName ?? "").trim() || String(dir.name ?? `Profile ${id}`),
          hashtags: Array.isArray(meta?.hashtags)
            ? meta!.hashtags!.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean)
            : [],
        };
      });

      nextAccounts.sort((a, b) => a.id - b.id);
      setAccounts(nextAccounts);

      if (reason === "refresh") {
        toast({
          title: tr("Оновлено", "Refreshed", "Обновлено"),
          description: tr(
            `Знайдено ${nextAccounts.length} Chrome-акаунтів`,
            `Found ${nextAccounts.length} Chrome accounts`,
            `Найдено ${nextAccounts.length} Chrome-аккаунтов`
          ),
        });
      }
    } catch (error) {
      console.error("Failed to load Chrome accounts:", error);
      setAccounts([]);
      toast({
        title: tr("Помилка читання папки", "Folder read failed", "Ошибка чтения папки"),
        description: tr(
          "Не вдалося прочитати папку Chrome-акаунтів",
          "Could not read Chrome accounts folder",
          "Не удалось прочитать папку Chrome-аккаунтов"
        ),
        variant: "destructive",
      });
    } finally {
      setIsAccountsLoading(false);
    }
  };

  useEffect(() => {
    void loadAccountsFromFolder("initial");
  }, []);

  const loadChromeProjects = () => {
    const projects = localStore
      .getProjects()
      .filter((project) => project.type === "chrome")
      .map((project) => ({
        name: String(project.name ?? "").trim(),
        ref_link: String(project.refLink || project.link || "").trim(),
      }))
      .filter((project) => project.name.length > 0);
    setAvailableProjects(projects);
  };

  useEffect(() => {
    loadChromeProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject || selectedProject === "custom" || selectedProject === OPEN_ALL_PROJECT) return;
    const exists = availableProjects.some((project) => project.name === selectedProject);
    if (!exists) setSelectedProject("");
  }, [availableProjects, selectedProject]);

  const selectedTargetUrl = useMemo(() => {
    if (selectedProject === "custom") return customLinkUrl?.trim() || null;
    if (selectedProject === OPEN_ALL_PROJECT) return null;
    if (!selectedProject) return null;
    const selected = availableProjects.find((project) => project.name === selectedProject);
    return selected?.ref_link?.trim() || null;
  }, [availableProjects, selectedProject, customLinkUrl]);

  const resetMassLaunchWidget = () => {
    setBatchTargets([]);
    setBatchCompleted(new Set());
    setBatchActive(new Set());
    batchPreOpenedRef.current = new Set();
    setSelectedProject("");
    setStartRange("");
    setEndRange("");
    setCustomLinkUrl(null);
    setIsProjectSelectOpen(false);
    setIsMix(true);
  };

  const handleProjectChange = (value: string) => {
    if (value === "__none__") {
      setSelectedProject("");
      setCustomLinkUrl(null);
      return;
    }
    if (value === "custom") {
      setIsProjectSelectOpen(false);
      setIsCustomLinkModalOpen(true);
      return;
    }
    setSelectedProject(value);
  };

  const handleAddProject = () => {
    setIsProjectSelectOpen(false);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = (project: { name: string; ref_link: string }) => {
    const name = String(project.name ?? "").trim();
    const refLink = String(project.ref_link ?? "").trim();
    if (!name || !refLink) return;

    const exists = localStore
      .getProjects()
      .some((item) => item.type === "chrome" && item.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      toast({
        title: tr("Проєкт вже існує", "Project already exists", "Проект уже существует"),
        description: tr(
          `Проєкт ${name} вже є у списку`,
          `Project ${name} already exists in the list`,
          `Проект ${name} уже есть в списке`
        ),
        variant: "destructive",
      });
      return;
    }

    localStore.addProject({
      name,
      type: "chrome",
      link: refLink,
      appName: name,
      appType: "",
      refLink,
      mixed: "",
    });
    loadChromeProjects();
    setSelectedProject(name);
    setIsProjectModalOpen(false);
    logAction(tr(`Додано проєкт ${name}`, `Added project ${name}`, `Добавлен проект ${name}`));
  };

  const handleCustomLinkSubmit = (customUrl: string) => {
    const normalized = String(customUrl ?? "").trim();
    if (!normalized) return;
    setCustomLinkUrl(normalized);
    setSelectedProject("custom");
    setIsCustomLinkModalOpen(false);
    window.setTimeout(() => {
      const startInput = document.getElementById("start-range-input") as HTMLInputElement | null;
      if (!startInput) return;
      startInput.focus();
      startInput.select();
    }, 30);
    toast({
      title: tr("Своє посилання додано", "Custom link added", "Своя ссылка добавлена"),
      description: normalized,
    });
  };

  const refreshStats = async () => {
    if (statsRefreshInFlightRef.current) return;
    try {
      statsRefreshInFlightRef.current = true;
      setStatsRefreshing(true);
      await Promise.all([loadAccountsFromFolder("refresh"), syncRunningProfiles()]);
    } catch (error) {
      toast({
        title: tr("Помилка оновлення статистики", "Stats refresh error", "Ошибка обновления статистики"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      statsRefreshInFlightRef.current = false;
      setStatsRefreshing(false);
    }
  };

  const saveAccountMeta = (accountId: number, patch: Partial<LocalAccountMeta>) => {
    if (!chromeFolderPath) return;
    localStore.upsertAccountMeta(chromeScopeKey(chromeFolderPath), accountId, patch);
  };

  const updateAccountNotes = (accountId: number, notes: string) => {
    setAccounts((prev) => prev.map((account) => (account.id === accountId ? { ...account, notes } : account)));
    saveAccountMeta(accountId, { notes });
    logAction(tr(`Chrome #${accountId}: нотатку оновлено`, `Chrome #${accountId}: note updated`, `Chrome #${accountId}: заметка обновлена`));
  };

  const updateAccountDisplayName = (accountId: number, displayName: string) => {
    setAccounts((prev) => prev.map((account) => (account.id === accountId ? { ...account, displayName } : account)));
    saveAccountMeta(accountId, { displayName });
  };

  const openHashtagModal = (accountId: number) => {
    setHashtagModalAccountId(accountId);
    setHashtagInput("");
    setIsHashtagModalOpen(true);
  };

  const closeHashtagModal = () => {
    setIsHashtagModalOpen(false);
    setHashtagModalAccountId(null);
    setHashtagInput("");
  };

  const submitHashtagModal = () => {
    const accountId = hashtagModalAccountId;
    if (!accountId) return;
    const normalized = hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (!normalized) return;
    setAccounts((prev) =>
      prev.map((account) => {
        if (account.id !== accountId) return account;
        const current = Array.isArray(account.hashtags) ? account.hashtags : [];
        if (current.includes(normalized)) return account;
        const next = [...current, normalized];
        saveAccountMeta(accountId, { hashtags: next });
        return { ...account, hashtags: next };
      })
    );
    closeHashtagModal();
  };

  const handleRemoveHashtag = (accountId: number, tag: string) => {
    setAccounts((prev) =>
      prev.map((account) => {
        if (account.id !== accountId) return account;
        const next = (account.hashtags ?? []).filter((item) => item !== tag);
        saveAccountMeta(accountId, { hashtags: next });
        return { ...account, hashtags: next };
      })
    );
  };

  const updateAccountStatus = (accountId: number, status: AccountStatus) => {
    setAccounts((prev) => prev.map((account) => (account.id === accountId ? { ...account, status } : account)));
  };

  const getEffectiveStatus = (account: ChromeAccount): AccountStatus => {
    if (account.status === accountStatus.blocked) return accountStatus.blocked;
    const pending = pendingProfileStates.get(account.name);
    const isRunning =
      typeof pending === "boolean"
        ? pending
        : runningProfiles.has(account.name) || locallyOpenedProfiles.has(account.name);
    return isRunning ? accountStatus.active : accountStatus.inactive;
  };

  const syncRunningProfiles = async () => {
    try {
      const running = await getRunningChromeProfiles(chromeFolderPath);
      const next = new Set((running ?? []).map((value) => String(value).trim()).filter(Boolean));
      setRunningProfiles(next);
      setLocallyOpenedProfiles((prev) => {
        if (prev.size === 0) return next;
        const now = Date.now();
        const merged = new Set(next);

        // Keep recently requested opens for a short grace period to avoid UI flicker.
        prev.forEach((name) => {
          const openedAt = locallyOpenedAtRef.current.get(name) ?? 0;
          const ageMs = now - openedAt;
          const pendingOpen = pendingProfileStates.get(name) === true;
          if (pendingOpen || ageMs < 5000) {
            merged.add(name);
          }
        });

        // Drop stale timestamps for profiles no longer considered locally opened.
        Array.from(locallyOpenedAtRef.current.keys()).forEach((name) => {
          if (!merged.has(name)) locallyOpenedAtRef.current.delete(name);
        });

        return merged;
      });
      next.forEach((name) => {
        if (!locallyOpenedAtRef.current.has(name)) {
          locallyOpenedAtRef.current.set(name, Date.now());
        }
      });
      setPendingProfileStates((prev) => {
        if (prev.size === 0) return prev;
        const now = Date.now();
        const updated = new Map(prev);
        prev.forEach((expectedRunning, profileName) => {
          const observedRunning = next.has(profileName);
          const keepUntil = pendingKeepUntilRef.current.get(profileName) ?? 0;
          // Clear pending marker after grace window even if external/manual action changed state.
          if ((observedRunning === expectedRunning && now >= keepUntil) || now >= keepUntil + 1500) {
            updated.delete(profileName);
            pendingKeepUntilRef.current.delete(profileName);
          }
        });
        return updated;
      });
    } catch (error) {
      console.warn("Failed to sync running Chrome profiles:", error);
    }
  };

  const handleCloseAll = async () => {
    try {
      const result = await closeChromeProfiles(chromeFolderPath);
      logAction(`Chrome close: CLOSED=${result.closed}/${result.target}`);
      toast({
        title: tr("Закриття завершено", "Close completed", "Закрытие завершено"),
        description: tr(
          `Закрито ${result.closed} з ${result.target}`,
          `Closed ${result.closed} of ${result.target}`,
          `Закрыто ${result.closed} из ${result.target}`
        ),
      });
      setAccounts((prev) =>
        prev.map((account) => ({
          ...account,
          status: account.status === accountStatus.active ? accountStatus.inactive : account.status,
        }))
      );
      setLocallyOpenedProfiles(new Set());
      locallyOpenedAtRef.current = new Map();
      void syncRunningProfiles();
    } catch (error) {
      toast({
        title: tr("Помилка закриття", "Close failed", "Ошибка закрытия"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const launchBatchTargets = async (targets: string[]) => {
    if (isBatchBusy) return;
    try {
      const settings = localStore.getSettings();
      const parsedThreads = Number.parseInt(String(settings.chromeThreads ?? "").trim(), 10);
      const batchSize = Number.isFinite(parsedThreads) && parsedThreads > 0 ? parsedThreads : 1;
      if (targets.length === 0) return;

      const runningNow = new Set(await getRunningChromeProfiles(chromeFolderPath));
      const preOpened = new Set(targets.filter((name) => runningNow.has(name)));
      const completed = new Set(preOpened);
      const remaining = targets.filter((name) => !completed.has(name));
      const nextBatch = remaining.slice(0, batchSize);

      setIsBatchBusy(true);
      let opened = 0;
      const openedNames: string[] = [];
      for (const profileName of nextBatch) {
        try {
          const launched = await launchSingleChromeProfile({
            chromeFolderPath,
            profileName,
            targetUrl: selectedTargetUrl,
          });
          if (launched) {
            opened += 1;
            openedNames.push(profileName);
          }
        } catch (error) {
          console.warn(`Failed to open profile ${profileName}:`, error);
        }
      }

      batchPreOpenedRef.current = preOpened;
      setBatchTargets(targets);
      setBatchCompleted(completed);
      setBatchActive(new Set(openedNames));
      logAction(`Chrome open all: OPEN=${opened}/${nextBatch.length}`);
      toast({
        title: tr("Відкриття завершено", "Open completed", "Открытие завершено"),
        description: tr(
          `Відкрито ${opened} з ${nextBatch.length}`,
          `Opened ${opened} of ${nextBatch.length}`,
          `Открыто ${opened} из ${nextBatch.length}`
        ),
      });
      void syncRunningProfiles();
    } catch (error) {
      toast({
        title: tr("Помилка відкриття", "Open failed", "Ошибка открытия"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsBatchBusy(false);
    }
  };

  const handleOpenAll = async () => {
    const sortedAllAccounts = [...accounts].sort((a, b) => a.id - b.id);
    const eligibleAccounts = sortedAllAccounts.filter((account) => account.status !== accountStatus.blocked);
    const targets = eligibleAccounts.map((account) => account.name);

    if (eligibleAccounts.length > 0) {
      setStartRange("1");
      setEndRange(String(eligibleAccounts.length));
    }
    setSelectedProject(OPEN_ALL_PROJECT);

    await launchBatchTargets(targets);
  };

  const handleLaunch = async () => {
    if (isBatchBusy) return;
    if (!selectedProject) {
      toast({
        title: tr("Оберіть проєкт", "Select project", "Выберите проект"),
        description: tr(
          "Оберіть проєкт або своє посилання перед запуском",
          "Select a project or custom link before launch",
          "Выберите проект или свою ссылку перед запуском"
        ),
        variant: "destructive",
      });
      return;
    }

    const start = Number.parseInt(startRange, 10);
    const end = Number.parseInt(endRange, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || start > end) {
      toast({
        title: tr("Некоректний діапазон", "Invalid range", "Некорректный диапазон"),
        description: tr(
          "Перевірте значення полів Початок/Кінець",
          "Check Start/End values",
          "Проверьте значения Начало/Конец"
        ),
        variant: "destructive",
      });
      return;
    }

    const eligibleAccounts = [...accounts]
      .filter((account) => account.status !== accountStatus.blocked)
      .sort((a, b) => a.id - b.id);
    const fromIndex = Math.max(0, start - 1);
    const toIndexExclusive = Math.min(eligibleAccounts.length, end);
    const targets = eligibleAccounts
      .slice(fromIndex, toIndexExclusive)
      .map((account) => account.name);
    if (targets.length === 0) {
      toast({
        title: tr("Немає профілів", "No profiles", "Нет профилей"),
        description: tr(
          "У цьому діапазоні немає доступних Chrome профілів",
          "No available Chrome profiles in this range",
          "В этом диапазоне нет доступных Chrome профилей"
        ),
        variant: "destructive",
      });
      return;
    }

    const launchTargets = isMix ? [...targets].sort(() => Math.random() - 0.5) : targets;
    await launchBatchTargets(launchTargets);
  };

  const handleContinueBatch = async () => {
    if (isBatchBusy || batchTargets.length === 0) return;
    try {
      const settings = localStore.getSettings();
      const parsedThreads = Number.parseInt(String(settings.chromeThreads ?? "").trim(), 10);
      const batchSize = Number.isFinite(parsedThreads) && parsedThreads > 0 ? parsedThreads : 1;
      setIsBatchBusy(true);

      const activeNow = Array.from(batchActive);
      const closedNames: string[] = [];
      for (const profileName of activeNow) {
        try {
          let closed = await closeSingleChromeProfile({ chromeFolderPath, profileName });
          if (!closed) {
            await new Promise((resolve) => window.setTimeout(resolve, 250));
            closed = await closeSingleChromeProfile({ chromeFolderPath, profileName });
          }
          if (!closed) {
            await new Promise((resolve) => window.setTimeout(resolve, 350));
            closed = await closeSingleChromeProfile({ chromeFolderPath, profileName });
          }
          if (closed) closedNames.push(profileName);
        } catch (error) {
          console.warn(`Failed to close profile ${profileName}:`, error);
        }
      }

      const nextCompleted = new Set(batchCompleted);
      closedNames.forEach((name) => nextCompleted.add(name));
      setBatchCompleted(nextCompleted);

      const runningNow = new Set(await getRunningChromeProfiles(chromeFolderPath));
      const remaining = batchTargets.filter(
        (name) =>
          !nextCompleted.has(name) &&
          !batchPreOpenedRef.current.has(name) &&
          !runningNow.has(name)
      );
      const nextBatch = remaining.slice(0, batchSize);

      const nextOpened: string[] = [];
      for (const profileName of nextBatch) {
        try {
          const launched = await launchSingleChromeProfile({
            chromeFolderPath,
            profileName,
            targetUrl: selectedTargetUrl,
          });
          if (launched) nextOpened.push(profileName);
        } catch (error) {
          console.warn(`Failed to open profile ${profileName}:`, error);
        }
      }
      setBatchActive(new Set(nextOpened));
      void syncRunningProfiles();
    } catch (error) {
      toast({
        title: tr("Помилка продовження", "Continue failed", "Ошибка продолжения"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsBatchBusy(false);
    }
  };

  const handleFinishBatch = async () => {
    if (isBatchBusy || batchTargets.length === 0) return;
    try {
      setIsBatchBusy(true);
      const observedRunning = new Set(await getRunningChromeProfiles(chromeFolderPath));
      const runningNow = new Set([
        ...Array.from(observedRunning),
        ...Array.from(runningProfiles),
        ...Array.from(locallyOpenedProfiles),
        ...Array.from(batchActive),
      ]);
      const closable = batchTargets.filter(
        (name) => runningNow.has(name) && !batchPreOpenedRef.current.has(name)
      );

      let closedCount = 0;
      for (const profileName of closable) {
        try {
          let closed = await closeSingleChromeProfile({ chromeFolderPath, profileName });
          if (!closed) {
            await new Promise((resolve) => window.setTimeout(resolve, 250));
            closed = await closeSingleChromeProfile({ chromeFolderPath, profileName });
          }
          if (!closed) {
            await new Promise((resolve) => window.setTimeout(resolve, 350));
            closed = await closeSingleChromeProfile({ chromeFolderPath, profileName });
          }
          if (closed) closedCount += 1;
        } catch (error) {
          console.warn(`Failed to close profile ${profileName}:`, error);
        }
      }

      resetMassLaunchWidget();
      toast({
        title: tr("Завершено", "Finished", "Завершено"),
        description: tr(
          `Закрито ${closedCount} з ${closable.length}`,
          `Closed ${closedCount} of ${closable.length}`,
          `Закрыто ${closedCount} из ${closable.length}`
        ),
      });
      void syncRunningProfiles();
    } catch (error) {
      toast({
        title: tr("Помилка завершення", "Finish failed", "Ошибка завершения"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsBatchBusy(false);
    }
  };

  const hasProfilesToClose = useMemo(
    () =>
      accounts.some((account) => {
        const pending = pendingProfileStates.get(account.name);
        if (typeof pending === "boolean") return pending;
        return runningProfiles.has(account.name) || locallyOpenedProfiles.has(account.name);
      }),
    [accounts, pendingProfileStates, runningProfiles, locallyOpenedProfiles]
  );

  const handleToggleAccount = async (account: ChromeAccount) => {
    const isRunning = runningProfiles.has(account.name) || locallyOpenedProfiles.has(account.name);
    pendingKeepUntilRef.current.set(account.name, Date.now() + 1800);
    setPendingProfileStates((prev) => {
      const next = new Map(prev);
      next.set(account.name, !isRunning);
      return next;
    });
    try {
      if (isRunning) {
        let closed = await closeSingleChromeProfile({ chromeFolderPath, profileName: account.name });
        if (!closed) {
          await new Promise((resolve) => window.setTimeout(resolve, 250));
          closed = await closeSingleChromeProfile({ chromeFolderPath, profileName: account.name });
        }
        if (!closed) {
          await new Promise((resolve) => window.setTimeout(resolve, 350));
          closed = await closeSingleChromeProfile({ chromeFolderPath, profileName: account.name });
        }
        if (!closed) {
          pendingKeepUntilRef.current.delete(account.name);
          setPendingProfileStates((prev) => {
            const next = new Map(prev);
            next.delete(account.name);
            return next;
          });
          void syncRunningProfiles();
          return;
        }
      } else {
        await launchSingleChromeProfile({
          chromeFolderPath,
          profileName: account.name,
          targetUrl: selectedTargetUrl,
        });
      }
      setRunningProfiles((prev) => {
        const next = new Set(prev);
        if (isRunning) {
          next.delete(account.name);
        } else {
          next.add(account.name);
        }
        return next;
      });
      setLocallyOpenedProfiles((prev) => {
        const next = new Set(prev);
        if (isRunning) {
          next.delete(account.name);
        } else {
          next.add(account.name);
        }
        return next;
      });
      if (isRunning) {
        locallyOpenedAtRef.current.delete(account.name);
      } else {
        locallyOpenedAtRef.current.set(account.name, Date.now());
      }
      window.setTimeout(() => {
        void syncRunningProfiles();
      }, 250);
    } catch (error) {
      pendingKeepUntilRef.current.delete(account.name);
      setPendingProfileStates((prev) => {
        const next = new Map(prev);
        next.delete(account.name);
        return next;
      });
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const filteredRecentActions = useMemo(
    () =>
      recentActions.filter((entry) => {
        const message = String(entry?.message ?? "").trim();
        const lower = message.toLowerCase();
        if (!lower.includes("chrome")) return false;
        if (lower.startsWith("chrome launch:")) return false;
        if (lower.startsWith("chrome close:")) return false;
        return true;
      }),
    [recentActions]
  );

  const visibleAccounts = useMemo(() => {
    const search = accountSearch.trim().toLowerCase();
    return accounts.filter((account) => {
      const effectiveStatus = getEffectiveStatus(account);
      if (accountFilter !== "all" && effectiveStatus !== accountFilter) return false;
      if (notesFilter === "with" && !String(account.notes ?? "").trim()) return false;
      if (!search) return true;
      const haystack = `${account.id} ${account.name} ${account.displayName} ${account.notes}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [accounts, accountFilter, notesFilter, accountSearch, runningProfiles]);

  const canCloseAll = Boolean(chromeFolderPath) && hasProfilesToClose;
  const canOpenAll = useMemo(
    () =>
      Boolean(chromeFolderPath) &&
      accounts.some((account) => {
        const effectiveStatus = getEffectiveStatus(account);
        return effectiveStatus !== accountStatus.active && effectiveStatus !== accountStatus.blocked;
      }),
    [chromeFolderPath, accounts, pendingProfileStates, runningProfiles, locallyOpenedProfiles]
  );
  const isBatchVisible = batchTargets.length > 0;
  const batchTotal = batchTargets.length;
  const batchProgress = Math.min(batchTotal, batchCompleted.size + batchActive.size);
  const batchSegments = batchTotal > 0 ? Math.max(6, Math.min(20, batchTotal)) : 12;
  const batchPendingToLaunchCount = useMemo(
    () =>
      batchTargets.filter(
        (name) =>
          !batchPreOpenedRef.current.has(name) &&
          !batchCompleted.has(name) &&
          !batchActive.has(name)
      ).length,
    [batchTargets, batchCompleted, batchActive]
  );
  const canContinueBatch = !isBatchBusy && isBatchVisible && batchPendingToLaunchCount > 0;
  const canFinishBatch = !isBatchBusy && isBatchVisible;

  const displayStats = useMemo(() => {
    const total = accounts.length;
    const running = accounts.filter((account) => getEffectiveStatus(account) === accountStatus.active).length;
    const blocked = accounts.filter((account) => getEffectiveStatus(account) === accountStatus.blocked).length;
    return { total, running, blocked };
  }, [accounts, runningProfiles]);

  useEffect(() => {
    void syncRunningProfiles();
    const intervalId = window.setInterval(() => {
      void syncRunningProfiles();
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [chromeFolderPath]);

  return (
    <div className="h-full min-h-0 bg-transparent text-white flex flex-col overflow-hidden">
      <main className="relative z-10 w-full pl-0 pr-3 sm:pr-4 lg:pr-5 pb-6 telegram-content flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6">
          <div className="telegram-top-grid grid gap-6">
            <div className="flex flex-col gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="telegram-mass-launch-panel bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col justify-between relative group w-full min-h-[320px] sm:min-h-[360px] lg:min-h-[420px] overflow-hidden"
              >
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700 pointer-events-none" />
                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                  <Rocket className="text-primary w-6 h-6" />
                  {tr("Масовий запуск", "Mass launch", "Массовый запуск")}
                </h2>
                <div className="space-y-4 w-full">
                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-muted-foreground">{tr("Проєкт", "Project", "Проект")}</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={selectedProject}
                        onValueChange={handleProjectChange}
                        open={isProjectSelectOpen}
                        onOpenChange={setIsProjectSelectOpen}
                      >
                        <SelectTrigger className="bg-white/[0.006] border-white/[0.025] h-10 rounded-xl focus:ring-0 focus:ring-offset-0 focus:border-white/[0.025] data-[state=open]:border-white/[0.025] text-white flex-1">
                          <SelectValue placeholder={tr("Виберіть проєкт", "Select project", "Выберите проект")} />
                        </SelectTrigger>
                        <SelectContent
                          align="start"
                          className="bg-black border-white/10 text-white w-[min(90vw,var(--radix-select-trigger-width))] max-w-[90vw]"
                          onPointerLeave={() => setIsProjectSelectOpen(false)}
                        >
                          {selectedProject === OPEN_ALL_PROJECT ? (
                            <SelectItem
                              key="__open_all__"
                              value={OPEN_ALL_PROJECT}
                              className="pl-2 [&>span.absolute]:hidden focus:bg-white/10 focus:text-white"
                            >
                              {tr("Відкриваємо всі", "Opening all", "Открываем все")}
                            </SelectItem>
                          ) : null}
                          {selectedProject ? (
                            <SelectItem
                              key="__none__"
                              value="__none__"
                              className="pl-2 [&>span.absolute]:hidden focus:bg-white/10 focus:text-white text-muted-foreground"
                            >
                              {tr("Очистити вибір", "Clear selection", "Очистить выбор")}
                            </SelectItem>
                          ) : null}
                          <SelectItem
                            key="custom"
                            value="custom"
                            className="pl-2 pr-20 [&>span.absolute]:hidden focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                          >
                            <div className="flex items-center w-full">
                              <span className="flex-1">{tr("Своє посилання", "Custom link", "Своя ссылка")}</span>
                            </div>
                          </SelectItem>
                          {availableProjects.map((project) => (
                            <SelectItem
                              key={project.name}
                              value={project.name}
                              className="pl-2 pr-20 [&>span.absolute]:hidden focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                            >
                              <div className="flex items-center w-full min-w-0 gap-2">
                                <span className="block max-w-[55%] truncate">{project.name}</span>
                                <span className="block max-w-[40%] truncate text-xs text-muted-foreground">
                                  {project.ref_link || ""}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleOpenAll()}
                        disabled={!canOpenAll}
                        className="h-10 px-3 border border-white/[0.025] bg-white/[0.006] text-white/80 hover:text-white hover:bg-white/10 hover:border-white/[0.04] transition-all duration-200 flex-shrink-0 disabled:opacity-40 disabled:cursor-default"
                        title={tr(
                          "Відкрити всі акаунти (за значенням «Одночасно відкритих»)",
                          "Open all accounts (based on the \"Opened simultaneously\" value)",
                          "Открыть все аккаунты (по значению «Открыто одновременно»)"
                        )}
                      >
                        {tr("Відкрити всі", "Open all", "Открыть все")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 border border-white/[0.025] bg-white/[0.006] hover:bg-white/10 hover:border-white/[0.04] hover:text-white transition-all duration-200 flex-shrink-0"
                        onClick={handleAddProject}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-none sm:max-w-[18rem]">
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-muted-foreground">{tr("Початок", "Start", "Начало")}</Label>
                      <Input
                        id="start-range-input"
                        type="number"
                        placeholder="1"
                        value={startRange}
                        onChange={(e) => setStartRange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const endInput = document.getElementById("end-range-input") as HTMLInputElement | null;
                            endInput?.focus();
                          }
                        }}
                        className="bg-white/[0.006] border-white/[0.025] h-10 rounded-xl text-white font-mono transition-none focus:border-white/[0.025] focus:ring-0 focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-muted-foreground">{tr("Кінець", "End", "Конец")}</Label>
                      <Input
                        id="end-range-input"
                        type="number"
                        placeholder="100"
                        value={endRange}
                        onChange={(e) => setEndRange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (selectedProject && startRange && endRange && !isBatchBusy) {
                              void handleLaunch();
                            }
                          }
                        }}
                        className="bg-white/[0.006] border-white/[0.025] h-10 rounded-xl text-white font-mono transition-none focus:border-white/[0.025] focus:ring-0 focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-3 pt-1">
                    <Checkbox
                      id="mix"
                      checked={isMix}
                      onCheckedChange={(checked) => setIsMix(Boolean(checked))}
                      className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-white w-5 h-5 rounded-md"
                    />
                    <Label htmlFor="mix" className="text-sm font-medium leading-none cursor-pointer text-muted-foreground">
                      {tr('Увімкнути режим "Мікс"', 'Enable "Mix" mode', 'Включить режим "Микс"')}
                    </Label>
                  </div>
                </div>
                <div className="mt-4 lg:mt-6 space-y-3">
                {isBatchVisible ? (
                  <div className="w-full space-y-1">
                    <div className="min-h-[3rem] flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="text-[11px] tracking-[0.2em] text-muted-foreground/80 shrink-0">
                          {tr("Прогрес", "Progress", "Прогресс")}
                        </span>
                        <SegmentProgress
                          total={batchTotal || batchSegments}
                          value={batchProgress}
                          segments={batchSegments}
                          className="py-1 flex-1"
                        />
                        <span className="text-xs text-primary/80 shrink-0">
                          {batchProgress}/{batchTotal}
                        </span>
                      </div>
                      {canContinueBatch ? (
                        <Button
                          onClick={() => void handleContinueBatch()}
                          className="h-10 min-w-[100px] sm:min-w-[120px] rounded-xl border-0 text-white font-semibold focus-visible:ring-0 bg-primary hover:bg-primary/90"
                        >
                          {tr("Продовжити", "Continue", "Продолжить")}
                        </Button>
                      ) : null}
                      <Button
                        onClick={() => void handleFinishBatch()}
                        disabled={!canFinishBatch}
                        className="h-10 min-w-[100px] sm:min-w-[120px] rounded-xl border border-white/10 text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-0 disabled:opacity-50"
                      >
                        {tr("Завершити", "Finish", "Завершить")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => void handleLaunch()}
                    disabled={isBatchBusy || (!selectedProject || !startRange || !endRange)}
                    className="h-12 w-full sm:w-auto sm:min-w-[200px] text-base font-bold bg-primary hover:bg-primary/90 text-white border-0 shadow-none hover:shadow-none hover:-translate-y-0.5 transition-all duration-300 rounded-xl uppercase tracking-widest focus-visible:ring-0 focus-visible:outline-none"
                  >
                    {tr("ЗАПУСТИТИ", "LAUNCH", "ЗАПУСТИТЬ")}
                  </Button>
                )}
                </div>
              </motion.div>

              <div className="telegram-secondary-widgets grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.6 }} className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 h-56 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="text-primary w-5 h-5 shrink-0" />
                    <h3 className="text-xl font-display font-bold text-white">{tr("Останні дії", "Recent actions", "Последние действия")}</h3>
                  </div>
                  {filteredRecentActions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground/70">{tr("Немає дій", "No actions", "Нет действий")}</div>
                  ) : (
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="space-y-2">
                        {filteredRecentActions.slice(0, 24).map((entry: { id: number; message: string; timestamp: number }) => (
                          <div key={entry.id} className="flex gap-3 text-sm font-mono group hover:bg-white/5 p-2 rounded-lg transition-colors">
                            <span className="text-primary/70 shrink-0">[{format(new Date(entry.timestamp), "HH:mm:ss")}]</span>
                            <span className="text-muted-foreground group-hover:text-white transition-colors break-all">{String(entry.message ?? "").trim()}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </motion.div>

                <div className="relative">
                  <AccountStatsWidget stats={displayStats} activeFilter={accountFilter} onFilterChange={setAccountFilter} />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="absolute top-2 right-2 flex gap-1"
                  >
                    <Button
                      onClick={() => void refreshStats()}
                      disabled={statsRefreshing}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-white/10 text-white/70 hover:text-white"
                      title={tr("Оновити статистику", "Refresh stats", "Обновить статистику")}
                    >
                      <RefreshCw className={`w-3 h-3 ${statsRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>

            <div className="telegram-right-column flex flex-col gap-6 min-h-0 min-w-0 overflow-hidden">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }} className="h-48 shrink-0 flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center">
                  <GlassCalendar selectedDate={selectedDate} className="w-full h-full" />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }} className="flex flex-col h-[28.25rem] shrink-0 min-h-0 overflow-hidden">
                <DailyTasksPanel scope="chrome" />
              </motion.div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }}>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h3 className="text-2xl font-display font-bold text-white">{tr("Список акаунтів", "Accounts list", "Список аккаунтов")}</h3>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                  <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-opacity ${isSearchFocused ? "opacity-0" : "opacity-100"}`} />
                  <Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} onFocus={() => setIsSearchFocused(true)} onBlur={() => setIsSearchFocused(false)} placeholder={tr("Пошук", "Search", "Поиск")} className={`h-9 w-full sm:w-60 bg-white/[0.006] border-white/[0.025] pr-9 text-white/90 placeholder:text-white/30 focus:border-white/[0.025] ${isSearchFocused ? "pl-3" : "pl-9"}`} />
                  <Select value={notesFilter} onValueChange={(value) => setNotesFilter(value as "all" | "with")}>
                    <SelectTrigger hideIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-md bg-transparent border-0 p-0 text-white/60 hover:text-white hover:bg-white/10 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none">
                      <Filter className="h-4 w-4" strokeWidth={2.2} />
                      {notesFilter !== "all" ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(157,0,255,0.6)]" /> : null}
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-white/10 text-white">
                      <SelectItem
                        value="all"
                        className="text-xs focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      >
                        {tr("Усі", "All", "Все")}
                      </SelectItem>
                      <SelectItem
                        value="with"
                        className="text-xs focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      >
                        {tr("З нотатками", "With notes", "С заметками")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCloseAll()}
                  disabled={!canCloseAll}
                  className={`group h-9 px-3 border transition-all duration-200 ${
                    canCloseAll
                      ? "border-white/10 bg-white/[0.02] text-white/85 hover:text-white hover:bg-white/10 hover:border-white/25"
                      : "border-white/5 bg-white/[0.01] text-white/35 cursor-default"
                  }`}
                >
                  <X className={`w-4 h-4 mr-2 transition-colors ${canCloseAll ? "text-white/70 group-hover:text-red-500" : "text-white/35"}`} />
                  {tr("Закрити всі", "Close all", "Закрыть все")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {isAccountsLoading ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-slate-500">{tr("Завантаження акаунтів...", "Loading accounts...", "Загрузка аккаунтов...")}</p>
                </motion.div>
              ) : visibleAccounts.length > 0 ? (
                visibleAccounts.map((account, index) => {
                  const displayNumber = index + 1;
                  const displayName = String(account.displayName ?? "").trim();
                  const hasDisplayName = displayName.length > 0;
                  const isEditing = editingAccountId === account.id;
                  const effectiveStatus = getEffectiveStatus(account);
                  const isRunningEffective = effectiveStatus === accountStatus.active;
                  const statusLabel =
                    effectiveStatus === accountStatus.active
                      ? tr("активні", "active", "активные")
                      : effectiveStatus === accountStatus.blocked
                        ? tr("заблоковані", "blocked", "заблокированные")
                        : tr("неактивні", "inactive", "неактивные");

                  return (
                    <motion.div
                      key={account.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="group relative bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openHashtagModal(account.id);
                        }}
                        className={`absolute ${hasDisplayName ? "right-9" : "right-3"} top-2.5 h-5 w-5 rounded-md flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity`}
                        title={tr("Додати хештег", "Add hashtag", "Добавить хештег")}
                      >
                        #
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!hasDisplayName || !navigator.clipboard?.writeText) return;
                          navigator.clipboard.writeText(displayName).catch(() => undefined);
                        }}
                        className={`absolute right-3 top-2.5 h-5 w-5 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 opacity-0 pointer-events-none transition-opacity ${
                          hasDisplayName ? "group-hover:opacity-100 group-hover:pointer-events-auto" : ""
                        }`}
                        title={hasDisplayName ? tr("Копіювати назву", "Copy name", "Копировать имя") : ""}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative min-w-0">
                                {isEditing ? (
                                  <Input
                                    autoFocus
                                    value={editingDisplayName}
                                    onChange={(e) => setEditingDisplayName(e.target.value)}
                                      onBlur={() => {
                                      updateAccountDisplayName(account.id, editingDisplayName.trim() || account.name);
                                      setEditingAccountId(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        updateAccountDisplayName(account.id, editingDisplayName.trim() || account.name);
                                        setEditingAccountId(null);
                                      }
                                      if (e.key === "Escape") setEditingAccountId(null);
                                    }}
                                    placeholder="@user"
                                    className="h-6 w-full max-w-[10rem] sm:max-w-[12rem] bg-transparent border-0 px-0 text-[12px] tracking-[0.02em] text-white/90 placeholder:text-white/35 focus:ring-0 focus:outline-none"
                                  />
                                ) : (
                                  <h4 className="font-semibold text-white truncate">
                                    <button
                                      type="button"
                                      className={`inline-flex items-center text-white/80 hover:text-white focus-visible:outline-none ${
                                        hasDisplayName ? "group-hover:hidden" : ""
                                      }`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditingAccountId(account.id);
                                        setEditingDisplayName(displayName || account.name);
                                      }}
                                      title={tr("Редагувати ім'я", "Edit name", "Редактировать имя")}
                                    >
                                      {displayNumber}
                                    </button>
                                    {hasDisplayName ? (
                                      <button
                                        type="button"
                                        className="hidden group-hover:inline-flex items-center text-white/90 hover:text-white focus-visible:outline-none"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setEditingAccountId(account.id);
                                          setEditingDisplayName(displayName || account.name);
                                        }}
                                        title={tr("Редагувати ім'я", "Edit name", "Редактировать имя")}
                                      >
                                        {displayName}
                                      </button>
                                    ) : null}
                                  </h4>
                                )}
                              </div>
                            </div>
                            {Array.isArray(account.hashtags) && account.hashtags.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {account.hashtags.map((tag) => (
                                  <div
                                    key={`${account.id}-${tag}`}
                                    className="group/hashtag relative inline-flex items-center justify-center rounded-full bg-primary/20 text-primary pl-2 pr-4 py-0.5 text-[10px] hover:bg-primary/30 transition-[color,background-color]"
                                    title={`#${tag}`}
                                  >
                                    <span className="leading-none">#{tag}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveHashtag(account.id, tag)}
                                      className="absolute right-1 flex items-center justify-center opacity-0 pointer-events-none group-hover/hashtag:opacity-100 group-hover/hashtag:pointer-events-auto transition-opacity"
                                      title={tr(`Видалити #${tag}`, `Remove #${tag}`, `Удалить #${tag}`)}
                                      aria-label={tr(`Видалити #${tag}`, `Remove #${tag}`, `Удалить #${tag}`)}
                                    >
                                      <X className="w-2.5 h-2.5 text-white/70 group-hover:text-red-500 transition-colors" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-1 h-5" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {effectiveStatus === accountStatus.blocked ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-500/20 text-slate-300">
                                {statusLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder={tr("Додати нотатку..", "Add note..", "Добавить заметку..")}
                            className="bg-white/[0.006] border-white/[0.025] text-white text-xs flex-1 placeholder:text-gray-500 focus:border-white/[0.025] focus:ring-0"
                            defaultValue={account.notes ?? ""}
                            onBlur={(e) => {
                              if (e.target.value !== (account.notes || "")) updateAccountNotes(account.id, e.target.value);
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 rounded-lg transition-all ${
                              isRunningEffective
                                ? "border-transparent bg-gradient-to-r from-primary to-primary/80 text-white hover:scale-105"
                                : "bg-white/[0.006] border-white/[0.025] hover:bg-white/10 hover:border-white/[0.04]"
                            } focus-visible:ring-0 focus-visible:outline-none`}
                            onClick={() => void handleToggleAccount(account)}
                            title={isRunningEffective ? tr("Закрити", "Close", "Закрыть") : tr("Відкрити", "Open", "Открыть")}
                          >
                            {isRunningEffective ? (
                              <X className="w-3 h-3 text-white" />
                            ) : (
                              <ExternalLink className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <SearchX className="w-16 h-16 text-slate-400 mb-4" />
                  <p className="text-xl font-medium text-slate-300 mb-2">{tr("Немає акаунтів", "No accounts", "Нет аккаунтов")}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <Dialog open={isHashtagModalOpen} onOpenChange={(open) => (open ? setIsHashtagModalOpen(true) : closeHashtagModal())}>
        <DialogContent hideClose className="bg-black/40 backdrop-blur-md border border-white/5 text-white sm:max-w-md p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold text-white">{tr("Додати хештег", "Add hashtag", "Добавить хештег")}</h2>
            <button onClick={closeHashtagModal} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all duration-200">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">#</span>
              <Input
                autoFocus
                autoComplete="new-password"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                className="bg-white/[0.006] border-white/[0.025] h-12 rounded-xl pl-7 text-white placeholder:text-gray-500 focus:border-white/[0.025]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitHashtagModal();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex gap-4 pt-6">
            <Button type="button" onClick={closeHashtagModal} className="flex-1 h-12 bg-black/50 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all duration-300">
              {tr("Скасувати", "Cancel", "Отмена")}
            </Button>
            <Button type="button" onClick={submitHashtagModal} className="flex-1 h-12 bg-primary hover:bg-primary active:bg-primary/95 text-white border-0 shadow-none hover:shadow-none focus-visible:ring-0 rounded-xl transition-all duration-200">
              {tr("Додати", "Add", "Добавить")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        project={null}
        mode="add"
        linkPlaceholder="https://example.com"
      />

      <CustomLinkModal
        isOpen={isCustomLinkModalOpen}
        onClose={() => setIsCustomLinkModalOpen(false)}
        onSubmit={handleCustomLinkSubmit}
        placeholder="https://example.com"
        mode="generic"
      />
    </div>
  );
}
