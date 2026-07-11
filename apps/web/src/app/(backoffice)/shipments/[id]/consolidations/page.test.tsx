import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ShipmentConsolidationsPage from "./page";
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

const pushToastMock = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    getMasterShipment: vi.fn(),
    listHouseShipments: vi.fn(),
    createHouseShipment: vi.fn(),
  },
}));

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={<div>Loading route</div>}>
        <ShipmentConsolidationsPage
          params={Promise.resolve({ id: "shipment-1" })}
        />
      </Suspense>,
    );
  });
}

describe("ShipmentConsolidationsPage", () => {
  beforeEach(() => {
    pushToastMock.mockReset();
    vi.mocked(backofficeApi.getMasterShipment).mockReset();
    vi.mocked(backofficeApi.listHouseShipments).mockReset();
    vi.mocked(backofficeApi.createHouseShipment).mockReset();
  });

  it("loads HAWBs for the selected master shipment", async () => {
    vi.mocked(backofficeApi.getMasterShipment).mockResolvedValue({
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
    });
    vi.mocked(backofficeApi.listHouseShipments).mockResolvedValue([
      {
        id: "house-shipment-1",
        organizationId: "org-1",
        dispatchId: "shipment-1",
        hawb: "HAWB-001",
        status: "DRAFT",
        notes: "Consolidado inicial",
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
        packages: [{ id: "package-1" }],
      },
    ]);

    await renderPage();

    await waitFor(() => {
      expect(backofficeApi.listHouseShipments).toHaveBeenCalledWith(
        "shipment-1",
      );
    });

    expect(screen.getByText("HAWB-001")).toBeVisible();
    expect(screen.getByText("Borrador")).toBeVisible();
    expect(screen.getByText("Consolidado inicial")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      "/house-shipments/house-shipment-1",
    );
  });

  it("creates a HAWB under the selected master shipment", async () => {
    vi.mocked(backofficeApi.getMasterShipment).mockResolvedValue({
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
    });
    vi.mocked(backofficeApi.listHouseShipments).mockResolvedValue([]);
    vi.mocked(backofficeApi.createHouseShipment).mockResolvedValue({
      id: "house-shipment-1",
      organizationId: "org-1",
      dispatchId: "shipment-1",
      hawb: "HAWB-002",
      status: "DRAFT",
      notes: "Nuevo consolidado",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
      packages: [],
    });

    await renderPage();

    fireEvent.change(await screen.findByLabelText("HAWB"), {
      target: { value: "HAWB-002" },
    });
    fireEvent.change(screen.getByLabelText("Notas"), {
      target: { value: "Nuevo consolidado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear HAWB" }));

    await waitFor(() => {
      expect(backofficeApi.createHouseShipment).toHaveBeenCalledWith(
        "shipment-1",
        {
          hawb: "HAWB-002",
          notes: "Nuevo consolidado",
        },
      );
    });
    expect(pushToastMock).toHaveBeenCalledWith("HAWB creado.");
  });
});
