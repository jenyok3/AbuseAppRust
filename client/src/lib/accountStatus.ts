export const accountStatus = {
  active: "active",
  blocked: "blocked",
  inactive: "inactive",
} as const;

export type AccountStatus = (typeof accountStatus)[keyof typeof accountStatus];

export const accountStatusLabels: Record<AccountStatus, string> = {
  active: "активні",
  blocked: "заблоковані",
  inactive: "неактивні",
};
