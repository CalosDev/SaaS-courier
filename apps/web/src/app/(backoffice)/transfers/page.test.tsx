import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TransfersPage from "./page";
import { backofficeApi } from "@/lib/api/backoffice";
import type { FacilityTransfer } from "@/lib/api/contracts";

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
    listTransfers: vi.fn(),
  },
}));

function transfer(overrides: Partial<FacilityTransfer> = {}): FacilityTransfer {
  return {
    id: "transfer-1",
    transferNumber: "TRF-001",
    originFacilityId: "facility-origin",
    destinationFacilityId: "facility-destination",
    status: "DRAFT",
    createdById: "employee-1",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <TransfersPage />
    </SWRConfig>,
  );
}

describe("TransfersPage", () => {
  beforeEach(() => {
    vi.mocked(backofficeApi.listTransfers).mockReset();
  });

  it("renders the array response returned by the transfers API", async () => {
    vi.mocked(backofficeApi.listTransfers).mockResolvedValue([transfer()]);

    renderPage();

    expect(screen.getByText("Transferencias Internas")).toBeInTheDocument();
    expect(screen.getByText("Cargando transferencias...")).toBeInTheDocument();

    await waitFor(() => {
      expect(backofficeApi.listTransfers).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("TRF-001")).toBeVisible();
    expect(screen.getByText("facility-origin")).toBeVisible();
    expect(screen.getByText("facility-destination")).toBeVisible();
    expect(screen.getByText("Borrador")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver Detalles" })).toHaveAttribute(
      "href",
      "/transfers/transfer-1",
    );
  });

  it("keeps compatibility with paginated transfer responses", async () => {
    vi.mocked(backofficeApi.listTransfers).mockResolvedValue({
      items: [transfer({ id: "transfer-2", transferNumber: "TRF-002" })],
      pagination: { page: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(backofficeApi.listTransfers).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("TRF-002")).toBeVisible();
    expect(screen.queryByText("No se encontraron transferencias.")).toBeNull();
  });
});
