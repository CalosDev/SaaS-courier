import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, Suspense } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomsManifestDetailPage from "./page";

const { pushToastMock, backofficeApiMock } = vi.hoisted(() => ({
  pushToastMock: vi.fn(),
  backofficeApiMock: {
    getCustomsManifest: vi.fn(),
    updateCustomsManifest: vi.fn(),
    buildCustomsManifestVersion: vi.fn(),
    validateCustomsManifest: vi.fn(),
    finalizeCustomsManifest: vi.fn(),
    cancelCustomsManifest: vi.fn(),
  },
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
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));
vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: backofficeApiMock }));

function manifest(overrides = {}) {
  return {
    id: "manifest-1",
    code: "CM-001",
    flightNumber: "AA123",
    arrivalDate: "2026-07-12",
    status: "DRAFT",
    currentVersion: 1,
    versions: [
      {
        id: "version-1",
        versionNumber: 1,
        validationStatus: "PENDING",
        items: [{ id: "item-1" }],
      },
    ],
    ...overrides,
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Suspense fallback={<div>Cargando ruta</div>}>
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

  it("builds and validates immutable versions through semantic endpoints", async () => {
    backofficeApiMock.getCustomsManifest.mockResolvedValue(manifest());
    backofficeApiMock.buildCustomsManifestVersion.mockResolvedValue({});
    backofficeApiMock.validateCustomsManifest.mockResolvedValue({});
    await renderPage();

    expect(await screen.findByText("v1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Construir versión" }));
    await waitFor(() =>
      expect(
        backofficeApiMock.buildCustomsManifestVersion,
      ).toHaveBeenCalledWith("manifest-1"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Validar" }));
    await waitFor(() =>
      expect(backofficeApiMock.validateCustomsManifest).toHaveBeenCalledWith(
        "manifest-1",
      ),
    );
  });

  it("renders finalized manifests as frozen", async () => {
    backofficeApiMock.getCustomsManifest.mockResolvedValue(
      manifest({ status: "FINALIZED" }),
    );
    await renderPage();

    expect(await screen.findByDisplayValue("AA123")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Construir versión" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
  });
});
