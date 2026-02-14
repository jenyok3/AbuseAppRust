import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Rocket, Loader2, ExternalLink, Plus, Edit, Trash2, Terminal, Circle, Wifi, Layers, GhostIcon as Ghost, Calendar, AppWindow, Clock, X } from "lucide-react";
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
import { readDirectory, launchAccounts, launchSingleAccount, launchAccountsBatch, getAvailableLinks, closeTelegramProcesses, closeSingleAccount, getRunningTelegramProcesses } from "@/lib/tauri-api";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import { ProjectModal } from "@/components/ProjectModal";
import { CustomLinkModal } from "@/components/CustomLinkModal";
import { projectStorage } from "@/lib/projectStorage";

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
  const [availableLinks, setAvailableLinks] = useState<any[]>([]);
  const [launchedPids, setLaunchedPids] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProject, setEditingProject] = useState<any>(null);
  const [isCustomLinkModalOpen, setIsCustomLinkModalOpen] = useState(false);
  const [openAccounts, setOpenAccounts] = useState<Map<number, number>>(new Map()); // accountId -> PID

  // Load settings and accounts on mount
  useEffect(() => {
    console.log('Telegram page mounted, loading settings...');
    
    const loadAccounts = () => {
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

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        console.log('Settings changed, reloading accounts...');
        loadAccounts();
      }
    };

    // Also listen for custom events for same-tab updates
    const handleSettingsUpdate = () => {
      console.log('Settings updated event received, reloading accounts...');
      loadAccounts();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Function to load accounts from folder using Tauri API
  const loadAccountsFromFolder = async (folderPath: string) => {
    try {
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
                allAccounts.push({
                  id: allAccounts.length + 1,
                  name: dir.name,
                  status: Math.random() > 0.3 ? 'активні' : 'заблоковані',
                  proxy: '',
                  notes: `${dir.path} (tdata)`,
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
              allAccounts.push({
                id: allAccounts.length + 1,
                name: sessionFile.name.replace('.session', ''),
                status: Math.random() > 0.3 ? 'активні' : 'заблоковані',
                proxy: '',
                notes: `${sessionFile.path} (session)`,
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
        allAccounts.push({
          id: allAccounts.length + 1,
          name: sessionFile.name.replace('.session', ''),
          status: Math.random() > 0.3 ? 'активні' : 'заблоковані',
          proxy: '',
          notes: `${sessionFile.path} (session)`,
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
          title: "Файли акаунтів не знайдено",
          description: `У папці ${folderPath} не знайдено файлів телеграм акаунтів. Доступні файли: ${fileList.substring(0, 200)}${fileList.length > 200 ? '...' : ''}`,
          variant: "destructive",
        });
        loadDefaultAccounts();
        return;
      }
      
      setAccounts(allAccounts);
      
      toast({
        title: "Акаунти завантажено",
        description: `Знайдено ${allAccounts.length} телеграм акаунтів у папці ${folderPath}`,
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
    }
  };

  // Function to load default accounts
  const loadDefaultAccounts = () => {
    console.log('Loading default accounts...');
    // Return empty array when no folder path is specified
    const defaultAccounts: any[] = [];
    console.log('Setting empty accounts list (no folder path specified)');
    setAccounts(defaultAccounts);
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
        title: "Нотатки оновлено",
        description: `Нотатки для акаунта ${accountId} збережено`,
      });
    } catch (error) {
      toast({
        title: "Помилка оновлення",
        description: "Не вдалося оновити нотатки",
        variant: "destructive",
      });
    }
  };

  // Function to open account
  const handleOpenAccount = async (accountId: number) => {
    try {
      // Check if account is already open
      if (openAccounts.has(accountId)) {
        toast({
          title: "Акаунт вже відкрито",
          description: `Акаунт ${accountId} вже запущено`,
          variant: "destructive",
        });
        return;
      }

      // Get saved settings to get telegram folder path
      const savedSettings = localStorage.getItem('appSettings');
      if (!savedSettings) {
        toast({
          title: "Помилка",
          description: "Спочатку налаштуйте шлях до папки з акаунтами",
          variant: "destructive",
        });
        return;
      }

      const settings = JSON.parse(savedSettings);
      if (!settings.telegramFolderPath) {
        toast({
          title: "Помилка",
          description: "Спочатку налаштуйте шлях до папки з акаунтами",
          variant: "destructive",
        });
        return;
      }

      console.log(`Launching account ${accountId} from folder: ${settings.telegramFolderPath}`);
      
      const pid = await launchSingleAccount(accountId, settings.telegramFolderPath) as number;
      
      // Add to open accounts map
      setOpenAccounts(prev => new Map(prev.set(accountId, pid)));
      
      toast({
        title: "Акаунт відкрито",
        description: `Акаунт ${accountId} успішно запущено (PID: ${pid})`,
      });
    } catch (error) {
      console.error('Error launching account:', error);
      toast({
        title: "Помилка відкриття",
        description: `Не вдалося відкрити акаунт: ${error}`,
        variant: "destructive",
      });
    }
  };

  // Function to close account
  const handleCloseAccount = async (accountId: number) => {
    try {
      const pid = openAccounts.get(accountId);
      
      if (pid) {
        // If we have the PID, close using specific process
        console.log(`Closing account ${accountId} with PID: ${pid}`);
        await closeTelegramProcesses([pid]);
      } else {
        // If no PID (manually opened), try to close by account detection
        console.log(`Closing manually opened account ${accountId}`);
        await closeSingleAccount(accountId);
      }
      
      // Remove from open accounts map
      setOpenAccounts(prev => {
        const newMap = new Map(prev);
        newMap.delete(accountId);
        return newMap;
      });
      
      toast({
        title: "Акаунт закрито",
        description: `Акаунт ${accountId} успішно закрито`,
      });
      
      // Verify the process is actually closed by checking running processes
      setTimeout(async () => {
        try {
          const runningPids = await getRunningTelegramProcesses() as string[];
          console.log('Verification - Running PIDs after close:', runningPids);
          
          // If the process is still running, remove it from the map
          if (pid && runningPids.includes(pid.toString())) {
            console.log(`Process ${pid} still running, removing from open accounts`);
            setOpenAccounts(prev => {
              const newMap = new Map(prev);
              newMap.delete(accountId);
              return newMap;
            });
          }
        } catch (error) {
          console.error('Error verifying process closure:', error);
        }
      }, 1000); // Check after 1 second
      
    } catch (error) {
      console.error('Error closing account:', error);
      toast({
        title: "Помилка закриття",
        description: `Не вдалося закрити акаунт: ${error}`,
        variant: "destructive",
      });
    }
  };

  // Function to toggle account open/close
  const handleToggleAccount = (accountId: number) => {
    if (openAccounts.has(accountId)) {
      handleCloseAccount(accountId);
    } else {
      handleOpenAccount(accountId);
    }
  };

  // Filter accounts based on selected filter
  const filteredAccounts = accounts.filter(account => {
    if (accountFilter === "all") return true;
    return account.status === accountFilter;
  });

  // Calculate stats based on filter
  const stats = {
    total: filteredAccounts.length,
    active: filteredAccounts.filter(a => a.status === 'активні').length,
    blocked: filteredAccounts.filter(a => a.status === 'заблоковані').length
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

  // Check for manually opened Telegram processes
  useEffect(() => {
    const checkManualAccounts = async () => {
      try {
        const runningPids = await getRunningTelegramProcesses() as string[];
        console.log('Running Telegram PIDs:', runningPids);
        console.log('Current accounts:', accounts.map(a => ({ id: a.id, name: a.name })));
        console.log('Current open accounts:', Array.from(openAccounts.entries()));
        
        // Get saved settings to check telegram folder path
        const savedSettings = localStorage.getItem('appSettings');
        if (!savedSettings) return;
        
        const settings = JSON.parse(savedSettings);
        if (!settings.telegramFolderPath) return;
        
        console.log('Checking accounts in folder:', settings.telegramFolderPath);
        
        // Only consider processes that match accounts in our farm folder
        if (runningPids.length > 0 && accounts.length > 0) {
          const currentOpenPids = Array.from(openAccounts.values()).map(pid => pid.toString());
          const newPids = runningPids.filter(pid => !currentOpenPids.includes(pid));
          
          console.log('Current open PIDs:', currentOpenPids);
          console.log('New PIDs to process:', newPids);
          
          if (newPids.length > 0) {
            // Find accounts that aren't already marked as open
            const availableAccounts = accounts.filter(account => !openAccounts.has(account.id));
            console.log('Available accounts for marking:', availableAccounts.map(a => ({ id: a.id, name: a.name })));
            
            // Only mark as many accounts as we have processes AND accounts available
            const maxAccountsToMark = Math.min(newPids.length, availableAccounts.length);
            const accountsToMark = availableAccounts.slice(0, maxAccountsToMark);
            const newOpenAccounts = new Map(openAccounts);
            
            console.log('Planning to mark accounts:', accountsToMark.map(a => ({ id: a.id, name: a.name })));
            console.log('With PIDs:', newPids.slice(0, accountsToMark.length));
            
            accountsToMark.forEach((account, index) => {
              if (index < newPids.length) {
                const pid = parseInt(newPids[index]);
                newOpenAccounts.set(account.id, pid);
                console.log(`Marking account ${account.id} (${account.name}) as open with PID ${pid}`);
              }
            });
            
            if (accountsToMark.length > 0) {
              setOpenAccounts(newOpenAccounts);
              console.log(`Updated open accounts: ${accountsToMark.length} new processes detected`);
              console.log('Final open accounts map:', Array.from(newOpenAccounts.entries()));
            }
          } else {
            // Check if any open accounts are no longer running
            const stillRunningPids = new Set(runningPids);
            const accountsToRemove = Array.from(openAccounts.entries())
              .filter(([accountId, pid]) => !stillRunningPids.has(pid.toString()));
            
            if (accountsToRemove.length > 0) {
              console.log('Removing closed accounts:', accountsToRemove);
              const newOpenAccounts = new Map(openAccounts);
              accountsToRemove.forEach(([accountId]) => newOpenAccounts.delete(accountId));
              setOpenAccounts(newOpenAccounts);
            }
          }
        } else {
          // No running processes, clear all open accounts
          if (openAccounts.size > 0) {
            console.log('No running processes, clearing all open accounts');
            setOpenAccounts(new Map());
          }
        }
      } catch (error) {
        console.error('Error checking manual accounts:', error);
      }
    };

    // Check on mount and periodically
    checkManualAccounts();
    const interval = setInterval(checkManualAccounts, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [accounts, openAccounts]);

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
        description: "Будь ласка, виберіть проект спочатку",
        variant: "destructive",
      });
      return;
    }

    if (!startRange || !endRange) {
      toast({
        title: "Помилка",
        description: "Будь ласка, вкажіть діапазон акаунтів",
        variant: "destructive",
      });
      return;
    }

    const start = parseInt(startRange);
    const end = parseInt(endRange);

    if (start > end) {
      toast({
        title: "Помилка",
        description: "Початковий номер не може бути більшим за кінцевий",
        variant: "destructive",
      });
      return;
    }

    // Get saved settings to get telegram folder path
    const savedSettings = localStorage.getItem('appSettings');
    if (!savedSettings) {
      toast({
        title: "Помилка",
        description: "Спочатку налаштуйте шлях до папки з акаунтами",
        variant: "destructive",
      });
      return;
    }

    const settings = JSON.parse(savedSettings);
    if (!settings.telegramFolderPath) {
      toast({
        title: "Помилка",
        description: "Спочатку налаштуйте шлях до папки з акаунтами",
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
        title: "Запуск розпочато",
        description: `Запущено ${pids.length} профілів. Натисніть F6 для продовження.`,
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
        title: "Кастомне посилання додано",
        description: `Проект ${app_name} додано`,
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
        title: "Проект видалено",
        description: `Проект ${projectName} успішно видалено`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Помилка видалення",
        description: `Не вдалося видалити проект ${projectName}`,
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
          title: "Помилка додавання",
          description: "Проект з такою назвою вже існує",
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
          title: "Помилка оновлення",
          description: "Не вдалося оновити проект",
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
        description: "Немає активних процесів для продовження",
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
        title: "Процеси завершено",
        description: "Усі запущені процеси Telegram завершено",
      });

      // Continue with next batch if needed
      // This would require additional logic to track remaining accounts
      
    } catch (error) {
      console.error('Error closing processes:', error);
      toast({
        title: "Помилка завершення",
        description: `Не вдалося завершити процеси: ${error}`,
        variant: "destructive",
      });
    }
  };

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
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Проект</Label>
                    <div className="flex items-center gap-2">
                      <Select value={selectedProject} onValueChange={handleProjectChange}>
                        <SelectTrigger className="bg-black/50 border-white/10 h-10 rounded-xl focus:ring-0 focus:ring-offset-0 focus:border-white/20 text-white flex-1">
                          <SelectValue placeholder="Виберіть проект" />
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
                <AccountStatsWidget />
              </div>
            </div>

            {/* Right column - Calendar and Daily Tasks stacked */}
            <div className="flex flex-col gap-6 h-[436px]">
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
                className="flex flex-col h-full"
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
            <h3 className="text-2xl font-display font-bold text-white mb-6">
              Список акаунтів
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account, index) => (
                    <motion.div
                      key={account.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        duration: 0.3,
                        ease: "easeInOut"
                      }}
                      className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all cursor-pointer"
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-white truncate">{account.id}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            account.status === 'активні' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {account.status}
                          </span>
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
                            variant="outline" 
                            className={`h-8 w-8 rounded-lg transition-all ${
                              openAccounts.has(account.id) 
                                ? "border-primary/50 bg-primary/10 hover:bg-primary/20 hover:border-primary" 
                                : "border-white/10 hover:bg-white/10 hover:border-white/20"
                            }`}
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
                                  <X className="w-3 h-3 text-primary" />
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
                    key="empty-state"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ 
                      duration: 0.3,
                      ease: "easeInOut"
                    }}
                    className="col-span-full flex flex-col items-center justify-center py-16 text-center"
                  >
                    <Ghost className="w-16 h-16 text-slate-400 mb-4" />
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
              </AnimatePresence>
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
