import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { Account } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { launchAccounts } from "@/lib/tauri-api";

export default function Accounts() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: [api.accounts.list.path],
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const res = await apiRequest("PATCH", buildUrl(api.accounts.updateNotes.path, { id }), { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      toast({ title: "Нотатки оновлено" });
    },
  });

  const handleOpenAccount = async (accountId: number) => {
    try {
      await launchAccounts([accountId.toString()]);
      toast({
        title: "Акаунт відкрито",
        description: `Акаунт ${accountId} успішно запущено`,
      });
    } catch (error) {
      toast({
        title: "Помилка відкриття",
        description: "Не вдалося відкрити акаунт",
        variant: "destructive",
      });
    }
  };

  const filteredAccounts = accounts?.filter((acc) =>
    acc.name.toLowerCase().includes(search.toLowerCase()) ||
    (acc.notes || "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-black text-white p-6 space-y-6">
      <div className="flex justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Пошук акаунтів..."
            className="pl-10 bg-white/5 border-white/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-accounts"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts?.map((account, index) => (
          <Card key={account.id} className="hover-elevate border-white/10 bg-card/40 backdrop-blur-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-lg" data-testid={`text-account-name-${account.id}`}>
                  {account.id}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  account.status === "live" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                }`}>
                  {account.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Додати нотатки..."
                    className="bg-black/40 border-white/5 placeholder:text-gray-500"
                    defaultValue=""
                    onBlur={(e) => {
                      if (e.target.value !== (account.notes || "")) {
                        updateNotesMutation.mutate({ id: account.id, notes: e.target.value });
                      }
                    }}
                    data-testid={`input-notes-${account.id}`}
                  />
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all" 
                    data-testid={`button-open-${account.id}`}
                    onClick={() => handleOpenAccount(account.id)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
