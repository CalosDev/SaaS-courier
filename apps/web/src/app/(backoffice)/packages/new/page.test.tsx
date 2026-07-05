import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewPackagePage from "@/app/(backoffice)/packages/new/page";

const { pushMock, useAuthMock, backofficeApiMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useAuthMock: vi.fn(),
  backofficeApiMock: {
    listCustomers: vi.fn(),
    listPrealerts: vi.fn(),
    createPackage: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: backofficeApiMock,
}));

describe("NewPackagePage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        permissionCodes: ["packages.manage"],
      },
    });
    backofficeApiMock.listCustomers.mockResolvedValue({
      items: [
        {
          id: "customer-active",
          customerCode: "C-001",
          displayName: "Cliente Activo",
          status: "ACTIVE",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });
    backofficeApiMock.listPrealerts.mockResolvedValue({
      items: [
        {
          id: "prealert-1",
          prealertCode: "PA7KMP4TX9RW",
          externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
          carrierName: null,
          storeName: "Amazon",
          purchaseDate: null,
          description: "Portable SSD",
          quantity: 1,
          declaredValue: "129.99",
          currencyCode: "USD",
          invoiceStatus: "PENDING",
          status: "PENDING_ARRIVAL",
          customer: {
            id: "customer-active",
            customerCode: "C-001",
            type: "INDIVIDUAL",
            displayName: "Cliente Activo",
          },
          matchedPackage: null,
          createdAt: "2026-07-03T10:00:00.000Z",
          updatedAt: "2026-07-03T10:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });
  });

  it("shows both creation modes and submits the manual payload without tenant or internal tracking fields", async () => {
    backofficeApiMock.createPackage.mockResolvedValue({
      id: "package-1",
    });

    render(<NewPackagePage />);

    expect(
      await screen.findAllByText(
        /Este registro inicia la identificacion del paquete/i,
      ),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar manualmente" }),
    );

    await screen.findByLabelText("Cliente");

    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "customer-active" },
    });
    fireEvent.change(screen.getByLabelText("Tracking externo"), {
      target: { value: " 1Z-999-AA1-01-2345-6784 " },
    });
    fireEvent.change(screen.getByLabelText("Notas (opcional)"), {
      target: { value: " Registro inicial " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Registrar paquete" }));

    await waitFor(() => {
      expect(backofficeApiMock.createPackage).toHaveBeenCalledWith({
        customerId: "customer-active",
        externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
        notes: "Registro inicial",
      });
    });
    expect(backofficeApiMock.createPackage.mock.calls[0][0]).not.toHaveProperty(
      "organizationId",
    );
    expect(backofficeApiMock.createPackage.mock.calls[0][0]).not.toHaveProperty(
      "internalTrackingNumber",
    );
    expect(pushMock).toHaveBeenCalledWith("/packages/package-1");
  });

  it("submits the prealert payload without manual fields", async () => {
    backofficeApiMock.createPackage.mockResolvedValue({
      id: "package-2",
    });

    render(<NewPackagePage />);

    await screen.findByLabelText("Prealerta pendiente");

    fireEvent.change(screen.getByLabelText("Prealerta pendiente"), {
      target: { value: "prealert-1" },
    });
    fireEvent.change(screen.getByLabelText("Notas (opcional)"), {
      target: { value: " Desde prealerta " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Registrar paquete" }));

    await waitFor(() => {
      expect(backofficeApiMock.createPackage).toHaveBeenCalledWith({
        prealertId: "prealert-1",
        notes: "Desde prealerta",
      });
    });
    expect(backofficeApiMock.createPackage.mock.calls[0][0]).not.toHaveProperty(
      "customerId",
    );
    expect(backofficeApiMock.createPackage.mock.calls[0][0]).not.toHaveProperty(
      "externalTrackingNumber",
    );
    expect(backofficeApiMock.createPackage.mock.calls[0][0]).not.toHaveProperty(
      "internalTrackingNumber",
    );
  });
});
