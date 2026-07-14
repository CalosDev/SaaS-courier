import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = { sessionId: "pickup-session", userId: "user-1", email: "pickup@courier.test", organizationId: "org-1", organizationSlug: "courier-demo", organizationName: "Courier Demo", employeeId: "employee-1", firstName: "Ada", lastName: "Lovelace", facilityIds: ["facility-1"], expiresAt: "2026-07-13T23:59:59.000Z", employeeCode: "EMP-001", primaryFacilityId: "facility-1" } as const;

async function setupAuth(page: Page) {
  await page.route("**/backend/auth/session", (route: Route) => route.fulfill({ json: { session: SESSION } }));
  await page.route("**/backend/auth/authorization", (route: Route) => route.fulfill({ json: { permissionCodes: ["pickups.read", "pickups.manage"] } }));
  await page.route("**/backend/auth/csrf", (route: Route) => route.fulfill({ json: { csrfToken: "csrf-token" } }));
  await page.route("**/backend/organizations/current*", (route: Route) => route.fulfill({ json: { id: "org-1" } }));
}

test("creates and completes a branch pickup without sending tenant identity", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/backend/customers**", (route) => route.fulfill({ json: { items: [{ id: "customer-1", customerCode: "C001", displayName: "Cliente Uno", status: "ACTIVE" }] } }));
  await page.route("**/backend/facilities**", (route) => route.fulfill({ json: { items: [{ id: "facility-1", code: "SDQ", name: "Sucursal Central", isActive: true, isCustomerFacing: true }] } }));
  await page.route("**/backend/packages**", (route) => route.fulfill({ json: { items: [{ id: "package-1", internalTrackingNumber: "PK-001", status: "ARRIVED_AT_DESTINATION", customer: { id: "customer-1" } }] } }));
  let createPayload: Record<string, unknown> | null = null;
  await page.route("**/backend/pickup-requests", async (route) => {
    createPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { id: "pickup-1", pickupNumber: "PU-001", status: "DRAFT" } });
  });
  let status = "DRAFT";
  await page.route("**/backend/pickup-requests/pickup-1", (route) => route.fulfill({ json: { id: "pickup-1", pickupNumber: "PU-001", status, createdAt: "2026-07-12T00:00:00.000Z", items: [{ id: "item-1", packageId: "package-1", pickupRequestId: "pickup-1", createdAt: "2026-07-12T00:00:00.000Z" }] } }));
  await page.route("**/backend/pickup-requests/pickup-1/ready", async (route) => { status = "READY"; await route.fulfill({ json: { status } }); });
  await page.route("**/backend/pickup-requests/pickup-1/complete", async (route) => { status = "COMPLETED"; await route.fulfill({ json: { status } }); });

  await page.goto("/pickup-requests/new");
  await page.getByLabel("Cliente").selectOption("customer-1");
  await page.getByLabel("Sucursal").selectOption("facility-1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear solicitud" }).click();
  await expect(page).toHaveURL(/\/pickup-requests\/pickup-1$/);
  expect(createPayload).toEqual({ customerId: "customer-1", facilityId: "facility-1", packageIds: ["package-1"] });
  expect(createPayload).not.toHaveProperty("organizationId");
  await page.getByRole("button", { name: "Marcar lista" }).click();
  await expect(page.getByRole("button", { name: "Completar retiro" })).toBeVisible();
  await page.getByRole("button", { name: "Completar retiro" }).click();
  await expect(page.getByText("COMPLETED")).toBeVisible();
});
