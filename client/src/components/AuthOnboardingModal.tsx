"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

type AuthOnboardingModalProps = {
  open: boolean;
  onTelegramLogin: (username: string) => void;
  onSkip: () => void;
};

export function AuthOnboardingModal({ open, onTelegramLogin, onSkip }: AuthOnboardingModalProps) {
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const [username, setUsername] = useState("");
  const normalized = username.trim().replace(/^@+/, "");
  const isValid =
    normalized.length >= 5 &&
    normalized.length <= 32 &&
    /^[a-zA-Z0-9_]+$/.test(normalized);
  const canSubmit = isValid;

  return (
    <Dialog open={open}>
      <DialogContent hideClose className="bg-black/50 border-white/10 text-white max-w-md rounded-3xl backdrop-blur-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-display">
            {tr("Ваш Telegram юзернейм", "Your Telegram username", "Ваш Telegram юзернейм")}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {tr(
              "Вхід не обов'язковий. Вкажіть `@username` або пропустіть.",
              "Sign-in is optional. Enter `@username` or skip.",
              "Вход не обязателен. Укажите `@username` или пропустите."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 h-11">
            <span className="text-white/40 text-sm">@</span>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
              placeholder="telegram_user"
              className="h-9 border-0 bg-transparent px-0 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          {!canSubmit && normalized.length > 0 ? (
            <div className="text-xs text-red-300">
              {tr(
                "Юзернейм: 5-32 символи, тільки латиниця, цифри або підкреслення.",
                "Username: 5-32 characters, only latin letters, digits or underscore.",
                "Юзернейм: 5-32 символа, только латиница, цифры или подчёркивание."
              )}
            </div>
          ) : null}
          <Button
            onClick={() => onTelegramLogin(normalized)}
            disabled={!canSubmit}
            className="h-11 px-5 border-0 bg-[#1f88c9] hover:bg-[#1a76ad] text-white font-semibold disabled:opacity-40 disabled:hover:bg-[#1f88c9] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
          >
            <Send className="w-4 h-4 mr-2" />
            {tr("Зберегти юзернейм", "Save username", "Сохранить юзернейм")}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            {tr("Пропустити", "Skip", "Пропустить")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
