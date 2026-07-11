import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CorrectionDetailPage from "./page";

const { pushToastMock, backofficeApiMock } = vi.hoisted(() => ({
  pushToastMock: vi.fn(),
  backofficeApiMock: {
    getCorrection: vi.fn(),
    approveCorrection: vi.fn(),
    rejectCorrection: vi.fn(),
    applyCorrection: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
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

async function renderPage() {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Suspense fallback={<div>Loading route</div>}>
          <CorrectionDetailPage
            params={Promise.resolve({ correctionId: "correction-1" })}
          />
        </Suspense>
      </SWRConfig>,
    );
  });
}

describe("CorrectionDetailPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushToastMock.mockReset();
  });

  it("approves requested corrections with an optional decision reason", async () => {
    backofficeApiMock.getCorrection.mockResolvedValue(correction());
    backofficeApiMock.approveCorrection.mockResolvedValue(
      correction({ status: "APPROVED" }),
    );

    await renderPage();

    expect(await screen.findByText("package-1")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Razon de decision"), {
      target: { value: "Invoice uploaded" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));

    await waitFor(() => {
      expect(backofficeApiMock.approveCorrection).toHaveBeenCalledWith(
        "correction-1",
        "Invoice uploaded",
      );
    });
  });

  it("rejects requested corrections", async () => {
    backofficeApiMock.getCorrection.mockResolvedValue(correction());
    backofficeApiMock.rejectCorrection.mockResolvedValue(
      correction({ status: "REJECTED" }),
    );

    await renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Rechazar" }));

    await waitFor(() => {
      expect(backofficeApiMock.rejectCorrection).toHaveBeenCalledWith(
        "correction-1",
        "",
      );
    });
  });

  it("exposes apply for approved corrections through the semantic endpoint", async () => {
    backofficeApiMock.getCorrection.mockResolvedValue(
      correction({ status: "APPROVED" }),
    );
    backofficeApiMock.applyCorrection.mockRejectedValue(
      new Error("Correction application is not configured for PACKAGE"),
    );

    await renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Aplicar correccion" }),
    );

    await waitFor(() => {
      expect(backofficeApiMock.applyCorrection).toHaveBeenCalledWith(
        "correction-1",
      );
    });
    expect(pushToastMock).toHaveBeenCalledWith(
      "No fue posible aplicar la correccion.",
    );
  });
});
