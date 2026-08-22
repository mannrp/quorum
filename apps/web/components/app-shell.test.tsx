// @vitest-environment jsdom
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppShell } from "./app-shell";
import { getCurrentUser, signOut } from "@/lib/auth-v2/client-actions";
import { viewerClient } from "@/lib/auth-v2/viewer-client";
import { publishSessionInvalidated } from "@/lib/auth-v2/session-events";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

vi.mock("@/lib/auth-v2/client-actions", () => ({
  getCurrentUser: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth-v2/viewer-client", () => ({
  viewerClient: {
    viewer: vi.fn(),
  },
}));

vi.mock("@/lib/operations/client", () => ({
  clearOperationCache: vi.fn(),
  operationRequest: vi.fn().mockResolvedValue({
    dashboardContext: { unreadMessages: 0, unreadNotifications: 0 },
  }),
}));

describe("AppShell auth state and navigation header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.pathname = "/";
  });

  it("renders anonymous header with Log In and Join Now when session is absent", async () => {
    vi.mocked(viewerClient.viewer).mockResolvedValue({ state: "unauthenticated" });

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Log In" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Join Now" })).toBeTruthy();
    });
    expect(screen.queryByText("Sign Out")).toBeNull();
  });

  it("renders Sign Out only for authenticated unenrolled users", async () => {
    vi.mocked(viewerClient.viewer).mockResolvedValue({ state: "unenrolled" });

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "Log In" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Join Now" })).toBeNull();
    expect(screen.getByRole("link", { name: "Choose Role" })).toBeTruthy();
  });

  it("renders Sign Out only for authenticated incomplete-profile users", async () => {
    vi.mocked(viewerClient.viewer).mockResolvedValue({
      state: "ready",
      viewer: {
        productUserId: "u1",
        accountState: "ACTIVE",
        onboardingState: "NOT_STARTED",
        username: null,
        displayName: null,
        selfServiceRoles: ["STUDENT"],
      },
    });

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "Log In" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Join Now" })).toBeNull();
    expect(screen.getByRole("link", { name: "Complete Profile" }).getAttribute("href")).toBe("/settings/profile");
    expect(screen.queryByRole("link", { name: "Choose Role" })).toBeNull();
  });

  it("renders avatar profile link plus Sign Out for ready profile users", async () => {
    vi.mocked(viewerClient.viewer).mockResolvedValue({
      state: "ready",
      viewer: {
        productUserId: "u1",
        accountState: "ACTIVE",
        onboardingState: "COMPLETE",
        username: "testuser",
        displayName: "Test User",
        selfServiceRoles: ["STUDENT"],
      },
    });

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeTruthy();
      expect(screen.getByText("Sign Out")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "Log In" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Join Now" })).toBeNull();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
  });

  it("handles authenticated viewer failure without rendering anonymous actions", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@example.com" } as any);
    vi.mocked(viewerClient.viewer).mockRejectedValue(new Error("Viewer API error"));

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeTruthy();
      expect(screen.getByText("Viewer API error")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "Log In" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Join Now" })).toBeNull();
  });

  it("refreshes auth state on session invalidation events", async () => {
    navigation.pathname = "/settings/account";
    vi.mocked(viewerClient.viewer)
      .mockResolvedValueOnce({ state: "unenrolled" })
      .mockResolvedValueOnce({ state: "unauthenticated" });

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeTruthy();
    });

    // Simulate logout in another tab.

    await act(async () => {
      publishSessionInvalidated();
    });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Log In" })).toBeTruthy();
      expect(navigation.replace).toHaveBeenCalledWith("/auth/login");
    });
  });
});
