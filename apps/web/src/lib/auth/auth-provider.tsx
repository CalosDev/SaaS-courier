"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiClient } from "@/lib/api/client";
import type {
  AuthenticationMembership,
  AuthorizationResponse,
  LoginResponse,
  SessionContext,
} from "@/lib/api/contracts";
import { onForbidden, onUnauthorized } from "@/lib/api/auth-events";
import type { PermissionCode } from "@/lib/permissions";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | {
      status: "authenticated";
      session: SessionContext;
      permissionCodes: PermissionCode[];
    };

type AuthContextValue = {
  state: AuthState;
  login: (input: { email: string; password: string }) => Promise<LoginResponse>;
  selectOrganization: (organizationId: string) => Promise<SessionContext>;
  logout: () => Promise<void>;
  refreshAuthorization: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = new Set(["/login", "/activate"]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refreshAuthorization = useCallback(async () => {
    const currentState = state;

    if (currentState.status !== "authenticated") {
      return;
    }

    try {
      const authorization =
        await apiClient.get<AuthorizationResponse>("/auth/authorization");

      setState({
        status: "authenticated",
        session: currentState.session,
        permissionCodes: authorization.permissionCodes,
      });
    } catch {
      // 403/401 handling is driven by the API client event hooks.
    }
  }, [state]);

  const restoreSession = useCallback(async () => {
    try {
      const sessionResponse = await apiClient.get<{ session: SessionContext }>(
        "/auth/session",
      );
      const authorization =
        await apiClient.get<AuthorizationResponse>("/auth/authorization");

      setState({
        status: "authenticated",
        session: sessionResponse.session,
        permissionCodes: authorization.permissionCodes,
      });
    } catch {
      setState({ status: "anonymous" });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void restoreSession();
    });
  }, [restoreSession]);

  useEffect(() => {
    return onUnauthorized(() => {
      apiClient.clearCsrf();
      setState({ status: "anonymous" });

      if (!PUBLIC_PATHS.has(pathname)) {
        router.replace("/login");
      }
    });
  }, [pathname, router]);

  useEffect(() => {
    return onForbidden(() => {
      void refreshAuthorization();
    });
  }, [refreshAuthorization]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const response = await apiClient.post<LoginResponse>("/auth/login", input);

      if (response.status === "authenticated") {
        const authorization =
          await apiClient.get<AuthorizationResponse>("/auth/authorization");

        setState({
          status: "authenticated",
          session: response.session,
          permissionCodes: authorization.permissionCodes,
        });
      }

      return response;
    },
    [],
  );

  const selectOrganization = useCallback(async (organizationId: string) => {
    const response = await apiClient.post<{
      status: "authenticated";
      session: SessionContext;
    }>("/auth/select-organization", {
      organizationId,
    });
    const authorization =
      await apiClient.get<AuthorizationResponse>("/auth/authorization");

    setState({
      status: "authenticated",
      session: response.session,
      permissionCodes: authorization.permissionCodes,
    });

    return response.session;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post<void>("/auth/logout", {});
    } catch {
      // Logout must remain idempotent for an already-invalid session.
    } finally {
      apiClient.clearCsrf();
      setState({ status: "anonymous" });
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login,
      selectOrganization,
      logout,
      refreshAuthorization,
      restoreSession,
    }),
    [login, logout, refreshAuthorization, restoreSession, selectOrganization, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

export type { AuthState, AuthenticationMembership };
