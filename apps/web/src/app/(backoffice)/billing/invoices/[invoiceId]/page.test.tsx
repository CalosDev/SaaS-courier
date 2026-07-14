import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, Suspense } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InvoiceDetailPage from "./page";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { getInvoice: vi.fn(), issueInvoice: vi.fn(), voidInvoice: vi.fn() },
  toastMock: vi.fn(),
}));
vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: apiMock }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: toastMock }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

function invoice(status = "DRAFT") {
  return {
    id: "invoice-1",
    invoiceNumber: "INV-001",
    status,
    currencyCode: "DOP",
    balanceDueMinor: "10000",
    lines: [
      {
        id: "line-1",
        description: "Transporte",
        quantity: 1,
        totalPriceMinor: "10000",
      },
    ],
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Suspense fallback={<div>Cargando</div>}>
          <InvoiceDetailPage
            params={Promise.resolve({ invoiceId: "invoice-1" })}
          />
        </Suspense>
      </SWRConfig>,
    );
  });
}

describe("InvoiceDetailPage", () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => mock.mockReset());
    toastMock.mockReset();
  });

  it("issues a draft invoice through the semantic endpoint", async () => {
    apiMock.getInvoice.mockResolvedValue(invoice());
    apiMock.issueInvoice.mockResolvedValue(invoice("ISSUED"));
    await renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Emitir factura" }),
    );
    await waitFor(() =>
      expect(apiMock.issueInvoice).toHaveBeenCalledWith("invoice-1"),
    );
  });
});
