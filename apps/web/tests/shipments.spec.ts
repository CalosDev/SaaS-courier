import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  sessionId: "session-shipments",
  userId: "user-1",
  email: "operator@courier.test",
  organizationId: "org-1",
  organizationSlug: "courier-demo",
  organizationName: "Courier Demo",
  employeeId: "employee-1",
  firstName: "Ada",
  lastName: "Lovelace",
  facilityIds: ["00000000-0000-4000-8000-000000000001"],
  expiresAt: "2026-07-13T23:59:59.000Z",
  employeeCode: "EMP-001",
  primaryFacilityId: "00000000-0000-4000-8000-000000000001",
} as const;

async function setupAuth(page: Page) {
  await page.route("**/backend/auth/session", (route: Route) =>
    route.fulfill({ json: { session: SESSION } }),
  );
  await page.route("**/backend/auth/authorization", (route: Route) =>
    route.fulfill({
      json: { permissionCodes: ["organizations.read", "shipments.manage"] },
    }),
  );
  await page.route("**/backend/auth/csrf", (route: Route) =>
    route.fulfill({ json: { csrfToken: "csrf-token" } }),
  );
  await page.route("**/backend/organizations/current*", (route: Route) =>
    route.fulfill({ json: { id: "org-1" } }),
  );
}

test("creates a master shipment with facility references", async ({ page }) => {
  await setupAuth(page);
  const originId = "00000000-0000-4000-8000-000000000001";
  const destinationId = "00000000-0000-4000-8000-000000000002";
  await page.route("**/backend/facilities**", (route) =>
    route.fulfill({
      json: {
        items: [
          { id: originId, code: "MIA", name: "Miami" },
          { id: destinationId, code: "SDQ", name: "Santo Domingo" },
        ],
      },
    }),
  );

  let payload: Record<string, unknown> | null = null;
  await page.route("**/backend/master-shipments", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    payload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        id: "shipment-1",
        dispatchCode: "DSP-2026-1001",
        status: "DRAFT",
      },
    });
  });
  await page.route("**/backend/master-shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        id: "shipment-1",
        dispatchCode: "DSP-2026-1001",
        status: "DRAFT",
        originFacilityId: originId,
        destinationFacilityId: destinationId,
        transportMode: "AIR",
        originFacility: { id: originId, code: "MIA", name: "Miami" },
        destinationFacility: {
          id: destinationId,
          code: "SDQ",
          name: "Santo Domingo",
        },
        packages: [],
      },
    }),
  );

  await page.goto("/shipments/new");
  await page.getByLabel("Facility de origen").selectOption(originId);
  await page.getByLabel("Facility de destino").selectOption(destinationId);
  await page.getByRole("button", { name: "Crear embarque" }).click();

  await expect(
    page.getByRole("heading", { name: "Embarque DSP-2026-1001" }),
  ).toBeVisible();
  expect(payload).toMatchObject({
    originFacilityId: originId,
    destinationFacilityId: destinationId,
    transportMode: "AIR",
  });
  expect(payload).not.toHaveProperty("organizationId");
  expect(payload).not.toHaveProperty("origin");
  expect(payload).not.toHaveProperty("destination");
});
