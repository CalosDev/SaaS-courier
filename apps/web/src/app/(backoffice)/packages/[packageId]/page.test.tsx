import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PackageDetailPage from "@/app/(backoffice)/packages/[packageId]/page";

const { useAuthMock, backofficeApiMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  backofficeApiMock: {
    getPackage: vi.fn(),
    listCustomers: vi.fn(),
    listPackageDocuments: vi.fn(),
    createPackageDocumentUploadIntent: vi.fn(),
    completePackageDocument: vi.fn(),
    deletePackageDocument: vi.fn(),
    updatePackage: vi.fn(),
    cancelPackage: vi.fn(),
  },
}));

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/api/backoffice", () => ({
  backofficeApi: backofficeApiMock,
}));

describe("PackageDetailPage", () => {
  beforeEach(() => {
    Object.values(backofficeApiMock).forEach((mock) => mock.mockReset());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    );
    useAuthMock.mockReturnValue({
      state: {
        status: "authenticated",
        permissionCodes: [
          "packages.read",
          "packages.manage",
          "packages.receive",
          "package_documents.read",
          "package_documents.manage",
          "facilities.read",
          "organizations.read",
        ],
      },
    });
    backofficeApiMock.listCustomers.mockResolvedValue({
      items: [
        {
          id: "customer-1",
          customerCode: "C-001",
          displayName: "Cliente Uno",
          status: "ACTIVE",
        },
        {
          id: "customer-2",
          customerCode: "C-002",
          displayName: "Cliente Dos",
          status: "ACTIVE",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1,
      },
    });
    backofficeApiMock.listPackageDocuments.mockResolvedValue({
      items: [],
    });
  });

  it("submits manual package updates with customer, tracking and notes only", async () => {
    backofficeApiMock.getPackage
      .mockResolvedValueOnce({
        id: "package-1",
        internalTrackingNumber: "PK7KMP4TX9RW3Q",
        externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
        status: "RECEPTION_PENDING",
        source: "MANUAL",
        customer: {
          id: "customer-1",
          customerCode: "C-001",
          type: "INDIVIDUAL",
          displayName: "Cliente Uno",
        },
        prealert: null,
        notes: "Initial notes",
        cancellationReason: null,
        cancelledAt: null,
        registeredBy: {
          id: "employee-1",
          displayName: "Ada Lovelace",
        },
        cancelledBy: null,
        registeredAt: "2026-07-03T10:00:00.000Z",
        createdAt: "2026-07-03T10:00:00.000Z",
        updatedAt: "2026-07-03T10:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "package-1",
        internalTrackingNumber: "PK7KMP4TX9RW3Q",
        externalTrackingNumber: "9400-1111-1111-1111-1111-11",
        status: "RECEPTION_PENDING",
        source: "MANUAL",
        customer: {
          id: "customer-2",
          customerCode: "C-002",
          type: "INDIVIDUAL",
          displayName: "Cliente Dos",
        },
        prealert: null,
        notes: "Updated notes",
        cancellationReason: null,
        cancelledAt: null,
        registeredBy: {
          id: "employee-1",
          displayName: "Ada Lovelace",
        },
        cancelledBy: null,
        registeredAt: "2026-07-03T10:00:00.000Z",
        createdAt: "2026-07-03T10:00:00.000Z",
        updatedAt: "2026-07-03T11:00:00.000Z",
      });
    backofficeApiMock.updatePackage.mockResolvedValue({});

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PackageDetailPage
            params={Promise.resolve({ packageId: "package-1" })}
          />
        </Suspense>,
      );
    });

    await screen.findByLabelText("Cliente");

    expect(
      screen.getByRole("link", { name: "Recibir paquete" }),
    ).toHaveAttribute("href", "/packages/package-1/receive");

    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "customer-2" },
    });
    fireEvent.change(screen.getByLabelText("Tracking externo"), {
      target: { value: " 9400-1111-1111-1111-1111-11 " },
    });
    fireEvent.change(screen.getByLabelText("Notas (opcional)"), {
      target: { value: " Updated notes " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(backofficeApiMock.updatePackage).toHaveBeenCalledWith("package-1", {
        customerId: "customer-2",
        externalTrackingNumber: "9400-1111-1111-1111-1111-11",
        notes: "Updated notes",
      });
    });
    expect(backofficeApiMock.updatePackage.mock.calls[0][1]).not.toHaveProperty(
      "organizationId",
    );
    expect(backofficeApiMock.updatePackage.mock.calls[0][1]).not.toHaveProperty(
      "internalTrackingNumber",
    );
  });

  it("uploads package documents without sending tenant or storage internals", async () => {
    backofficeApiMock.getPackage.mockResolvedValue({
      id: "package-1",
      internalTrackingNumber: "PK7KMP4TX9RW3Q",
      externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
      status: "RECEPTION_PENDING",
      source: "MANUAL",
      customer: {
        id: "customer-1",
        customerCode: "C-001",
        type: "INDIVIDUAL",
        displayName: "Cliente Uno",
      },
      prealert: null,
      notes: null,
      cancellationReason: null,
      cancelledAt: null,
      registeredBy: {
        id: "employee-1",
        displayName: "Ada Lovelace",
      },
      cancelledBy: null,
      registeredAt: "2026-07-03T10:00:00.000Z",
      createdAt: "2026-07-03T10:00:00.000Z",
      updatedAt: "2026-07-03T10:00:00.000Z",
    });
    backofficeApiMock.listPackageDocuments
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [
          {
            id: "document-1",
            packageId: "package-1",
            documentType: "INVOICE",
            status: "AVAILABLE",
            originalFilename: "invoice.pdf",
            contentType: "application/pdf",
            contentLength: 2048,
            createdBy: {
              id: "employee-1",
              displayName: "Ada Lovelace",
            },
            createdAt: "2026-07-07T10:00:00.000Z",
            availableAt: "2026-07-07T10:01:00.000Z",
            deletedAt: null,
          },
        ],
      });
    backofficeApiMock.createPackageDocumentUploadIntent.mockResolvedValue({
      document: {
        id: "document-1",
      },
      upload: {
        method: "PUT",
        url: "https://storage.example/upload/document-1",
        headers: {
          "Content-Type": "application/pdf",
        },
        expiresAt: "2026-07-07T10:15:00.000Z",
      },
    });
    backofficeApiMock.completePackageDocument.mockResolvedValue({});

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PackageDetailPage
            params={Promise.resolve({ packageId: "package-1" })}
          />
        </Suspense>,
      );
    });

    const fileInput = await screen.findByLabelText("Archivo");
    const file = new File(["invoice"], "invoice.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(screen.getByLabelText("Tipo de documento"), {
      target: { value: "INVOICE" },
    });
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cargar documento" }));

    await waitFor(() => {
      expect(
        backofficeApiMock.createPackageDocumentUploadIntent,
      ).toHaveBeenCalledWith("package-1", {
        documentType: "INVOICE",
        fileName: "invoice.pdf",
        contentType: "application/pdf",
        contentLength: 7,
      });
    });

    expect(
      backofficeApiMock.createPackageDocumentUploadIntent.mock.calls[0][1],
    ).not.toHaveProperty("organizationId");
    expect(
      backofficeApiMock.createPackageDocumentUploadIntent.mock.calls[0][1],
    ).not.toHaveProperty("bucketName");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://storage.example/upload/document-1",
      expect.objectContaining({
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: file,
      }),
    );
    expect(backofficeApiMock.completePackageDocument).toHaveBeenCalledWith(
      "package-1",
      "document-1",
    );
  });

  it("keeps linked packages locked to notes-only updates", async () => {
    backofficeApiMock.getPackage
      .mockResolvedValueOnce({
        id: "package-2",
        internalTrackingNumber: "PK7KMP4TX9RW3Q",
        externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
        status: "RECEPTION_PENDING",
        source: "PREALERT",
        customer: {
          id: "customer-1",
          customerCode: "C-001",
          type: "INDIVIDUAL",
          displayName: "Cliente Uno",
        },
        prealert: {
          id: "prealert-1",
          prealertCode: "PA7KMP4TX9RW",
          storeName: "Amazon",
        },
        notes: "Initial linked notes",
        cancellationReason: null,
        cancelledAt: null,
        registeredBy: {
          id: "employee-1",
          displayName: "Ada Lovelace",
        },
        cancelledBy: null,
        registeredAt: "2026-07-03T10:00:00.000Z",
        createdAt: "2026-07-03T10:00:00.000Z",
        updatedAt: "2026-07-03T10:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "package-2",
        internalTrackingNumber: "PK7KMP4TX9RW3Q",
        externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
        status: "RECEPTION_PENDING",
        source: "PREALERT",
        customer: {
          id: "customer-1",
          customerCode: "C-001",
          type: "INDIVIDUAL",
          displayName: "Cliente Uno",
        },
        prealert: {
          id: "prealert-1",
          prealertCode: "PA7KMP4TX9RW",
          storeName: "Amazon",
        },
        notes: "Linked notes updated",
        cancellationReason: null,
        cancelledAt: null,
        registeredBy: {
          id: "employee-1",
          displayName: "Ada Lovelace",
        },
        cancelledBy: null,
        registeredAt: "2026-07-03T10:00:00.000Z",
        createdAt: "2026-07-03T10:00:00.000Z",
        updatedAt: "2026-07-03T11:00:00.000Z",
      });
    backofficeApiMock.updatePackage.mockResolvedValue({});

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PackageDetailPage
            params={Promise.resolve({ packageId: "package-2" })}
          />
        </Suspense>,
      );
    });

    expect(await screen.findByLabelText("Cliente")).toBeDisabled();
    expect(screen.getByLabelText("Tracking externo")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Notas (opcional)"), {
      target: { value: " Linked notes updated " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(backofficeApiMock.updatePackage).toHaveBeenCalledWith("package-2", {
        notes: "Linked notes updated",
      });
    });
    expect(backofficeApiMock.updatePackage.mock.calls[0][1]).not.toHaveProperty(
      "customerId",
    );
    expect(backofficeApiMock.updatePackage.mock.calls[0][1]).not.toHaveProperty(
      "externalTrackingNumber",
    );
  });

  it("renders cancelled packages as read-only", async () => {
    backofficeApiMock.getPackage.mockResolvedValue({
      id: "package-3",
      internalTrackingNumber: "PK7KMP4TX9RW3Q",
      externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
      status: "CANCELLED",
      source: "MANUAL",
      customer: {
        id: "customer-1",
        customerCode: "C-001",
        type: "INDIVIDUAL",
        displayName: "Cliente Uno",
      },
      prealert: null,
      notes: "Cancelled notes",
      cancellationReason: "Registro duplicado.",
      cancelledAt: "2026-07-03T12:00:00.000Z",
      registeredBy: {
        id: "employee-1",
        displayName: "Ada Lovelace",
      },
      cancelledBy: {
        id: "employee-2",
        displayName: "Grace Hopper",
      },
      registeredAt: "2026-07-03T10:00:00.000Z",
      createdAt: "2026-07-03T10:00:00.000Z",
      updatedAt: "2026-07-03T12:00:00.000Z",
    });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <PackageDetailPage
            params={Promise.resolve({ packageId: "package-3" })}
          />
        </Suspense>,
      );
    });

    expect(
      await screen.findByText(
        "Este paquete esta cancelado y permanece en solo lectura.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("1Z-999-AA1-01-2345-6784")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Guardar cambios" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar paquete" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Registro duplicado.")).toBeInTheDocument();
  });
});
