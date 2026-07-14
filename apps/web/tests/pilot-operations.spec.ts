import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  sessionId: "session-pilot-operations",
  userId: "user-1",
  email: "operator@courier.test",
  organizationId: "org-1",
  organizationSlug: "courier-demo",
  organizationName: "Courier Demo",
  employeeId: "employee-1",
  firstName: "Ada",
  lastName: "Lovelace",
  facilityIds: ["00000000-0000-4000-8000-000000000001"],
  expiresAt: "2026-07-14T23:59:59.000Z",
  employeeCode: "EMP-001",
  primaryFacilityId: "00000000-0000-4000-8000-000000000001",
} as const;

const PERMISSIONS = [
  "organizations.read",
  "inventory.read",
  "inventory.manage",
  "notifications.read",
  "notifications.manage",
  "carriers.read",
  "carriers.manage",
];

async function setupAuth(page: Page) {
  await page.route("**/backend/auth/session", (route: Route) =>
    route.fulfill({ json: { session: SESSION } }),
  );
  await page.route("**/backend/auth/authorization", (route: Route) =>
    route.fulfill({ json: { permissionCodes: PERMISSIONS } }),
  );
  await page.route("**/backend/auth/csrf", (route: Route) =>
    route.fulfill({ json: { csrfToken: "csrf-token" } }),
  );
  await page.route("**/backend/organizations/current*", (route: Route) =>
    route.fulfill({ json: { id: "org-1" } }),
  );
}

test("processes a tenant-safe warehouse putaway batch", async ({ page }) => {
  await setupAuth(page);
  const locationId = "00000000-0000-4000-8000-000000000010";
  let payload: Record<string, unknown> | null = null;
  await page.route("**/backend/inventory/locations**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: locationId,
            code: "A-01",
            name: "Rack A",
            type: "RACK",
            isActive: true,
            facility: { id: "facility-1", code: "SDQ", name: "Santo Domingo" },
          },
        ],
        pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      },
    }),
  );
  await page.route("**/backend/warehouse/batch/putaway", async (route) => {
    payload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        location: { id: locationId, code: "A-01", name: "Rack A" },
        summary: { requested: 1, placed: 1, failed: 0, skipped: 0 },
        results: [
          {
            code: "PK123",
            packageId: "package-1",
            internalTrackingNumber: "PK123",
            status: "PLACED",
            locationCode: "A-01",
          },
        ],
      },
    });
  });

  await page.goto("/warehouse/putaway");
  await page.getByPlaceholder("Tracking o prealerta").fill("pk123");
  await page.getByRole("button", { name: "Agregar scan" }).click();
  await page.locator('select[name="toLocationId"]').selectOption(locationId);
  await page.getByRole("button", { name: "Procesar lote" }).click();

  await expect(page.getByText("Ubicados: 1")).toBeVisible();
  expect(payload).toEqual({ codes: ["PK123"], toLocationId: locationId });
  expect(payload).not.toHaveProperty("organizationId");
});

test("creates an outbox notification template without tenant input", async ({
  page,
}) => {
  await setupAuth(page);
  let payload: Record<string, unknown> | null = null;
  let templates: Record<string, unknown>[] = [];
  await page.route("**/backend/notification-templates", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: templates });
      return;
    }
    payload = route.request().postDataJSON() as Record<string, unknown>;
    templates = [
      {
        id: "template-1",
        ...payload,
        channel: "EMAIL",
        isActive: true,
        createdAt: "2026-07-13T20:00:00.000Z",
        updatedAt: "2026-07-13T20:00:00.000Z",
      },
    ];
    await route.fulfill({ status: 201, json: templates[0] });
  });

  await page.goto("/notifications/templates");
  await page.locator('input[name="code"]').fill("PACKAGE_RECEIVED");
  await page.getByRole("textbox", { name: "Evento outbox" }).fill("package.received");
  await page.locator('input[name="subjectTemplate"]').fill("Paquete recibido");
  await page.locator('textarea[name="bodyTemplate"]').fill("Tracking {{trackingNumber}}");
  await page.locator('input[name="variable:trackingNumber"]').check();
  await page.getByRole("button", { name: "Crear plantilla" }).click();

  await expect(page.getByText("Plantilla creada.")).toBeVisible();
  expect(payload).toMatchObject({
    code: "PACKAGE_RECEIVED",
    eventType: "package.received",
    allowedVariables: ["trackingNumber"],
  });
  expect(payload).not.toHaveProperty("organizationId");
});

test("creates a carrier connection using only an environment secret reference", async ({
  page,
}) => {
  await setupAuth(page);
  let payload: Record<string, unknown> | null = null;
  let connections: Record<string, unknown>[] = [];
  await page.route("**/backend/carrier-connections", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: connections });
      return;
    }
    payload = route.request().postDataJSON() as Record<string, unknown>;
    connections = [
      {
        id: "connection-1",
        carrierCode: "UPS",
        displayName: "UPS Pilot",
        connectionKey: "public-key",
        status: "DISABLED",
        credentialConfigured: false,
        lastTestedAt: null,
        lastErrorCode: null,
        createdAt: "2026-07-13T20:00:00.000Z",
        updatedAt: "2026-07-13T20:00:00.000Z",
      },
    ];
    await route.fulfill({ status: 201, json: connections[0] });
  });

  await page.goto("/integrations/carriers");
  await page.locator('select[name="carrierCode"]').selectOption("UPS");
  await page.locator('input[name="displayName"]').fill("UPS Pilot");
  await page.locator('input[name="secretReference"]').fill("UPS_PILOT");
  await page.getByRole("button", { name: "Crear conexión" }).click();

  await expect(page.getByText(/Configura el secreto/)).toBeVisible();
  expect(payload).toEqual({
    carrierCode: "UPS",
    displayName: "UPS Pilot",
    secretReference: "UPS_PILOT",
    status: "DISABLED",
  });
  expect(payload).not.toHaveProperty("organizationId");
});

test("shows live readiness dependency results", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/backend/health/ready", (route) =>
    route.fulfill({
      json: {
        status: "ready",
        service: "courier-api",
        checks: { database: "up", objectStorage: "up", smtp: "up" },
        timestamp: "2026-07-13T20:00:00.000Z",
      },
    }),
  );

  await page.goto("/system/status");
  await expect(page.getByText("READY")).toBeVisible();
  await expect(page.getByRole("cell", { name: "PostgreSQL" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Object storage" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "SMTP" })).toBeVisible();
});
