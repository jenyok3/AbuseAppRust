import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export default function Chrome() {
  const { t } = useI18n();
  useEffect(() => {
    document.body.style.backgroundColor = "#000000";
    document.body.style.backgroundImage = "none";
    document.body.style.background = "#000000";

    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = "";
      document.body.style.background = "";
    };
  }, []);

  return (
    <div className="h-full min-h-0 bg-transparent text-white flex items-center justify-center px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-white/80 mb-4">{t("chrome.title")}</h1>
        <p className="text-white/60">{t("chrome.description")}</p>
      </div>
    </div>
  );
}
