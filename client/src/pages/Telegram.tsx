import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { Rocket, Loader2, ExternalLink, Plus, Pencil, Trash2, Terminal, Circle, Wifi, Layers, GhostIcon as Ghost, Calendar, AppWindow, Clock, X, RefreshCw, SearchX, Search, Filter, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TelegramLink } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLogs, useCreateLog } from "@/hooks/use-dashboard";
import { DailyTasksPanel } from "@/components/DailyTasksPanel";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isToday, isSameYear } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { GhostIcon } from "@/components/ui/ghost-icon";
import { AccountStatsWidget } from "@/components/AccountStatsWidget";
import { accountStatus, type AccountStatus } from "@/lib/accountStatus";
import {
  readDirectory,
  launchAccounts,
  launchSingleAccount,
  launchAccountsForProfiles,
  getAvailableLinks,
  closeTelegramProcesses,
  closeTelegramAccountsBatch,
  getTelegramPidsForAccounts,
  closeSingleAccount,
  getRunningTelegramProcesses,
  getAccountStats,
  type AccountStats,
} from "@/lib/tauri-api";
import { ProjectModal } from "@/components/ProjectModal";
import { CustomLinkModal } from "@/components/CustomLinkModal";
import { Progress } from "@/components/ui/progress";
import { SegmentProgress } from "@/components/ui/segment-progress";
import { listen } from "@tauri-apps/api/event";
import { projectStorage, type ProjectData } from "@/lib/projectStorage";
import { localStore, type LocalHashtagMeta, type TelegramLaunchParams } from "@/lib/localStore";
import { useQueryClient } from "@tanstack/react-query";
import blockedGhostIcon from "@/assets/icons/blocked-ghost-custom.png";
import {
  stableAccountId,
  getTelegramBatchSize,
  buildProfileList,
  normalizeHashtag,
  hasUserNotes,
  getAccountHashtags,
  isSystemGeneratedNote,
  normalizeText,
  processBelongsToAccount,
  findPidForAccount,
  type TelegramAccount,
  type TelegramProcess,
  type TelegramProjectTuple,
} from "@/lib/telegram-helpers";
import { useI18n } from "@/lib/i18n";

type DirectoryEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified?: string | number | Date;
};

type LaunchProgressEvent = {
  payload?: {
    batch_index?: number;
    batchIndex?: number;
  };
};

