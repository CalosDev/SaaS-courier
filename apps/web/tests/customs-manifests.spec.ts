import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  sessionId: "session-manifest",
  userId: "user-1",
  email: "operator@courier.test",
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
          "customs_manifests.read",
          "customs_manifests.manage",
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

test("builds, validates and finalizes an immutable customs manifest", async ({
  page,
}) => {
  await setupAuth(page);
  let manifest = {
    id: "manifest-1",
    code: "CM-001",
    flightNumber: "AA123",
    arrivalDate: "2026-07-12",
    status: "DRAFT",
    currentVersion: 0,
    finalizedVersionId: null as string | null,
    versions: [] as Array<Record<string, unknown>>,
  };

  await page.route("**/backend/customs-manifests/manifest-1", (route) =>
    route.fulfill({ json: manifest }),
  );
  await page.route(
    "**/backend/customs-manifests/manifest-1/build-version",
    async (route) => {
      const version = {
        id: "version-1",
        versionNumber: 1,
        validationStatus: "PENDING",
        items: [{ id: "item-1" }],
      };
      manifest = { ...manifest, currentVersion: 1, versions: [version] };
      await route.fulfill({ json: version });
    },
  );
  await page.route(
    "**/backend/customs-manifests/manifest-1/validate",
    async (route) => {
      const version = {
        ...manifest.versions[0],
        validationStatus: "VALID",
      };
      manifest = { ...manifest, status: "VALIDATED", versions: [version] };
      await route.fulfill({ json: version });
    },
  );
  await page.route(
    "**/backend/customs-manifests/manifest-1/finalize",
    async (route) => {
      manifest = {
        ...manifest,
        status: "FINALIZED",
        finalizedVersionId: "version-1",
      };
      await route.fulfill({ json: manifest });
    },
  );

  await page.goto("/customs-manifests/manifest-1");
  await page.getByRole("button", { name: "Construir versión" }).click();
  await expect(page.getByText("v1")).toBeVisible();
  await page.getByRole("button", { name: "Validar" }).click();
  await expect(page.getByRole("cell", { name: "VALID", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar" }).click();
  await expect(page.getByText("Finalizado")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Construir versión" }),
  ).toHaveCount(0);
});
