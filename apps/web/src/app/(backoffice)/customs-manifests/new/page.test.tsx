import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewCustomsManifestPage from "./page";
import { backofficeApi } from "@/lib/api/backoffice";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    createCustomsManifest: vi.fn(),
  },
}));

describe("NewCustomsManifestPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.mocked(backofficeApi.createCustomsManifest).mockReset();
  });

  it("creates a manifest without tenant fields and routes to detail", async () => {
    vi.mocked(backofficeApi.createCustomsManifest).mockResolvedValue({
      id: "manifest-1",
      organizationId: "org-1",
      code: "CM-20260711-00001",
      flightNumber: "AA123",
      arrivalDate: "2026-07-12",
      status: "DRAFT",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
      packages: [],
    });

    render(<NewCustomsManifestPage />);

    fireEvent.change(screen.getByLabelText("Vuelo"), {
      target: { value: " AA123 " },
    });
    fireEvent.change(screen.getByLabelText("Fecha llegada"), {
      target: { value: "2026-07-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear manifiesto" }));

    await waitFor(() => {
      expect(backofficeApi.createCustomsManifest).toHaveBeenCalledWith({
        flightNumber: "AA123",
        arrivalDate: "2026-07-12",
      });
    });
    expect(
      vi.mocked(backofficeApi.createCustomsManifest).mock.calls[0][0],
    ).not.toHaveProperty("organizationId");
    expect(pushMock).toHaveBeenCalledWith("/customs-manifests/manifest-1");
  });
});
