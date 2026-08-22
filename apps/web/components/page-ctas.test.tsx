// @vitest-environment jsdom
import React, { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HomePage from "@/app/page";
import ProjectDetailPage from "@/app/projects/[id]/page";
import DashboardPage from "@/app/dashboard/page";
import LoginPage from "@/app/auth/login/page";
import RegisterPage from "@/app/auth/register/page";
import { getCurrentUser } from "@/lib/auth-v2/client-actions";
import { viewerClient } from "@/lib/auth-v2/viewer-client";
import { operationRequest, useOperation } from "@/lib/operations/client";
import { AuthProvider } from "@/lib/auth-context";

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("@/lib/auth-v2/client-actions", () => ({
  getCurrentUser: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUpWithEmail: vi.fn(),
}));

vi.mock("@/lib/auth-v2/viewer-client", () => ({
  viewerClient: {
    viewer: vi.fn(),
    enroll: vi.fn(),
  },
}));

vi.mock("@/lib/operations/client", () => ({
  useOperation: vi.fn(),
  operationRequest: vi.fn(),
  userFacingError: (err: unknown) => (err instanceof Error ? err.message : "Error"),
}));

describe("Contextual Page CTAs and Auth Redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operationRequest).mockResolvedValue({
      me: null,
      dashboardContext: { myTeams: [] },
    });
  });

  describe("HomePage contextual CTAs", () => {
    it("renders Register for anonymous users", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({ state: "unauthenticated" });
      vi.mocked(useOperation).mockReturnValue({ data: { projects: [] }, error: null, loading: false, reload: vi.fn() } as any);

      render(
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /Register/ })).toBeTruthy();
      });
    });

    it("renders Choose Role for authenticated unenrolled users", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({ state: "unenrolled" });
      vi.mocked(useOperation).mockReturnValue({ data: { projects: [] }, error: null, loading: false, reload: vi.fn() } as any);

      render(
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /Choose Role/ })).toBeTruthy();
      });
    });

    it("renders Complete Profile for enrolled users with an incomplete profile", async () => {
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
      vi.mocked(useOperation).mockReturnValue({ data: { projects: [] }, error: null, loading: false, reload: vi.fn() } as any);

      render(
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /Complete Profile/ }).getAttribute("href")).toBe("/settings/profile");
      });
      expect(screen.queryByRole("link", { name: /Choose Role/ })).toBeNull();
    });
    it("renders Dashboard for ready profile users", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({
        state: "ready",
        viewer: {
          productUserId: "u1",
          accountState: "ACTIVE",
          onboardingState: "COMPLETE",
          username: "student",
          displayName: "Student User",
          selfServiceRoles: ["STUDENT"],
        },
      });
      vi.mocked(useOperation).mockReturnValue({ data: { projects: [] }, error: null, loading: false, reload: vi.fn() } as any);

      render(
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /Dashboard/ })).toBeTruthy();
      });
    });
  });

  describe("Project Detail Application Modal", () => {
    const projectResult = {
      data: {
        project: {
          id: "p1",
          title: "Test Project",
          description: "Desc",
          status: "OPEN",
          disciplines: [],
          owner: { id: "o1", username: "owner", fullName: "Owner" },
        },
      },
      error: null,
      loading: false,
      reload: vi.fn(),
    };

    async function openApplicationModal() {
      vi.mocked(useOperation).mockReturnValue(projectResult as any);
      const params = Promise.resolve({ id: "p1" });
      await act(async () => {
        render(
          <Suspense fallback={null}>
            <AuthProvider>
              <ProjectDetailPage params={params} />
            </AuthProvider>
          </Suspense>
        );
      });
      screen.getByRole("button", { name: "Apply with Team" }).click();
    }

    it("offers Log In for anonymous users when applying", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({ state: "unauthenticated" });
      await openApplicationModal();

      await waitFor(() => {
        expect(screen.getByText("You must log in to submit a project application.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Log In" })).toBeTruthy();
      });
    });

    it("offers Choose Role for authenticated unenrolled users when applying", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({ state: "unenrolled" });
      await openApplicationModal();

      await waitFor(() => {
        expect(screen.getByText("Choose a role before applying for projects.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Choose Role" })).toBeTruthy();
      });
    });

    it("offers Complete Profile for enrolled users with incomplete profiles", async () => {
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
      await openApplicationModal();

      await waitFor(() => {
        const link = screen.getByRole("link", { name: "Complete Profile" });
        expect(link.getAttribute("href")).toBe("/settings/profile");
      });
    });
  });
  describe("Dashboard Error View", () => {
    it("renders Sign In Again for anonymous errors", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      vi.mocked(viewerClient.viewer).mockRejectedValue(new Error("Session expired"));

      render(
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("link", { name: "Sign In Again" })).toBeTruthy();
      });
    });

    it("renders Retry and product links for authenticated failures", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({
        state: "ready",
        viewer: {
          productUserId: "u1",
          accountState: "ACTIVE",
          onboardingState: "COMPLETE",
          username: "student",
          displayName: "Student",
          selfServiceRoles: ["STUDENT"],
        },
      });
      vi.mocked(operationRequest).mockRejectedValue(new Error("Database connection failed"));

      render(
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Database connection failed")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Browse Teams" })).toBeTruthy();
      });
      expect(screen.queryByRole("link", { name: "Sign In Again" })).toBeNull();
    });
  });

  describe("Auth Pages Redirects", () => {
    it("redirects authenticated unenrolled users from login to onboarding", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({ state: "unenrolled" });

      render(
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/onboarding");
      });
    });

    it("redirects enrolled users with incomplete profiles to profile settings", async () => {
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
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/settings/profile");
      });
    });
    it("redirects authenticated ready users from register to dashboard", async () => {
      vi.mocked(viewerClient.viewer).mockResolvedValue({
        state: "ready",
        viewer: {
          productUserId: "u1",
          accountState: "ACTIVE",
          onboardingState: "COMPLETE",
          username: "student",
          displayName: "Student",
          selfServiceRoles: ["STUDENT"],
        },
      });

      render(
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/dashboard");
      });
    });
  });
});
