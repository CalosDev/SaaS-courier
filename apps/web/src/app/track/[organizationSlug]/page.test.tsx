import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicTrackingPage from "./page";

const getMock = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ organizationSlug: "courier-demo" }) }));
vi.mock("@/lib/api/client", () => ({ apiClient: { get: (...args: unknown[]) => getMock(...args) } }));

describe("PublicTrackingPage", () => {
  beforeEach(() => getMock.mockReset());

  it("queries the organization-scoped endpoint and renders sanitized events", async () => {
    getMock.mockResolvedValue({
      organization: { slug: "courier-demo", name: "Courier Demo" },
      referenceType: "INTERNAL_TRACKING",
      internalTrackingNumber: "PKABCDEFGH2345",
      status: "ARRIVED_AT_DESTINATION",
      timeline: [{ eventType: "ARRIVED_AT_DESTINATION", location: "Sucursal Central", createdAt: "2026-07-12T12:00:00.000Z" }],
    });
    render(<PublicTrackingPage />);
    fireEvent.change(screen.getByLabelText("Referencia de tracking"), { target: { value: "PKABCDEFGH2345" } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/public/organizations/courier-demo/tracking/PKABCDEFGH2345"));
    expect((await screen.findAllByText("Disponible en destino")).length).toBeGreaterThan(0);
    expect(screen.getByText("Sucursal Central")).toBeInTheDocument();
  });
});
