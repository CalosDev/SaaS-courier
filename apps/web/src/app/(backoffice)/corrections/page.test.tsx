import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CorrectionsPage from "./page";

const { pushToastMock, backofficeApiMock } = vi.hoisted(() => ({
  pushToastMock: vi.fn(),
  backofficeApiMock: {
    listCorrections: vi.fn(),
    createCorrection: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: backofficeApiMock,
}));

function correction(overrides = {}) {
  return {
    id: "correction-1",
    organizationId: "org-1",
    targetType: "PACKAGE",
    targetId: "package-1",
    reason: "Weight correction",
    proposedData: { weightLb: "4.20" },
    status: "REQUESTED",
    requestedByEmployeeId: "employee-1",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CorrectionsPage />
    </SWRConfig>,
  );
}

describe("CorrectionsPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushToastMock.mockReset();
  });

  it("links corrections to the operations detail route", async () => {
    backofficeApiMock.listCorrections.mockResolvedValue([correction()]);

    renderPage();

    expect(await screen.findByText("package-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      "/operations/corrections/correction-1",
    );
  });

  it("creates corrections with structured proposed data and no tenant fields", async () => {
    backofficeApiMock.listCorrections.mockResolvedValue([]);
    backofficeApiMock.createCorrection.mockResolvedValue(correction());

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Nueva solicitud" }),
    );
    fireEvent.change(screen.getByLabelText("Tipo de objeto"), {
      target: { value: "INVOICE" },
    });
    fireEvent.change(screen.getByLabelText("ID del objeto"), {
      target: { value: "invoice-1" },
    });
    fireEvent.change(screen.getByLabelText("Campo a corregir"), {
      target: { value: "notes" },
    });
    fireEvent.change(screen.getByLabelText("Nuevo valor"), {
      target: { value: "Corrected note" },
    });
    fireEvent.change(screen.getByLabelText("Motivo de la correccion"), {
      target: { value: "Backoffice evidence validated" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar correccion" }),
    );

    await waitFor(() => {
      expect(backofficeApiMock.createCorrection).toHaveBeenCalledWith({
        targetType: "INVOICE",
        targetId: "invoice-1",
        reason: "Backoffice evidence validated",
        proposedData: { notes: "Corrected note" },
      });
    });
    expect(
      backofficeApiMock.createCorrection.mock.calls[0][0],
    ).not.toHaveProperty("organizationId");
  });
});
