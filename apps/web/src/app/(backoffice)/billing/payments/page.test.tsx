import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PaymentsPage from "./page";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    listPayments: vi.fn(),
    listCustomers: vi.fn(),
    listInvoices: vi.fn(),
    applyPayment: vi.fn(),
    voidPayment: vi.fn(),
    createPayment: vi.fn(),
  },
  toastMock: vi.fn(),
}));
vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: apiMock }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: toastMock }),
}));

describe("PaymentsPage", () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => mock.mockReset());
    toastMock.mockReset();
  });

  it("applies a payment only to an eligible customer invoice", async () => {
    apiMock.listPayments.mockResolvedValue({
      items: [
        {
          id: "payment-1",
          customerId: "customer-1",
          paymentNumber: "PAY-001",
          status: "RECORDED",
          method: "CASH",
          amountMinor: "10000",
          currencyCode: "DOP",
          reference: null,
          createdAt: "2026-07-12T00:00:00.000Z",
        },
      ],
    });
    apiMock.listCustomers.mockResolvedValue({ items: [] });
    apiMock.listInvoices.mockResolvedValue({
      items: [
        {
          id: "invoice-1",
          customerId: "customer-1",
          invoiceNumber: "INV-001",
          status: "ISSUED",
          currencyCode: "DOP",
        },
        {
          id: "invoice-2",
          customerId: "customer-2",
          invoiceNumber: "INV-002",
          status: "ISSUED",
          currencyCode: "DOP",
        },
      ],
    });
    apiMock.applyPayment.mockResolvedValue({});

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <PaymentsPage />
      </SWRConfig>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
    expect(screen.queryByText("INV-002")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Factura"), {
      target: { value: "invoice-1" },
    });
    fireEvent.change(screen.getByLabelText("Monto"), {
      target: { value: "70.00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(apiMock.applyPayment).toHaveBeenCalledWith("payment-1", {
        invoiceId: "invoice-1",
        amountMinor: "7000",
      }),
    );
  });
});
