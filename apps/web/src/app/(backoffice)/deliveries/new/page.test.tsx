import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewDeliveryPage from "./page";

const { pushMock, backofficeApiMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backofficeApiMock: {
    listCustomers: vi.fn(),
    listPackages: vi.fn(),
    createDelivery: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: backofficeApiMock }));

function renderPage() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <NewDeliveryPage />
    </SWRConfig>,
  );
}

describe("NewDeliveryPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushMock.mockReset();
  });

  it("creates a delivery only with packages from the selected customer", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_752_278_400_000);
    backofficeApiMock.listCustomers.mockResolvedValue({
      items: [
        { id: "customer-1", customerCode: "C001", displayName: "Ana Perez" },
      ],
    });
    backofficeApiMock.listPackages.mockResolvedValue({
      items: [
        {
          id: "package-1",
          internalTrackingNumber: "PK-001",
          externalTrackingNumber: "EXT-001",
          customer: { id: "customer-1" },
        },
        {
          id: "package-2",
          internalTrackingNumber: "PK-002",
          externalTrackingNumber: "EXT-002",
          customer: { id: "customer-2" },
        },
      ],
    });
    backofficeApiMock.createDelivery.mockResolvedValue({ id: "delivery-1" });

    renderPage();

    fireEvent.change(await screen.findByLabelText("Cliente"), {
      target: { value: "customer-1" },
    });
    expect(screen.getByText("PK-001 - EXT-001")).toBeVisible();
    expect(screen.queryByText("PK-002 - EXT-002")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Dirección"), {
      target: { value: "Calle 1" },
    });
    fireEvent.change(screen.getByLabelText("Ciudad"), {
      target: { value: "Santo Domingo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear entrega" }));

    await waitFor(() => {
      expect(backofficeApiMock.createDelivery).toHaveBeenCalledWith({
        deliveryNumber: "DEL-1752278400000",
        customerId: "customer-1",
        method: "HOME_DELIVERY",
        deliveryAddressSnap: {
          line1: "Calle 1",
          city: "Santo Domingo",
          countryCode: "DO",
        },
        notes: undefined,
        packageIds: ["package-1"],
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/deliveries/delivery-1");
  });
});
