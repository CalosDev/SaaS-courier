import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewShipmentPage from "./page";

const { pushMock, backofficeApiMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backofficeApiMock: {
    listFacilities: vi.fn(),
    createMasterShipment: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: backofficeApiMock }));

describe("NewShipmentPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushMock.mockReset();
  });

  it("creates a master shipment with tenant-safe facility references", async () => {
    backofficeApiMock.listFacilities.mockResolvedValue({
      items: [
        { id: "facility-1", code: "MIA", name: "Miami" },
        { id: "facility-2", code: "SDQ", name: "Santo Domingo" },
      ],
    });
    backofficeApiMock.createMasterShipment.mockResolvedValue({
      id: "shipment-1",
    });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <NewShipmentPage />
      </SWRConfig>,
    );

    fireEvent.change(await screen.findByLabelText("Facility de origen"), {
      target: { value: "facility-1" },
    });
    fireEvent.change(screen.getByLabelText("Facility de destino"), {
      target: { value: "facility-2" },
    });
    fireEvent.change(screen.getByLabelText("Transportista"), {
      target: { value: " Integration Air " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear embarque" }));

    await waitFor(() => {
      expect(backofficeApiMock.createMasterShipment).toHaveBeenCalledWith({
        originFacilityId: "facility-1",
        destinationFacilityId: "facility-2",
        transportMode: "AIR",
        carrier: "Integration Air",
        flightNumber: undefined,
        departureTime: undefined,
        estimatedArrivalTime: undefined,
        mawb: undefined,
      });
    });
    const payload = backofficeApiMock.createMasterShipment.mock.calls[0][0];
    expect(payload).not.toHaveProperty("organizationId");
    expect(payload).not.toHaveProperty("origin");
    expect(payload).not.toHaveProperty("destination");
    expect(pushMock).toHaveBeenCalledWith("/shipments/shipment-1");
  });
});
