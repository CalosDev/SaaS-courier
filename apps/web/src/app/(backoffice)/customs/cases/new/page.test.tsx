import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewCustomsCasePage from "./page";
import { backofficeApi } from "@/lib/api/backoffice";

const pushMock = vi.fn();
const backMock = vi.fn();
const pushToastMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock("@/components/auth/permission-boundary", () => ({
  PermissionBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    createCustomsCase: vi.fn(),
  },
}));

describe("NewCustomsCasePage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    pushToastMock.mockReset();
    vi.mocked(backofficeApi.createCustomsCase).mockReset();
  });

  it("creates a customs case without tenant fields and routes to detail", async () => {
    vi.mocked(backofficeApi.createCustomsCase).mockResolvedValue({
      id: "case-1",
      organizationId: "org-1",
      caseNumber: "CASO-2026-0001",
      status: "PENDING_REVIEW",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
    });

    render(<NewCustomsCasePage />);

    fireEvent.change(screen.getByLabelText("Número de caso *"), {
      target: { value: " CASO-2026-0001 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(backofficeApi.createCustomsCase).toHaveBeenCalledWith({
        caseNumber: "CASO-2026-0001",
      });
    });
    expect(vi.mocked(backofficeApi.createCustomsCase).mock.calls[0][0]).not.toHaveProperty(
      "organizationId",
    );
    expect(pushMock).toHaveBeenCalledWith("/customs/cases/case-1");
  });
});
