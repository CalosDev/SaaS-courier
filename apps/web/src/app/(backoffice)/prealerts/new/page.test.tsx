import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewPrealertPage from "@/app/(backoffice)/prealerts/new/page";
import { ApiError } from "@/lib/api/api-error";

const { pushMock, useAuthMock, backofficeApiMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useAuthMock: vi.fn(),
  backofficeApiMock: {
    getCurrentOrganization: vi.fn(),
    listCustomers: vi.fn(),
    createPrealert: vi.fn(),
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

describe("NewPrealertPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        permissionCodes: ["prealerts.manage"],
      },
    });
    backofficeApiMock.getCurrentOrganization.mockResolvedValue({
      currencyCode: "DOP",
    });
    backofficeApiMock.listCustomers.mockResolvedValue({
      items: [
        {
          id: "customer-active",
          customerCode: "C-001",
          displayName: "Cliente Activo",
          status: "ACTIVE",
        },
        {
          id: "customer-suspended",
          customerCode: "C-002",
          displayName: "Cliente Suspendido",
          status: "SUSPENDED",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1,
      },
    });
  });

  it("shows the warning and submits only the allowed payload", async () => {
    backofficeApiMock.createPrealert.mockResolvedValue({
      id: "prealert-1",
    });

    render(<NewPrealertPage />);

    expect(
      await screen.findByText(
        /La prealerta informa una compra esperada\. No confirma que el paquete/i,
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("C-001 · Cliente Activo")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("C-002 · Cliente Suspendido"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "customer-active" },
    });
    fireEvent.change(screen.getByLabelText("Tracking externo"), {
      target: { value: " 1Z-999-AA1-01-2345-6784 " },
    });
    fireEvent.change(screen.getByLabelText("Tienda"), {
      target: { value: "Amazon" },
    });
    fireEvent.change(screen.getByLabelText("Descripcion"), {
      target: { value: "Portable SSD" },
    });
    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Valor declarado"), {
      target: { value: "129.99" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Registrar prealerta" }));

    await waitFor(() => {
      expect(backofficeApiMock.createPrealert).toHaveBeenCalledWith({
        customerId: "customer-active",
        externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
        storeName: "Amazon",
        description: "Portable SSD",
        quantity: 2,
        declaredValue: "129.99",
        currencyCode: "DOP",
        invoiceStatus: "PENDING",
      });
    });
    expect(backofficeApiMock.createPrealert.mock.calls[0][0]).not.toHaveProperty(
      "organizationId",
    );
    expect(backofficeApiMock.createPrealert.mock.calls[0][0]).not.toHaveProperty(
      "prealertCode",
    );
    expect(pushMock).toHaveBeenCalledWith("/prealerts/prealert-1");
  });

  it("shows the API conflict message when the tracking is duplicated", async () => {
    backofficeApiMock.createPrealert.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "PREALERT_TRACKING_CONFLICT",
        message: "Ya existe una prealerta activa con ese tracking.",
      }),
    );

    render(<NewPrealertPage />);

    await waitFor(() => {
      expect(screen.getByText("C-001 · Cliente Activo")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "customer-active" },
    });
    fireEvent.change(screen.getByLabelText("Tracking externo"), {
      target: { value: "1Z999AA10123456784" },
    });
    fireEvent.change(screen.getByLabelText("Tienda"), {
      target: { value: "Amazon" },
    });
    fireEvent.change(screen.getByLabelText("Descripcion"), {
      target: { value: "Portable SSD" },
    });
    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Valor declarado"), {
      target: { value: "20.00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Registrar prealerta" }));

    await waitFor(() => {
      expect(backofficeApiMock.createPrealert).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText(/Ya existe una prealerta activa con ese tracking\./i),
    ).toBeInTheDocument();
  });
});
