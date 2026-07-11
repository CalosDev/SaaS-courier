import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HoldsPage from "./page";

const { pushToastMock, backofficeApiMock } = vi.hoisted(() => ({
  pushToastMock: vi.fn(),
  backofficeApiMock: {
    listHolds: vi.fn(),
    createHold: vi.fn(),
    releaseHold: vi.fn(),
  },
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: backofficeApiMock,
}));

function hold(overrides = {}) {
  return {
    id: "hold-1",
    organizationId: "org-1",
    targetType: "PACKAGE",
    targetId: "package-1",
    reason: "Missing invoice",
    status: "ACTIVE",
    releaseReason: null,
    requestedByEmployeeId: "employee-1",
    releasedByEmployeeId: null,
    releasedAt: null,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <HoldsPage />
    </SWRConfig>,
  );
}

describe("HoldsPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushToastMock.mockReset();
  });

  it("releases active holds through the semantic endpoint", async () => {
    backofficeApiMock.listHolds.mockResolvedValue([hold()]);
    backofficeApiMock.releaseHold.mockResolvedValue(
      hold({ status: "RELEASED", releaseReason: "Invoice validated" }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Liberar" }));
    fireEvent.change(screen.getByLabelText("Motivo de la liberacion"), {
      target: { value: "Invoice validated" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar liberacion" }),
    );

    await waitFor(() => {
      expect(backofficeApiMock.releaseHold).toHaveBeenCalledWith(
        "hold-1",
        "Invoice validated",
      );
    });
  });

  it("creates holds without sending tenant fields", async () => {
    backofficeApiMock.listHolds.mockResolvedValue([]);
    backofficeApiMock.createHold.mockResolvedValue(hold());

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Aplicar retencion" }),
    );
    fireEvent.change(screen.getByLabelText("ID del paquete"), {
      target: { value: "package-2" },
    });
    fireEvent.change(screen.getByLabelText("Motivo de la retencion"), {
      target: { value: "Customer review required" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Aplicar retencion" })[1],
    );

    await waitFor(() => {
      expect(backofficeApiMock.createHold).toHaveBeenCalledWith({
        packageId: "package-2",
        reason: "Customer review required",
      });
    });
    expect(backofficeApiMock.createHold.mock.calls[0][0]).not.toHaveProperty(
      "organizationId",
    );
  });
});
