import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomsManifestsPage from "./page";

const swrMock = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: {
    listCustomsManifests: vi.fn(),
    transmitCustomsManifest: vi.fn(),
  },
}));

describe("CustomsManifestsPage", () => {
  beforeEach(() => {
    swrMock.mockReset();
  });

  it("renders manifests with a missing arrival date without formatting null as a date", () => {
    swrMock.mockReturnValue({
      data: [
        {
          id: "manifest-1",
          organizationId: "org-1",
          code: "CM-20260711-00001",
          flightNumber: "AA123",
          arrivalDate: null,
          status: "DRAFT",
          createdAt: "2026-07-11T00:00:00.000Z",
          updatedAt: "2026-07-11T00:00:00.000Z",
          packages: [],
        },
      ],
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    });

    render(<CustomsManifestsPage />);

    expect(screen.getByText("CM-20260711-00001")).toBeVisible();
    expect(screen.getByText("Sin fecha")).toBeVisible();
    expect(screen.queryByText(/1969|1970|Invalid Date/i)).not.toBeInTheDocument();
  });
});
