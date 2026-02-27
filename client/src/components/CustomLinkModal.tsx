import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface CustomLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export function CustomLinkModal({ isOpen, onClose, onSubmit }: CustomLinkModalProps) {
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  const validateUrl = (value: string): string[] => {
    const validationErrors: string[] = [];

    if (!value || value.trim().length === 0) {
      validationErrors.push(tr("Посилання обов'язкове", "Link is required", "Ссылка обязательна"));
      return validationErrors;
    }

    try {
      new URL(value);
    } catch {
      validationErrors.push(tr("Некоректне посилання", "Invalid link", "Некорректная ссылка"));
    }

    if (!value.startsWith("https://t.me/") && !value.startsWith("tg://")) {
      validationErrors.push(
        tr(
          "Посилання має починатися з https://t.me/ або tg://",
          "Link must start with https://t.me/ or tg://",
          "Ссылка должна начинаться с https://t.me/ или tg://"
        )
      );
    }

    return validationErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateUrl(url);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSubmit(url.trim());
    onClose();
    setUrl("");
    setErrors([]);
  };

  const handleInputChange = (value: string) => {
    setUrl(value);
    if (errors.length > 0) setErrors([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold text-white">{tr("Своє посилання", "Custom link", "Своя ссылка")}</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <div className="space-y-3">
            <Label htmlFor="url" className="text-sm font-normal text-muted-foreground">
              {tr("Посилання на проєкт", "Project link", "Ссылка на проект")}
            </Label>
            <Input
              id="url"
              ref={inputRef}
              name="custom_link_url_nostore"
              autoComplete="off"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={url}
              onChange={(e) => handleInputChange(e.target.value)}
              className="bg-black/50 border-white/10 h-12 rounded-xl text-white placeholder:text-gray-500 focus:border-white/10 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
              placeholder="https://t.me/your_bot"
            />
          </div>

          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
              {errors.map((error, index) => (
                <p key={index} className="text-red-400 text-sm">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-4 pt-6">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-black/50 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all duration-300"
            >
              {tr("Скасувати", "Cancel", "Отмена")}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 bg-primary hover:bg-primary active:bg-primary/95 text-white border-0 shadow-none hover:shadow-none focus-visible:ring-0 rounded-xl transition-all duration-200"
            >
              {tr("Додати", "Add", "Добавить")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
