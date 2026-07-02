import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitUnauthorizedEvent } from "@/lib/api/auth-events";
import { AuthProvider, useAuth } from "@/lib/auth/auth-provider";

const { replaceMock, apiClientMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  apiClientMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    clearCsrf: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiClientMock,
}));

function AuthStateProbe() {
  const { state } = useAuth();

  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="permissions">
        {state.status === "authenticated" ? state.permissionCodes.join(",") : ""}
      </span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    Object.values(apiClientMock).forEach((mock) => mock.mockReset());
  });

  it("restores the authenticated session into memory", async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        session: {
          sessionId: "session-1",
          userId: "user-1",
          email: "admin@courier.test",
          organizationId: "org-1",
          organizationSlug: "org-1",
          organizationName: "Courier One",
          employeeId: "employee-1",
          firstName: "Ada",
          lastName: "Lovelace",
          facilityIds: [],
          expiresAt: "2026-07-02T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        permissionCodes: ["organizations.read", "customers.read"],
      });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("permissions")).toHaveTextContent(
      "organizations.read,customers.read",
    );
  });

  it("clears auth state and redirects to login after an unauthorized event", async () => {
    apiClientMock.get
      .mockResolvedValueOnce({
        session: {
          sessionId: "session-1",
          userId: "user-1",
          email: "admin@courier.test",
          organizationId: "org-1",
          organizationSlug: "org-1",
          organizationName: "Courier One",
          employeeId: "employee-1",
          firstName: "Ada",
          lastName: "Lovelace",
          facilityIds: [],
          expiresAt: "2026-07-02T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        permissionCodes: ["organizations.read"],
      });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });

    act(() => {
      emitUnauthorizedEvent();
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
    });
    expect(apiClientMock.clearCsrf).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
