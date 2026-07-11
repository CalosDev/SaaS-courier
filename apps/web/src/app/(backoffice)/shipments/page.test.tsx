import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ShipmentsPage from "./page";
import { backofficeApi } from "@/lib/api/backoffice";

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
    listMasterShipments: vi.fn(),
  },
}));

describe("ShipmentsPage", () => {
  beforeEach(() => {
    vi.mocked(backofficeApi.listMasterShipments).mockReset();
  });

  it("loads master shipments through the semantic API", async () => {
    vi.mocked(backofficeApi.listMasterShipments).mockResolvedValue([
      {
        id: "shipment-1",
        organizationId: "org-1",
        dispatchCode: "DSP-2026-0001",
        status: "CLOSED",
        origin: "MIA",
        destination: "SDQ",
        departureTime: null,
        estimatedArrivalTime: null,
        actualArrivalTime: null,
        carrier: "AA",
        flightNumber: "AA123",
        mawb: "001-12345678",
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
    ]);

    render(<ShipmentsPage />);

    expect(screen.getByText("Embarques")).toBeInTheDocument();
    expect(screen.getByText("Cargando...")).toBeInTheDocument();

    await waitFor(() => {
      expect(backofficeApi.listMasterShipments).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("DSP-2026-0001")).toBeVisible();
    expect(screen.getByText("Cerrado")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver Detalle" })).toHaveAttribute(
      "href",
      "/shipments/shipment-1",
    );
  });
});
