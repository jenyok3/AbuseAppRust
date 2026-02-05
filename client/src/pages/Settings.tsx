import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, Settings as SettingsIcon, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [api.settings.get.path],
  });

  const mutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const res = await fetch(api.settings.update.path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.get.path] });
      toast({
        title: "Налаштування збережено",
        description: "Ваші зміни успішно застосовані.",
      });
    },
  });

  const [telegramThreads, setTelegramThreads] = useState<string>("");
  const [telegramFolderPath, setTelegramFolderPath] = useState<string>("");
  const [chromeThreads, setChromeThreads] = useState<string>("");
  const [chromeFolderPath, setChromeFolderPath] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setTelegramThreads(String(settings.telegramThreads || "1"));
      setTelegramFolderPath(settings.telegramFolderPath || "");
      setChromeThreads(String(settings.chromeThreads || "1"));
      setChromeFolderPath(settings.chromeFolderPath || "");
    }
  }, [settings]);

  useEffect(() => {
    if (settings) {
      const changed = 
        telegramThreads !== String(settings.telegramThreads) || 
        telegramFolderPath !== settings.telegramFolderPath ||
        chromeThreads !== String(settings.chromeThreads) ||
        chromeFolderPath !== settings.chromeFolderPath;
      setHasChanges(changed);
    }
  }, [telegramThreads, telegramFolderPath, chromeThreads, chromeFolderPath, settings]);

  const handleSave = () => {
    mutation.mutate({
      telegramThreads: parseInt(telegramThreads) || 1,
      telegramFolderPath,
      chromeThreads: parseInt(chromeThreads) || 1,
      chromeFolderPath,
    });
  };

  // Handle click outside to remove focus from inputs
  const handleContainerClick = (e: React.MouseEvent) => {
    // Check if click is on input or label
    const target = e.target as HTMLElement;
    if (!target.closest('input, label, button')) {
      // Remove focus from all inputs
      (document.activeElement as HTMLInputElement)?.blur();
    }
  };

  // Apply responsive padding to cards
  useEffect(() => {
    const main = document.querySelector('main') as HTMLElement;
    const container = document.querySelector('.space-y-6') as HTMLElement;
    if (main && container) {
      // Force reset main element styles
      main.style.marginLeft = '0px !important';
      main.style.marginRight = '0px !important';
      main.style.paddingLeft = '32px !important';
      main.style.paddingRight = '0px !important';
      main.style.borderLeft = '0px !important';
      main.style.borderRight = '0px !important';
      main.style.outlineOffset = '0px';
      
      // Force apply with higher priority
      main.setAttribute('style', main.getAttribute('style') + '; margin-left: 0px !important; margin-right: 0px !important; padding-left: 32px !important; padding-right: 0px !important;');
      
      // Reset container styles
      container.style.marginLeft = '0px !important';
      container.style.marginRight = '0px !important';
      container.style.paddingLeft = '0px !important';
      container.style.paddingRight = '0px !important';
      container.style.borderLeft = '0px !important';
      container.style.borderRight = '0px !important';
      container.style.outlineOffset = '0px';
      
      // Apply responsive padding to cards
      const cardElements = container.querySelectorAll('.bg-card\\/40') as NodeListOf<HTMLElement>;
      const containerWidth = container.offsetWidth;
      const cardPadding = Math.max(32, Math.min(96, containerWidth * 0.12));
      
      cardElements.forEach((card: HTMLElement) => {
        card.style.marginLeft = `${cardPadding}px !important`;
        card.style.marginRight = `${cardPadding}px !important`;
        card.style.paddingLeft = `${cardPadding}px !important`;
        card.style.paddingRight = `${cardPadding}px !important`;
      });
      
      // Force apply with higher priority if needed
      setTimeout(() => {
        cardElements.forEach((card: HTMLElement) => {
          const currentPaddingRight = window.getComputedStyle(card).paddingRight;
          const currentPaddingLeft = window.getComputedStyle(card).paddingLeft;
          if (currentPaddingRight !== `${cardPadding}px` || currentPaddingLeft !== `${cardPadding}px`) {
            card.setAttribute('style', card.getAttribute('style') + `; padding-right: ${cardPadding}px !important; margin-right: ${cardPadding}px !important; padding-left: ${cardPadding}px !important; margin-left: ${cardPadding}px !important;`);
          }
        });
      }, 200);
    }
  }, []);

  if (isLoading) return null;

  return (
    <div className="flex-1 overflow-hidden relative font-body text-white">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 max-w-2xl mx-auto space-y-8 pl-4 md:pl-6 lg:pl-8 pr-0 h-full overflow-y-auto smooth-scroll custom-scrollbar" onClick={handleContainerClick}>
        <div className="flex items-center gap-3 mb-8 mt-16">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Налаштування</h1>
            <p className="text-muted-foreground">Керування параметрами системи</p>
          </div>
        </div>

        <div className="space-y-6 pr-0 mr-0">
          {/* Telegram Settings */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-6"
          >
            <h2 className="text-xl font-semibold">
              Telegram
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="telegramThreads" className="text-sm font-medium text-zinc-400">
                  Кількість потоків
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть кількість одночасних потоків для Telegram
                </div>
                <Input
                  id="telegramThreads"
                  type="number"
                  value={telegramThreads}
                  onChange={(e) => setTelegramThreads(e.target.value)}
                  className="bg-black/40 border-white/5 h-12 rounded-xl focus:border-primary/50 transition-all pl-4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegramFolderPath" className="text-sm font-medium text-zinc-400">
                  Шлях до папки з акаунтами
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть повний шлях до папки з акаунтами Telegram
                </div>
                <Input
                  id="telegramFolderPath"
                  value={telegramFolderPath}
                  onChange={(e) => setTelegramFolderPath(e.target.value)}
                  className="bg-black/40 border-white/5 h-12 rounded-xl focus:border-primary/50 transition-all pl-4"
                  placeholder="C:\Users\Admin\Documents\TelegramAccounts"
                />
              </div>
            </div>
          </motion.div>

          {/* Chrome Settings */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-6"
          >
            <h2 className="text-xl font-semibold">
              Chrome
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chromeThreads" className="text-sm font-medium text-zinc-400">
                  Кількість потоків
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть кількість одночасних потоків для Chrome
                </div>
                <Input
                  id="chromeThreads"
                  type="number"
                  value={chromeThreads}
                  onChange={(e) => setChromeThreads(e.target.value)}
                  className="bg-black/40 border-white/5 h-12 rounded-xl focus:border-primary/50 transition-all pl-4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chromeFolderPath" className="text-sm font-medium text-zinc-400">
                  Шлях до папки з акаунтами
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть повний шлях до папки з акаунтами Chrome
                </div>
                <Input
                  id="chromeFolderPath"
                  value={chromeFolderPath}
                  onChange={(e) => setChromeFolderPath(e.target.value)}
                  className="bg-black/40 border-white/5 h-12 rounded-xl focus:border-primary/50 transition-all pl-4"
                  placeholder="C:\Users\Admin\Documents\ChromeAccounts"
                />
              </div>
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-end pt-8 pb-8"
          >
            <Button 
              onClick={handleSave}
              disabled={!hasChanges || mutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {mutation.isPending ? "Збереження..." : "Зберегти"}
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
