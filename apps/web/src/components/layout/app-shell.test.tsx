import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/app-shell";

const { useAuthMock, usePathnameMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => useAuthMock(),
}));

describe("AppShell", () => {
  it("shows the prealerts entry only when the session has prealerts.read", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        session: {
          organizationName: "Courier Uno",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@courier.test",
        },
        permissionCodes: ["organizations.read"],
      },
      logout: vi.fn(),
    });

    const { rerender } = render(
      <AppShell>
        <div>Contenido</div>
      </AppShell>,
    );

    expect(screen.queryByText("Prealertas")).not.toBeInTheDocument();

    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        session: {
          organizationName: "Courier Uno",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@courier.test",
        },
        permissionCodes: ["organizations.read", "prealerts.read"],
      },
      logout: vi.fn(),
    });

    rerender(
      <AppShell>
        <div>Contenido</div>
      </AppShell>,
    );

    expect(screen.getByText("Prealertas")).toBeInTheDocument();
  });

  it("shows the packages entry only when the session has packages.read", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        session: {
          organizationName: "Courier Uno",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@courier.test",
        },
        permissionCodes: ["organizations.read"],
      },
      logout: vi.fn(),
    });

    const { rerender } = render(
      <AppShell>
        <div>Contenido</div>
      </AppShell>,
    );

    expect(screen.queryByText("Paquetes")).not.toBeInTheDocument();

    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        session: {
          organizationName: "Courier Uno",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@courier.test",
        },
        permissionCodes: ["organizations.read", "packages.read"],
      },
      logout: vi.fn(),
    });

    rerender(
      <AppShell>
        <div>Contenido</div>
      </AppShell>,
    );

    expect(screen.getByText("Paquetes")).toBeInTheDocument();
  });

  it("shows the shipments entry only when the session has shipments.read", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        session: {
          organizationName: "Courier Uno",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@courier.test",
        },
        permissionCodes: ["organizations.read"],
      },
      logout: vi.fn(),
    });

    const { rerender } = render(
      <AppShell>
        <div>Contenido</div>
      </AppShell>,
    );

    expect(screen.queryByText("Embarques")).not.toBeInTheDocument();

    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        session: {
          organizationName: "Courier Uno",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@courier.test",
        },
        permissionCodes: ["organizations.read", "shipments.read"],
      },
      logout: vi.fn(),
    });

    rerender(
      <AppShell>
        <div>Contenido</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /Embarques/ })).toHaveAttribute(
      "href",
      "/shipments",
    );
  });
});
