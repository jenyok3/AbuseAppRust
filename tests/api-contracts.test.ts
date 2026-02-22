import { describe, expect, it } from "vitest";
import { api, buildUrl } from "@shared/routes";

describe("API contracts", () => {
  it("buildUrl substitutes params", () => {
    const url = buildUrl(api.projects.delete.path, { id: 42 });
    expect(url).toBe("/api/projects/42");
  });

  it("validates project creation input", () => {
    const parsed = api.projects.create.input.parse({
      name: "Test Project",
      type: "telegram",
    });
    expect(parsed.name).toBe("Test Project");
  });

  it("rejects invalid account status values", () => {
    expect(() =>
      api.accounts.create.input.parse({
        projectId: 1,
        name: "acc_1",
        status: "live",
      })
    ).toThrow();
  });

  it("accepts valid account status values", () => {
    const parsed = api.accounts.create.input.parse({
      projectId: 1,
      name: "acc_1",
      status: "active",
    });
    expect(parsed.status).toBe("active");
  });

  it("validates stats response shape", () => {
    const parsed = api.stats.get.responses[200].parse({
      totalAccounts: 10,
      liveAccounts: 8,
      blockedAccounts: 2,
      livePercent: 80,
    });
    expect(parsed.totalAccounts).toBe(10);
  });
});
