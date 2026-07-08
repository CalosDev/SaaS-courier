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
  expiresAt: "2026-07-08T23:59:59.000Z",
  employeeCode: "EMP-001",
  primaryFacilityId: "facility-1",
} as const;

const INVENTORY_PERMISSIONS = [
  "inventory.read",
  "inventory.manage",
  "facilities.read",
] as const;

const FACILITY = {
  id: "facility-1",
  code: "MIA-01",
  name: "Miami Origin",
  type: "INTERNATIONAL_WAREHOUSE",
  isActive: true,
  isPackageOrigin: true,
} as const;

const PACKAGE = {
  id: "package-1",
  internalTrackingNumber: "PK7KMP4TX9RW3Q",
  externalTrackingNumber: "1Z-999-AA1-01-2345-6784",
  status: "RECEIVED_AT_ORIGIN",
  customer: {
    id: "customer-1",
    customerCode: "C-001",
    displayName: "Ada Lovelace",
  },
  reception: {
    facility: {
      id: FACILITY.id,
      code: FACILITY.code,
      name: FACILITY.name,
    },
    receivedAt: "2026-07-08T10:00:00.000Z",
  },
  currentPosition: null,
} as const;

test("creates a warehouse location without tenant fields in the payload", async ({
  page,
}) => {
  let createPayload: Record<string, unknown> | null = null;

  await mockInventoryBackoffice(page);
  await page.route("**/backend/inventory/locations", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    createPayload = (await route.request().postDataJSON()) as Record<
      string,
      unknown
    >;

    await fulfillJson(route, 201, {
      id: "location-2",
      facility: {
        id: FACILITY.id,
        code: FACILITY.code,
        name: FACILITY.name,
      },
      code: "A-02",
      name: "Rack A-02",
      type: "SHELF",
      description: null,
      isActive: true,
      createdAt: "2026-07-08T10:10:00.000Z",
      updatedAt: "2026-07-08T10:10:00.000Z",
    });
  });

  await page.goto("/inventory/locations");

  await expect(
    page.getByRole("heading", { name: "Ubicaciones de almacén" }),
  ).toBeVisible();
  await page.getByLabel("Código").fill("A-02");
  await page.getByLabel("Nombre").fill("Rack A-02");
  await page.getByRole("button", { name: "Crear ubicación" }).click();

  await expect
    .poll(() => createPayload, {
      message: "La creacion debe enviar el payload de la ubicacion",
    })
    .toEqual({
      facilityId: FACILITY.id,
      code: "A-02",
      name: "Rack A-02",
      type: "SHELF",
      description: null,
      isActive: true,
    });
  await expect(page.getByText(/Ubicaci.n creada\./)).toBeVisible();
  expect(createPayload).not.toHaveProperty("organizationId");
  expect(createPayload).not.toHaveProperty("employeeId");
});

test("registers an inventory movement without tenant fields in the payload", async ({
  page,
}) => {
  let movementPayload: Record<string, unknown> | null = null;

  await mockInventoryBackoffice(page);
  await page.route(`**/backend/inventory/packages/${PACKAGE.id}/move`, async (route) => {
    movementPayload = (await route.request().postDataJSON()) as Record<
      string,
      unknown
    >;
    await fulfillJson(route, 200, {
      ...PACKAGE,
      currentPosition: {
        location: {
          id: "location-1",
          code: "A-01",
          name: "Rack A-01",
          type: "SHELF",
        },
        placedAt: "2026-07-08T10:15:00.000Z",
        updatedAt: "2026-07-08T10:15:00.000Z",
      },
    });
  });

  await page.goto("/inventory/packages");

  await page.getByRole("button", { name: "Gestionar" }).click();
  await page.getByRole("combobox", { name: "Ubicación destino" }).selectOption(
    "location-1",
  );
  await page.getByLabel("Nota").fill("Initial placement");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();

  await expect
    .poll(() => movementPayload, {
      message: "El movimiento debe enviar el payload esperado",
    })
    .toEqual({
      movementType: "PUTAWAY",
      toLocationId: "location-1",
      note: "Initial placement",
    });
  expect(movementPayload).not.toHaveProperty("organizationId");
  expect(movementPayload).not.toHaveProperty("employeeId");
  await expect(page.getByText("Movimiento registrado.")).toBeVisible();
});

async function mockInventoryBackoffice(page: Page): Promise<void> {
  await page.route("**/backend/**", async (route) => {
    await fulfillInventoryRoute(route);
  });
}

async function fulfillInventoryRoute(route: Route): Promise<void> {
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
      permissionCodes: INVENTORY_PERMISSIONS,
    });
    return;
  }

  if (method === "GET" && path === "/backend/auth/csrf") {
    await fulfillJson(route, 200, {
      csrfToken: "csrf-token",
    });
    return;
  }

  if (method === "GET" && path === "/backend/facilities") {
    await fulfillJson(route, 200, {
      items: [FACILITY],
      pagination: {
        page: 1,
        pageSize: 100,
        totalItems: 1,
        totalPages: 1,
      },
    });
    return;
  }

  if (method === "GET" && path === "/backend/inventory/locations") {
    await fulfillJson(route, 200, {
      items: [
        {
          id: "location-1",
          facility: {
            id: FACILITY.id,
            code: FACILITY.code,
            name: FACILITY.name,
          },
          code: "A-01",
          name: "Rack A-01",
          type: "SHELF",
          description: null,
          isActive: true,
          createdAt: "2026-07-08T10:00:00.000Z",
          updatedAt: "2026-07-08T10:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: Number(url.searchParams.get("pageSize") ?? "10"),
        totalItems: 1,
        totalPages: 1,
      },
    });
    return;
  }

  if (method === "GET" && path === "/backend/inventory/packages") {
    await fulfillJson(route, 200, {
      items: [PACKAGE],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    });
    return;
  }

  if (
    method === "GET" &&
    path === `/backend/inventory/packages/${PACKAGE.id}/movements`
  ) {
    await fulfillJson(route, 200, {
      items: [],
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
