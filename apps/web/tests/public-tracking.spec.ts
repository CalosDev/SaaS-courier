import { expect, test } from "@playwright/test";

test("tracks a shipment publicly without an authenticated session", async ({ page }) => {
  await page.route("**/backend/auth/session", (route) => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Authentication required" } } }));
  await page.route("**/backend/public/organizations/courier-demo/tracking/PKABCDEFGH2345", (route) => route.fulfill({ headers: { "Cache-Control": "no-store" }, json: { organization: { slug: "courier-demo", name: "Courier Demo" }, referenceType: "INTERNAL_TRACKING", internalTrackingNumber: "PKABCDEFGH2345", status: "ARRIVED_AT_DESTINATION", timeline: [{ eventType: "RECEIVED_AT_ORIGIN", location: "Miami", createdAt: "2026-07-10T12:00:00.000Z" }, { eventType: "ARRIVED_AT_DESTINATION", location: "Sucursal Central", createdAt: "2026-07-12T12:00:00.000Z" }] } }));

  await page.goto("/track/courier-demo");
  await expect(page).toHaveURL(/\/track\/courier-demo$/);
  await page.getByLabel("Referencia de tracking").fill("PKABCDEFGH2345");
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page.getByText("Courier Demo")).toBeVisible();
  await expect(page.getByText("Disponible en destino").first()).toBeVisible();
  await expect(page.getByText("Sucursal Central")).toBeVisible();
  await expect(page).not.toHaveURL(/\/login$/);
});
