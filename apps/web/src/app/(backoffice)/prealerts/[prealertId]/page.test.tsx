import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PrealertDetailPage from "@/app/(backoffice)/prealerts/[prealertId]/page";

const { useAuthMock, backofficeApiMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  backofficeApiMock: {
    getPrealert: vi.fn(),
  },
}));

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: backofficeApiMock,
}));

describe("PrealertDetailPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        permissionCodes: ["prealerts.read", "prealerts.manage"],
      },
    });
  });

  it("renders cancelled prealerts as read-only", async () => {
    backofficeApiMock.getPrealert.mockResolvedValue({
      id: "prealert-1",
      prealertCode: "PA7KMP4TX9RW",
      externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
      carrierName: "UPS",
      storeName: "Amazon",
      purchaseDate: "2026-07-01",
      description: "Portable SSD",
      quantity: 1,
      declaredValue: "129.99",
      currencyCode: "DOP",
      invoiceStatus: "VERIFIED",
      status: "CANCELLED",
      customer: {
        id: "customer-1",
        customerCode: "C-001",
        type: "INDIVIDUAL",
        displayName: "Cliente Uno",
      },
      matchedPackage: null,
      createdAt: "2026-07-03T10:00:00.000Z",
      updatedAt: "2026-07-03T11:00:00.000Z",
      notes: "Compra descartada",
      cancellationReason: "La compra fue cancelada por el cliente.",
      cancelledAt: "2026-07-03T12:00:00.000Z",
      createdBy: {
        id: "employee-1",
        displayName: "Ada Lovelace",
      },
      cancelledBy: {
        id: "employee-2",
        displayName: "Grace Hopper",
      },
    });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PrealertDetailPage
            params={Promise.resolve({ prealertId: "prealert-1" })}
          />
        </Suspense>,
      );
    });

    expect(
      await screen.findByText(
        "Esta prealerta esta cancelada y permanece en solo lectura.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Portable SSD")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Guardar cambios" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar prealerta" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("La compra fue cancelada por el cliente."),
    ).toBeInTheDocument();
  });

  it("renders matched prealerts as read-only and shows the linked package", async () => {
    backofficeApiMock.getPrealert.mockResolvedValue({
      id: "prealert-2",
      prealertCode: "PA7KMP4TX9RW",
      externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
      carrierName: "UPS",
      storeName: "Amazon",
      purchaseDate: "2026-07-01",
      description: "Portable SSD",
      quantity: 1,
      declaredValue: "129.99",
      currencyCode: "DOP",
      invoiceStatus: "VERIFIED",
      status: "MATCHED",
      customer: {
        id: "customer-1",
        customerCode: "C-001",
        type: "INDIVIDUAL",
        displayName: "Cliente Uno",
      },
      matchedPackage: {
        id: "package-1",
        internalTrackingNumber: "PK7KMP4TX9RW3Q",
        status: "RECEPTION_PENDING",
      },
      createdAt: "2026-07-03T10:00:00.000Z",
      updatedAt: "2026-07-03T11:00:00.000Z",
      notes: "Compra vinculada",
      cancellationReason: null,
      cancelledAt: null,
      createdBy: {
        id: "employee-1",
        displayName: "Ada Lovelace",
      },
      cancelledBy: null,
    });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PrealertDetailPage
            params={Promise.resolve({ prealertId: "prealert-2" })}
          />
        </Suspense>,
      );
    });

    expect(
      await screen.findByText(
        "Esta prealerta ya fue vinculada a un paquete y permanece en solo lectura.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("PK7KMP4TX9RW3Q")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar prealerta" }),
    ).not.toBeInTheDocument();
  });
});