export default function Telegram() {
  const { toast } = useToast();
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;
  const locale = language === "en" ? "en" : language === "ru" ? "ru" : "uk";
  const queryClient = useQueryClient();
  const { data: recentActions = [] } = useLogs();
  const { mutate: createLog } = useCreateLog();
  const LAUNCH_STALE_MS = 24 * 60 * 60 * 1000;
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [customLink, setCustomLink] = useState<TelegramLink | null>(null);
  const [startRange, setStartRange] = useState("");
  const [endRange, setEndRange] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMix, setIsMix] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [accountFilter, setAccountFilter] = useState<"all" | AccountStatus>("all"); // all, active, blocked, inactive
  const [hashtagFilter, setHashtagFilter] = useState<string>("all");
  const [accountSearch, setAccountSearch] = useState<string>("");
  const [notesFilter, setNotesFilter] = useState<"all" | "with">("all");
  const [hashtagMeta, setHashtagMeta] = useState<LocalHashtagMeta[]>([]);
  const [isHashtagEditOpen, setIsHashtagEditOpen] = useState(false);
  const [hashtagEditTag, setHashtagEditTag] = useState<string>("");
  const [hashtagEditName, setHashtagEditName] = useState<string>("");
  const [hashtagEditLink, setHashtagEditLink] = useState<string>("");
  const [hashtagEditErrors, setHashtagEditErrors] = useState<string[]>([]);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [availableLinks, setAvailableLinks] = useState<TelegramProjectTuple[]>([]);
  const [launchedPids, setLaunchedPids] = useState<number[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<number[]>([]);
  const [batchSize, setBatchSize] = useState<number>(1);
  const [launchParams, setLaunchParams] = useState<TelegramLaunchParams | null>(null);
  const [totalProfiles, setTotalProfiles] = useState<number>(0);
  const [launchProgressCount, setLaunchProgressCount] = useState<number>(0);
  const [launchMode, setLaunchMode] = useState<"project" | "plain" | null>(null);
  const batchBaseCountRef = useRef(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProject, setEditingProject] = useState<{ name: string; ref_link: string } | null>(null);
  const [isProjectSelectOpen, setIsProjectSelectOpen] = useState(false);
  const [isCustomLinkModalOpen, setIsCustomLinkModalOpen] = useState(false);
  const [isHashtagModalOpen, setIsHashtagModalOpen] = useState(false);
  const [hashtagModalAccountId, setHashtagModalAccountId] = useState<number | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [openAccounts, setOpenAccounts] = useState<Map<number, number>>(new Map()); // accountId -> PID
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState<string>("");
  const [realStats, setRealStats] = useState<{running: number, blocked: number, total: number}>({ running: 0, blocked: 0, total: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const statsRefreshInFlight = useRef(false);
  const statsBaseDelayMs = 4000;
  const statsMaxDelayMs = 15000;
  const statsDelayRef = useRef(statsBaseDelayMs);
  const statsTimerRef = useRef<number | null>(null);
  const launchHydratedRef = useRef(false);
  const cancelLaunchRef = useRef(false);
  const lastLaunchProjectRef = useRef<string>("");
  const lastBatchProfileIdsRef = useRef<number[]>([]);

  const readTelegramBatchSize = () => getTelegramBatchSize(localStore.getSettings().telegramThreads);
  const logAction = (message: string) => {
    createLog({ message });
  };

  const getAllProfileIds = (): number[] => {
    const ids = accounts
      .map((account) => extractProfileId(account))
      .filter((id): id is number => Number.isFinite(id));
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  };

  const syncAccountsRunningStatus = async () => {
    try {
      const runningProcesses = await getRunningTelegramProcesses() as TelegramProcess[];
      const runningPidSet = new Set<number>(
        runningProcesses
          .map((p) => Number(p?.pid))
          .filter((pid: number) => Number.isFinite(pid))
      );

      setAccounts((prevAccounts: TelegramAccount[]) => {
        const nextAccounts = prevAccounts.map((acc) => {
          const isRunning = runningProcesses.some((process) =>
            processBelongsToAccount(acc, process)
          );

          const nextStatus = isRunning
            ? accountStatus.active
            : (acc.status === accountStatus.blocked ? accountStatus.blocked : accountStatus.inactive);
          return acc.status === nextStatus ? acc : { ...acc, status: nextStatus };
        });

        localStore.saveAccounts(nextAccounts);
        const scopeKey = localStore.getSettings().telegramFolderPath || "";
        if (scopeKey) {
          localStore.syncAccountMetaFromAccounts(scopeKey, nextAccounts);
        }

        const usedPids = new Set<number>();
        const mappedByProcess = new Map<number, number>();
        for (const acc of nextAccounts) {
          const pid = findPidForAccount(acc, runningProcesses, usedPids);
          if (pid !== null) {
            mappedByProcess.set(acc.id, pid);
            usedPids.add(pid);
          }
        }

        setOpenAccounts((prevOpenAccounts) => {
          const nextOpenAccounts = new Map<number, number>(mappedByProcess);

          // Keep existing mapping if its PID is still alive but couldn't be re-matched yet.
          for (const [accountId, pid] of Array.from(prevOpenAccounts.entries())) {
            if (!nextOpenAccounts.has(accountId) && runningPidSet.has(pid)) {
              nextOpenAccounts.set(accountId, pid);
            }
          }

          return nextOpenAccounts;
        });

        return nextAccounts;
      });

      setLaunchedPids((prev) => prev.filter((pid) => runningPidSet.has(pid)));
    } catch (error) {
      console.error("Failed to sync running statuses:", error);
    }
  };
  const [accountStatusOverrides, setAccountStatusOverrides] = useState<Map<string, AccountStatus>>(new Map());
  const getEffectiveStatus = (account: TelegramAccount) =>
    accountStatusOverrides.get(account?.name) ?? account?.status;

  // Function to analyze specific account in detail
  const analyzeAccountDetails = async (accountName: string) => {
    try {
      const settings = localStore.getSettings();
      const folderPath = settings.telegramFolderPath || null;
      
      if (!folderPath) {
        toast({
          title: tr("Помилка", "Error", "Ошибка"),
          description: tr(
            "Спочатку вкажіть шлях до папки в налаштуваннях",
            "First set the folder path in settings",
            "Сначала укажите путь к папке в настройках"
          ),
          variant: "destructive",
        });
        return;
      }
      
      // Get all directories to find the specific account
      const files = await readDirectory(folderPath) as DirectoryEntry[];
      const directories = files.filter((file) => file.is_dir);
      const tgDirectories = directories.filter((dir) => dir.name.toLowerCase().startsWith('tg'));
      
      const accountDir = tgDirectories.find((dir) => dir.name === accountName);
      if (!accountDir) {
        toast({
          title: tr("Помилка", "Error", "Ошибка"),
          description: tr(
            `Акаунт ${accountName} не знайдено`,
            `Account ${accountName} not found`,
            `Аккаунт ${accountName} не найден`
          ),
          variant: "destructive",
        });
        return;
      }
      
      const tdataPath = `${accountDir.path}/tdata`;
      const tdataFiles = await readDirectory(tdataPath) as DirectoryEntry[];
      
      console.log(`=== DETAILED ANALYSIS FOR ${accountName} ===`);
      console.log('Total files:', tdataFiles.length);
      console.log('Files:', tdataFiles.map(f => `${f.name} (${f.size} bytes)`));
      
      const status = await determineAccountStatus(tdataFiles, accountName, accountDir.path);
      
      toast({
        title: tr("Аналіз завершено", "Analysis completed", "Анализ завершен"),
        description: tr(
          `${accountName}: ${status}. Деталі у консолі.`,
          `${accountName}: ${status}. Details in console.`,
          `${accountName}: ${status}. Подробности в консоли.`
        ),
      });
      
    } catch (error) {
      console.error(`Error analyzing ${accountName}:`, error);
      toast({
        title: tr("Помилка аналізу", "Analysis error", "Ошибка анализа"),
        description: tr(
          `Не вдалося проаналізувати акаунт ${accountName}`,
          `Failed to analyze account ${accountName}`,
          `Не удалось проанализировать аккаунт ${accountName}`
        ),
        variant: "destructive",
      });
    }
  };

  // Function to reset all manual overrides
  const resetStatusOverrides = () => {
    setAccountStatusOverrides(new Map());
    loadRealStats();
    toast({
      title: tr("Оверрайди скинуто", "Overrides reset", "Оверрайды сброшены"),
      description: tr(
        "Усі ручні статуси акаунтів очищено",
        "All manual account statuses were cleared",
        "Все ручные статусы аккаунтов очищены"
      ),
    });
  };

  // Function to manually override account status
  const overrideAccountStatus = (accountName: string, status: AccountStatus) => {
    setAccountStatusOverrides(prev => {
      const newOverrides = new Map(prev);
      newOverrides.set(accountName, status);
      return newOverrides;
    });
    
    // Recalculate stats
    loadRealStats();
    
    toast({
      title: tr("Статус змінено", "Status updated", "Статус изменен"),
      description: tr(
        `Статус ${accountName} оновлено на ${status}`,
        `Status for ${accountName} updated to ${status}`,
        `Статус ${accountName} обновлен на ${status}`
      ),
    });
  };

  // Load real account stats
  const loadRealStats = async (manual = false): Promise<boolean> => {
    if (statsRefreshInFlight.current) return true;
    statsRefreshInFlight.current = true;
    let ok = true;

    try {
      if (manual) {
        setStatsLoading(true);
      }

      const settings = localStore.getSettings();
      const folderPath = settings.telegramFolderPath || "";
      const raw = await getAccountStats(folderPath) as AccountStats;
      const finalStats = {
        total: Number(raw?.total ?? 0),
        running: Number(raw?.running ?? raw?.active ?? 0),
        blocked: Number(raw?.blocked ?? 0),
      };

      setRealStats(finalStats);
      await syncAccountsRunningStatus();
    } catch (error) {
      ok = false;
      console.error('Failed to load real stats:', error);
      if (manual) {
        toast({
          title: tr("Помилка оновлення статистики", "Stats refresh error", "Ошибка обновления статистики"),
          description: tr(
            "Не вдалося завантажити поточну статистику акаунтів",
            "Failed to load current account statistics",
            "Не удалось загрузить текущую статистику аккаунтов"
          ),
          variant: "destructive",
        });
      }
    } finally {
      if (manual) {
        setStatsLoading(false);
      }
      statsRefreshInFlight.current = false;
    }
    return ok;
  };
  // Load settings and accounts on mount
  useEffect(() => {
    console.log('Telegram page mounted, loading settings...');
    
    const loadAccounts = (reason: "init" | "settings" | "silent" = "silent") => {
      setIsAccountsLoading(true);
      const settings = localStore.getSettings();
      console.log('Loaded settings:', settings);

      if (settings.telegramFolderPath) {
        console.log('Loading accounts from folder:', settings.telegramFolderPath);
        loadAccountsFromFolder(settings.telegramFolderPath, reason);
      } else {
        console.log('No telegram folder path found, loading default accounts');
        loadDefaultAccounts();
      }
    };

    // Load available links
    const loadLinks = async () => {
      try {
        // First try to load from projectStorage
        const storedProjects = projectStorage.getProjects();
        
        if (storedProjects.length > 0) {
          setAvailableLinks(storedProjects);
          console.log('Loaded projects from projectStorage:', storedProjects);
        } else {
          // If no stored projects, create empty array
          setAvailableLinks([]);
          console.log('No stored projects found, starting with empty list');
        }
      } catch (error) {
        console.error('Error loading links:', error);
        // Set empty array as fallback
        setAvailableLinks([]);
      }
    };

    // Initial load
    loadAccounts("init");
    loadLinks();
    loadRealStats();

    // Auto-refresh stats in background with backoff
    const scheduleStatsRefresh = () => {
      if (statsTimerRef.current !== null) {
        window.clearTimeout(statsTimerRef.current);
      }
      statsTimerRef.current = window.setTimeout(async () => {
        const ok = await loadRealStats();
        statsDelayRef.current = ok
          ? statsBaseDelayMs
          : Math.min(statsMaxDelayMs, Math.round(statsDelayRef.current * 1.7));
        scheduleStatsRefresh();
      }, statsDelayRef.current);
    };

    statsDelayRef.current = statsBaseDelayMs;
    scheduleStatsRefresh();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        console.log('Settings changed, reloading accounts...');
        loadAccounts("settings");
        loadRealStats(); // Reload stats too
      }
    };

    // Also listen for custom events for same-tab updates
    const handleSettingsUpdate = () => {
      console.log('Settings updated event received, reloading accounts...');
      loadAccounts("settings");
      loadRealStats(); // Reload stats too
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      if (statsTimerRef.current !== null) {
        window.clearTimeout(statsTimerRef.current);
        statsTimerRef.current = null;
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Midnight refresh for logs + daily tasks
  useEffect(() => {
    let timeoutId: number | null = null;
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
      timeoutId = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
        queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
        scheduleMidnightRefresh();
      }, delay);
    };

    scheduleMidnightRefresh();
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [queryClient]);

  // Restore telegram launch state when page mounts
  useEffect(() => {
    const saved = localStore.getTelegramLaunchState();
    if (saved) {
      if (saved.selectedProject === "custom" && !saved.launchParams) {
        setSelectedProject("");
      } else {
        setSelectedProject(saved.selectedProject || "");
      }
      setStartRange(saved.startRange || "");
      setEndRange(saved.endRange || "");
      setIsMix(Boolean(saved.isMix));
      setLaunchedPids(Array.isArray(saved.launchedPids) ? saved.launchedPids : []);
      setPendingProfiles(Array.isArray(saved.pendingProfiles) ? saved.pendingProfiles : []);
      setBatchSize(Number.isFinite(saved.batchSize) && saved.batchSize > 0 ? saved.batchSize : 1);
      setLaunchParams(saved.launchParams ?? null);
      setTotalProfiles(Number.isFinite(saved.totalProfiles) ? saved.totalProfiles : 0);
      if (saved.launchMode === "project" || saved.launchMode === "plain") {
        setLaunchMode(saved.launchMode);
      } else if (!saved.launchParams && !saved.selectedProject && saved.pendingProfiles?.length) {
        setLaunchMode("plain");
      } else if (saved.launchParams || saved.selectedProject) {
        setLaunchMode("project");
      }
      setLaunchProgressCount(
        Number.isFinite(saved.totalProfiles)
          ? Math.max(0, Number(saved.totalProfiles) - (saved.pendingProfiles ? saved.pendingProfiles.length : 0))
          : 0,
      );
    } else {
      setIsMix(true);
    }
    launchHydratedRef.current = true;

    if (saved?.launchedPids?.length) {
      (async () => {
        try {
          const running = await getRunningTelegramProcesses() as TelegramProcess[];
          const runningPidSet = new Set<number>(
            running
              .map((p) => Number(p?.pid))
              .filter((pid: number) => Number.isFinite(pid))
          );
          const filtered = saved.launchedPids.filter((pid: number) => runningPidSet.has(pid));
          if (filtered.length !== saved.launchedPids.length) {
            setLaunchedPids(filtered);
            if (filtered.length === 0 && (!saved.pendingProfiles || saved.pendingProfiles.length === 0)) {
              localStore.clearTelegramLaunchState();
            }
          }
        } catch (error) {
          console.warn("Failed to validate saved launch PIDs:", error);
        }
      })();
    }

    if (saved) {
      (async () => {
        try {
          const ageMs = Date.now() - Number(saved.updatedAt ?? Date.now());
          if (ageMs < LAUNCH_STALE_MS) return;

          const running = await getRunningTelegramProcesses() as TelegramProcess[];
          const runningPidSet = new Set<number>(
            running
              .map((p) => Number(p?.pid))
              .filter((pid: number) => Number.isFinite(pid))
          );
          const hasSavedRunning = Array.isArray(saved.launchedPids)
            ? saved.launchedPids.some((pid) => runningPidSet.has(Number(pid)))
            : false;

          if (hasSavedRunning) return;

          const hadQueue = (saved.pendingProfiles?.length || 0) > 0 || (saved.launchedPids?.length || 0) > 0;
          setSelectedProject("");
          setStartRange("");
          setEndRange("");
          setIsMix(true);
          setLaunchedPids([]);
          setPendingProfiles([]);
          setBatchSize(1);
          setLaunchParams(null);
          setTotalProfiles(0);
          setLaunchMode(null);
          setLaunchProgressCount(0);
          localStore.clearTelegramLaunchState();

          if (hadQueue) {
            toast({
              title: tr("Черга очищена", "Queue cleared", "Очередь очищена"),
              description: tr(
                "Застарілий прогрес запуску було скинуто.",
                "Stale launch progress has been reset.",
                "Устаревший прогресс запуска был сброшен."
              ),
            });
          }
        } catch (error) {
          console.warn("Failed to auto-clear stale launch queue:", error);
        }
      })();
    }
  }, []);

  useEffect(() => {
    let unlisten: null | (() => void) = null;
    listen('telegram-launch-progress', (event: LaunchProgressEvent) => {
      const payload = (event && event.payload) || {};
      const batchIndex = Number(payload.batch_index ?? payload.batchIndex ?? 0);
      if (!Number.isFinite(batchIndex) || batchIndex <= 0) return;
      setLaunchProgressCount((prev) => {
        const base = batchBaseCountRef.current || 0;
        const next = base + batchIndex;
        return next > prev ? next : prev;
      });
    })
      .then((fn: () => void) => {
        unlisten = fn;
      })
      .catch((error: unknown) => {
        console.warn('Failed to listen for launch progress:', error);
      });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    if (selectedProject === "custom") return;

    const timer = window.setTimeout(() => {
      const startInput = document.getElementById("start-range-input") as HTMLInputElement | null;
      if (startInput) {
        startInput.focus();
        startInput.select();
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [selectedProject]);

  // Persist telegram launch state for navigation
  useEffect(() => {
    if (!launchHydratedRef.current) return;
    const hasAny =
      launchedPids.length > 0 ||
      pendingProfiles.length > 0 ||
      Boolean(selectedProject) ||
      Boolean(startRange) ||
      Boolean(endRange) ||
      Boolean(isMix);
    if (!hasAny) {
      localStore.clearTelegramLaunchState();
      return;
    }
    localStore.saveTelegramLaunchState({
      selectedProject,
      startRange,
      endRange,
      isMix,
      launchedPids,
      pendingProfiles,
      batchSize,
      launchParams,
      totalProfiles,
      launchMode,
      updatedAt: Date.now(),
    });
  }, [selectedProject, startRange, endRange, isMix, launchedPids, pendingProfiles, batchSize, launchParams, totalProfiles, launchMode]);

  // Clear invalid selection if project list changed
  useEffect(() => {
    if (!selectedProject) return;
    if (selectedProject.startsWith("#")) return;
    if (selectedProject === "custom") return;
    const exists = availableLinks.some(([name]) => name === selectedProject);
    if (!exists) {
      setSelectedProject("");
    }
  }, [availableLinks, selectedProject]);

  // Function to get REAL account status by checking actual account state
  const determineAccountStatus = async (tdataFiles: DirectoryEntry[], accountName: string, accountPath: string): Promise<AccountStatus> => {
    try {
      console.log(`Checking REAL status for account: ${accountName} at ${accountPath}`);
      
      // Method 1: Check if account is currently running
      const runningProcesses = await getRunningTelegramProcesses() as TelegramProcess[];
      const isAccountRunning = runningProcesses.some((process) => {
        const processPath = process.path ? process.path.toLowerCase() : '';
        const processName = process.name ? process.name.toLowerCase() : '';

        return processPath.includes(accountName.toLowerCase()) ||
               processName.includes(accountName.toLowerCase()) ||
               processPath.includes(accountPath.toLowerCase());
      });

      if (isAccountRunning) {
        return accountStatus.active;
      }

      // Method 2: Explicit indicators that the account is blocked/deleted
      const telegramDeletionIndicators = [
        'deleted', 'banned', 'suspended', 'restricted',
        'error', 'failed', 'blocked',
      ];

      const hasDeletionIndicators = tdataFiles.some((f) =>
        telegramDeletionIndicators.some((indicator) =>
          String(f.name || '').toLowerCase().includes(indicator)
        )
      );

      if (hasDeletionIndicators) {
        return accountStatus.blocked;
      }

      // Not running and no explicit ban markers -> inactive, not blocked.
      return accountStatus.inactive;
    } catch (error) {
      console.error(`Failed to determine status for ${accountName}:`, error);
      return accountStatus.inactive;
    }
  };
  // Function to load accounts from folder using Tauri API
  const loadAccountsFromFolder = async (
    folderPath: string,
    reason: "init" | "settings" | "silent" = "silent"
  ) => {
    try {
      setIsAccountsLoading(true);
      console.log('Loading accounts from:', folderPath);
      
      // Use real directory reading via Tauri API
      const files = await readDirectory(folderPath) as DirectoryEntry[];
      console.log('All files found:', files);
      
      // Find all directories that might contain accounts
      const directories = files.filter((file) => file.is_dir);
      console.log('Directories found:', directories);
      
      let allAccounts: TelegramAccount[] = [];
      const existingById = localStore.getAccountMetaMap(folderPath);
      
      // Check each directory for tdata folders
      for (const dir of directories) {
        try {
          const subFiles = await readDirectory(dir.path) as DirectoryEntry[];
          console.log(`Files in ${dir.name}:`, subFiles);
          
          // Look for tdata folder in this directory
          const tdataFolder = subFiles.find((f) => f.is_dir && f.name === 'tdata');
          
          if (tdataFolder) {
            // Additional check: verify tdata folder contains Telegram files
            try {
              const tdataFiles = await readDirectory(tdataFolder.path) as DirectoryEntry[];
              console.log(`Files in tdata folder of ${dir.name}:`, tdataFiles);
              
              // Check for essential Telegram files in tdata
              const hasTelegramFiles = tdataFiles.some((f) => {
                const fileName = f.name.toLowerCase();
                return fileName.includes('user') || 
                       fileName.includes('session') ||
                       fileName.includes('key') ||
                       fileName.includes('map') ||
                       fileName.includes('settings');
              });
              
              if (hasTelegramFiles) {
                // This directory contains a valid tdata folder - it's a Telegram account
                // Determine REAL status based on actual checks
                const accountStatusValue = await determineAccountStatus(tdataFiles, dir.name, dir.path);
                console.log(`Account ${dir.name} REAL status determined as: ${accountStatusValue}`);
                const accountId = stableAccountId(`${dir.path}|tdata`);
                const existing = existingById.get(accountId);
                const nextNotes =
                  typeof existing?.notes === "string" && !isSystemGeneratedNote(existing.notes)
                    ? existing.notes
                    : "";
                const nextDisplayName = typeof existing?.displayName === "string" ? existing.displayName : "";
                
                allAccounts.push({
                  id: accountId,
                  name: dir.name,
                  displayName: nextDisplayName,
                  status: accountStatusValue,
                  notes: nextNotes,
                  hashtags: Array.isArray(existing?.hashtags) ? existing.hashtags : [],
                  type: 'tdata',
                  size: dir.size,
                  modified: dir.modified,
                  api_id: "", // Add missing fields for TelegramLink compatibility
                  api_hash: "", // Add missing fields for TelegramLink compatibility
                  phone: "", // Add missing fields for TelegramLink compatibility
                  app_name: "", // Add app_name for compatibility
                  app_type: "", // Add app_type for compatibility
                  ref_link: "", // Add ref_link for compatibility
                  mixed: "yes" // Add mixed for compatibility
                });
                console.log(`Added account: ${dir.name}`);
              } else {
                console.log(`Skipped ${dir.name} - tdata folder doesn't contain Telegram files`);
              }
            } catch (tdataError) {
              console.error(`Failed to read tdata folder for ${dir.name}:`, tdataError);
            }
          } else {
            console.log(`Skipped ${dir.name} - no tdata folder found`);
          }
          
          // Only check for session files directly in this directory if it's not a TG folder
          if (!dir.name.toLowerCase().startsWith('tg')) {
            const sessionFiles = subFiles.filter((f) => f.name.endsWith('.session'));
            for (const sessionFile of sessionFiles) {
              // For session files, most are blocked since Telegram bans log them out
              // Only very recently modified sessions might still be active
              const fileAge = Date.now() - new Date(sessionFile.modified ?? 0).getTime();
              const daysOld = fileAge / (1000 * 60 * 60 * 24);
              const accountStatusValue = daysOld < 1 ? accountStatus.active : accountStatus.blocked; // Only active if modified today
              const accountId = stableAccountId(`${sessionFile.path}|session`);
                const existing = existingById.get(accountId);
                const nextNotes =
                  typeof existing?.notes === "string" && !isSystemGeneratedNote(existing.notes)
                    ? existing.notes
                    : "";
                const nextDisplayName = typeof existing?.displayName === "string" ? existing.displayName : "";
              
              console.log(`Session account ${sessionFile.name.replace('.session', '')}: ${daysOld.toFixed(1)} days old -> ${accountStatus}`);
              
              allAccounts.push({
                id: accountId,
                name: sessionFile.name.replace('.session', ''),
                displayName: nextDisplayName,
                status: accountStatusValue,
                notes: nextNotes,
                hashtags: Array.isArray(existing?.hashtags) ? existing.hashtags : [],
                type: 'session',
                size: sessionFile.size,
                modified: sessionFile.modified,
                api_id: "", 
                api_hash: "", 
                phone: "", 
                app_name: "", 
                app_type: "", 
                ref_link: "", 
                mixed: "yes" 
              });
            }
          }
          
        } catch (error) {
          console.error(`Failed to read directory ${dir.path}:`, error);
        }
      }
      
      // Also check for session files in the root folder
      const rootSessionFiles = files.filter((file) => file.name.endsWith('.session'));
      for (const sessionFile of rootSessionFiles) {
        // For session files, most are blocked since Telegram bans log them out
        const fileAge = Date.now() - new Date(sessionFile.modified ?? 0).getTime();
        const daysOld = fileAge / (1000 * 60 * 60 * 24);
        const accountStatusValue = daysOld < 1 ? accountStatus.active : accountStatus.blocked; // Only active if modified today
        const accountId = stableAccountId(`${sessionFile.path}|root-session`);
        const existing = existingById.get(accountId);
        const nextNotes =
          typeof existing?.notes === "string" && !isSystemGeneratedNote(existing.notes)
            ? existing.notes
            : "";
        const nextDisplayName = typeof existing?.displayName === "string" ? existing.displayName : "";
        
        console.log(`Root session account ${sessionFile.name.replace('.session', '')}: ${daysOld.toFixed(1)} days old -> ${accountStatus}`);
        
        allAccounts.push({
          id: accountId,
          name: sessionFile.name.replace('.session', ''),
          displayName: nextDisplayName,
          status: accountStatusValue,
          notes: nextNotes,
          hashtags: Array.isArray(existing?.hashtags) ? existing.hashtags : [],
          type: 'session',
          size: sessionFile.size,
          modified: sessionFile.modified,
          api_id: "", // Add missing fields for TelegramLink compatibility
          api_hash: "", // Add missing fields for TelegramLink compatibility
          phone: "", // Add missing fields for TelegramLink compatibility
          app_name: "", // Add app_name for compatibility
          app_type: "", // Add app_type for compatibility
          ref_link: "", // Add ref_link for compatibility
          mixed: "yes" // Add mixed for compatibility
        });
      }
      
      console.log('Final accounts list:', allAccounts);
      
      if (allAccounts.length === 0) {
        // Show detailed error with file list
        const fileList = files.map((f) => `${f.name} (${f.is_dir ? 'dir' : 'file'})`).join(', ');
        console.log('No Telegram files found. Available files:', fileList);
        
        toast({
          title: tr("Telegram-акаунти не знайдено", "Telegram accounts not found", "Telegram-аккаунты не найдены"),
          description: tr(
            `У папці ${folderPath} не знайдено валідних Telegram-акаунтів. Вміст папки: ${fileList.substring(0, 200)}${fileList.length > 200 ? '...' : ''}`,
            `No valid Telegram accounts were found in folder ${folderPath}. Folder content: ${fileList.substring(0, 200)}${fileList.length > 200 ? "..." : ""}`,
            `В папке ${folderPath} не найдено валидных Telegram-аккаунтов. Содержимое папки: ${fileList.substring(0, 200)}${fileList.length > 200 ? "..." : ""}`
          ),
          variant: "destructive",
        });
        loadDefaultAccounts();
        return;
      }
      
      setAccounts(allAccounts);
      localStore.saveAccounts(allAccounts);
      localStore.syncAccountMetaFromAccounts(folderPath, allAccounts);
      
      const shouldToast = (() => {
        if (reason === "settings") return true;
        if (reason !== "init") return false;
        try {
          const key = "abuseapp.accountsToastShown";
          const already = sessionStorage.getItem(key) === "1";
          if (!already) {
            sessionStorage.setItem(key, "1");
            return true;
          }
        } catch {
          // ignore storage errors, fall back to showing once
          return true;
        }
        return false;
      })();

      if (shouldToast) {
        toast({
          title: tr("Акаунти завантажено", "Accounts loaded", "Аккаунты загружены"),
          description: tr(
            `Знайдено ${allAccounts.length} Telegram-акаунтів у папці ${folderPath}`,
            `Found ${allAccounts.length} Telegram accounts in folder ${folderPath}`,
            `Найдено ${allAccounts.length} Telegram-аккаунтов в папке ${folderPath}`
          ),
        });
      }
      
    } catch (error) {
      console.error('Failed to load accounts from folder:', error);
      toast({
        title: tr("Помилка завантаження", "Loading error", "Ошибка загрузки"),
        description: tr(
          `Не вдалося прочитати папку: ${error}`,
          `Failed to read folder: ${error}`,
          `Не удалось прочитать папку: ${error}`
        ),
        variant: "destructive",
      });
      // Fallback to sample accounts if folder reading fails
      loadDefaultAccounts();
    } finally {
      setIsAccountsLoading(false);
    }
  };

  // Function to load default accounts
  const loadDefaultAccounts = () => {
    console.log('Loading default accounts...');
    // Return empty array when no folder path is specified
    const defaultAccounts: TelegramAccount[] = [];
    console.log('Setting empty accounts list (no folder path specified)');
    setAccounts(defaultAccounts);
    localStore.saveAccounts(defaultAccounts);
    setIsAccountsLoading(false);
  };

  // Function to update account notes
  const updateAccountNotes = async (accountId: number, notes: string, cardNumber?: number) => {
    try {
      const accountName = accounts.find((acc) => acc.id === accountId)?.name ?? String(accountId);
      // Update local state immediately for better UX
      setAccounts(prevAccounts => 
        prevAccounts.map(acc => 
          acc.id === accountId ? { ...acc, notes } : acc
        )
      );
      const scopeKey = localStore.getSettings().telegramFolderPath || "";
      localStore.updateAccountNotes(accountId, notes, scopeKey);
      const cardLabel = Number.isFinite(cardNumber) ? Number(cardNumber) : accountId;

      toast({
        title: tr("Нотатку оновлено", "Note updated", "Заметка обновлена"),
        description: tr(`Акаунт ${cardLabel}`, `Account ${cardLabel}`, `Аккаунт ${cardLabel}`),
      });
    } catch (error) {
      toast({
        title: tr("Помилка збереження", "Save error", "Ошибка сохранения"),
        description: tr("Не вдалося оновити нотатку", "Failed to update note", "Не удалось обновить заметку"),
        variant: "destructive",
      });
    }
  };

  const updateAccountDisplayName = async (accountId: number, displayName: string, cardNumber?: number) => {
    try {
      const cardLabel = Number.isFinite(cardNumber) ? Number(cardNumber) : accountId;
      setAccounts(prevAccounts =>
        prevAccounts.map(acc =>
          acc.id === accountId ? { ...acc, displayName } : acc
        )
      );
      const scopeKey = localStore.getSettings().telegramFolderPath || "";
      localStore.updateAccountDisplayName(accountId, displayName, scopeKey);

      toast({
        title: tr("Назву оновлено", "Name updated", "Имя обновлено"),
        description: tr(`Акаунт ${cardLabel}`, `Account ${cardLabel}`, `Аккаунт ${cardLabel}`),
      });
    } catch (error) {
      toast({
        title: tr("Помилка збереження", "Save error", "Ошибка сохранения"),
        description: tr("Не вдалося оновити назву", "Failed to update name", "Не удалось обновить имя"),
        variant: "destructive",
      });
    }
  };

  const extractProfileId = (account: TelegramAccount): number | null => {
    const name = String(account?.name || "");
    const notes = String(account?.notes || "");
    const combined = `${name} ${notes}`;
    const m =
      combined.match(/\bTG\s*(\d+)\b/i) ||
      name.match(/^(\d+)$/) ||
      name.match(/^\D*(\d+)$/);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isFinite(id) ? id : null;
  };

  const saveAccountHashtags = (accountId: number, hashtags: string[]) => {
    const normalized = Array.from(new Set(hashtags.map(normalizeHashtag).filter(Boolean)));
    setAccounts((prevAccounts) => {
      const nextAccounts = prevAccounts.map((acc) =>
        acc.id === accountId ? { ...acc, hashtags: normalized } : acc
      );
      localStore.saveAccounts(nextAccounts);
      const scopeKey = localStore.getSettings().telegramFolderPath || "";
      if (scopeKey) {
        localStore.syncAccountMetaFromAccounts(scopeKey, nextAccounts);
      }
      return nextAccounts;
    });
  };

  const handleAddHashtag = (accountId: number, rawTag: string) => {
    const tag = normalizeHashtag(rawTag);
    if (!tag) return;
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    const next = Array.from(new Set([...getAccountHashtags(account), tag]));
    saveAccountHashtags(accountId, next);
    logAction(tr(`Додано хештег #${tag}`, `Added hashtag #${tag}`, `Добавлен хештег #${tag}`));
  };

  const handleRemoveHashtag = (accountId: number, tagToRemove: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    const next = getAccountHashtags(account).filter((tag) => tag !== tagToRemove);
    saveAccountHashtags(accountId, next);
    logAction(tr(`Видалено хештег #${tagToRemove}`, `Removed hashtag #${tagToRemove}`, `Удален хештег #${tagToRemove}`));
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
    if (hashtagModalAccountId === null) return;
    handleAddHashtag(hashtagModalAccountId, hashtagInput);
    closeHashtagModal();
  };

  const hashtagModalAccount = accounts.find((a) => a.id === hashtagModalAccountId) ?? null;

  useEffect(() => {
    setHashtagMeta(localStore.getHashtagMeta());
  }, []);

  const saveHashtagMeta = (next: LocalHashtagMeta[]) => {
    setHashtagMeta(next);
    localStore.saveHashtagMeta(next);
  };

  const getHashtagMetaItem = (tag: string) =>
    hashtagMeta.find((item) => normalizeHashtag(item.tag) === normalizeHashtag(tag)) ?? null;

  const validateHashtagLink = (value: string): string | null => {
    if (!value.trim()) return null;
    try {
      const url = new URL(value);
      if (!value.startsWith("https://t.me/") && !value.startsWith("tg://")) {
        return tr(
          "Посилання має починатися з https://t.me/ або tg://",
          "Link must start with https://t.me/ or tg://",
          "Ссылка должна начинаться с https://t.me/ или tg://"
        );
      }
      return url
        ? null
        : tr("Некоректне посилання", "Invalid link", "Некорректная ссылка");
    } catch {
      return tr("Некоректне посилання", "Invalid link", "Некорректная ссылка");
    }
  };

  const openHashtagEditModal = (tag: string) => {
    const meta = getHashtagMetaItem(tag);
    setHashtagEditTag(tag);
    setHashtagEditName(tag);
    setHashtagEditLink(meta?.link ?? "");
    setHashtagEditErrors([]);
    setIsHashtagEditOpen(true);
  };

  const closeHashtagEditModal = () => {
    setIsHashtagEditOpen(false);
    setHashtagEditTag("");
    setHashtagEditName("");
    setHashtagEditLink("");
    setHashtagEditErrors([]);
  };

  const handleDeleteHashtag = (tagToDelete: string) => {
    const normalized = normalizeHashtag(tagToDelete);
    if (!normalized) return;

    setAccounts((prevAccounts) => {
      const nextAccounts = prevAccounts.map((acc) => {
        const tags = getAccountHashtags(acc).filter((tag) => tag !== normalized);
        return { ...acc, hashtags: tags };
      });
      localStore.saveAccounts(nextAccounts);
      const scopeKey = localStore.getSettings().telegramFolderPath || "";
      if (scopeKey) {
        localStore.syncAccountMetaFromAccounts(scopeKey, nextAccounts);
      }
      return nextAccounts;
    });

    saveHashtagMeta(hashtagMeta.filter((item) => normalizeHashtag(item.tag) !== normalized));
    if (hashtagFilter === normalized) {
      setHashtagFilter("all");
    }
    logAction(tr(`Видалено хештег #${normalized}`, `Removed hashtag #${normalized}`, `Удален хештег #${normalized}`));
  };

  const handleSaveHashtagEdit = () => {
    const nextTag = normalizeHashtag(hashtagEditName);
    const errors: string[] = [];

    if (!nextTag) {
      errors.push(tr("Вкажіть назву хештегу", "Enter hashtag name", "Укажите название хештега"));
    }

    const linkError = validateHashtagLink(hashtagEditLink);
    if (linkError) {
      errors.push(linkError);
    }

    if (errors.length > 0) {
      setHashtagEditErrors(errors);
      return;
    }

    const prevTag = normalizeHashtag(hashtagEditTag);
    const nextLink = hashtagEditLink.trim();

    if (prevTag && prevTag !== nextTag) {
      setAccounts((prevAccounts) => {
        const nextAccounts = prevAccounts.map((acc) => {
          const tags = getAccountHashtags(acc);
          if (!tags.includes(prevTag)) return acc;
          const merged = Array.from(new Set(tags.map((tag) => (tag === prevTag ? nextTag : tag))));
          return { ...acc, hashtags: merged };
        });
        localStore.saveAccounts(nextAccounts);
        const scopeKey = localStore.getSettings().telegramFolderPath || "";
        if (scopeKey) {
          localStore.syncAccountMetaFromAccounts(scopeKey, nextAccounts);
        }
        return nextAccounts;
      });

      if (hashtagFilter === prevTag) {
        setHashtagFilter(nextTag);
      }
    }

    const nextMeta = hashtagMeta
      .filter((item) => {
        const key = normalizeHashtag(item.tag);
        return key !== prevTag && key !== nextTag;
      })
      .concat([{ tag: nextTag, link: nextLink }]);
    saveHashtagMeta(nextMeta);
    logAction(
      tr(
        `Оновлено хештег #${prevTag || nextTag}`,
        `Updated hashtag #${prevTag || nextTag}`,
        `Обновлен хештег #${prevTag || nextTag}`
      )
    );
    closeHashtagEditModal();
  };

  // Function to toggle account open/close
  const handleToggleAccount = async (accountId: number) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;

    const settings = localStore.getSettings();
    const folderPath = settings.telegramFolderPath || "";

    if (!folderPath) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          "Спочатку вкажіть шлях до папки в налаштуваннях",
          "First set the folder path in settings",
          "Сначала укажите путь к папке в настройках"
        ),
        variant: "destructive",
      });
      return;
    }

    const profileId = extractProfileId(account);
    if (!profileId) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          `Не вдалося визначити номер профілю для ${account.name}`,
          `Failed to detect profile number for ${account.name}`,
          `Не удалось определить номер профиля для ${account.name}`
        ),
        variant: "destructive",
      });
      return;
    }

    try {
      if (openAccounts.has(accountId)) {
        const pid = openAccounts.get(accountId)!;
        await closeTelegramProcesses([pid]);
        setOpenAccounts((prev) => {
          const next = new Map(prev);
          next.delete(accountId);
          return next;
        });
      } else {
        const pid = await launchSingleAccount(profileId, folderPath) as number;
        setOpenAccounts((prev) => {
          const next = new Map(prev);
          next.set(accountId, pid);
          return next;
        });
      }

      await loadRealStats();
    } catch (error) {
      console.error(`Failed to toggle account ${account.name}:`, error);
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          `Не вдалося ${openAccounts.has(accountId) ? "закрити" : "відкрити"} акаунт`,
          `Failed to ${openAccounts.has(accountId) ? "close" : "open"} account`,
          `Не удалось ${openAccounts.has(accountId) ? "закрыть" : "открыть"} аккаунт`
        ),
        variant: "destructive",
      });
    }
  };

  const accountsWithMeta = useMemo(
    () =>
      [...accounts].map((account) => ({
        ...account,
        effectiveStatus: getEffectiveStatus(account),
        hashtags: getAccountHashtags(account),
      })),
    [accounts, accountStatusOverrides]
  );

  const hashtagOptions = useMemo(
    () =>
      Array.from(new Set(accountsWithMeta.flatMap((account) => account.hashtags || []))).sort((a, b) =>
        String(a).localeCompare(String(b), locale, { sensitivity: "base", numeric: true })
      ),
    [accountsWithMeta]
  );

  useEffect(() => {
    if (hashtagFilter !== "all" && !hashtagOptions.includes(hashtagFilter)) {
      setHashtagFilter("all");
    }
  }, [hashtagFilter, hashtagOptions]);

  const normalizedAccountSearch = normalizeText(accountSearch);
  const notesFilterValue = "__with_notes__";

  // Filter accounts based on selected status + hashtag
  const filteredAccounts = accountsWithMeta
    .filter((account) => {
      const byStatus = accountFilter === "all" || account.effectiveStatus === accountFilter;
      const byHashtag =
        hashtagFilter === "all" || (account.hashtags as string[]).includes(hashtagFilter);
      return byStatus && byHashtag;
    })
    .sort((a, b) => {
      const aProfile = extractProfileId(a);
      const bProfile = extractProfileId(b);

      if (aProfile !== null && bProfile !== null) {
        return aProfile - bProfile;
      }
      if (aProfile !== null) return -1;
      if (bProfile !== null) return 1;

      const aName = String(a?.name || "");
      const bName = String(b?.name || "");
      return aName.localeCompare(bName, locale, { numeric: true, sensitivity: "base" });
    });

  const visibleAccounts = filteredAccounts.filter((account) => {
    if (notesFilter === "with" && !hasUserNotes(account)) return false;
    if (!normalizedAccountSearch) return true;
    const combined = `${account?.displayName ?? ""} ${account?.name ?? ""} ${account?.notes ?? ""}`;
    const searchText = normalizeText(combined);
    return searchText.includes(normalizedAccountSearch);
  });
  const allProfileIds = useMemo(() => getAllProfileIds(), [accounts]);
  const filteredProfileIds = useMemo(
    () =>
      filteredAccounts
        .map((account) => extractProfileId(account))
        .filter((id): id is number => Number.isFinite(id)),
    [filteredAccounts]
  );
  const selectedHashtagMeta = useMemo(
    () => (hashtagFilter !== "all" ? getHashtagMetaItem(hashtagFilter) : null),
    [hashtagFilter, hashtagMeta]
  );

  // Calculate stats based on filter
  const stats = {
    total: filteredAccounts.length,
    running: filteredAccounts.filter(a => a.effectiveStatus === accountStatus.active).length,
    blocked: filteredAccounts.filter(a => a.effectiveStatus === accountStatus.blocked).length
  };

  // Keep widget stats global; account list itself is filtered by accountFilter.
  const displayStats = realStats;

  const handleLaunchByHashtagFilter = async () => {
    if (!selectedHashtagMeta?.link) return;

    const settings = localStore.getSettings();
    if (!settings.telegramFolderPath) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          "Спочатку вкажіть шлях до папки в налаштуваннях",
          "First set the folder path in settings",
          "Сначала укажите путь к папке в настройках"
        ),
        variant: "destructive",
      });
      return;
    }

    if (filteredProfileIds.length === 0) {
      toast({
        title: tr("Немає акаунтів", "No accounts", "Нет аккаунтов"),
        description: tr(
          "Не вдалося знайти номери TG профілів для цього фільтру",
          "Failed to find TG profile numbers for this filter",
          "Не удалось найти номера TG профилей для этого фильтра"
        ),
        variant: "destructive",
      });
      return;
    }

    let launchParams: TelegramLaunchParams;
    try {
      const parsed = parseTelegramLinkFromUrl(selectedHashtagMeta.link);
      launchParams = toLaunchParams(parsed, `#${hashtagFilter}`, isMix ? "yes" : "no");
    } catch (error) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          "Некоректне посилання у хештезі",
          "Invalid link in hashtag",
          "Некорректная ссылка в хештеге"
        ),
        variant: "destructive",
      });
      return;
    }

    setIsLaunching(true);
    setLaunchMode("project");
    const hashtagProjectName = `#${hashtagFilter}`;
    const minProfile = Math.min(...filteredProfileIds);
    const maxProfile = Math.max(...filteredProfileIds);
    setSelectedProject(hashtagProjectName);
    setStartRange(String(minProfile));
    setEndRange(String(maxProfile));

    try {
      const size = readTelegramBatchSize();
      const firstBatch = filteredProfileIds.slice(0, size);
      const remaining = filteredProfileIds.slice(size);

      setBatchSize(size);
      setPendingProfiles(remaining);
      setLaunchParams(launchParams);
      setTotalProfiles(filteredProfileIds.length);
      setLaunchProgressCount(0);
      batchBaseCountRef.current = 0;
      lastBatchProfileIdsRef.current = firstBatch;

      const pids = await launchAccountsForProfiles(
        launchParams,
        firstBatch,
        settings.telegramFolderPath
      ) as number[];

      let effectivePids = pids;
      try {
        const actualPids = await getTelegramPidsForAccounts(firstBatch);
        if (actualPids.length > 0) {
          effectivePids = actualPids;
        }
      } catch (error) {
        console.warn("Failed to resolve actual Telegram PIDs:", error);
      }
      setLaunchedPids(effectivePids);
      setLaunchProgressCount((prev) => Math.max(prev, pids.length));

      toast({
        title: tr("Запуск виконано", "Launch completed", "Запуск выполнен"),
        description: tr(
          `Запущено ${pids.length} акаунтів. Натисніть F6 для продовження.`,
          `Launched ${pids.length} accounts. Press F6 to continue.`,
          `Запущено ${pids.length} аккаунтов. Нажмите F6 для продолжения.`
        ),
      });
    } catch (error) {
      console.error("Launch hashtag error:", error);
      toast({
        title: tr("Помилка запуску", "Launch error", "Ошибка запуска"),
        description: tr(
          `Не вдалося запустити акаунти: ${error}`,
          `Failed to launch accounts: ${error}`,
          `Не удалось запустить аккаунты: ${error}`
        ),
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  // Force black background
  useEffect(() => {
    document.body.style.backgroundColor = '#000000';
    document.body.style.backgroundImage = 'none';
    document.body.style.background = '#000000';
    
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = '';
      document.body.style.background = '';
    };
  }, []);

  // Handle F6 key press for continuing launch via custom event
  useEffect(() => {
    const handleF6Pressed = () => {
      console.log('F6 custom event received, launchedPids:', launchedPids.length);
      if (launchedPids.length > 0 || pendingProfiles.length > 0) {
        handleContinueLaunch();
      }
    };

    window.addEventListener('f6-pressed', handleF6Pressed);
    return () => window.removeEventListener('f6-pressed', handleF6Pressed);
  }, [launchedPids, pendingProfiles]);

  const handleLaunch = async () => {
    cancelLaunchRef.current = false;
    if (!selectedProject) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr("Оберіть проєкт перед запуском", "Select a project before launching", "Выберите проект перед запуском"),
        variant: "destructive",
      });
      return;
    }

    if (!startRange || !endRange) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr("Вкажіть початок і кінець діапазону", "Enter range start and end", "Укажите начало и конец диапазона"),
        variant: "destructive",
      });
      return;
    }

    const start = parseInt(startRange);
    const end = parseInt(endRange);

    if (start > end) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          "Початок діапазону не може бути більшим за кінець",
          "Range start cannot be greater than range end",
          "Начало диапазона не может быть больше конца"
        ),
        variant: "destructive",
      });
      return;
    }

    // Get saved settings to get telegram folder path
    const settings = localStore.getSettings();
    if (!settings.telegramFolderPath) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          "Спочатку вкажіть шлях до папки в налаштуваннях",
          "First set the folder path in settings",
          "Сначала укажите путь к папке в настройках"
        ),
        variant: "destructive",
      });
      return;
    }

    setIsLaunching(true);
    setLaunchMode("project");

    try {
      let projectName = "";
      let linkParams: ProjectData | TelegramLink | null = null;

      if (selectedProject === "custom") {
        if (!customLink) {
          throw new Error("Custom link is missing");
        }
        projectName = customLink.app_name || "custom";
        linkParams = customLink;
      } else {
        const selectedLink = availableLinks.find(([name]) => name === selectedProject);
        if (!selectedLink) {
          throw new Error("Selected project not found");
        }
        [projectName, linkParams] = selectedLink;
      }
      
      lastLaunchProjectRef.current = projectName;

      // Handle custom link differently
      let launchParams: TelegramLaunchParams;
      console.log('Debug - projectName:', projectName);
      console.log('Debug - linkParams:', linkParams);
      console.log('Debug - availableLinks:', availableLinks);
      
      if (!linkParams) {
        throw new Error("Selected project params missing");
      }

      // Always use the parsed app_name and app_type from linkParams
      launchParams = toLaunchParams(linkParams, projectName, isMix ? "yes" : "no");
      console.log('Debug - launchParams:', launchParams);
      
      console.log('Launching batch:', {
        projectName,
        ref_link: linkParams.ref_link,
        start,
        end,
        telegramFolderPath: settings.telegramFolderPath
      });

      const size = readTelegramBatchSize();
      const allProfiles = buildProfileList(start, end, isMix);
      const firstBatch = allProfiles.slice(0, size);
      const remaining = allProfiles.slice(size);

      setBatchSize(size);
      setPendingProfiles(remaining);
      setLaunchParams(launchParams);
      setTotalProfiles(allProfiles.length);
      setLaunchProgressCount(0);
      batchBaseCountRef.current = 0;
      lastBatchProfileIdsRef.current = firstBatch;

      const pids = await launchAccountsForProfiles(
        launchParams,
        firstBatch,
        settings.telegramFolderPath
      ) as number[];

      if (cancelLaunchRef.current) {
        if (pids.length > 0) {
          await closeTelegramProcesses(pids);
        }
        return;
      }
      
      let effectivePids = pids;
      try {
        const actualPids = await getTelegramPidsForAccounts(firstBatch);
        if (actualPids.length > 0) {
          effectivePids = actualPids;
        }
      } catch (error) {
        console.warn("Failed to resolve actual Telegram PIDs:", error);
      }
      setLaunchedPids(effectivePids);
      setLaunchProgressCount((prev) => Math.max(prev, pids.length));
      logAction(tr(`Запущено ${projectName}`, `Launched ${projectName}`, `Запущено ${projectName}`));
      
      toast({
        title: tr("Запуск виконано", "Launch completed", "Запуск выполнен"),
        description: tr(
          `Запущено ${pids.length} акаунтів. Натисніть F6 для продовження.`,
          `Launched ${pids.length} accounts. Press F6 to continue.`,
          `Запущено ${pids.length} аккаунтов. Нажмите F6 для продолжения.`
        ),
      });

    } catch (error) {
      console.error('Launch error:', error);
      toast({
        title: tr("Помилка запуску", "Launch error", "Ошибка запуска"),
        description: tr(
          `Не вдалося запустити акаунти: ${error}`,
          `Failed to launch accounts: ${error}`,
          `Не удалось запустить аккаунты: ${error}`
        ),
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  // Function to handle project selection
  const handleProjectChange = (value: string) => {
    if (value === "__none__") {
      setSelectedProject("");
      setLaunchParams(null);
      setStartRange("");
      setEndRange("");
    } else if (value === "custom") {
      // Show custom link modal instead of prompt
      setIsCustomLinkModalOpen(true);
    } else {
      setSelectedProject(value);
    }
  };

  const launchPlainProfiles = async (profileIds: number[], baseCount: number, telegramFolderPath: string) => {
    const launched: number[] = [];
    for (let i = 0; i < profileIds.length; i += 1) {
      if (cancelLaunchRef.current) {
        break;
      }
      try {
        const pid = await launchSingleAccount(profileIds[i], telegramFolderPath);
        if (Number.isFinite(pid)) {
          launched.push(pid as number);
        }
      } catch (error) {
        console.warn("Failed to launch account:", profileIds[i], error);
      }
      if (!cancelLaunchRef.current) {
        setLaunchProgressCount((prev) => {
          const next = baseCount + i + 1;
          return next > prev ? next : prev;
        });
      }
    }
    return launched;
  };

  const handleLaunchAllAccounts = async () => {
    const settings = localStore.getSettings();
    if (!settings.telegramFolderPath) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr(
          "Спочатку вкажіть шлях до папки в налаштуваннях",
          "First set the folder path in settings",
          "Сначала укажите путь к папке в настройках"
        ),
        variant: "destructive",
      });
      return;
    }

    const allProfiles = getAllProfileIds();
    if (allProfiles.length === 0) {
      toast({
        title: tr("Немає акаунтів", "No accounts", "Нет аккаунтов"),
        description: tr(
          "Не вдалося знайти номери TG профілів у списку акаунтів",
          "Failed to find TG profile numbers in account list",
          "Не удалось найти номера TG профилей в списке аккаунтов"
        ),
        variant: "destructive",
      });
      return;
    }

    setIsLaunching(true);
    setLaunchMode("plain");

    try {
      const size = readTelegramBatchSize();
      const firstBatch = allProfiles.slice(0, size);
      const remaining = allProfiles.slice(size);

      setBatchSize(size);
      setPendingProfiles(remaining);
      setLaunchParams(null);
      setTotalProfiles(allProfiles.length);
      setLaunchProgressCount(0);
      batchBaseCountRef.current = 0;
      lastBatchProfileIdsRef.current = firstBatch;

      const pids = await launchPlainProfiles(firstBatch, 0, settings.telegramFolderPath);

      let effectivePids = pids;
      try {
        const actualPids = await getTelegramPidsForAccounts(firstBatch);
        if (actualPids.length > 0) {
          effectivePids = actualPids;
        }
      } catch (error) {
        console.warn("Failed to resolve actual Telegram PIDs:", error);
      }
      setLaunchedPids(effectivePids);
      setLaunchProgressCount((prev) => Math.max(prev, pids.length));
      logAction(
        tr(
          `Запущено ${pids.length} акаунтів (усі)`,
          `Launched ${pids.length} accounts (all)`,
          `Запущено ${pids.length} аккаунтов (все)`
        )
      );

      toast({
        title: tr("Запуск виконано", "Launch completed", "Запуск выполнен"),
        description: tr(
          `Запущено ${pids.length} акаунтів. Натисніть F6 для продовження.`,
          `Launched ${pids.length} accounts. Press F6 to continue.`,
          `Запущено ${pids.length} аккаунтов. Нажмите F6 для продолжения.`
        ),
      });
    } catch (error) {
      console.error("Launch all error:", error);
      toast({
        title: tr("Помилка запуску", "Launch error", "Ошибка запуска"),
        description: tr(
          `Не вдалося запустити акаунти: ${error}`,
          `Failed to launch accounts: ${error}`,
          `Не удалось запустить аккаунты: ${error}`
        ),
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const parseTelegramLinkFromUrl = (customUrl: string): TelegramLink => {
    let app_name = "";
    let app_type = "";
    let ref_link = "";

    if (customUrl.startsWith("tg://")) {
      const url = new URL(customUrl);
      app_name = url.searchParams.get("domain") || "";
      app_type = url.searchParams.get("appname") || "";
      ref_link = url.searchParams.get("startapp") || url.searchParams.get("start") || "";
    } else {
      const url = new URL(customUrl);
      const pathParts = url.pathname.split("/").filter((p) => p);

      if (pathParts.length >= 2) {
        app_name = pathParts[pathParts.length - 2];
        app_type = pathParts[pathParts.length - 1];
      } else if (pathParts.length >= 1) {
        app_name = pathParts[0];
      }

      const searchParams = new URLSearchParams(url.search);
      ref_link = searchParams.get("startapp") || searchParams.get("start") || "";
    }

    return {
      api_id: "",
      api_hash: "",
      phone: "",
      app_name,
      app_type,
      ref_link,
      mixed: "yes",
    };
  };

  // Function to handle custom link submission
  const handleCustomLinkSubmit = (customUrl: string) => {
    try {
      const customProject = parseTelegramLinkFromUrl(customUrl);
      
      setCustomLink(customProject);
      setSelectedProject("custom");
      window.setTimeout(() => {
        const startInput = document.getElementById("start-range-input") as HTMLInputElement | null;
        if (startInput) {
          startInput.focus();
          startInput.select();
        }
      }, 160);
      logAction(
        tr(
          `Запущено своє посилання ${customProject.app_name || "custom"}`,
          `Launched custom link ${customProject.app_name || "custom"}`,
          `Запущена своя ссылка ${customProject.app_name || "custom"}`
        )
      );
      
      toast({
        title: tr("Кастомне посилання додано", "Custom link added", "Кастомная ссылка добавлена"),
        description: tr(
          "Посилання застосовано (не зберігається)",
          "Link applied (not saved)",
          "Ссылка применена (не сохраняется)"
        ),
      });
    } catch (error) {
      toast({
        title: tr("Помилка", "Error", "Ошибка"),
        description: tr("Некоректне посилання", "Invalid link", "Некорректная ссылка"),
        variant: "destructive",
      });
    }
  };

  // Function to add a new project
  const handleAddProject = () => {
    setIsProjectSelectOpen(false);
    setModalMode('add');
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const toLaunchParams = (
    source: ProjectData | TelegramLink | TelegramLaunchParams,
    fallbackName: string,
    mixed: "yes" | "no"
  ): TelegramLaunchParams => ({
    api_id: "api_id" in source && typeof source.api_id === "string" ? source.api_id : "",
    api_hash: "api_hash" in source && typeof source.api_hash === "string" ? source.api_hash : "",
    phone: "phone" in source && typeof source.phone === "string" ? source.phone : "",
    app_name: source.app_name || fallbackName,
    app_type: source.app_type || "",
    ref_link: source.ref_link || "",
    mixed,
  });

  // Function to edit a project
  const handleEditProject = (projectName: string, projectData: ProjectData) => {
    setIsProjectSelectOpen(false);
    setModalMode('edit');
    // Pass the actual project data for editing
    setEditingProject({
      name: projectName,
      ref_link: projectData.ref_link || ""
    });
    setIsModalOpen(true);
  };

  // Function to delete a project
  const handleDeleteProject = (projectName: string) => {
    setIsProjectSelectOpen(false);
    // Delete from projectStorage
    const success = projectStorage.deleteProject(projectName);
    
    if (success) {
      // Update state
      setAvailableLinks(prev => prev.filter(([name]) => name !== projectName));
      
      // If deleted project was selected, clear selection
      if (selectedProject === projectName) {
        setSelectedProject("");
      }
      
      toast({
        title: tr("Проєкт видалено", "Project deleted", "Проект удален"),
        description: tr(
          `Проєкт ${projectName} успішно видалено`,
          `Project ${projectName} deleted successfully`,
          `Проект ${projectName} успешно удален`
        ),
        variant: "destructive",
      });
      logAction(tr(`Видалено проєкт ${projectName}`, `Deleted project ${projectName}`, `Удален проект ${projectName}`));
    } else {
      toast({
        title: tr("Помилка видалення", "Delete error", "Ошибка удаления"),
        description: tr(
          `Не вдалося видалити проєкт ${projectName}`,
          `Failed to delete project ${projectName}`,
          `Не удалось удалить проект ${projectName}`
        ),
        variant: "destructive",
      });
    }
  };

  // Function to save project (from modal)
  const handleSaveProject = (project: { name: string; ref_link: string }) => {
    console.log('handleSaveProject called with:', project);
    
    // Parse ref_link to extract app_name and app_type like custom links
    let app_name = project.name;
    let app_type = "";
    
    if (project.ref_link) {
      try {
        // Handle both tg:// and https://t.me/ links
        if (project.ref_link.startsWith('tg://')) {
          const url = new URL(project.ref_link);
          app_name = url.searchParams.get('domain') || project.name;
          app_type = url.searchParams.get('appname') || "";
        } else {
          const url = new URL(project.ref_link);
          const pathParts = url.pathname.split('/').filter(p => p);
          
          if (pathParts.length >= 2) {
            app_name = pathParts[pathParts.length - 2];
            app_type = pathParts[pathParts.length - 1];
          } else if (pathParts.length >= 1) {
            app_name = pathParts[0];
          }
        }
      } catch (error) {
        console.log('Could not parse ref_link URL, using defaults:', error);
      }
    }
    
    console.log('Parsed app_name:', app_name, 'app_type:', app_type);
    
    // Create simplified project data that matches Python script requirements
    const fullProject: ProjectData = {
      name: project.name,
      ref_link: project.ref_link || "",
      app_name: app_name,
      app_type: app_type,
      mixed: ""
    };
    
    console.log('Full project data to save:', fullProject);
    
    if (modalMode === 'add') {
      const success = projectStorage.addProject(fullProject);
      
      if (success) {
        // Update state
        setAvailableLinks(prev => [...prev, [project.name, fullProject]]);
        logAction(tr(`Додано проєкт ${project.name}`, `Added project ${project.name}`, `Добавлен проект ${project.name}`));
      } else {
        toast({
          title: tr("Помилка збереження", "Save error", "Ошибка сохранения"),
          description: tr(
            "Проєкт з такою назвою вже існує",
            "A project with this name already exists",
            "Проект с таким именем уже существует"
          ),
          variant: "destructive",
        });
      }
    } else {
      const oldName = editingProject?.name || project.name;
      const success = projectStorage.updateProject(oldName, fullProject);
      
      if (success) {
        // Update state
        setAvailableLinks(prev => 
          prev.map(([name, data]) => 
            name === oldName ? [project.name, fullProject] : [name, data]
          )
        );
        
        // If name changed and it was selected, update selection
        if (oldName !== project.name && selectedProject === oldName) {
          setSelectedProject(project.name);
        }
        logAction(
          tr(
            `Оновлено проєкт ${oldName} -> ${project.name}`,
            `Updated project ${oldName} -> ${project.name}`,
            `Обновлен проект ${oldName} -> ${project.name}`
          )
        );
      } else {
        toast({
          title: tr("Помилка збереження", "Save error", "Ошибка сохранения"),
          description: tr(
            "Не вдалося оновити проєкт",
            "Failed to update project",
            "Не удалось обновить проект"
          ),
          variant: "destructive",
        });
      }
    }
  };

  // Function to continue batch launch (simulate F6 press)
  const handleContinueLaunch = async () => {
    cancelLaunchRef.current = false;
    try {
      const hasNext = pendingProfiles.length > 0;

      setIsLaunching(true);

      if (launchedPids.length > 0) {
        const closingPids = [...launchedPids];
        await closeTelegramProcesses(closingPids);
        if (lastBatchProfileIdsRef.current.length > 0) {
          try {
            await closeTelegramAccountsBatch(lastBatchProfileIdsRef.current);
          } catch (error) {
            console.warn("Failed to close batch accounts:", error);
          }
        }
        try {
          const running = await getRunningTelegramProcesses() as TelegramProcess[];
          const runningSet = new Set<number>(
            running
              .map((p) => Number(p?.pid))
              .filter((pid: number) => Number.isFinite(pid))
          );
          const stillRunning = closingPids.filter((pid) => runningSet.has(pid));
          if (stillRunning.length > 0) {
            toast({
              title: tr("Не всі акаунти закрито", "Not all accounts were closed", "Не все аккаунты закрыты"),
              description: tr(
                "Деякі процеси залишилися. Можливо, вони поза шляхом з налаштувань або Telegram не відповів.",
                "Some processes are still running. They may be outside the configured path or Telegram did not respond.",
                "Некоторые процессы остались. Возможно, они вне пути из настроек или Telegram не ответил."
              ),
            });
          }
        } catch (error) {
          console.warn("Failed to verify closed Telegram processes:", error);
        }
        setLaunchedPids([]);
      }

      if (!hasNext) {
        const activeProjectName = lastLaunchProjectRef.current || launchParams?.app_name || selectedProject || "";
        setPendingProfiles([]);
        setLaunchParams(null);
        setLaunchMode(null);
        setBatchSize(1);
        setTotalProfiles(0);
        setLaunchProgressCount(0);
        setLaunchProgressCount(0);
        localStore.clearTelegramLaunchState();
        lastBatchProfileIdsRef.current = [];

        // Reset all form fields to initial state
        setSelectedProject("");
        setStartRange("");
        setEndRange("");
        setIsMix(true);

        toast({
          title: tr("Пакет завершено", "Batch finished", "Пакет завершен"),
          description: tr(
            "Усі запущені Telegram процеси закрито",
            "All launched Telegram processes were closed",
            "Все запущенные процессы Telegram закрыты"
          ),
        });
        if (activeProjectName) {
          logAction(tr(`Завершено ${activeProjectName}`, `Finished ${activeProjectName}`, `Завершено ${activeProjectName}`));
        } else {
          logAction(tr("Завершено запуск", "Launch finished", "Запуск завершен"));
        }
        return;
      }

      const settings = localStore.getSettings();
      if (!settings.telegramFolderPath) {
        toast({
          title: tr("Помилка", "Error", "Ошибка"),
          description: tr(
            "Спробуйте ще раз після збереження шляху до Telegram",
            "Try again after saving Telegram path",
            "Попробуйте снова после сохранения пути к Telegram"
          ),
          variant: "destructive",
        });
        return;
      }

      const size = batchSize > 0 ? batchSize : readTelegramBatchSize();
      const baseCount = totalProfiles > 0 ? Math.max(0, totalProfiles - pendingProfiles.length) : launchProgressCount;
      batchBaseCountRef.current = baseCount;
      setLaunchProgressCount(baseCount);
      const nextBatch = pendingProfiles.slice(0, size);
      const remaining = pendingProfiles.slice(size);

      if (nextBatch.length === 0) {
        setPendingProfiles([]);
        setLaunchParams(null);
        setLaunchMode(null);
        setBatchSize(1);
        setTotalProfiles(0);
        setLaunchProgressCount(0);
        localStore.clearTelegramLaunchState();
        lastBatchProfileIdsRef.current = [];
        toast({
          title: tr("Пакет завершено", "Batch finished", "Пакет завершен"),
          description: tr(
            "Усі запущені Telegram процеси закрито",
            "All launched Telegram processes were closed",
            "Все запущенные процессы Telegram закрыты"
          ),
        });
        return;
      }

      let pids: number[] = [];
      if (launchMode === "plain") {
        pids = await launchPlainProfiles(nextBatch, baseCount, settings.telegramFolderPath);
      } else {
        let params = launchParams;
        if (!params && selectedProject) {
          if (selectedProject === "custom") {
            if (customLink) {
              params = toLaunchParams(customLink, "custom", isMix ? "yes" : "no");
              setLaunchParams(params);
              setLaunchMode("project");
            }
          } else {
            const selectedLink = availableLinks.find(([name]) => name === selectedProject);
            if (selectedLink) {
              const [projectName, linkParams] = selectedLink;
              params = toLaunchParams(linkParams, projectName, isMix ? "yes" : "no");
              setLaunchParams(params);
              setLaunchMode("project");
            }
          }
        }

        if (!params) {
          toast({
            title: tr("Помилка", "Error", "Ошибка"),
            description: tr(
              "Неможливо відновити параметри запуску",
              "Unable to restore launch parameters",
              "Невозможно восстановить параметры запуска"
            ),
            variant: "destructive",
          });
          return;
        }

        pids = await launchAccountsForProfiles(
          params,
          nextBatch,
          settings.telegramFolderPath
        ) as number[];
      }

      if (cancelLaunchRef.current) {
        if (pids.length > 0) {
          await closeTelegramProcesses(pids);
        }
        return;
      }

      let effectivePids = pids;
      try {
        const actualPids = await getTelegramPidsForAccounts(nextBatch);
        if (actualPids.length > 0) {
          effectivePids = actualPids;
        }
      } catch (error) {
        console.warn("Failed to resolve actual Telegram PIDs:", error);
      }
      setLaunchedPids(effectivePids);
      setPendingProfiles(remaining);
      setLaunchProgressCount((prev) => Math.max(prev, baseCount + pids.length));
      lastBatchProfileIdsRef.current = nextBatch;

      toast({
        title: tr("Продовження запуску", "Launch continuation", "Продолжение запуска"),
        description: tr(
          `Запущено ${pids.length} акаунтів. Залишилось ${remaining.length}.`,
          `Launched ${pids.length} accounts. Remaining ${remaining.length}.`,
          `Запущено ${pids.length} аккаунтов. Осталось ${remaining.length}.`
        ),
      });
    } catch (error) {
      console.error('Error closing processes:', error);
      toast({
        title: tr("Помилка завершення", "Finish error", "Ошибка завершения"),
        description: tr(
          `Не вдалося закрити процеси: ${error}`,
          `Failed to close processes: ${error}`,
          `Не удалось закрыть процессы: ${error}`
        ),
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleCloseAllOpenedAccounts = async () => {
    cancelLaunchRef.current = true;
    const pids = Array.from(new Set([
      ...Array.from(openAccounts.values()),
      ...launchedPids,
    ]));
    const accountIds = Array.from(new Set([
      ...Array.from(openAccounts.keys()),
      ...lastBatchProfileIdsRef.current,
    ]));
    const activeProjectName = lastLaunchProjectRef.current || launchParams?.app_name || selectedProject || "";

    const hasAnyToReset =
      isLaunching ||
      pendingProfiles.length > 0 ||
      launchedPids.length > 0 ||
      openAccounts.size > 0;

    if (pids.length === 0 && !hasAnyToReset) {
      toast({
        title: tr("Немає відкритих акаунтів", "No open accounts", "Нет открытых аккаунтов"),
        description: tr(
          "Зараз немає процесів для закриття",
          "There are no processes to close now",
          "Сейчас нет процессов для закрытия"
        ),
      });
      return;
    }

    try {
      if (pids.length > 0) {
        await closeTelegramProcesses(pids);
      }
      if (accountIds.length > 0) {
        try {
          await closeTelegramAccountsBatch(accountIds);
        } catch (error) {
          console.warn("Failed to close accounts batch:", error);
        }
      }
      setOpenAccounts(new Map());
      setLaunchedPids([]);
      setPendingProfiles([]);
      setSelectedProject("");
      setStartRange("");
      setEndRange("");
      setLaunchParams(null);
      setLaunchMode(null);
      setBatchSize(1);
      setTotalProfiles(0);
      setLaunchProgressCount(0);
      setIsLaunching(false);
      lastBatchProfileIdsRef.current = [];
      localStore.clearTelegramLaunchState();
      await loadRealStats();

      toast({
        title: pids.length > 0
          ? tr("Усі акаунти закрито", "All accounts are closed", "Все аккаунты закрыты")
          : tr("Запуск зупинено", "Launch stopped", "Запуск остановлен"),
        description: pids.length > 0
          ? tr(`Завершено ${pids.length} процесів`, `Closed ${pids.length} processes`, `Завершено ${pids.length} процессов`)
          : tr("Черга запуску очищена", "Launch queue cleared", "Очередь запуска очищена"),
      });
      if (activeProjectName) {
        logAction(tr(`Завершено ${activeProjectName}`, `Finished ${activeProjectName}`, `Завершено ${activeProjectName}`));
      } else if (hasAnyToReset) {
        logAction(tr("Завершено запуск", "Launch finished", "Запуск завершен"));
      }
    } catch (error) {
      console.error("Failed to close all opened accounts:", error);
      toast({
        title: tr("Помилка закриття", "Close error", "Ошибка закрытия"),
        description: tr(
          "Не вдалося завершити всі процеси",
          "Failed to finish all processes",
          "Не удалось завершить все процессы"
        ),
        variant: "destructive",
      });
    }
  };

  const isBatchActive =
    (isLaunching && totalProfiles > 0) ||
    launchedPids.length > 0 ||
    pendingProfiles.length > 0;
  const totalProfilesCount = totalProfiles > 0 ? totalProfiles : (pendingProfiles.length + launchedPids.length);
  const launchedCount = totalProfilesCount > 0 ? Math.min(totalProfilesCount, Math.max(0, launchProgressCount)) : 0;
  const progressValue = totalProfilesCount > 0 ? Math.round((launchedCount / totalProfilesCount) * 100) : 0;
  const segmentCount = totalProfilesCount > 0 ? Math.min(36, totalProfilesCount) : 36;

  const hasClosableAccounts = openAccounts.size > 0 || launchedPids.length > 0 || pendingProfiles.length > 0;
  const canContinueBatch = !isLaunching && pendingProfiles.length > 0;
  const batchActionLabel = canContinueBatch
    ? tr("Продовжити", "Continue", "Продолжить")
    : tr("Завершити", "Finish", "Завершить");
  const batchActionHandler = canContinueBatch ? handleContinueLaunch : handleCloseAllOpenedAccounts;

  // Auto-clear selection once a batch finishes and all accounts are closed manually.
  const batchActiveRef = useRef(false);
  useEffect(() => {
    const isActiveNow = isBatchActive || openAccounts.size > 0;
    if (batchActiveRef.current && !isActiveNow && launchMode) {
      setSelectedProject("");
      setStartRange("");
      setEndRange("");
      setLaunchParams(null);
      setLaunchMode(null);
      setBatchSize(1);
      setTotalProfiles(0);
      setLaunchProgressCount(0);
      setLaunchedPids([]);
      setPendingProfiles([]);
      localStore.clearTelegramLaunchState();
    }
    batchActiveRef.current = isActiveNow;
  }, [isBatchActive, openAccounts, launchMode]);

  return (
    <div className="h-full min-h-0 bg-transparent text-white flex flex-col overflow-hidden">
      {/* Ambient background effects - removed for pure black background */}
      {/* <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div> */}

      <main className="relative z-10 w-full px-6 pb-6 telegram-content flex-1 overflow-y-auto">
        {/* Main content area */}
        <div className="flex flex-col gap-6">
          {/* Top row - Mass Launch, Stats and Recent Actions */}
          <div className="telegram-top-grid grid gap-6">
              {/* Left column - Mass Launch, Stats and Recent Actions */}
              <div className="flex flex-col gap-6">
              {/* Mass Launch Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="telegram-mass-launch-panel bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 lg:p-8 flex flex-col justify-between relative group w-full min-h-[360px] lg:min-h-[460px] overflow-hidden"
              >
                {/* Decorative background glow */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700 pointer-events-none" />

                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                  <Rocket className="text-primary w-6 h-6" />
                  {tr("Масовий запуск", "Mass launch", "Массовый запуск")}
                </h2>

                <div className="space-y-4 w-full">
                  <div className="space-y-2">
                    <Label className="text-sm font-normal text-muted-foreground">{tr("Проєкт", "Project", "Проект")}</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedProject}
                        onValueChange={handleProjectChange}
                        open={isProjectSelectOpen}
                        onOpenChange={setIsProjectSelectOpen}
                      >
                        <SelectTrigger className="bg-black/50 border-white/10 h-10 rounded-xl focus:ring-0 focus:ring-offset-0 focus:border-white/20 text-white flex-1">
                          <SelectValue placeholder={tr("Виберіть проєкт", "Select project", "Выберите проект")} />
                        </SelectTrigger>
                        <SelectContent
                          className="bg-black border-white/10 text-white min-w-[300px]"
                          onPointerLeave={() => setIsProjectSelectOpen(false)}
                        >
                          {selectedProject.startsWith("#") ? (
                            <SelectItem
                              key="__hashtag_project__"
                              value={selectedProject}
                              className="focus:bg-white/10 focus:text-white"
                            >
                              {selectedProject}
                            </SelectItem>
                          ) : null}
                          {selectedProject ? (
                            <SelectItem
                              key="__none__"
                              value="__none__"
                              className="focus:bg-white/10 focus:text-white text-muted-foreground"
                            >
                              {tr("Очистити вибір", "Clear selection", "Очистить выбор")}
                            </SelectItem>
                          ) : null}
                          <SelectItem 
                            key="custom" 
                            value="custom" 
                            className="focus:bg-primary/20 focus:text-white pr-20"
                          >
                            <div className="flex items-center w-full">
                              <span className="flex-1">{tr("Своє посилання", "Custom link", "Своя ссылка")}</span>
                            </div>
                          </SelectItem>
                          {availableLinks.map(([name, link]) => (
                            <div key={name} className="group relative">
                              <SelectItem 
                                key={name} 
                                value={name} 
                                className="focus:bg-primary/20 focus:text-white pr-20"
                              >
                                <div className="flex items-center w-full">
                                  <span className="flex-1">{name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {link.ref_link ? link.ref_link.substring(0, 30) + "..." : ""}
                                  </span>
                                </div>
                              </SelectItem>
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-white/10 text-white/70 hover:text-white"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEditProject(name, link);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-red-500/20 text-red-400/70 hover:text-red-400"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteProject(name);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLaunchAllAccounts}
                        disabled={isLaunching || allProfileIds.length === 0}
                        className={`h-10 px-3 border border-white/10 bg-transparent transition-all duration-200 flex-shrink-0 ${
                          allProfileIds.length > 0
                            ? "text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20"
                            : "text-white/30 cursor-default"
                        }`}
                        title={tr(
                          "Відкрити всі акаунти (за кількістю потоків)",
                          "Open all accounts (based on thread count)",
                          "Открыть все аккаунты (по количеству потоков)"
                        )}
                      >
                        {tr("Відкрити всі", "Open all", "Открыть все")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 border border-white/10 bg-transparent hover:bg-white/10 hover:text-white transition-all duration-200 flex-shrink-0"
                        onClick={handleAddProject}
                      >
                        <Plus className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-w-[18rem]">
                    <div className="space-y-2">
                      <Label className="text-sm font-normal text-muted-foreground">{tr("Початок", "Start", "Начало")}</Label>
                      <Input 
                        id="start-range-input"
                        type="number" 
                        placeholder="1" 
                        value={startRange}
                        onChange={(e) => setStartRange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Focus on end range input
                            const endInput = document.getElementById('end-range-input') as HTMLInputElement;
                            if (endInput) {
                              endInput.focus();
                            }
                          }
                        }}
                        className="bg-black/50 border-white/10 h-10 rounded-xl text-white font-mono transition-none focus:border-white/10 focus:ring-0 focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:outline-none" 
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
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Try to launch if all fields are filled
                            if (selectedProject && startRange && endRange && !isLaunching) {
                              handleLaunch();
                            }
                          }
                        }}
                        className="bg-black/50 border-white/10 h-10 rounded-xl text-white font-mono transition-none focus:border-white/10 focus:ring-0 focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 pt-1">
                    <Checkbox 
                      id="mix" 
                      checked={isMix}
                      onCheckedChange={(checked) => setIsMix(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-white w-5 h-5 rounded-md" 
                    />
                    <Label htmlFor="mix" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground">
                      {tr('Увімкнути режим "Мікс"', 'Enable "Mix" mode', 'Включить режим "Микс"')}
                    </Label>
                  </div>
                </div>

                <div className="mt-4 lg:mt-6 space-y-3">
                  {isBatchActive ? (
                    <div className="w-full space-y-1">
                      <div className="h-12 flex items-center gap-3">
                        <div className="min-w-0 flex-1 flex items-center gap-3">
                          <span className="text-[11px] tracking-[0.2em] text-muted-foreground/80 shrink-0">
                            {tr("Прогрес", "Progress", "Прогресс")}
                          </span>
                          <SegmentProgress
                            total={totalProfilesCount || segmentCount}
                            value={launchedCount}
                            segments={segmentCount}
                            className="py-1 flex-1"
                          />
                          <span className="text-xs text-primary/80 shrink-0">
                            {launchedCount}/{totalProfilesCount}
                          </span>
                        </div>
                        <Button
                          onClick={batchActionHandler}
                          className={`h-10 min-w-[120px] rounded-xl border-0 text-white font-semibold focus-visible:ring-0 ${
                            canContinueBatch ? "bg-primary hover:bg-primary/90" : "bg-zinc-800 hover:bg-zinc-700"
                          }`}
                        >
                          {batchActionLabel}
                        </Button>
                        {canContinueBatch ? (
                          <Button
                            onClick={handleCloseAllOpenedAccounts}
                            className="h-10 min-w-[120px] rounded-xl border border-white/10 text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-0"
                          >
                            {tr("Завершити", "Finish", "Завершить")}
                          </Button>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground/70">
                        {tr(
                          "F6 працює як швидке продовження.",
                          "F6 works as a quick continue.",
                          "F6 работает как быстрое продолжение."
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button 
                      onClick={handleLaunch}
                      disabled={isLaunching || (!selectedProject || !startRange || !endRange)}
                      className="h-12 w-full sm:w-auto sm:min-w-[230px] text-base font-bold bg-primary hover:bg-primary/90 text-white border-0 shadow-none hover:shadow-none hover:-translate-y-0.5 transition-all duration-300 rounded-xl uppercase tracking-widest focus-visible:ring-0 focus-visible:outline-none"
                    >
                      {tr("ЗАПУСТИТИ", "LAUNCH", "ЗАПУСТИТЬ")}
                    </Button>
                  )}
                </div>

                              </motion.div>

              {/* Stats and Recent Actions row - 2 columns */}
              <div className="telegram-secondary-widgets grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Widget 1 - Останні дії */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 h-56 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="text-primary w-5 h-5 shrink-0" />
                    <h3 className="text-xl font-display font-bold text-white">{tr("Останні дії", "Recent actions", "Последние действия")}</h3>
                  </div>
                  
                  {recentActions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground/70">
                      {tr("Немає дій", "No actions", "Нет действий")}
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="space-y-2">
                        {recentActions.slice(0, 24).map((entry: { id: number; message: string; timestamp: number }) => {
                          const message = String(entry?.message ?? "").trim().replace(/\.$/, "");
                          return (
                          <div
                            key={entry.id}
                            className="flex gap-3 text-sm font-mono group hover:bg-white/5 p-2 rounded-lg transition-colors"
                          >
                            <span className="text-primary/70 shrink-0">
                              [{format(new Date(entry.timestamp), "HH:mm:ss")}]
                            </span>
                            <span className="text-muted-foreground group-hover:text-white transition-colors break-all">
                              {message}
                            </span>
                          </div>
                        )})}
                      </div>
                    </ScrollArea>
                  )}
                </motion.div>

                {/* Widget 2 - Статистика акаунтів */}
                <div className="relative">
                  <AccountStatsWidget
                    stats={displayStats}
                    activeFilter={accountFilter}
                    onFilterChange={setAccountFilter}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="absolute top-2 right-2 flex gap-1"
                  >
                    {accountStatusOverrides.size > 0 && (
                      <Button
                        onClick={resetStatusOverrides}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-white/10 text-white/70 hover:text-white"
                        title={tr("Скинути всі оверрайди", "Reset all overrides", "Сбросить все оверрайды")}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      onClick={() => loadRealStats(true)}
                      disabled={statsLoading}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-white/10 text-white/70 hover:text-white"
                      title={tr("Оновити статистику", "Refresh stats", "Обновить статистику")}
                    >
                      <RefreshCw className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Right column - Calendar and Daily Tasks stacked */}
            <div className="telegram-right-column flex flex-col gap-6 min-h-0 min-w-0 overflow-hidden">
              {/* Calendar Widget */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="h-64 flex items-center justify-center"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <GlassCalendar 
                    selectedDate={selectedDate}
                    className="w-full h-full"
                  />
                </div>
              </motion.div>

              {/* Daily Tasks Widget */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="flex flex-col flex-1 min-h-0"
              >
                <DailyTasksPanel />
              </motion.div>
            </div>
          </div>

          {/* Bottom row - Accounts List - Full width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-display font-bold text-white">
                {tr("Список акаунтів", "Accounts list", "Список аккаунтов")}
              </h3>
                <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-opacity ${
                      isSearchFocused ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  <Input
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder={tr("Пошук", "Search", "Поиск")}
                    className={`h-9 w-60 bg-black/40 border-white/10 pr-9 text-white/90 placeholder:text-white/30 focus:border-white/20 ${
                      isSearchFocused ? "pl-3" : "pl-9"
                    }`}
                  />
                  <Select
                    value={notesFilter === "with" ? notesFilterValue : hashtagFilter}
                    onValueChange={(value) => {
                      if (value === notesFilterValue) {
                        setNotesFilter("with");
                        setHashtagFilter("all");
                        return;
                      }
                      setNotesFilter("all");
                      setHashtagFilter(value);
                    }}
                  >
                    <SelectTrigger
                      hideIcon
                      title={
                        notesFilter === "with"
                          ? tr("Фільтр: З нотатками", "Filter: With notes", "Фильтр: С заметками")
                          : hashtagFilter === "all"
                            ? tr("Фільтр за #", "Filter by #", "Фильтр по #")
                            : tr(`Фільтр: #${hashtagFilter}`, `Filter: #${hashtagFilter}`, `Фильтр: #${hashtagFilter}`)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-md bg-transparent border-0 p-0 text-white/60 hover:text-white hover:bg-white/10 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                    >
                      <Filter className="h-4 w-4" strokeWidth={2.2} />
                      {notesFilter === "with" || hashtagFilter !== "all" ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(157,0,255,0.6)]" />
                      ) : null}
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-white/10 text-white">
                      <SelectItem
                        value="all"
                        className="text-xs focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      >
                        {tr("Усі", "All", "Все")}
                      </SelectItem>
                      <SelectItem
                        value={notesFilterValue}
                        className="text-xs focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                      >
                        {tr("З нотатками", "With notes", "С заметками")}
                      </SelectItem>
                      {hashtagOptions.map((tag) => {
                        const meta = getHashtagMetaItem(tag);
                        return (
                          <div key={tag} className="group relative">
                            <SelectItem
                              value={tag}
                              className="text-xs focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white pr-16"
                            >
                              <div className="flex items-center w-full">
                                <span className="flex-1 max-w-[120px] truncate">#{tag}</span>
                                {meta?.link ? (
                                  <span className="text-[10px] text-primary/70 ml-2">{tr("посилання", "link", "ссылка")}</span>
                                ) : null}
                              </div>
                            </SelectItem>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 p-0 hover:bg-white/10 text-white/70 hover:text-white"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openHashtagEditModal(tag);
                                }}
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 p-0 hover:bg-red-500/20 text-red-400/70 hover:text-red-400"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteHashtag(tag);
                                }}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              {hashtagFilter !== "all" && selectedHashtagMeta?.link ? (
                  <Button
                    onClick={handleLaunchByHashtagFilter}
                    disabled={isLaunching || filteredProfileIds.length === 0}
                    className="h-9 px-3 border font-display font-semibold tracking-[0.02em] transition-all duration-200 border-white/10 bg-white/[0.02] text-white/85 hover:text-white hover:bg-white/10 hover:border-white/25"
                    title={tr(
                      `Запустити акаунти за #${hashtagFilter}`,
                      `Launch accounts by #${hashtagFilter}`,
                      `Запустить аккаунты по #${hashtagFilter}`
                    )}
                  >
                    <Rocket className="w-4 h-4 mr-2 text-primary/80" />
                    {tr("Запустити за #", "Launch by #", "Запустить по #")}
                  </Button>
                ) : null}
                <Button
                  onClick={handleCloseAllOpenedAccounts}
                  variant="ghost"
                  size="sm"
                  disabled={!hasClosableAccounts}
                  className={`group h-9 px-3 border font-display font-semibold tracking-[0.02em] transition-all duration-200 ${
                    hasClosableAccounts
                      ? "border-white/10 bg-white/[0.02] text-white/85 hover:text-white hover:bg-white/10 hover:border-white/25"
                      : "border-white/5 bg-white/[0.01] text-white/35 cursor-default"
                  }`}
                >
                  <X className={`w-4 h-4 mr-2 transition-colors ${hasClosableAccounts ? "text-white/70 group-hover:text-red-500" : "text-white/35"}`} />
                  {tr("Закрити всі", "Close all", "Закрыть все")}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <>
                {isAccountsLoading ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="col-span-full flex flex-col items-center justify-center py-16 text-center"
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm text-slate-500">{tr("Завантаження акаунтів...", "Loading accounts...", "Загрузка аккаунтов...")}</p>
                  </motion.div>
                ) : visibleAccounts.length > 0 ? (
                  visibleAccounts.map((account, index) => {
                    const statusLabel = account.effectiveStatus === accountStatus.active
                      ? tr("активні", "active", "активные")
                      : account.effectiveStatus === accountStatus.blocked
                        ? tr("заблоковані", "blocked", "заблокированные")
                        : tr("неактивні", "inactive", "неактивные");
                    const displayName = String(account.displayName ?? "").trim();
                    const hasDisplayName = displayName.length > 0;
                    return (
                    <motion.div
                      key={account.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ 
                        duration: 0.25,
                        ease: "easeOut",
                      }}
                      className="group relative bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all cursor-pointer"
                    >
                      {account.effectiveStatus === accountStatus.active && (
                        <span
                          className="absolute right-8 top-3 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                          title={tr("Активний", "Active", "Активный")}
                        />
                      )}
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
                          if (!hasDisplayName) return;
                          if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(displayName);
                          }
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
                                {editingAccountId === account.id ? (
                                  <Input
                                    autoFocus
                                    value={editingDisplayName}
                                    onChange={(e) => setEditingDisplayName(e.target.value)}
                                    onBlur={() => {
                                      const next = editingDisplayName.trim();
                                      const current = String(account.displayName ?? "").trim();
                                      setEditingAccountId(null);
                                      if (next !== current) {
                                        updateAccountDisplayName(account.id, next, index + 1);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const next = editingDisplayName.trim();
                                        const current = String(account.displayName ?? "").trim();
                                        setEditingAccountId(null);
                                        if (next !== current) {
                                          updateAccountDisplayName(account.id, next, index + 1);
                                        }
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        setEditingAccountId(null);
                                        setEditingDisplayName(String(account.displayName ?? ""));
                                      }
                                    }}
                                    placeholder="@user"
                                    className="h-6 w-40 bg-transparent border-0 px-0 text-[12px] tracking-[0.02em] text-white/90 placeholder:text-white/35 focus:ring-0 focus:outline-none"
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
                                        setEditingDisplayName(String(account.displayName ?? ""));
                                      }}
                                      title={tr("Редагувати ім'я", "Edit name", "Редактировать имя")}
                                    >
                                      {index + 1}
                                    </button>
                                    {hasDisplayName ? (
                                      <button
                                        type="button"
                                        className="hidden group-hover:inline-flex items-center text-white/90 hover:text-white focus-visible:outline-none"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setEditingAccountId(account.id);
                                          setEditingDisplayName(String(account.displayName ?? ""));
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
                                {account.hashtags.map((tag: string) => (
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
                          {account.effectiveStatus === accountStatus.blocked && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              'bg-slate-500/20 text-slate-300'
                            }`}>
                              {statusLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder={tr("Додати нотатку..", "Add note..", "Добавить заметку..")}
                          className="bg-black/40 border-white/5 text-white text-xs flex-1 placeholder:text-gray-500"
                            defaultValue={account.notes ?? ""}
                            onBlur={(e) => {
                              if (e.target.value !== (account.notes || "")) {
                                updateAccountNotes(account.id, e.target.value, index + 1);
                              }
                            }}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className={`h-8 w-8 rounded-lg transition-all ${
                              openAccounts.has(account.id) 
                                ? "border-transparent bg-gradient-to-r from-primary to-primary/80 text-white hover:scale-105" 
                                : "border-white/10 hover:bg-white/10 hover:border-white/20"
                            } focus-visible:ring-0 focus-visible:outline-none`}
                            onClick={() => handleToggleAccount(account.id)}
                          >
                            <AnimatePresence mode="wait">
                              {openAccounts.has(account.id) ? (
                                <motion.div
                                  key="close"
                                  initial={{ rotate: -180, opacity: 0 }}
                                  animate={{ rotate: 0, opacity: 1 }}
                                  exit={{ rotate: 180, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <X className="w-3 h-3 text-white" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="open"
                                  initial={{ rotate: 180, opacity: 0 }}
                                  animate={{ rotate: 0, opacity: 1 }}
                                  exit={{ rotate: -180, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      duration: 0.3,
                      ease: "easeInOut"
                    }}
                    className="col-span-full flex flex-col items-center justify-center py-16 text-center"
                  >
                    {accountFilter === accountStatus.blocked ? (
                      <img
                        src={blockedGhostIcon}
                        alt={tr("Заблоковані акаунти", "Blocked accounts", "Заблокированные аккаунты")}
                        className="w-16 h-16 object-contain mb-4"
                      />
                    ) : (
                      <SearchX className="w-16 h-16 text-slate-400 mb-4" />
                    )}
                    <p className="text-xl font-medium text-slate-300 mb-2">
                      {accountFilter === accountStatus.blocked
                        ? tr("Жодного бану", "No blocked accounts", "Нет банов")
                        : tr("Немає акаунтів", "No accounts", "Нет аккаунтов")}
                    </p>
                    {accountFilter !== accountStatus.blocked ? null : null}
                  </motion.div>
                )}
              </>
            </div>
          </motion.div>
        </div>
      </main>
      
      {/* Project Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProject}
        project={editingProject}
        mode={modalMode}
      />

      {/* Custom Link Modal */}
      <CustomLinkModal
        isOpen={isCustomLinkModalOpen}
        onClose={() => setIsCustomLinkModalOpen(false)}
        onSubmit={handleCustomLinkSubmit}
      />

      <Dialog open={isHashtagModalOpen} onOpenChange={(open) => (open ? setIsHashtagModalOpen(true) : closeHashtagModal())}>
        <DialogContent hideClose className="bg-black/40 backdrop-blur-md border border-white/5 text-white sm:max-w-md p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold text-white">{tr("Додати хештег", "Add hashtag", "Добавить хештег")}</h2>
            <button
              onClick={closeHashtagModal}
              className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-normal text-muted-foreground">
              {hashtagModalAccount
                ? tr(
                    `Акаунт: ${hashtagModalAccount.name}`,
                    `Account: ${hashtagModalAccount.name}`,
                    `Аккаунт: ${hashtagModalAccount.name}`
                  )
                : tr("Оберіть акаунт", "Select account", "Выберите аккаунт")}
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">
                #
              </span>
              <Input
                autoFocus
                autoComplete="new-password"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                className="bg-black/50 border-white/10 h-12 rounded-xl pl-7 text-white placeholder:text-gray-500 focus:border-white/10"
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
            <Button
              type="button"
              onClick={closeHashtagModal}
              className="flex-1 h-12 bg-black/50 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all duration-300"
            >
              {tr("Скасувати", "Cancel", "Отмена")}
            </Button>
            <Button
              type="button"
              onClick={submitHashtagModal}
              className="flex-1 h-12 bg-primary hover:bg-primary active:bg-primary/95 text-white border-0 shadow-none hover:shadow-none focus-visible:ring-0 rounded-xl transition-all duration-200"
            >
              {tr("Додати", "Add", "Добавить")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHashtagEditOpen} onOpenChange={(open) => (open ? setIsHashtagEditOpen(true) : closeHashtagEditModal())}>
        <DialogContent hideClose className="bg-black/40 backdrop-blur-md border border-white/5 text-white sm:max-w-md p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold text-white">{tr("Редагувати хештег", "Edit hashtag", "Редактировать хештег")}</h2>
            <button
              onClick={closeHashtagEditModal}
              className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-normal text-muted-foreground">
                {tr("Назва хештегу", "Hashtag name", "Название хештега")}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">
                  #
                </span>
                <Input
                  autoComplete="new-password"
                  value={hashtagEditName}
                  onChange={(e) => setHashtagEditName(e.target.value)}
                  className="bg-black/50 border-white/10 h-12 rounded-xl pl-7 text-white placeholder:text-gray-500 focus:border-white/10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-normal text-muted-foreground">
                {tr("Посилання на проєкт (необов'язково)", "Project link (optional)", "Ссылка на проект (необязательно)")}
              </Label>
              <Input
                autoComplete="new-password"
                value={hashtagEditLink}
                onChange={(e) => setHashtagEditLink(e.target.value)}
                placeholder="https://t.me/your_bot"
                className="bg-black/50 border-white/10 h-12 rounded-xl text-white placeholder:text-gray-500 focus:border-white/10"
              />
            </div>
            {hashtagEditErrors.length > 0 ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
                {hashtagEditErrors.map((error, index) => (
                  <p key={index} className="text-red-400 text-sm">
                    {error}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex gap-4 pt-6">
            <Button
              type="button"
              onClick={closeHashtagEditModal}
              className="flex-1 h-12 bg-black/50 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all duration-300"
            >
              {tr("Скасувати", "Cancel", "Отмена")}
            </Button>
            <Button
              type="button"
              onClick={handleSaveHashtagEdit}
              className="flex-1 h-12 bg-primary hover:bg-primary active:bg-primary/95 text-white border-0 shadow-none hover:shadow-none focus-visible:ring-0 rounded-xl transition-all duration-200"
            >
              {tr("Зберегти", "Save", "Сохранить")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}





















