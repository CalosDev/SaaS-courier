import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InventoryLocationsPage from "./page";

const useAsyncStateMock = vi.fn();
const createInventoryLocationMock = vi.fn();
const updateInventoryLocationMock = vi.fn();

vi.mock("@/components/auth/permission-boundary", () => ({
  PermissionBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/use-async-state", () => ({
  useAsyncState: (...args: unknown[]) => useAsyncStateMock(...args),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    createInventoryLocation: (...args: unknown[]) =>
      createInventoryLocationMock(...args),
    updateInventoryLocation: (...args: unknown[]) =>
      updateInventoryLocationMock(...args),
  },
}));

describe("InventoryLocationsPage", () => {
  beforeEach(() => {
    useAsyncStateMock.mockReset();
    createInventoryLocationMock.mockReset();
    updateInventoryLocationMock.mockReset();
  });

  it("renders the locations catalog with facility and status details", () => {
    const refreshLocations = vi.fn();
    const refreshFacilities = vi.fn();
    const locationsResource = {
      status: "success",
      data: {
        items: [
          {
            id: "location-1",
            facility: {
              id: "facility-1",
              code: "MIA-01",
              name: "Miami Origin",
            },
            code: "A-01",
            name: "Rack A-01",
            type: "SHELF",
            description: "Primary shelf",
            isActive: true,
            createdAt: "2026-07-07T00:00:00.000Z",
            updatedAt: "2026-07-07T00:00:00.000Z",
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        },
      },
      error: null,
      refresh: refreshLocations,
    };
    const facilitiesResource = {
      status: "success",
      data: {
        items: [
          {
            id: "facility-1",
            code: "MIA-01",
            name: "Miami Origin",
          },
        ],
      },
      error: null,
      refresh: refreshFacilities,
    };
    let callCount = 0;

    useAsyncStateMock.mockImplementation(() => {
      const result = callCount % 2 === 0 ? locationsResource : facilitiesResource;
      callCount += 1;
      return result;
    });

    render(<InventoryLocationsPage />);

    expect(
      screen.getByRole("heading", { name: /Ubicaciones de almacén/i }),
    ).toBeVisible();
    expect(screen.getByText("Rack A-01")).toBeVisible();
    expect(screen.getAllByText("Activa")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Editar" })).toBeVisible();
  });

  it("submits the create form without tenant fields and refreshes the locations list", async () => {
    const refreshLocations = vi.fn().mockResolvedValue(undefined);
    const refreshFacilities = vi.fn();
    const locationsResource = {
      status: "success",
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      },
      error: null,
      refresh: refreshLocations,
    };
    const facilitiesResource = {
      status: "success",
      data: {
        items: [
          {
            id: "facility-1",
            code: "MIA-01",
            name: "Miami Origin",
          },
        ],
      },
      error: null,
      refresh: refreshFacilities,
    };
    let callCount = 0;
    createInventoryLocationMock.mockResolvedValue({
      id: "location-2",
    });

    useAsyncStateMock.mockImplementation(() => {
      const result = callCount % 2 === 0 ? locationsResource : facilitiesResource;
      callCount += 1;
      return result;
    });

    render(<InventoryLocationsPage />);

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "A-02" },
    });
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Rack A-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear ubicación" }));

    await waitFor(() => {
      expect(createInventoryLocationMock).toHaveBeenCalledWith({
        facilityId: "facility-1",
        code: "A-02",
        name: "Rack A-02",
        type: "SHELF",
        description: null,
        isActive: true,
      });
    });
    await waitFor(() => {
      expect(refreshLocations).toHaveBeenCalledTimes(1);
    });
  });
});
