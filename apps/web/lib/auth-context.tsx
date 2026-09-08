"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "./auth-v2/client-actions";
import { subscribeToSessionInvalidation } from "./auth-v2/session-events";
import { viewerClient } from "./auth-v2/viewer-client";
import type { ViewerBootstrapV1 } from "./auth-v2/viewer-contract";
import type { User } from "@/types/domain";

export type SessionState = "loading" | "anonymous" | "authenticated";
export type ProductViewerState = "loading" | "unavailable" | "unenrolled" | "profile-incomplete" | "ready";

export type AuthContextType = {
  sessionState: SessionState;
  productViewerState: ProductViewerState;
  user: User | null;
  sessionError: string | null;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [productViewerState, setProductViewerState] = useState<ProductViewerState>("loading");
  const [viewer, setViewer] = useState<ViewerBootstrapV1 | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    setSessionError(null);

    try {
      const result = await viewerClient.viewer();
      if (result.state === "unauthenticated") {
        setSessionState("anonymous");
        setProductViewerState("unavailable");
        setViewer(null);
        return;
      }

      if (result.state === "unenrolled") {
        setSessionState("authenticated");
        setProductViewerState("unenrolled");
        setViewer(null);
        return;
      }

      setSessionState("authenticated");
      setViewer(result.viewer);
      setProductViewerState(
        result.viewer.onboardingState === "COMPLETE" && result.viewer.username && result.viewer.displayName
          ? "ready"
          : "profile-incomplete",
      );
    } catch (error) {
      try {
        if (await getCurrentUser()) {
          setSessionState("authenticated");
          setProductViewerState("unavailable");
          setViewer(null);
          setSessionError(error instanceof Error ? error.message : "Unable to load account state.");
          return;
        }
      } catch {
        // Both session checks failed, so fail closed as anonymous.
      }

      setSessionState("anonymous");
      setProductViewerState("unavailable");
      setViewer(null);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [pathname, refreshAuth]);

  useEffect(() => subscribeToSessionInvalidation(() => {
    void refreshAuth();
  }), [refreshAuth]);

  const user = productViewerState === "ready" && viewer?.username && viewer.displayName
    ? { id: viewer.productUserId, username: viewer.username, fullName: viewer.displayName }
    : null;

  return (
    <AuthContext.Provider value={{ sessionState, productViewerState, user, sessionError, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within AuthProvider.");
  return context;
}