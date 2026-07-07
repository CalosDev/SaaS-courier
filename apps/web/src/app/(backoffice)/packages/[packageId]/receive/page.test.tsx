import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PackageReceptionPage from "@/app/(backoffice)/packages/[packageId]/receive/page";

const { pushMock, useAuthMock, backofficeApiMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useAuthMock: vi.fn(),
  backofficeApiMock: {
    getPackage: vi.fn(),
    getCurrentSettings: vi.fn(),
    listFacilities: vi.fn(),
    receivePackage: vi.fn(),
    getPackageReception: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: backofficeApiMock,
}));

describe("PackageReceptionPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        permissionCodes: [
          "packages.read",
          "packages.receive",
          "facilities.read",
          "organizations.read",
        ],
        session: {
          facilityIds: ["facility-1"],
          primaryFacilityId: "facility-1",
        },
      },
    });
    backofficeApiMock.getPackage.mockResolvedValue({
      id: "package-1",
      internalTrackingNumber: "PK7KMP4TX9RW3Q",
      externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
      status: "RECEPTION_PENDING",
      customer: { displayName: "Cliente Uno" },
    });
    backofficeApiMock.getCurrentSettings.mockResolvedValue({
      weightUnit: "LB",
      dimensionUnit: "IN",
    });
    backofficeApiMock.listFacilities.mockResolvedValue({
      items: [
        {
          id: "facility-1",
          code: "MIA-01",
          name: "Miami Origin",
          isActive: true,
          isPackageOrigin: true,
        },
        {
          id: "facility-2",
          code: "SDQ-01",
          name: "Santo Domingo",
          isActive: true,
          isPackageOrigin: false,
        },
      ],
      pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
    });
  });

  it("submits physical measurements without tenant, actor, status or units", async () => {
    backofficeApiMock.receivePackage.mockResolvedValue({ id: "reception-1" });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PackageReceptionPage
            params={Promise.resolve({ packageId: "package-1" })}
          />
        </Suspense>,
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Recibir paquete" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("PK7KMP4TX9RW3Q")).toHaveLength(2);
    expect(screen.getByLabelText("Instalacion de recepcion")).toHaveValue(
      "facility-1",
    );
    expect(screen.queryByText("Santo Domingo")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Peso (LB)"), {
      target: { value: "12.5" },
    });
    fireEvent.change(screen.getByLabelText("Largo (IN)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Ancho (IN)"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Alto (IN)"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Piezas"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Condicion"), {
      target: { value: "SEALED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recepcion" }));

    await waitFor(() => {
      expect(backofficeApiMock.receivePackage).toHaveBeenCalledWith(
        "package-1",
        {
          facilityId: "facility-1",
          weight: 12.5,
          length: 10,
          width: 8,
          height: 6,
          pieceCount: 1,
          condition: "SEALED",
        },
      );
    });

    const payload = backofficeApiMock.receivePackage.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty("organizationId");
    expect(payload).not.toHaveProperty("employeeId");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("weightUnit");
    expect(payload).not.toHaveProperty("dimensionUnit");
    expect(pushMock).toHaveBeenCalledWith("/packages/package-1");
  });

  it("renders the recorded reception as read-only", async () => {
    backofficeApiMock.getPackage.mockResolvedValue({
      id: "package-1",
      internalTrackingNumber: "PK7KMP4TX9RW3Q",
      externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
      status: "RECEIVED_AT_ORIGIN",
      customer: { displayName: "Cliente Uno" },
    });
    backofficeApiMock.getPackageReception.mockResolvedValue({
      id: "reception-1",
      packageId: "package-1",
      facility: { id: "facility-1", code: "MIA-01", name: "Miami Origin" },
      receivedBy: { id: "employee-1", displayName: "Ada Lovelace" },
      weight: "12.500",
      weightUnit: "LB",
      length: "10.00",
      width: "8.00",
      height: "6.00",
      dimensionUnit: "IN",
      pieceCount: 1,
      condition: "SEALED",
      receivedAt: "2026-07-05T12:00:00.000Z",
      createdAt: "2026-07-05T12:00:00.000Z",
    });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PackageReceptionPage
            params={Promise.resolve({ packageId: "package-1" })}
          />
        </Suspense>,
      );
    });

    expect(await screen.findByText("Recepcion confirmada")).toBeInTheDocument();
    expect(screen.getByText("12.500 LB")).toBeInTheDocument();
    expect(screen.getByText("10.00 x 8.00 x 6.00 IN")).toBeInTheDocument();
    expect(screen.getByText("Miami Origin")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar recepcion" }),
    ).not.toBeInTheDocument();
  });
});
