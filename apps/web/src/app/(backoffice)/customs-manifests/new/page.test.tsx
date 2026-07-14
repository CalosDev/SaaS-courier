import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewCustomsManifestPage from "./page";

const { pushMock, backofficeApiMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backofficeApiMock: {
    listMasterShipments: vi.fn(),
    createCustomsManifest: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: backofficeApiMock }));

describe("NewCustomsManifestPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushMock.mockReset();
  });

  it("creates a manifest linked to an arrived master shipment", async () => {
    backofficeApiMock.listMasterShipments.mockResolvedValue([
      { id: "shipment-1", dispatchCode: "DSP-001", status: "ARRIVED" },
      { id: "shipment-2", dispatchCode: "DSP-002", status: "DRAFT" },
    ]);
    backofficeApiMock.createCustomsManifest.mockResolvedValue({
      id: "manifest-1",
    });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <NewCustomsManifestPage />
      </SWRConfig>,
    );

    fireEvent.change(await screen.findByLabelText("Embarque maestro"), {
      target: { value: "shipment-1" },
    });
    expect(screen.queryByText("DSP-002")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Vuelo"), {
      target: { value: " AA123 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear manifiesto" }));

    await waitFor(() => {
      expect(backofficeApiMock.createCustomsManifest).toHaveBeenCalledWith({
        masterShipmentId: "shipment-1",
        flightNumber: "AA123",
        arrivalDate: undefined,
      });
    });
    expect(
      backofficeApiMock.createCustomsManifest.mock.calls[0][0],
    ).not.toHaveProperty("organizationId");
    expect(pushMock).toHaveBeenCalledWith("/customs-manifests/manifest-1");
  });
});
