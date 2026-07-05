import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  sessionId: "session-1",
  userId: "user-1",
  email: "ada@courier.test",
  organizationId: "org-1",
  organizationSlug: "courier-demo",
  organizationName: "Courier Demo",
  employeeId: "employee-1",
  firstName: "Ada",
  lastName: "Lovelace",
  facilityIds: ["facility-1"],
  expiresAt: "2026-07-04T23:59:59.000Z",
  employeeCode: "EMP-001",
  primaryFacilityId: "facility-1",
} as const;

const PACKAGE_PERMISSIONS = [
  "organizations.read",
  "packages.read",
  "packages.manage",
  "customers.read",
  "prealerts.read",
] as const;

const CUSTOMER = {
  id: "customer-1",
  customerCode: "C-001",
  type: "INDIVIDUAL",
  firstName: "Ana",
  lastName: "Perez",
  businessName: null,
  displayName: "Ana Perez",
  email: null,
  phone: null,
  mobilePhone: null,
  status: "ACTIVE",
  notes: null,
  createdAt: "2026-07-04T10:00:00.000Z",
  updatedAt: "2026-07-04T10:00:00.000Z",
} as const;

const PREALERT = {
  id: "prealert-1",
  prealertCode: "PA7KMP4TX9RW",
  externalTrackingNumber: "9400-2222-2222-2222-2222-22",
  carrierName: null,
  storeName: "Best Buy",
  purchaseDate: null,
  description: "Gaming mouse",
  quantity: 1,
  declaredValue: "30.00",
  currencyCode: "USD",
  invoiceStatus: "PENDING",
  status: "PENDING_ARRIVAL",
  customer: {
    id: CUSTOMER.id,
    customerCode: CUSTOMER.customerCode,
    type: CUSTOMER.type,
    displayName: CUSTOMER.displayName,
  },
  matchedPackage: null,
  createdAt: "2026-07-04T10:00:00.000Z",
  updatedAt: "2026-07-04T10:00:00.000Z",
} as const;

const PACKAGE_SUMMARY = {
  id: "package-1",
  internalTrackingNumber: "PK7KMP4TX9RW3Q",
  externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
  status: "RECEPTION_PENDING",
  source: "MANUAL",
  customer: {
    id: CUSTOMER.id,
    customerCode: CUSTOMER.customerCode,
    type: CUSTOMER.type,
    displayName: CUSTOMER.displayName,
  },
  prealert: null,
  registeredAt: "2026-07-04T10:10:00.000Z",
  createdAt: "2026-07-04T10:10:00.000Z",
  updatedAt: "2026-07-04T10:10:00.000Z",
} as const;

const PACKAGE_DETAIL = {
  ...PACKAGE_SUMMARY,
  notes: "Validar etiqueta externa",
  cancellationReason: null,
  cancelledAt: null,
  registeredBy: {
    id: "employee-1",
    displayName: "Ada Lovelace",
  },
  cancelledBy: null,
} as const;

test.beforeEach(async ({ page }) => {
  await mockBackoffice(page);
});

test("renders the packages list with navigation and mocked data", async ({
  page,
}) => {
  await page.goto("/packages");

  await expect(page.getByRole("heading", { name: "Paquetes" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toContainText("Paquetes");
  await expect(page.getByText(PACKAGE_SUMMARY.internalTrackingNumber)).toBeVisible();
  await expect(page.getByText(PACKAGE_SUMMARY.externalTrackingNumber)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver detalle" })).toBeVisible();
});

test("submits the manual package form without tenant or internal tracking fields", async ({
  page,
}) => {
    let createPayload: Record<string, unknown> | null = null;

    await page.route("**/backend/packages", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      createPayload = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(PACKAGE_SUMMARY),
      });
    });

    await page.goto("/packages/new");

    await expect(
      page
        .getByText(
          "Este registro inicia la identificacion del paquete. La recepcion todavia no esta completada.",
        )
        .first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Registrar manualmente" }).click();
    await page.getByRole("combobox", { name: "Cliente" }).selectOption(
      CUSTOMER.id,
    );
    await page
      .getByLabel("Tracking externo")
      .fill(` ${PACKAGE_SUMMARY.externalTrackingNumber} `);
    await page.getByLabel("Notas (opcional)").fill("  Validar etiqueta externa  ");

    await expect(
      page.getByLabel("Tracking externo").locator(".."),
    ).toBeVisible();
    await expect(page.getByText("Tracking interno")).toHaveCount(0);

    await page.getByRole("button", { name: "Registrar paquete" }).click();

    expect(createPayload).toEqual({
      customerId: CUSTOMER.id,
      externalTrackingNumber: PACKAGE_SUMMARY.externalTrackingNumber,
      notes: "Validar etiqueta externa",
    });
    expect(createPayload).not.toHaveProperty("organizationId");
    expect(createPayload).not.toHaveProperty("internalTrackingNumber");

    await page.waitForURL(`**/packages/${PACKAGE_SUMMARY.id}`, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", {
        name: PACKAGE_DETAIL.internalTrackingNumber,
      }),
    ).toBeVisible();
  },
);

async function mockBackoffice(page: Page): Promise<void> {
  await page.route("**/backend/**", async (route) => {
    await fulfillBackofficeRoute(route);
  });
}

async function fulfillBackofficeRoute(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();

  if (method === "GET" && path === "/backend/auth/session") {
    await fulfillJson(route, 200, { session: SESSION });
    return;
  }

  if (method === "GET" && path === "/backend/auth/authorization") {
    await fulfillJson(route, 200, {
      permissionCodes: PACKAGE_PERMISSIONS,
    });
    return;
  }

  if (method === "GET" && path === "/backend/auth/csrf") {
    await fulfillJson(route, 200, {
      csrfToken: "csrf-token",
    });
    return;
  }

  if (method === "GET" && path === "/backend/packages") {
    await fulfillJson(route, 200, {
      items: [PACKAGE_SUMMARY],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });
    return;
  }

  if (method === "GET" && path === `/backend/packages/${PACKAGE_SUMMARY.id}`) {
    await fulfillJson(route, 200, PACKAGE_DETAIL);
    return;
  }

  if (method === "GET" && path === "/backend/customers") {
    await fulfillJson(route, 200, {
      items: [CUSTOMER],
      pagination: {
        page: 1,
        pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
        totalItems: 1,
        totalPages: 1,
      },
    });
    return;
  }

  if (method === "GET" && path === "/backend/prealerts") {
    await fulfillJson(route, 200, {
      items: [PREALERT],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });
    return;
  }

  await fulfillJson(route, 500, {
    error: {
      code: "UNMOCKED_ROUTE",
      message: `Ruta no mockeada: ${method} ${path}`,
    },
  });
}

async function fulfillJson(
  route: Route,
  status: number,
  body: unknown,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
