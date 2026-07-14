import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  sessionId: "session-billing",
  userId: "user-1",
  email: "billing@courier.test",
  organizationId: "org-1",
  organizationSlug: "courier-demo",
  organizationName: "Courier Demo",
  employeeId: "employee-1",
  firstName: "Ada",
  lastName: "Lovelace",
  facilityIds: [],
  expiresAt: "2026-07-13T23:59:59.000Z",
  employeeCode: "EMP-001",
  primaryFacilityId: null,
} as const;

async function setupAuth(page: Page) {
  await page.route("**/backend/auth/session", (route: Route) =>
    route.fulfill({ json: { session: SESSION } }),
  );
  await page.route("**/backend/auth/authorization", (route: Route) =>
    route.fulfill({
      json: {
        permissionCodes: [
          "organizations.read",
          "billing.read",
          "billing.manage",
          "payments.manage",
        ],
      },
    }),
  );
  await page.route("**/backend/auth/csrf", (route: Route) =>
    route.fulfill({ json: { csrfToken: "csrf-token" } }),
  );
  await page.route("**/backend/organizations/current*", (route: Route) =>
    route.fulfill({ json: { id: "org-1" } }),
  );
}

test("issues an invoice and applies a payment in minor units", async ({ page }) => {
  await setupAuth(page);
  const baseInvoice = {
    id: "invoice-1",
    customerId: "customer-1",
    invoiceNumber: "INV-001",
    status: "DRAFT",
    currencyCode: "DOP",
    balanceDueMinor: "10000",
    lines: [
      {
        id: "line-1",
        description: "Transporte",
        quantity: 1,
        totalPriceMinor: "10000",
      },
    ],
  };
  let invoice = baseInvoice;
  await page.route("**/backend/invoices/invoice-1", (route) =>
    route.fulfill({ json: invoice }),
  );
  await page.route("**/backend/invoices/invoice-1/issue", async (route) => {
    invoice = { ...invoice, status: "ISSUED" };
    await route.fulfill({ json: invoice });
  });

  await page.goto("/billing/invoices/invoice-1");
  await page.getByRole("button", { name: "Emitir factura" }).click();
  await expect(page.getByText("ISSUED")).toBeVisible();

  await page.route("**/backend/payments**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          items: [
            {
              id: "payment-1",
              customerId: "customer-1",
              paymentNumber: "PAY-001",
              status: "RECORDED",
              method: "CASH",
              amountMinor: "10000",
              currencyCode: "DOP",
              reference: null,
              createdAt: "2026-07-12T00:00:00.000Z",
            },
          ],
        },
      });
      return;
    }
    await route.continue();
  });
  await page.route("**/backend/customers**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/backend/invoices**", (route) =>
    route.fulfill({ json: { items: [invoice] } }),
  );
  let applyPayload: Record<string, unknown> | null = null;
  await page.route("**/backend/payments/payment-1/apply", async (route) => {
    applyPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { status: "APPLIED" } });
  });

  await page.goto("/billing/payments");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.getByLabel("Factura").selectOption("invoice-1");
  await page.getByLabel("Monto").fill("70.00");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(() => applyPayload).not.toBeNull();
  expect(applyPayload).toEqual({ invoiceId: "invoice-1", amountMinor: "7000" });
  expect(applyPayload).not.toHaveProperty("organizationId");
});
