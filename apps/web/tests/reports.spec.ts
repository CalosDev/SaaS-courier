import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  sessionId: "session-reports",
  userId: "user-1",
  email: "reports@courier.test",
  organizationId: "org-1",
  organizationSlug: "courier-demo",
  organizationName: "Courier Demo",
  employeeId: "employee-1",
  firstName: "Ada",
  lastName: "Lovelace",
  facilityIds: ["facility-1"],
  expiresAt: "2026-07-13T23:59:59.000Z",
  employeeCode: "EMP-001",
  primaryFacilityId: "facility-1",
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
          "reports.read",
          "reports.export",
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

test("filters an operational report and downloads its asynchronous export", async ({
  page,
}) => {
  await setupAuth(page);
  let reportDateFrom: string | null = null;
  let reportDateTo: string | null = null;
  let exportPayload: Record<string, unknown> | null = null;

  await page.route("**/backend/reports/operations**", async (route) => {
    const reportQuery = new URL(route.request().url());
    reportDateFrom = reportQuery.searchParams.get("dateFrom");
    reportDateTo = reportQuery.searchParams.get("dateTo");
    await route.fulfill({
      json: {
        generatedAt: "2026-07-13T12:00:00.000Z",
        filters: {
          dateFrom: reportQuery.searchParams.get("dateFrom"),
          dateTo: reportQuery.searchParams.get("dateTo"),
        },
        data: {
          total: 2,
          byStatus: [
            { status: "IN_TRANSIT", count: 1 },
            { status: "ARRIVED_AT_DESTINATION", count: 1 },
          ],
        },
      },
    });
  });

  await page.route("**/backend/report-exports", async (route) => {
    exportPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      json: {
        id: "00000000-0000-4000-8000-000000000044",
        reportType: "OPERATIONS",
        status: "PENDING",
        filters: {},
        fileName: null,
        contentType: null,
        rowCount: null,
        truncated: false,
        errorCode: null,
        startedAt: null,
        completedAt: null,
        expiresAt: null,
        createdAt: "2026-07-13T12:00:00.000Z",
        updatedAt: "2026-07-13T12:00:00.000Z",
      },
    });
  });

  await page.route(
    "**/backend/report-exports/00000000-0000-4000-8000-000000000044",
    (route) =>
      route.fulfill({
        json: {
          id: "00000000-0000-4000-8000-000000000044",
          reportType: "OPERATIONS",
          status: "COMPLETED",
          filters: {},
          fileName: "operations-report.csv",
          contentType: "text/csv; charset=utf-8",
          rowCount: 2,
          truncated: false,
          errorCode: null,
          startedAt: "2026-07-13T12:00:01.000Z",
          completedAt: "2026-07-13T12:00:02.000Z",
          expiresAt: "2026-07-14T12:00:02.000Z",
          createdAt: "2026-07-13T12:00:00.000Z",
          updatedAt: "2026-07-13T12:00:02.000Z",
        },
      }),
  );
  await page.route(
    "**/backend/report-exports/00000000-0000-4000-8000-000000000044/download",
    (route) =>
      route.fulfill({
        contentType: "text/csv",
        headers: {
          "Content-Disposition": 'attachment; filename="operations-report.csv"',
        },
        body: '"Tracking","Estado"\r\n"PK-1","IN_TRANSIT"',
      }),
  );

  await page.goto("/reports");
  await page.getByLabel("Desde").fill("2026-07-01");
  await page.getByLabel("Hasta").fill("2026-07-31");
  await page.getByRole("button", { name: "Consultar" }).click();

  await expect(page.getByRole("cell", { name: "IN_TRANSIT" })).toBeVisible();
  expect(reportDateFrom).toBe("2026-07-01T00:00:00.000Z");
  expect(reportDateTo).toBe("2026-07-31T23:59:59.999Z");

  await page.getByRole("button", { name: "Exportar CSV" }).click();
  await expect(
    page.getByRole("heading", { name: "Exportacion de reporte" }),
  ).toBeVisible();
  await expect(page.getByText("COMPLETED")).toBeVisible();

  expect(exportPayload).toEqual({
    reportType: "OPERATIONS",
    dateFrom: "2026-07-01T00:00:00.000Z",
    dateTo: "2026-07-31T23:59:59.999Z",
  });
  expect(exportPayload).not.toHaveProperty("organizationId");
  expect(exportPayload).not.toHaveProperty("employeeId");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("operations-report.csv");
});
