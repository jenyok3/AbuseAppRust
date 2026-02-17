import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Rocket, Loader2, ExternalLink, Plus, Edit, Trash2, Terminal, Circle, Wifi, Layers, GhostIcon as Ghost, Calendar, AppWindow, Clock, X, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TelegramLink } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DailyTasksPanel } from "@/components/DailyTasksPanel";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isToday, isSameYear } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { GhostIcon } from "@/components/ui/ghost-icon";
import { AccountStatsWidget } from "@/components/AccountStatsWidget";
import { readDirectory, launchAccounts, launchSingleAccount, launchAccountsBatch, getAvailableLinks, closeTelegramProcesses, closeSingleAccount, getRunningTelegramProcesses, getAccountStats } from "@/lib/tauri-api";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import { ProjectModal } from "@/components/ProjectModal";
import { CustomLinkModal } from "@/components/CustomLinkModal";
import { projectStorage } from "@/lib/projectStorage";
import blockedGhostIcon from "@/assets/icons/blocked-ghost-custom.png";

export default function Telegram() {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startRange, setStartRange] = useState("");
  const [endRange, setEndRange] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMix, setIsMix] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>("all"); // all, активні, заблоковані
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);
  const [availableLinks, setAvailableLinks] = useState<any[]>([]);
  const [launchedPids, setLaunchedPids] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProject, setEditingProject] = useState<any>(null);
  const [isCustomLinkModalOpen, setIsCustomLinkModalOpen] = useState(false);
  const [openAccounts, setOpenAccounts] = useState<Map<number, number>>(new Map()); // accountId -> PID
  const [realStats, setRealStats] = useState<{running: number, blocked: number, total: number}>({ running: 0, blocked: 0, total: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const statsRefreshInFlight = useRef(false);

  const normalizeText = (value: unknown): string => String(value ?? "").toLowerCase().trim();
  const normalizePath = (value: unknown): string =>
    normalizeText(value).replace(/\\/g, "/").replace(/\/+/g, "/");
  const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const extractProfileNumberFromText = (value: unknown): number | null => {
    const text = normalizeText(value);
    const m = text.match(/\btg\s*(\d+)\b/i);
    if (!m) return null;
    const num = Number(m[1]);
    return Number.isFinite(num) ? num : null;
  };

  const processBelongsToAccount = (account: any, process: any): boolean => {
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

    // If both sides have TG profile numbers, enforce exact match.
    if (accountProfile !== null && processProfile !== null) {
      if (accountProfile !== processProfile) return false;
      return true;
    }

    // Primary matcher: exact account directory path (prevents "1" matching "13").
    if (accountPath && processPath) {
      if (processPath === accountPath || processPath.startsWith(`${accountPath}/`)) {
        return true;
      }
    }

    // Fallback matcher for cases without path metadata.
    if (!accountName) return false;
    const namePattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(accountName)}([^a-z0-9]|$)`, "i");
    return namePattern.test(processPath) || namePattern.test(processName);
  };

  const findPidForAccount = (
    account: any,
    runningProcesses: any[],
    usedPids: Set<number>
  ): number | null => {
    for (const process of runningProcesses) {
      const pid = Number(process?.pid);
      if (!Number.isFinite(pid) || usedPids.has(pid)) continue;

      if (processBelongsToAccount(account, process)) {
        return pid;
      }
    }

    return null;
  };

  const syncAccountsRunningStatus = async () => {
    try {
      const runningProcesses = await getRunningTelegramProcesses() as any[];
      const runningPidSet = new Set<number>(
        runningProcesses
          .map((p: any) => Number(p?.pid))
          .filter((pid: number) => Number.isFinite(pid))
      );

      setAccounts((prevAccounts: any[]) => {
        const nextAccounts = prevAccounts.map((acc: any) => {
          const isRunning = runningProcesses.some((process: any) =>
            processBelongsToAccount(acc, process)
          );

          const nextStatus = isRunning
            ? "активні"
            : (acc.status === "заблоковані" ? "заблоковані" : "неактивні");
          return acc.status === nextStatus ? acc : { ...acc, status: nextStatus };
        });

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
  const [accountStatusOverrides, setAccountStatusOverrides] = useState<Map<string, 'активні' | 'заблоковані'>>(new Map());

  // Function to analyze specific account in detail
  const analyzeAccountDetails = async (accountName: string) => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      const folderPath = savedSettings ? JSON.parse(savedSettings).telegramFolderPath : null;
      
      if (!folderPath) {
        toast({
          title: "Помилка",
          description: "Спочатку вкажіть шлях до папки в налаштуваннях",
          variant: "destructive",
        });
        return;
      }
      
      // Get all directories to find the specific account
      const files = await readDirectory(folderPath) as any[];
      const directories = files.filter((file: any) => file.is_dir);
      const tgDirectories = directories.filter((dir: any) => dir.name.toLowerCase().startsWith('tg'));
      
      const accountDir = tgDirectories.find((dir: any) => dir.name === accountName);
      if (!accountDir) {
        toast({
          title: "Помилка",
          description: `Акаунт ${accountName} не знайдено`,
          variant: "destructive",
        });
        return;
      }
      
      const tdataPath = `${accountDir.path}/tdata`;
      const tdataFiles = await readDirectory(tdataPath) as any[];
      
      console.log(`=== DETAILED ANALYSIS FOR ${accountName} ===`);
      console.log('Total files:', tdataFiles.length);
      console.log('Files:', tdataFiles.map(f => `${f.name} (${f.size} bytes)`));
      
      const status = await determineAccountStatus(tdataFiles, accountName, accountDir.path);
      
      toast({
        title: "Аналіз завершено",
        description: `${accountName}: ${status}. Деталі у консолі.`,
      });
      
    } catch (error) {
      console.error(`Error analyzing ${accountName}:`, error);
      toast({
        title: "Помилка аналізу",
        description: `Не вдалося проаналізувати акаунт ${accountName}`,
        variant: "destructive",
      });
    }
  };

  // Function to reset all manual overrides
  const resetStatusOverrides = () => {
    setAccountStatusOverrides(new Map());
    loadRealStats();
    toast({
      title: "Оверрайди скинуто",
      description: "Усі ручні статуси акаунтів очищено",
    });
  };

  // Function to manually override account status
  const overrideAccountStatus = (accountName: string, status: 'активні' | 'заблоковані') => {
    setAccountStatusOverrides(prev => {
      const newOverrides = new Map(prev);
      newOverrides.set(accountName, status);
      return newOverrides;
    });
    
    // Recalculate stats
    loadRealStats();
    
    toast({
      title: "Статус змінено",
      description: `Статус ${accountName} оновлено на ${status}`,
    });
  };

  // Load real account stats
  const loadRealStats = async (manual = false) => {
    if (statsRefreshInFlight.current) return;
    statsRefreshInFlight.current = true;

    try {
      if (manual) {
        setStatsLoading(true);
      }

      const savedSettings = localStorage.getItem('appSettings');
      const folderPath = savedSettings ? JSON.parse(savedSettings).telegramFolderPath : "";
      const raw = await getAccountStats(folderPath) as any;
      const finalStats = {
        total: Number(raw?.total ?? 0),
        running: Number(raw?.running ?? raw?.active ?? 0),
        blocked: Number(raw?.blocked ?? 0),
      };

      setRealStats(finalStats);
      await syncAccountsRunningStatus();
    } catch (error) {
      console.error('Failed to load real stats:', error);
      if (manual) {
        toast({
          title: "Помилка оновлення статистики",
          description: "Не вдалося завантажити поточну статистику акаунтів",
          variant: "destructive",
        });
      }
    } finally {
      if (manual) {
        setStatsLoading(false);
      }
      statsRefreshInFlight.current = false;
    }
  };
  // Load settings and accounts on mount
  useEffect(() => {
    console.log('Telegram page mounted, loading settings...');
    
    const loadAccounts = () => {
      setIsAccountsLoading(true);
      // Load settings from localStorage
      const savedSettings = localStorage.getItem('appSettings');
      console.log('Saved settings found:', savedSettings);
      
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          console.log('Parsed settings:', settings);
          
          // Load accounts from specified folder
          if (settings.telegramFolderPath) {
            console.log('Loading accounts from folder:', settings.telegramFolderPath);
            loadAccountsFromFolder(settings.telegramFolderPath);
          } else {
            console.log('No telegram folder path found, loading default accounts');
            loadDefaultAccounts();
          }
        } catch (error) {
          console.error('Error parsing settings:', error);
          loadDefaultAccounts();
        }
      } else {
        console.log('No settings found, loading default accounts');
        loadDefaultAccounts();
      }
    };

    // Load available links
    const loadLinks = async () => {
      try {
        // First try to load from localStorage
        const storedProjects = projectStorage.getProjects();
        
        if (storedProjects.length > 0) {
          setAvailableLinks(storedProjects);
          console.log('Loaded projects from localStorage:', storedProjects);
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
    loadAccounts();
    loadLinks();
    loadRealStats();

    // Auto-refresh stats in background
    const statsInterval = window.setInterval(() => {
      loadRealStats();
    }, 2000);

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        console.log('Settings changed, reloading accounts...');
        loadAccounts();
        loadRealStats(); // Reload stats too
      }
    };

    // Also listen for custom events for same-tab updates
    const handleSettingsUpdate = () => {
      console.log('Settings updated event received, reloading accounts...');
      loadAccounts();
      loadRealStats(); // Reload stats too
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      window.clearInterval(statsInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Function to get REAL account status by checking actual account state
  const determineAccountStatus = async (tdataFiles: any[], accountName: string, accountPath: string): Promise<'активні' | 'заблоковані' | 'неактивні'> => {
    try {
      console.log(`Checking REAL status for account: ${accountName} at ${accountPath}`);
      
      // Method 1: Check if account is currently running
      const runningProcesses = await getRunningTelegramProcesses() as any[];
      const isAccountRunning = runningProcesses.some((process: any) => {
        const processPath = process.path ? process.path.toLowerCase() : '';
        const processName = process.name ? process.name.toLowerCase() : '';

        return processPath.includes(accountName.toLowerCase()) ||
               processName.includes(accountName.toLowerCase()) ||
               processPath.includes(accountPath.toLowerCase());
      });

      if (isAccountRunning) {
        return 'активні';
      }

      // Method 2: Explicit indicators that the account is blocked/deleted
      const telegramDeletionIndicators = [
        'deleted', 'banned', 'suspended', 'restricted',
        'error', 'failed', 'blocked',
      ];

      const hasDeletionIndicators = tdataFiles.some((f: any) =>
        telegramDeletionIndicators.some((indicator) =>
          String(f.name || '').toLowerCase().includes(indicator)
        )
      );

      if (hasDeletionIndicators) {
        return 'заблоковані';
      }

      // Not running and no explicit ban markers -> inactive, not blocked.
      return 'неактивні';
    } catch (error) {
      console.error(`Failed to determine status for ${accountName}:`, error);
      return 'неактивні';
    }
  };
  // Function to load accounts from folder using Tauri API
  const loadAccountsFromFolder = async (folderPath: string) => {
    try {
      setIsAccountsLoading(true);
      console.log('Loading accounts from:', folderPath);
      
      // Use real directory reading via Tauri API
      const files = await readDirectory(folderPath) as any[];
      console.log('All files found:', files);
      
      // Find all directories that might contain accounts
      const directories = files.filter((file: any) => file.is_dir);
      console.log('Directories found:', directories);
      
      let allAccounts: any[] = [];
      
      // Check each directory for tdata folders
      for (const dir of directories) {
        try {
          const subFiles = await readDirectory(dir.path) as any[];
          console.log(`Files in ${dir.name}:`, subFiles);
          
          // Look for tdata folder in this directory
          const tdataFolder = subFiles.find((f: any) => f.is_dir && f.name === 'tdata');
          
          if (tdataFolder) {
            // Additional check: verify tdata folder contains Telegram files
            try {
              const tdataFiles = await readDirectory(tdataFolder.path) as any[];
              console.log(`Files in tdata folder of ${dir.name}:`, tdataFiles);
              
              // Check for essential Telegram files in tdata
              const hasTelegramFiles = tdataFiles.some((f: any) => {
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
                const accountStatus = await determineAccountStatus(tdataFiles, dir.name, dir.path);
                console.log(`Account ${dir.name} REAL status determined as: ${accountStatus}`);
                
                allAccounts.push({
                  id: allAccounts.length + 1,
                  name: dir.name,
                  status: accountStatus,
                  proxy: '',
                  notes: `${dir.path} (tdata) - ${accountStatus}`,
                  type: 'tdata',
                  isFile: false,
                  isDir: true,
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
            const sessionFiles = subFiles.filter((f: any) => f.name.endsWith('.session'));
            for (const sessionFile of sessionFiles) {
              // For session files, most are blocked since Telegram bans log them out
              // Only very recently modified sessions might still be active
              const fileAge = Date.now() - new Date(sessionFile.modified).getTime();
              const daysOld = fileAge / (1000 * 60 * 60 * 24);
              const accountStatus = daysOld < 1 ? 'активні' : 'заблоковані'; // Only active if modified today
              
              console.log(`Session account ${sessionFile.name.replace('.session', '')}: ${daysOld.toFixed(1)} days old -> ${accountStatus}`);
              
              allAccounts.push({
                id: allAccounts.length + 1,
                name: sessionFile.name.replace('.session', ''),
                status: accountStatus,
                proxy: '',
                notes: `${sessionFile.path} (session) - ${accountStatus} (${daysOld.toFixed(1)} days old)`,
                type: 'session',
                isFile: true,
                isDir: false,
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
      const rootSessionFiles = files.filter((file: any) => file.name.endsWith('.session'));
      for (const sessionFile of rootSessionFiles) {
        // For session files, most are blocked since Telegram bans log them out
        const fileAge = Date.now() - new Date(sessionFile.modified).getTime();
        const daysOld = fileAge / (1000 * 60 * 60 * 24);
        const accountStatus = daysOld < 1 ? 'активні' : 'заблоковані'; // Only active if modified today
        
        console.log(`Root session account ${sessionFile.name.replace('.session', '')}: ${daysOld.toFixed(1)} days old -> ${accountStatus}`);
        
        allAccounts.push({
          id: allAccounts.length + 1,
          name: sessionFile.name.replace('.session', ''),
          status: accountStatus,
          proxy: '',
          notes: `${sessionFile.path} (session) - ${accountStatus} (${daysOld.toFixed(1)} days old)`,
          type: 'session',
          isFile: true,
          isDir: false,
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
        const fileList = files.map((f: any) => `${f.name} (${f.is_dir ? 'dir' : 'file'})`).join(', ');
        console.log('No Telegram files found. Available files:', fileList);
        
        toast({
          title: "Telegram-акаунти не знайдено",
          description: `У папці ${folderPath} не знайдено валідних Telegram-акаунтів. Вміст папки: ${fileList.substring(0, 200)}${fileList.length > 200 ? '...' : ''}`,
          variant: "destructive",
        });
        loadDefaultAccounts();
        return;
      }
      
      setAccounts(allAccounts);
      
      toast({
        title: "Акаунти завантажено",
        description: `Знайдено ${allAccounts.length} Telegram-акаунтів у папці ${folderPath}`,
      });
      
    } catch (error) {
      console.error('Failed to load accounts from folder:', error);
      toast({
        title: "Помилка завантаження",
        description: `Не вдалося прочитати папку: ${error}`,
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
    const defaultAccounts: any[] = [];
    console.log('Setting empty accounts list (no folder path specified)');
    setAccounts(defaultAccounts);
    setIsAccountsLoading(false);
  };

  // Function to update account notes
  const updateAccountNotes = async (accountId: number, notes: string) => {
    try {
      // Update local state immediately for better UX
      setAccounts(prevAccounts => 
        prevAccounts.map(acc => 
          acc.id === accountId ? { ...acc, notes } : acc
        )
      );
      
      // If we have API support, also update on server
      // For now, just keep it in local state
      toast({
        title: "Нотатку збережено",
        description: `Нотатку для акаунта ${accountId} оновлено`,
      });
    } catch (error) {
      toast({
        title: "Помилка збереження",
        description: "Не вдалося оновити нотатку",
        variant: "destructive",
      });
    }
  };

  const extractProfileId = (account: any): number | null => {
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

  // Function to toggle account open/close
  const handleToggleAccount = async (accountId: number) => {
    const account = accounts.find((a: any) => a.id === accountId);
    if (!account) return;

    const savedSettings = localStorage.getItem('appSettings');
    const folderPath = savedSettings ? JSON.parse(savedSettings).telegramFolderPath : "";

    if (!folderPath) {
      toast({
        title: "Помилка",
        description: "Спочатку вкажіть шлях до папки в налаштуваннях",
        variant: "destructive",
      });
      return;
    }

    const profileId = extractProfileId(account);
    if (!profileId) {
      toast({
        title: "Помилка",
        description: `Не вдалося визначити номер профілю для ${account.name}`,
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
        title: "Помилка",
        description: `Не вдалося ${openAccounts.has(accountId) ? "закрити" : "відкрити"} акаунт`,
        variant: "destructive",
      });
    }
  };

  // Filter accounts based on selected filter
  const filteredAccounts = [...accounts]
    .filter((account) => {
      if (accountFilter === "all") return true;
      return account.status === accountFilter;
    })
    .sort((a: any, b: any) => {
      const aProfile = extractProfileId(a);
      const bProfile = extractProfileId(b);

      if (aProfile !== null && bProfile !== null) {
        return aProfile - bProfile;
      }
      if (aProfile !== null) return -1;
      if (bProfile !== null) return 1;

      const aName = String(a?.name || "");
      const bName = String(b?.name || "");
      return aName.localeCompare(bName, "uk", { numeric: true, sensitivity: "base" });
    });

  // Calculate stats based on filter
  const stats = {
    total: filteredAccounts.length,
    running: filteredAccounts.filter(a => a.status === 'активні').length,
    blocked: filteredAccounts.filter(a => a.status === 'заблоковані').length
  };

  // Keep widget stats global; account list itself is filtered by accountFilter.
  const displayStats = realStats;

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
      if (launchedPids.length > 0) {
        handleContinueLaunch();
      }
    };

    window.addEventListener('f6-pressed', handleF6Pressed);
    return () => window.removeEventListener('f6-pressed', handleF6Pressed);
  }, [launchedPids]);

  const handleLaunch = async () => {
    if (!selectedProject) {
      toast({
        title: "Помилка",
        description: "Оберіть проєкт перед запуском",
        variant: "destructive",
      });
      return;
    }

    if (!startRange || !endRange) {
      toast({
        title: "Помилка",
        description: "Вкажіть початок і кінець діапазону",
        variant: "destructive",
      });
      return;
    }

    const start = parseInt(startRange);
    const end = parseInt(endRange);

    if (start > end) {
      toast({
        title: "Помилка",
        description: "Початок діапазону не може бути більшим за кінець",
        variant: "destructive",
      });
      return;
    }

    // Get saved settings to get telegram folder path
    const savedSettings = localStorage.getItem('appSettings');
    if (!savedSettings) {
      toast({
        title: "Помилка",
        description: "Спочатку вкажіть шлях до папки в налаштуваннях",
        variant: "destructive",
      });
      return;
    }

    const settings = JSON.parse(savedSettings);
    if (!settings.telegramFolderPath) {
      toast({
        title: "Помилка",
        description: "Спочатку вкажіть шлях до папки в налаштуваннях",
        variant: "destructive",
      });
      return;
    }

    setIsLaunching(true);

    try {
      // Find the selected link parameters
      const selectedLink = availableLinks.find(([name]) => name === selectedProject);
      if (!selectedLink) {
        throw new Error("Selected project not found");
      }

      const [projectName, linkParams] = selectedLink;
      
      // Handle custom link differently
      let launchParams;
      console.log('Debug - projectName:', projectName);
      console.log('Debug - linkParams:', linkParams);
      console.log('Debug - availableLinks:', availableLinks);
      
      // Always use the parsed app_name and app_type from linkParams
      launchParams = {
        api_id: linkParams.api_id || "",
        api_hash: linkParams.api_hash || "",
        phone: linkParams.phone || "",
        app_name: linkParams.app_name || projectName, // Use app_name from stored data or fallback to project name
        app_type: linkParams.app_type || "", // Use app_type from stored data
        ref_link: linkParams.ref_link || "",
        mixed: isMix ? "yes" : "no"
      };
      console.log('Debug - launchParams:', launchParams);
      
      console.log('Launching batch:', {
        projectName,
        ref_link: linkParams.ref_link,
        start,
        end,
        telegramFolderPath: settings.telegramFolderPath
      });

      const pids = await launchAccountsBatch(
        launchParams,
        start,
        end,
        settings.telegramFolderPath
      ) as number[];
      
      setLaunchedPids(pids);
      
      toast({
        title: "Запуск виконано",
        description: `Запущено ${pids.length} акаунтів. Натисніть F6 для продовження.`,
      });

    } catch (error) {
      console.error('Launch error:', error);
      toast({
        title: "Помилка запуску",
        description: `Не вдалося запустити акаунти: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  // Function to handle project selection
  const handleProjectChange = (value: string) => {
    if (value === "custom") {
      // Show custom link modal instead of prompt
      setIsCustomLinkModalOpen(true);
    } else {
      setSelectedProject(value);
    }
  };

  // Function to handle custom link submission
  const handleCustomLinkSubmit = (customUrl: string) => {
    try {
      let app_name = "";
      let app_type = "";
      let ref_link = "";
      
      // Handle both tg:// and https://t.me/ links
      if (customUrl.startsWith('tg://')) {
        const url = new URL(customUrl);
        app_name = url.searchParams.get('domain') || "";
        app_type = url.searchParams.get('appname') || "";
        ref_link = url.searchParams.get('startapp') || url.searchParams.get('start') || "";
      } else {
        const url = new URL(customUrl);
        const pathParts = url.pathname.split('/').filter(p => p);
        
        if (pathParts.length >= 2) {
          app_name = pathParts[pathParts.length - 2];
          app_type = pathParts[pathParts.length - 1];
        } else if (pathParts.length >= 1) {
          app_name = pathParts[0];
        }
        
        const searchParams = new URLSearchParams(url.search);
        ref_link = searchParams.get('startapp') || searchParams.get('start') || "";
      }
      
      // Create custom project data that matches TelegramLink structure
      const customProject: TelegramLink = {
        api_id: "", // Generate or request from user
        api_hash: "", // Generate or request from user  
        phone: "", // Generate or request from user
        app_name: app_name,
        app_type: app_type,
        ref_link: ref_link,
        mixed: "yes" // Default to mixed for custom projects
      };
      
      // Add to available links temporarily
      setAvailableLinks(prev => [...prev, [app_name, customProject]]);
      setSelectedProject(app_name);
      
      toast({
        title: "Кастомний проєкт додано",
        description: `Проєкт ${app_name} додано`,
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Некоректне посилання",
        variant: "destructive",
      });
    }
  };

  // Function to add a new project
  const handleAddProject = () => {
    setModalMode('add');
    setEditingProject(null);
    setIsModalOpen(true);
  };

  // Function to edit a project
  const handleEditProject = (projectName: string, projectData: any) => {
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
    // Delete from localStorage
    const success = projectStorage.deleteProject(projectName);
    
    if (success) {
      // Update state
      setAvailableLinks(prev => prev.filter(([name]) => name !== projectName));
      
      // If deleted project was selected, clear selection
      if (selectedProject === projectName) {
        setSelectedProject("");
      }
      
      toast({
        title: "Проєкт видалено",
        description: `Проєкт ${projectName} успішно видалено`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Помилка видалення",
        description: `Не вдалося видалити проєкт ${projectName}`,
        variant: "destructive",
      });
    }
  };

  // Function to save project (from modal)
  const handleSaveProject = (project: any) => {
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
    const fullProject = {
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
      } else {
        toast({
          title: "Помилка збереження",
          description: "Проєкт з такою назвою вже існує",
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
      } else {
        toast({
          title: "Помилка збереження",
          description: "Не вдалося оновити проєкт",
          variant: "destructive",
        });
      }
    }
  };

  // Function to continue batch launch (simulate F6 press)
  const handleContinueLaunch = async () => {
    if (launchedPids.length === 0) {
      toast({
        title: "Помилка",
        description: "Немає запущених акаунтів для продовження",
        variant: "destructive",
      });
      return;
    }

    try {
      await closeTelegramProcesses(launchedPids);
      setLaunchedPids([]);
      
      // Reset all form fields to initial state
      setSelectedProject("");
      setStartRange("");
      setEndRange("");
      setIsMix(false);
      
      toast({
        title: "Пакет завершено",
        description: "Усі запущені Telegram процеси закрито",
      });

      // Continue with next batch if needed
      // This would require additional logic to track remaining accounts
      
    } catch (error) {
      console.error('Error closing processes:', error);
      toast({
        title: "Помилка завершення",
        description: `Не вдалося закрити процеси: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleCloseAllOpenedAccounts = async () => {
    const pids = Array.from(new Set([
      ...Array.from(openAccounts.values()),
      ...launchedPids,
    ]));

    if (pids.length === 0) {
      toast({
        title: "Немає відкритих акаунтів",
        description: "Зараз немає процесів для закриття",
      });
      return;
    }

    try {
      await closeTelegramProcesses(pids);
      setOpenAccounts(new Map());
      setLaunchedPids([]);
      await loadRealStats();

      toast({
        title: "Усі акаунти закрито",
        description: `Завершено ${pids.length} процесів`,
      });
    } catch (error) {
      console.error("Failed to close all opened accounts:", error);
      toast({
        title: "Помилка закриття",
        description: "Не вдалося завершити всі процеси",
        variant: "destructive",
      });
    }
  };

  const hasClosableAccounts = openAccounts.size > 0 || launchedPids.length > 0;

  return (
    <div 
      className="min-h-screen bg-black text-white overflow-y-auto !bg-black" 
      style={{ backgroundColor: '#000000' }}
    >
      {/* Ambient background effects - removed for pure black background */}
      {/* <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div> */}

      <main className="relative z-10 max-w-7xl mx-auto min-h-screen pt-6 px-6 pr-6 pb-20">
        {/* Main content area */}
        <div className="flex flex-col gap-6">
          {/* Top row - Mass Launch, Stats and Recent Actions */}
          <div className="grid grid-cols-[3.6fr_1.4fr] gap-6">
            {/* Left column - Mass Launch, Stats and Recent Actions */}
            <div className="flex flex-col gap-6">
              {/* Mass Launch Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 lg:p-8 flex flex-col relative overflow-hidden group h-full w-full"
                style={{ height: '460px' }}
              >
                {/* Decorative background glow */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700 pointer-events-none" />

                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                  <Rocket className="text-primary w-6 h-6" />
                  Масовий запуск
                </h2>

                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Проєкт</Label>
                    <div className="flex items-center gap-2">
                      <Select value={selectedProject} onValueChange={handleProjectChange}>
                        <SelectTrigger className="bg-black/50 border-white/10 h-10 rounded-xl focus:ring-0 focus:ring-offset-0 focus:border-white/20 text-white flex-1">
                          <SelectValue placeholder="Виберіть проєкт" />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/10 text-white min-w-[300px]">
                          <SelectItem 
                            key="custom" 
                            value="custom" 
                            className="focus:bg-primary/20 focus:text-white pr-20"
                          >
                            <div className="flex items-center w-full">
                              <span className="flex-1">Обрати своє посилання</span>
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
                                  <Edit className="w-3 h-3" />
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
                        size="icon"
                        className="h-10 w-10 border border-white/10 bg-transparent hover:bg-white/10 hover:text-white transition-all duration-200 flex-shrink-0"
                        onClick={handleAddProject}
                      >
                        <Plus className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-2 w-32 shrink-0">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Початок</Label>
                      <Input 
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
                        className="bg-black/50 border-white/10 h-10 rounded-xl focus:border-primary/50 text-white font-mono" 
                      />
                    </div>
                    <div className="space-y-2 w-32 shrink-0">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Кінець</Label>
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
                        className="bg-black/50 border-white/10 h-10 rounded-xl focus:border-primary/50 text-white font-mono" 
                      />
                    </div>
                    <div className="flex-1" />
                  </div>

                  <div className="flex items-center space-x-3 pt-1">
                    <Checkbox 
                      id="mix" 
                      checked={isMix}
                      onCheckedChange={(checked) => setIsMix(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-white w-5 h-5 rounded-md" 
                    />
                    <Label htmlFor="mix" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground">
                      Увімкнути режим "Мікс"
                    </Label>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button 
                    onClick={launchedPids.length > 0 ? handleContinueLaunch : handleLaunch}
                    disabled={isLaunching || (launchedPids.length === 0 && (!selectedProject || !startRange || !endRange)) || (launchedPids.length > 0 && false)}
                    className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(157,0,255,0.4)] hover:shadow-[0_0_30px_rgba(157,0,255,0.6)] hover:-translate-y-0.5 transition-all duration-300 rounded-xl uppercase tracking-widest"
                  >
                    {isLaunching ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : launchedPids.length > 0 ? (
                      "ЗАВЕРШИТИ"
                    ) : (
                      "ЗАПУСТИТИ"
                    )}
                  </Button>
                </div>

                              </motion.div>

              {/* Stats and Recent Actions row - 2 columns */}
              <div className="grid grid-cols-2 gap-6">
                {/* Widget 1 - Останні дії */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 h-56 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="text-primary w-5 h-5 shrink-0" />
                    <h3 className="text-xl font-display font-bold text-white">Останні дії</h3>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    <div className="space-y-2">
                      <div className="flex gap-3 text-sm font-mono group hover:bg-white/5 p-2 rounded-lg transition-colors">
                        <span className="text-primary/70 shrink-0">[10:42:27]</span>
                        <span className="text-muted-foreground group-hover:text-white transition-colors break-all">
                          Запустив Stellar
                        </span>
                      </div>
                    </div>
                  </ScrollArea>
                </motion.div>

                {/* Widget 2 - Статистика акаунтів */}
                <div className="relative">
                  <AccountStatsWidget
                    stats={displayStats}
                    activeFilter={accountFilter as any}
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
                        title="Скинути всі оверрайди"
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
                      title="Оновити статистику"
                    >
                      <RefreshCw className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Right column - Calendar and Daily Tasks stacked */}
            <div className="flex flex-col gap-6 h-[709px] min-h-0">
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
                Список акаунтів
              </h3>
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
                Закрити всі
              </Button>
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
                    <p className="text-sm text-slate-500">Завантаження акаунтів...</p>
                  </motion.div>
                ) : filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account, index) => (
                    <motion.div
                      key={account.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ 
                        duration: 0.25,
                        ease: "easeOut",
                      }}
                      className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all cursor-pointer"
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-white truncate">{account.name || account.id}</h4>
                          {(account.status === 'активні' || account.status === 'заблоковані') && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              account.status === 'активні'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-slate-500/20 text-slate-300'
                            }`}>
                              {account.status}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Додати нотатки..."
                            className="bg-black/40 border-white/5 text-white text-xs flex-1 placeholder:text-gray-500"
                            defaultValue=""
                            onBlur={(e) => {
                              if (e.target.value !== (account.notes || "")) {
                                updateAccountNotes(account.id, e.target.value);
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
                  ))
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
                    {accountFilter === "заблоковані" ? (
                      <img
                        src={blockedGhostIcon}
                        alt="Blocked accounts"
                        className="w-16 h-16 object-contain mb-4"
                      />
                    ) : (
                      <SearchX className="w-16 h-16 text-slate-400 mb-4" />
                    )}
                    <p className="text-xl font-medium text-slate-300 mb-2">
                      {accountFilter === "заблоковані" ? "Чисто! Жодного бану" : "Немає акаунтів"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {accountFilter === "заблоковані" 
                        ? "Усі акаунти в порядку" 
                        : "Спробуйте змінити фільтр"
                      }
                    </p>
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
    </div>
  );
}

