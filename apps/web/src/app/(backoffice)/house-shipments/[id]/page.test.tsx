import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HouseShipmentDetailPage from "./page";

const { pushToastMock, backofficeApiMock } = vi.hoisted(() => ({
  pushToastMock: vi.fn(),
  backofficeApiMock: {
    getHouseShipment: vi.fn(),
    updateHouseShipment: vi.fn(),
    addPackagesToHouseShipment: vi.fn(),
    closeHouseShipment: vi.fn(),
    cancelHouseShipment: vi.fn(),
  },
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

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: backofficeApiMock,
}));

function houseShipment(overrides = {}) {
  return {
    id: "house-shipment-1",
    organizationId: "org-1",
    dispatchId: "shipment-1",
    hawb: "HAWB-001",
    status: "DRAFT",
    notes: "Initial notes",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    packages: [
      {
        id: "assignment-1",
        package: {
          id: "package-1",
          internalTrackingNumber: "PK-001",
        },
      },
    ],
    ...overrides,
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Suspense fallback={<div>Loading route</div>}>
          <HouseShipmentDetailPage
            params={Promise.resolve({ id: "house-shipment-1" })}
          />
        </Suspense>
      </SWRConfig>,
    );
  });
}

describe("HouseShipmentDetailPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushToastMock.mockReset();
  });

  it("updates draft HAWB data and packages without sending tenant fields", async () => {
    backofficeApiMock.getHouseShipment.mockResolvedValue(houseShipment());
    backofficeApiMock.updateHouseShipment.mockResolvedValue(
      houseShipment({
        hawb: "HAWB-UPDATED",
        notes: "Updated notes",
      }),
    );
    backofficeApiMock.addPackagesToHouseShipment.mockResolvedValue({});

    await renderPage();

    expect(await screen.findByDisplayValue("HAWB-001")).toBeInTheDocument();
    expect(screen.getByText("PK-001")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/shipments/shipment-1/consolidations",
    );

    fireEvent.change(screen.getByLabelText("HAWB"), {
      target: { value: "HAWB-UPDATED" },
    });
    fireEvent.change(screen.getByLabelText("Notas"), {
      target: { value: "Updated notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(backofficeApiMock.updateHouseShipment).toHaveBeenCalledWith(
        "house-shipment-1",
        {
          hawb: "HAWB-UPDATED",
          notes: "Updated notes",
        },
      );
    });
    expect(backofficeApiMock.updateHouseShipment.mock.calls[0][1]).not.toHaveProperty(
      "organizationId",
    );

    fireEvent.change(screen.getByLabelText("IDs de paquetes"), {
      target: { value: " package-2, package-3 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar paquetes" }));

    await waitFor(() => {
      expect(backofficeApiMock.addPackagesToHouseShipment).toHaveBeenCalledWith(
        "house-shipment-1",
        {
          packageIds: ["package-2", "package-3"],
        },
      );
    });
  });

  it("runs close action only for draft HAWBs", async () => {
    backofficeApiMock.getHouseShipment.mockResolvedValue(houseShipment());
    backofficeApiMock.closeHouseShipment.mockResolvedValue({});

    await renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Cerrar" }));

    await waitFor(() => {
      expect(backofficeApiMock.closeHouseShipment).toHaveBeenCalledWith(
        "house-shipment-1",
      );
    });
    expect(pushToastMock).toHaveBeenCalledWith("HAWB actualizado.");
  });

  it("renders closed HAWBs as read-only", async () => {
    backofficeApiMock.getHouseShipment.mockResolvedValue(
      houseShipment({ status: "CLOSED" }),
    );

    await renderPage();

    expect(await screen.findByDisplayValue("HAWB-001")).toBeDisabled();
    expect(screen.getByLabelText("Notas")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Cerrar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reemplazar paquetes" }),
    ).not.toBeInTheDocument();
  });
});
