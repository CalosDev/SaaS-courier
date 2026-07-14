import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  sessionId: "session-rates",
  userId: "user-1",
  email: "rates@courier.test",
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

const PAGINATION = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
} as const;

const SERVICE = {
  id: "service-1",
  code: "AIR",
  name: "Aereo Express",
  description: "Entrega aerea prioritaria",
  isActive: true,
  createdAt: "2026-07-13T10:00:00.000Z",
  updatedAt: "2026-07-13T10:00:00.000Z",
} as const;

function buildRateCard() {
  return {
    id: "rate-card-1",
    service: {
      id: SERVICE.id,
      code: SERVICE.code,
      name: SERVICE.name,
    },
    name: "Aereo Retail 2026",
    segmentKey: "RETAIL",
    segmentName: "Clientes retail",
    calculationType: "FLAT",
    version: 1,
    status: "DRAFT",
    currencyCode: "DOP",
    weightUnit: "LB",
    rules: [] as Array<{
      id: string;
      sortOrder: number;
      minWeight: string | null;
      maxWeight: string | null;
      flatAmountMinor: number | null;
      unitAmountMinor: number | null;
    }>,
    createdAt: "2026-07-13T10:05:00.000Z",
    updatedAt: "2026-07-13T10:05:00.000Z",
  };
}

async function setupAuth(page: Page) {
  await page.route("**/backend/auth/session", (route: Route) =>
    route.fulfill({ json: { session: SESSION } }),
  );
  await page.route("**/backend/auth/authorization", (route: Route) =>
    route.fulfill({
      json: {
        permissionCodes: [
          "organizations.read",
          "rates.read",
          "rates.manage",
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

test("creates, configures, activates and quotes a versioned rate card", async ({
  page,
}) => {
  await setupAuth(page);

  const services = [] as Array<typeof SERVICE>;
  const rateCards = [] as ReturnType<typeof buildRateCard>[];
  let rateCard = buildRateCard();
  let servicePayload: Record<string, unknown> | null = null;
  let rateCardPayload: Record<string, unknown> | null = null;
  let rulesPayload: Record<string, unknown> | null = null;
  let activationPayload: Record<string, unknown> | null = null;
  let quotePayload: Record<string, unknown> | null = null;

  await page.route("**/backend/services**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "GET" && path === "/backend/services") {
      await route.fulfill({
        json: {
          items: services,
          pagination: { ...PAGINATION, total: services.length },
        },
      });
      return;
    }

    if (request.method() === "POST" && path === "/backend/services") {
      servicePayload = request.postDataJSON() as Record<string, unknown>;
      services.push(SERVICE);
      await route.fulfill({ status: 201, json: SERVICE });
      return;
    }

    await route.continue();
  });

  await page.route("**/backend/rate-cards**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "GET" && path === "/backend/rate-cards") {
      await route.fulfill({
        json: {
          items: rateCards,
          pagination: { ...PAGINATION, total: rateCards.length },
        },
      });
      return;
    }

    if (request.method() === "POST" && path === "/backend/rate-cards") {
      rateCardPayload = request.postDataJSON() as Record<string, unknown>;
      rateCards.push(rateCard);
      await route.fulfill({ status: 201, json: rateCard });
      return;
    }

    if (
      request.method() === "GET" &&
      path === `/backend/rate-cards/${rateCard.id}`
    ) {
      await route.fulfill({ json: rateCard });
      return;
    }

    if (
      request.method() === "PUT" &&
      path === `/backend/rate-cards/${rateCard.id}/rules`
    ) {
      rulesPayload = request.postDataJSON() as Record<string, unknown>;
      rateCard = {
        ...rateCard,
        rules: [
          {
            id: "rule-1",
            sortOrder: 1,
            minWeight: null,
            maxWeight: null,
            flatAmountMinor: 1550,
            unitAmountMinor: null,
          },
        ],
      };
      rateCards[0] = rateCard;
      await route.fulfill({ json: rateCard });
      return;
    }

    if (
      request.method() === "POST" &&
      path === `/backend/rate-cards/${rateCard.id}/activate`
    ) {
      activationPayload = request.postDataJSON() as Record<string, unknown>;
      rateCard = { ...rateCard, status: "ACTIVE" };
      rateCards[0] = rateCard;
      await route.fulfill({ json: rateCard });
      return;
    }

    await route.continue();
  });

  await page.route("**/backend/rates/quote", async (route: Route) => {
    quotePayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        rateCard,
        appliedRule: rateCard.rules[0],
        quote: {
          weight: "2",
          pieceCount: 1,
          courierAmountMinor: "1550",
          customsAmountMinor: "0",
          totalAmountMinor: "1550",
        },
      },
    });
  });

  await page.goto("/rates/services");
  await page.locator('input[name="code"]').fill("AIR");
  await page.locator('input[name="name"]').fill("Aereo Express");
  await page
    .locator('input[name="description"]')
    .fill("Entrega aerea prioritaria");
  await page.getByRole("button", { name: "Crear servicio" }).click();

  await expect(page.getByText("Servicio creado.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "AIR" })).toBeVisible();

  await page.goto("/rates/cards");
  await page.locator('select[name="serviceId"]').selectOption(SERVICE.id);
  await page.locator('input[name="name"]').fill("Aereo Retail 2026");
  await page.locator('input[name="segmentKey"]').fill("RETAIL");
  await page.locator('input[name="segmentName"]').fill("Clientes retail");
  await page.locator('select[name="calculationType"]').selectOption("FLAT");
  await page.getByRole("button", { name: "Crear Tarifario" }).click();

  await expect(page.getByText(/Tarifario creado/)).toBeVisible();
  await page.getByRole("link", { name: "Configurar" }).click();

  await expect(
    page.getByRole("heading", { name: "Tarifario: Aereo Retail 2026" }),
  ).toBeVisible();
  await page.locator('input[name="flatMinor"]').fill("15.50");
  await page.getByRole("button", { name: "Guardar Regla" }).click();
  await expect(page.getByText("Reglas guardadas correctamente.")).toBeVisible();

  await page.getByRole("button", { name: "Activar Tarifario" }).click();
  await expect(page.getByText("Tarifario activado correctamente.")).toBeVisible();
  await expect(page.getByText(/Estado:/)).toContainText("ACTIVE");

  await page.getByLabel("Peso (Weight)").fill("2");
  await page.getByRole("button", { name: "Cotizar" }).click();
  await expect(page.getByText("Total Courier: DOP 15.50")).toBeVisible();

  expect(servicePayload).toEqual({
    code: "AIR",
    name: "Aereo Express",
    description: "Entrega aerea prioritaria",
    isActive: true,
  });
  expect(rateCardPayload).toEqual({
    serviceId: SERVICE.id,
    name: "Aereo Retail 2026",
    segmentKey: "RETAIL",
    segmentName: "Clientes retail",
    calculationType: "FLAT",
  });
  expect(rulesPayload).toEqual({
    rules: [
      {
        sortOrder: 1,
        minWeight: null,
        maxWeight: null,
        flatAmountMinor: 1550,
        unitAmountMinor: null,
      },
    ],
  });
  expect(activationPayload).toEqual({});
  expect(quotePayload).toEqual({ rateCardId: rateCard.id, weight: 2 });

  for (const payload of [
    servicePayload,
    rateCardPayload,
    rulesPayload,
    activationPayload,
    quotePayload,
  ]) {
    expect(payload).not.toHaveProperty("organizationId");
    expect(payload).not.toHaveProperty("employeeId");
    expect(payload).not.toHaveProperty("actorId");
  }
});
