import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HouseShipmentsPage from "./page";

const swrMock = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    listMasterShipments: vi.fn(),
    listHouseShipments: vi.fn(),
  },
}));

describe("HouseShipmentsPage", () => {
  beforeEach(() => {
    swrMock.mockReset();
    swrMock.mockImplementation((key: unknown) => {
      if (key === "/master-shipments") {
        return {
          data: [
            {
              id: "dispatch-1",
              organizationId: "org-1",
              dispatchCode: "DSP-2026-0001",
              status: "DRAFT",
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
          ],
          error: null,
          isLoading: false,
        };
      }

      if (Array.isArray(key) && key[1] === "dispatch-1") {
        return {
          data: [
            {
              id: "house-shipment-1",
              organizationId: "org-1",
              dispatchId: "dispatch-1",
              hawb: "HAWB-001",
              status: "DRAFT",
              notes: "Consolidado inicial",
              createdAt: "2026-07-11T00:00:00.000Z",
              updatedAt: "2026-07-11T00:00:00.000Z",
              packages: [{ id: "package-1" }, { id: "package-2" }],
            },
          ],
          error: null,
          isLoading: false,
        };
      }

      return {
        data: undefined,
        error: null,
        isLoading: false,
      };
    });
  });

  it("loads house shipments for the selected master shipment", () => {
    render(<HouseShipmentsPage />);

    fireEvent.change(screen.getByLabelText("Master Shipment"), {
      target: { value: "dispatch-1" },
    });

    expect(screen.getAllByText("DSP-2026-0001 - MIA -> SDQ")).toHaveLength(2);
    expect(screen.getByText("HAWB-001")).toBeVisible();
    expect(screen.getByText("Borrador")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText("Consolidado inicial")).toBeVisible();
  });
});
