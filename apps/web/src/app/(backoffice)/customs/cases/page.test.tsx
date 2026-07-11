import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CustomsCasesPage from "./page";

const swrMock = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
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

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    listCustomsCases: vi.fn(),
  },
}));

describe("CustomsCasesPage", () => {
  it("renders customs cases with actions to create and view detail", () => {
    swrMock.mockReturnValue({
      data: {
        items: [
          {
            id: "case-1",
            organizationId: "org-1",
            caseNumber: "CASO-2026-0001",
            status: "PENDING_REVIEW",
            createdAt: "2026-07-11T00:00:00.000Z",
            updatedAt: "2026-07-11T00:00:00.000Z",
          },
        ],
        total: 1,
      },
      error: null,
      isLoading: false,
    });

    render(<CustomsCasesPage />);

    expect(screen.getByText("CASO-2026-0001")).toBeVisible();
    expect(screen.getByText("Pendiente revisión")).toBeVisible();
    expect(screen.getByRole("link", { name: "Registrar caso" })).toHaveAttribute(
      "href",
      "/customs/cases/new",
    );
    expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      "/customs/cases/case-1",
    );
  });
});
