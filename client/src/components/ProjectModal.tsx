import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface ProjectData {
  name: string;
  ref_link: string;
}

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: ProjectData) => void;
  project?: ProjectData | null;
  mode: "add" | "edit";
}

export function ProjectModal({ isOpen, onClose, onSave, project, mode }: ProjectModalProps) {
  const { toast } = useToast();
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const [formData, setFormData] = useState<ProjectData>({
    name: "",
    ref_link: "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: "", ref_link: "" });
      setErrors([]);
      return;
    }

    if (project && mode === "edit") {
      setFormData(project);
    } else {
      setFormData({ name: "", ref_link: "" });
    }

    setErrors([]);
  }, [isOpen, project, mode]);

  const validateProject = (data: ProjectData): string[] => {
    const validationErrors: string[] = [];

    if (!data.name || data.name.trim().length < 2) {
      validationErrors.push(
        tr(
          "Назва проєкту має містити мінімум 2 символи",
          "Project name must contain at least 2 characters",
          "Название проекта должно содержать минимум 2 символа"
        )
      );
    }

    if (!data.ref_link || data.ref_link.trim().length === 0) {
      validationErrors.push(tr("Посилання обов'язкове", "Link is required", "Ссылка обязательна"));
    }

    return validationErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateProject(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSave(formData);
    setFormData({ name: "", ref_link: "" });
    onClose();

    toast({
      title: mode === "edit"
        ? tr("Проєкт оновлено", "Project updated", "Проект обновлен")
        : tr("Проєкт додано", "Project added", "Проект добавлен"),
      description: tr(
        `Проєкт "${formData.name}" успішно збережено`,
        `Project "${formData.name}" saved successfully`,
        `Проект "${formData.name}" успешно сохранен`
      ),
    });
  };

  const handleInputChange = (field: keyof ProjectData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors.length > 0) setErrors([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold text-white">
            {mode === "edit"
              ? tr("Редагувати проєкт", "Edit project", "Редактировать проект")
              : tr("Додати проєкт", "Add project", "Добавить проект")}
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="new-password">
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-normal text-muted-foreground">
              {tr("Назва проєкту", "Project name", "Название проекта")}
            </Label>
            <Input
              id="name"
              name="project_name"
              autoComplete="new-password"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="bg-black/50 border-white/10 h-12 rounded-xl text-white placeholder:text-gray-500 focus:border-white/10"
              placeholder={tr("Введіть назву проєкту", "Enter project name", "Введите название проекта")}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="ref_link" className="text-sm font-normal text-muted-foreground">
              {tr("Посилання на проєкт", "Project link", "Ссылка на проект")}
            </Label>
            <Input
              id="ref_link"
              name="project_ref_link"
              autoComplete="new-password"
              value={formData.ref_link}
              onChange={(e) => handleInputChange("ref_link", e.target.value)}
              className="bg-black/50 border-white/10 h-12 rounded-xl text-white placeholder:text-gray-500 focus:border-white/10"
              placeholder="https://t.me/your_bot"
            />
          </div>

          {errors.length > 0 ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
              {errors.map((error, index) => (
                <p key={index} className="text-red-400 text-sm">
                  {error}
                </p>
              ))}
            </div>
          ) : null}

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
              {mode === "edit"
                ? tr("Зберегти", "Save", "Сохранить")
                : tr("Додати", "Add", "Добавить")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
