import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, Suspense } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeliveryDetailPage from "./page";

const { backofficeApiMock } = vi.hoisted(() => ({
  backofficeApiMock: {
    getDelivery: vi.fn(),
    markDeliveryReady: vi.fn(),
    dispatchDelivery: vi.fn(),
    cancelDelivery: vi.fn(),
    recordDeliveryAttempt: vi.fn(),
  },
}));

vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: backofficeApiMock }));

function delivery(overrides = {}) {
  return {
    id: "delivery-1",
    organizationId: "org-1",
    deliveryNumber: "DEL-001",
    customerId: "customer-1",
    method: "HOME_DELIVERY",
    status: "OUT_FOR_DELIVERY",
    createdById: "employee-1",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    customer: { displayName: "Ana Perez" },
    items: [
      {
        id: "item-1",
        packageId: "package-1",
        package: { internalTrackingNumber: "PK-001" },
      },
    ],
    attempts: [],
    ...overrides,
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Suspense fallback={<div>Cargando ruta</div>}>
          <DeliveryDetailPage params={Promise.resolve({ id: "delivery-1" })} />
        </Suspense>
      </SWRConfig>,
    );
  });
}

describe("DeliveryDetailPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
  });

  it("records a successful attempt without tenant-controlled fields", async () => {
    backofficeApiMock.getDelivery.mockResolvedValue(delivery());
    backofficeApiMock.recordDeliveryAttempt.mockResolvedValue(
      delivery({ status: "DELIVERED" }),
    );

    await renderPage();

    expect(await screen.findByText("Entrega DEL-001")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Resultado"), {
      target: { value: "DELIVERED" },
    });
    fireEvent.change(screen.getByLabelText("Receptor"), {
      target: { value: " Juan Perez " },
    });
    fireEvent.change(screen.getByLabelText("Notas"), {
      target: { value: " Entregado en recepcion " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar intento" }));

    await waitFor(() => {
      expect(backofficeApiMock.recordDeliveryAttempt).toHaveBeenCalledWith(
        "delivery-1",
        {
          result: "DELIVERED",
          receiverName: "Juan Perez",
          notes: "Entregado en recepcion",
        },
      );
    });
    expect(
      backofficeApiMock.recordDeliveryAttempt.mock.calls[0][1],
    ).not.toHaveProperty("organizationId");
  });
});
