import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="h-full min-h-0 w-full flex items-center justify-center bg-transparent p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-destructive font-bold text-xl items-center">
            <AlertCircle className="h-8 w-8" />
            <h1>{t("notFound.title")}</h1>
          </div>
          
          <p className="mt-4 text-sm text-zinc-400 font-mono">
            {t("notFound.description")}
          </p>

          <div className="mt-8">
            <Link href="/">
              <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold">
                {t("notFound.back")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
