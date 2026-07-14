import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomsCaseDetailPage from "./page";
import { backofficeApi } from "@/lib/api/backoffice";

const { pushToastMock, refreshMock, asyncResourceMock } = vi.hoisted(() => ({
  pushToastMock: vi.fn(),
  refreshMock: vi.fn(),
  asyncResourceMock: vi.fn(),
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

vi.mock("@/components/auth/permission-boundary", () => ({
  PermissionBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));

vi.mock("@/hooks/use-async-state", () => ({
  useAsyncState: () => asyncResourceMock(),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    getCustomsCase: vi.fn(),
    recordCustomsCaseEvent: vi.fn(),
    changeCustomsCaseStatus: vi.fn(),
  },
}));

function customsCase(overrides = {}) {
  return {
    id: "case-1",
    organizationId: "org-1",
    caseNumber: "CASO-2026-0001",
    status: "PENDING_REVIEW",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    events: [
      {
        id: "event-1",
        source: "MANUAL",
        eventDate: "2026-07-11T12:00:00.000Z",
        description: "Revision inicial",
        createdAt: "2026-07-11T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={<div>Loading route</div>}>
        <CustomsCaseDetailPage
          params={Promise.resolve({ caseId: "case-1" })}
        />
      </Suspense>,
    );
  });
}

describe("CustomsCaseDetailPage", () => {
  beforeEach(() => {
    pushToastMock.mockReset();
    refreshMock.mockReset();
    asyncResourceMock.mockReset();
    vi.mocked(backofficeApi.recordCustomsCaseEvent).mockReset();
    vi.mocked(backofficeApi.changeCustomsCaseStatus).mockReset();
    asyncResourceMock.mockReturnValue({
      status: "success",
      data: customsCase(),
      error: null,
      refresh: refreshMock.mockResolvedValue(undefined),
    });
  });

  it("records customs events without tenant fields and refreshes the case", async () => {
    vi.mocked(backofficeApi.recordCustomsCaseEvent).mockResolvedValue({
      id: "event-2",
    } as any);

    await renderPage();

    expect(await screen.findByText(/CASO-2026-0001/)).toBeVisible();
    expect(screen.getByText("Revision inicial")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Fuente *"), {
      target: { value: "MANUAL" },
    });
    fireEvent.change(screen.getByLabelText("Fecha del evento *"), {
      target: { value: "2026-07-11T13:30" },
    });
    fireEvent.change(screen.getByLabelText("Descripción *"), {
      target: { value: " Nuevo evento manual " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar evento" }));

    const expectedEventDate = new Date("2026-07-11T13:30").toISOString();

    await waitFor(() => {
      expect(backofficeApi.recordCustomsCaseEvent).toHaveBeenCalledWith(
        "case-1",
        {
          source: "MANUAL",
          eventDate: expectedEventDate,
          description: "Nuevo evento manual",
        },
      );
    });
    expect(
      vi.mocked(backofficeApi.recordCustomsCaseEvent).mock.calls[0][1],
    ).not.toHaveProperty("organizationId");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("changes customs case status with enum values only", async () => {
    vi.mocked(backofficeApi.changeCustomsCaseStatus).mockResolvedValue({
      id: "case-1",
      status: "UNDER_REVIEW",
    } as any);

    await renderPage();

    fireEvent.change(screen.getByLabelText("Nuevo estado *"), {
      target: { value: "UNDER_REVIEW" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));

    await waitFor(() => {
      expect(backofficeApi.changeCustomsCaseStatus).toHaveBeenCalledWith(
        "case-1",
        {
          status: "UNDER_REVIEW",
        },
      );
    });
    expect(
      vi.mocked(backofficeApi.changeCustomsCaseStatus).mock.calls[0][1],
    ).not.toHaveProperty("organizationId");
  });

  it("requires evidence for portal events and hides integration-only source", async () => {
    vi.mocked(backofficeApi.recordCustomsCaseEvent).mockResolvedValue({
      id: "event-2",
    } as any);
    await renderPage();

    expect(
      screen.queryByRole("option", { name: /Integraci/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fuente *"), {
      target: { value: "OFFICIAL_PORTAL" },
    });
    fireEvent.change(screen.getByLabelText("Fecha del evento *"), {
      target: { value: "2026-07-11T13:30" },
    });
    fireEvent.change(screen.getByLabelText(/Descripci/), {
      target: { value: "Consulta manual al portal" },
    });
    expect(
      screen.getByRole("button", { name: "Registrar evento" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Referencia oficial *"), {
      target: { value: " DGA-4455 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar evento" }));

    await waitFor(() =>
      expect(backofficeApi.recordCustomsCaseEvent).toHaveBeenCalledWith(
        "case-1",
        expect.objectContaining({
          source: "OFFICIAL_PORTAL",
          evidenceReference: "DGA-4455",
        }),
      ),
    );
  });
});
