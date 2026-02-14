// Інтерфейс для Telegram посилань, що відповідає структурі Rust
export interface TelegramLink {
  api_id?: string;
  api_hash?: string;
  phone?: string;
  app_name: string;
  app_type?: string;
  ref_link?: string;
  mixed?: "yes" | "no";
}
