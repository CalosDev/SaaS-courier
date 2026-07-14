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

const CUSTOMS_PERMISSIONS = [
  "organizations.read",
  "customs.read",
  "customs.manage",
] as const;

const CUSTOMS_CASE = {
  id: "case-1",
  organizationId: "org-1",
  caseNumber: "CASO-2023-0001",
  status: "PENDING_REVIEW",
  createdAt: "2026-07-04T10:00:00.000Z",
  updatedAt: "2026-07-04T10:00:00.000Z",
  events: [],
} as const;

const CUSTOMS_CASE_UPDATED = {
  ...CUSTOMS_CASE,
  status: "UNDER_REVIEW",
  events: [
    {
      id: "event-1",
      source: "MANUAL",
      eventDate: "2026-07-04T10:30:00.000Z",
      description: "Documentación recibida",
      createdAt: "2026-07-04T10:30:00.000Z",
    },
  ],
} as const;

async function setupAuth(page: Page, overrides?: { permissions?: string[] }) {
  await page.route("**/backend/auth/session", async (route: Route) => {
    await route.fulfill({ json: { session: SESSION } });
  });

  await page.route("**/backend/auth/authorization", async (route: Route) => {
    await route.fulfill({
      json: { permissionCodes: overrides?.permissions ?? CUSTOMS_PERMISSIONS },
    });
  });

  await page.route("**/backend/auth/csrf", async (route: Route) => {
    await route.fulfill({ json: { csrfToken: "csrf-token" } });
  });

  await page.route("**/backend/organizations/current*", async (route: Route) => {
    await route.fulfill({ json: { id: "org-1" } });
  });
}

async function mockCustomsCasesList(page: Page, payload: unknown) {
  await page.route("**/backend/customs-cases**", async (route: Route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === "GET" &&
      url.pathname.endsWith("/backend/customs-cases")
    ) {
      await route.fulfill({ json: payload });
      return;
    }

    await route.continue();
  });
}

test.describe("Customs Cases", () => {
  test("should list customs cases", async ({ page }) => {
    await setupAuth(page);

    await mockCustomsCasesList(page, {
      items: [CUSTOMS_CASE],
      total: 1,
    });

    await page.goto("/customs/cases");

    await expect(page.getByRole("heading", { name: "Casos Aduaneros" })).toBeVisible();
    await expect(page.getByText("CASO-2023-0001")).toBeVisible();
    await expect(page.getByText("Pendiente")).toBeVisible();
  });

  test("should create a customs case", async ({ page }) => {
    await setupAuth(page);

    await mockCustomsCasesList(page, { items: [], total: 0 });

    let createdData: any = null;
    await page.route("**/backend/customs-cases", async (route: Route) => {
      if (route.request().method() === "POST") {
        createdData = route.request().postDataJSON();
        await route.fulfill({ json: CUSTOMS_CASE });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/backend/customs-cases/${CUSTOMS_CASE.id}`, async (route: Route) => {
      await route.fulfill({ json: CUSTOMS_CASE });
    });

    await page.goto("/customs/cases/new");

    await expect(page.getByRole("heading", { name: "Registrar caso aduanero" })).toBeVisible();

    await page.getByLabel("Número de caso *").fill("CASO-2023-0001");
    await page.getByRole("button", { name: "Registrar" }).click();

    // Se redirige a la página de detalles
    await expect(page.getByRole("heading", { name: "Caso Aduanero: CASO-2023-0001" })).toBeVisible();

    expect(createdData).toEqual({ caseNumber: "CASO-2023-0001" });
  });

  test("should record an event and change status", async ({ page }) => {
    await setupAuth(page);

    await page.route(`**/backend/customs-cases/${CUSTOMS_CASE.id}`, async (route: Route) => {
      await route.fulfill({ json: CUSTOMS_CASE });
    });

    await page.goto(`/customs/cases/${CUSTOMS_CASE.id}`);

    await expect(page.getByRole("heading", { name: "Caso Aduanero: CASO-2023-0001" })).toBeVisible();
    await expect(page.getByText("No hay eventos registrados.")).toBeVisible();

    // Mock changing status
    let statusData: any = null;
    await page.route(`**/backend/customs-cases/${CUSTOMS_CASE.id}/status`, async (route: Route) => {
      if (route.request().method() === "POST") {
        statusData = route.request().postDataJSON();
        // Update get route mock to return the new status
        await page.route(`**/backend/customs-cases/${CUSTOMS_CASE.id}`, async (r) => {
          await r.fulfill({ json: { ...CUSTOMS_CASE, status: statusData.status } });
        });
        await route.fulfill({ json: { ...CUSTOMS_CASE, status: statusData.status } });
      } else {
        await route.continue();
      }
    });

    await page.getByLabel("Nuevo estado *").selectOption("UNDER_REVIEW");
    await page.getByRole("button", { name: "Actualizar estado" }).click();

    await expect(
      page.locator(".ui-badge").filter({ hasText: "En revisión" }),
    ).toBeVisible();
    expect(statusData).toEqual({ status: "UNDER_REVIEW" });

    // Mock recording event
    let eventData: any = null;
    await page.route(`**/backend/customs-cases/${CUSTOMS_CASE.id}/events`, async (r) => {
      if (r.request().method() === "POST") {
        eventData = r.request().postDataJSON();

        // Update get route mock to return the new event
        await page.route(`**/backend/customs-cases/${CUSTOMS_CASE.id}`, async (getRoute) => {
          await getRoute.fulfill({
            json: {
              ...CUSTOMS_CASE,
              status: statusData ? statusData.status : CUSTOMS_CASE.status,
              events: [
                {
                  id: "event-1",
                  ...eventData,
                  createdAt: new Date().toISOString()
                }
              ]
            }
          });
        });

        await r.fulfill({
          json: {
            id: "event-1",
            ...eventData,
            createdAt: new Date().toISOString(),
          },
        });
      } else {
        await r.continue();
      }
    });

    await page.getByLabel("Fuente *").selectOption("MANUAL");
    await page.getByLabel("Fecha del evento *").fill("2023-01-01T10:00");
    await page.getByLabel("Descripción *").fill("Revisión iniciada en aduana");
    await page.getByRole("button", { name: "Registrar evento" }).click();

    await expect(page.getByText("Revisión iniciada en aduana")).toBeVisible();

    expect(eventData).toMatchObject({
      source: "MANUAL",
      description: "Revisión iniciada en aduana",
    });
  });
});
