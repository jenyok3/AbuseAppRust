import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountStatsWidget } from "@/components/AccountStatsWidget";
import { DailyTasksPanel } from "@/components/DailyTasksPanel";

vi.mock("@/hooks/use-dashboard", () => ({
  useDailyTasks: () => ({ data: [], isLoading: false }),
  useCreateDailyTask: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleDailyTask: () => ({ mutate: vi.fn() }),
  useDeleteDailyTask: () => ({ mutate: vi.fn() }),
  useUpdateDailyTask: () => ({ mutate: vi.fn() }),
}));

describe("UI smoke tests", () => {
  it("renders account stats widget", () => {
    render(<AccountStatsWidget stats={{ total: 3, running: 2, blocked: 1 }} />);
    expect(screen.getByText("Статистика акаунтів")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("renders daily tasks panel with empty state", () => {
    render(<DailyTasksPanel />);
    expect(screen.getByText("Немає щоденних завдань")).toBeInTheDocument();
  });
});
