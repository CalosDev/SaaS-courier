import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomerDetailPage from "@/app/(backoffice)/customers/[customerId]/page";

const { backofficeApiMock, useAuthMock } = vi.hoisted(() => ({
  backofficeApiMock: {
    getCustomer: vi.fn(),
    listCustomerAddresses: vi.fn(),
    getCustomerCustomsProfile: vi.fn(),
    upsertCustomerCustomsProfile: vi.fn(),
    updateCustomer: vi.fn(),
    createCustomerAddress: vi.fn(),
  },
  useAuthMock: vi.fn(),
}));

vi.mock("@/lib/api/backoffice", () => ({ backofficeApi: backofficeApiMock }));
vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => useAuthMock(),
}));

describe("CustomerDetailPage customs profile", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        permissionCodes: ["customers.customs.read", "customers.customs.manage"],
      },
    });
    backofficeApiMock.getCustomer.mockResolvedValue({
      id: "customer-1",
      customerCode: "C-001",
      displayName: "Cliente Uno",
      type: "INDIVIDUAL",
      firstName: "Cliente",
      lastName: "Uno",
      businessName: null,
      email: null,
      phone: null,
      mobilePhone: null,
      status: "ACTIVE",
      notes: null,
    });
    backofficeApiMock.listCustomerAddresses.mockResolvedValue([]);
    backofficeApiMock.getCustomerCustomsProfile.mockResolvedValue({
      id: "profile-1",
      documentType: "CEDULA",
      documentNumber: "00112345678",
      ruaStatus: "UNKNOWN",
      verificationSource: null,
      lastCheckedAt: null,
      verifiedAt: null,
      externalReference: null,
      notes: null,
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
    });
    backofficeApiMock.upsertCustomerCustomsProfile.mockResolvedValue({});
  });

  it("submits identity and verification through one atomic request", async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <CustomerDetailPage
            params={Promise.resolve({ customerId: "customer-1" })}
          />
        </Suspense>,
      );
    });

    expect(await screen.findByText("Perfil aduanero")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Estado RUA"), {
      target: { value: "REGISTERED" },
    });
    fireEvent.change(screen.getByLabelText("Fuente de verificacion"), {
      target: { value: "DGA_PORTAL" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de verificacion"), {
      target: { value: "2026-08-31T10:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar perfil aduanero" }),
    );

    await waitFor(() =>
      expect(
        backofficeApiMock.upsertCustomerCustomsProfile,
      ).toHaveBeenCalledTimes(1),
    );
    expect(backofficeApiMock.upsertCustomerCustomsProfile).toHaveBeenCalledWith(
      "customer-1",
      expect.objectContaining({
        documentType: "CEDULA",
        documentNumber: "00112345678",
        status: "REGISTERED",
        source: "DGA_PORTAL",
        checkedAt: new Date("2026-08-31T10:30").toISOString(),
      }),
    );
  });

  it("does not submit a terminal state without a verification date", async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <CustomerDetailPage
            params={Promise.resolve({ customerId: "customer-1" })}
          />
        </Suspense>,
      );
    });

    expect(await screen.findByText("Perfil aduanero")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Estado RUA"), {
      target: { value: "NOT_REGISTERED" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar perfil aduanero" }),
    );

    expect(
      await screen.findByText(
        "La fecha de verificacion es obligatoria para este estado RUA.",
      ),
    ).toBeInTheDocument();
    expect(
      backofficeApiMock.upsertCustomerCustomsProfile,
    ).not.toHaveBeenCalled();
  });
});
