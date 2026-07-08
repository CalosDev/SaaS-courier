import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InventoryPackagesPage from "./page";

const useAsyncStateMock = vi.fn();
const moveInventoryPackageMock = vi.fn();

vi.mock("@/components/auth/permission-boundary", () => ({
  PermissionBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/use-async-state", () => ({
  useAsyncState: (...args: unknown[]) => useAsyncStateMock(...args),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    moveInventoryPackage: (...args: unknown[]) =>
      moveInventoryPackageMock(...args),
  },
}));

describe("InventoryPackagesPage", () => {
  beforeEach(() => {
    useAsyncStateMock.mockReset();
    moveInventoryPackageMock.mockReset();
  });

  it("renders received packages and shows the selected package movement context", async () => {
    const refreshPackages = vi.fn();
    const refreshLocations = vi.fn();
    const refreshMovements = vi.fn();
    const packagesResource = {
      status: "success",
      data: {
        items: [
          {
            id: "package-1",
            internalTrackingNumber: "PK7KMP4TX9RW3Q",
            externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
            status: "RECEIVED_AT_ORIGIN",
            customer: {
              id: "customer-1",
              customerCode: "C-001",
              displayName: "Ada Lovelace",
            },
            reception: {
              facility: {
                id: "facility-1",
                code: "MIA-01",
                name: "Miami Origin",
              },
              receivedAt: "2026-07-07T00:00:00.000Z",
            },
            currentPosition: null,
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
      refresh: refreshPackages,
    };
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
            description: null,
            isActive: true,
            createdAt: "2026-07-07T00:00:00.000Z",
            updatedAt: "2026-07-07T00:00:00.000Z",
          },
        ],
      },
      error: null,
      refresh: refreshLocations,
    };
    const movementsResource = {
      status: "success",
      data: {
        items: [
          {
            id: "movement-1",
            packageId: "package-1",
            facility: {
              id: "facility-1",
              code: "MIA-01",
              name: "Miami Origin",
            },
            movementType: "PUTAWAY",
            fromLocation: null,
            toLocation: {
              id: "location-1",
              code: "A-01",
              name: "Rack A-01",
              type: "SHELF",
            },
            movedBy: {
              id: "employee-1",
              displayName: "Ada Lovelace",
            },
            note: "Initial placement",
            occurredAt: "2026-07-07T00:15:00.000Z",
            createdAt: "2026-07-07T00:15:00.000Z",
          },
        ],
      },
      error: null,
      refresh: refreshMovements,
    };
    let callCount = 0;

    useAsyncStateMock.mockImplementation(() => {
      const index = callCount % 3;
      callCount += 1;
      return index === 0
        ? packagesResource
        : index === 1
          ? locationsResource
          : movementsResource;
    });

    render(<InventoryPackagesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Gestionar" }));

    expect(
      screen.getByRole("heading", { name: /Inventario de paquetes/i }),
    ).toBeVisible();
    expect(screen.getAllByText("PK7KMP4TX9RW3Q")).toHaveLength(2);
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(2);
    await waitFor(() => {
      expect(screen.getByText("Initial placement")).toBeVisible();
    });
  });

  it("submits an inventory movement without tenant fields and refreshes the resources", async () => {
    const refreshPackages = vi.fn().mockResolvedValue(undefined);
    const refreshLocations = vi.fn().mockResolvedValue(undefined);
    const refreshMovements = vi.fn().mockResolvedValue(undefined);
    const packagesResource = {
      status: "success",
      data: {
        items: [
          {
            id: "package-1",
            internalTrackingNumber: "PK7KMP4TX9RW3Q",
            externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
            status: "RECEIVED_AT_ORIGIN",
            customer: {
              id: "customer-1",
              customerCode: "C-001",
              displayName: "Ada Lovelace",
            },
            reception: {
              facility: {
                id: "facility-1",
                code: "MIA-01",
                name: "Miami Origin",
              },
              receivedAt: "2026-07-07T00:00:00.000Z",
            },
            currentPosition: null,
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
      refresh: refreshPackages,
    };
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
            description: null,
            isActive: true,
            createdAt: "2026-07-07T00:00:00.000Z",
            updatedAt: "2026-07-07T00:00:00.000Z",
          },
        ],
      },
      error: null,
      refresh: refreshLocations,
    };
    const movementsResource = {
      status: "success",
      data: {
        items: [],
      },
      error: null,
      refresh: refreshMovements,
    };
    let callCount = 0;
    moveInventoryPackageMock.mockResolvedValue({
      id: "package-1",
    });

    useAsyncStateMock.mockImplementation(() => {
      const index = callCount % 3;
      callCount += 1;
      return index === 0
        ? packagesResource
        : index === 1
          ? locationsResource
          : movementsResource;
    });

    render(<InventoryPackagesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Gestionar" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Ubicación destino" }), {
      target: { value: "location-1" },
    });
    fireEvent.change(screen.getByLabelText("Nota"), {
      target: { value: "Move note" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar movimiento" }),
    );

    await waitFor(() => {
      expect(moveInventoryPackageMock).toHaveBeenCalledWith("package-1", {
        movementType: "PUTAWAY",
        toLocationId: "location-1",
        note: "Move note",
      });
    });
    await waitFor(() => {
      expect(refreshPackages).toHaveBeenCalledTimes(1);
      expect(refreshLocations).toHaveBeenCalledTimes(1);
      expect(refreshMovements).toHaveBeenCalledTimes(1);
    });
  });
});
