import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomsManifestDetailPage from "./page";

const { pushToastMock, backofficeApiMock } = vi.hoisted(() => ({
  pushToastMock: vi.fn(),
  backofficeApiMock: {
    getCustomsManifest: vi.fn(),
    updateCustomsManifest: vi.fn(),
    addPackagesToCustomsManifest: vi.fn(),
    removePackagesFromCustomsManifest: vi.fn(),
    transmitCustomsManifest: vi.fn(),
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

function manifest(overrides = {}) {
  return {
    id: "manifest-1",
    organizationId: "org-1",
    code: "CM-20260711-00001",
    flightNumber: "AA123",
    arrivalDate: "2026-07-12",
    status: "DRAFT",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    packages: [
      {
        id: "package-1",
        internalTrackingNumber: "PK-001",
      },
    ],
    ...overrides,
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Suspense fallback={<div>Loading route</div>}>
          <CustomsManifestDetailPage
            params={Promise.resolve({ id: "manifest-1" })}
          />
        </Suspense>
      </SWRConfig>,
    );
  });
}

describe("CustomsManifestDetailPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    pushToastMock.mockReset();
  });

  it("updates draft manifest data and packages without sending tenant fields", async () => {
    backofficeApiMock.getCustomsManifest.mockResolvedValue(manifest());
    backofficeApiMock.updateCustomsManifest.mockResolvedValue(
      manifest({
        flightNumber: "AA456",
        arrivalDate: "2026-07-13",
      }),
    );
    backofficeApiMock.addPackagesToCustomsManifest.mockResolvedValue({});
    backofficeApiMock.removePackagesFromCustomsManifest.mockResolvedValue({});

    await renderPage();

    expect(await screen.findByDisplayValue("AA123")).toBeInTheDocument();
    expect(screen.getByText("PK-001")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/customs-manifests",
    );

    fireEvent.change(screen.getByLabelText("Vuelo"), {
      target: { value: "AA456" },
    });
    fireEvent.change(screen.getByLabelText("Fecha llegada"), {
      target: { value: "2026-07-13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(backofficeApiMock.updateCustomsManifest).toHaveBeenCalledWith(
        "manifest-1",
        {
          flightNumber: "AA456",
          arrivalDate: "2026-07-13",
        },
      );
    });
    expect(backofficeApiMock.updateCustomsManifest.mock.calls[0][1]).not.toHaveProperty(
      "organizationId",
    );

    fireEvent.change(screen.getByLabelText("IDs de paquetes para agregar"), {
      target: { value: " package-2, package-3 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar paquetes" }));

    await waitFor(() => {
      expect(backofficeApiMock.addPackagesToCustomsManifest).toHaveBeenCalledWith(
        "manifest-1",
        {
          packageIds: ["package-2", "package-3"],
        },
      );
    });

    fireEvent.change(screen.getByLabelText("IDs de paquetes para quitar"), {
      target: { value: " package-2 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Quitar paquetes" }));

    await waitFor(() => {
      expect(
        backofficeApiMock.removePackagesFromCustomsManifest,
      ).toHaveBeenCalledWith("manifest-1", {
        packageIds: ["package-2"],
      });
    });
  });

  it("transmits draft manifests to SIGA", async () => {
    backofficeApiMock.getCustomsManifest.mockResolvedValue(manifest());
    backofficeApiMock.transmitCustomsManifest.mockResolvedValue(
      manifest({ status: "SUBMITTED" }),
    );

    await renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Transmitir a SIGA" }));

    await waitFor(() => {
      expect(backofficeApiMock.transmitCustomsManifest).toHaveBeenCalledWith(
        "manifest-1",
      );
    });
    expect(pushToastMock).toHaveBeenCalledWith(
      "Manifiesto transmitido a SIGA.",
    );
  });

  it("renders submitted manifests as read-only", async () => {
    backofficeApiMock.getCustomsManifest.mockResolvedValue(
      manifest({ status: "SUBMITTED" }),
    );

    await renderPage();

    expect(await screen.findByDisplayValue("AA123")).toBeDisabled();
    expect(screen.getByLabelText("Fecha llegada")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Transmitir a SIGA" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agregar paquetes" }),
    ).not.toBeInTheDocument();
  });
});
