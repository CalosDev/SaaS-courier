"use client";

import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR(
    "/dashboard-data",
    async () => {
      const [organization, capabilities, onboarding, metricsResponse] = await Promise.all([
        backofficeApi.getCurrentOrganization(),
        backofficeApi.getCapabilities(),
        backofficeApi.getOnboarding(),
        backofficeApi.getDashboardMetrics(),
      ]);
      return { organization, capabilities, onboarding, metrics: metricsResponse };
    }
  );

  if (isLoading) {
    return <LoadingState label="Cargando dashboard..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="No fue posible cargar el dashboard"
        description={error?.message || "Ocurrió un error inesperado."}
      />
    );
  }

  const { organization, capabilities, onboarding, metrics } = data;

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{organization.commercialName}</p>
        </div>
      </section>

      <section className="stats-grid">
        <Card>
          <h2>Paquetes Pendientes</h2>
          <strong>{metrics.pendingPackages}</strong>
        </Card>
        <Card>
          <h2>Prealertas sin Match</h2>
          <strong>{metrics.unmatchedPrealerts}</strong>
        </Card>
        <Card>
          <h2>Envíos Activos</h2>
          <strong>{metrics.activeShipments}</strong>
        </Card>
        <Card>
          <h2>Plan</h2>
          <strong>{capabilities.planCode}</strong>
        </Card>
        <Card>
          <h2>Usuarios</h2>
          <strong>
            {capabilities.usage.users} / {capabilities.limits.maxUsers}
          </strong>
        </Card>
        <Card>
          <h2>Facilities</h2>
          <strong>
            {capabilities.usage.facilities} / {capabilities.limits.maxFacilities}
          </strong>
        </Card>
        <Card>
          <h2>Clientes</h2>
          <strong>{capabilities.usage.customers}</strong>
        </Card>
      </section>

      <section className="content-grid">
        <Card>
          <h2>Onboarding</h2>
          <p>Estado: {onboarding.status}</p>
          <ul className="simple-list">
            {onboarding.steps.map((step) => (
              <li key={step.code}>
                <span>{step.code}</span>
                <strong>{step.completed ? "Completado" : "Pendiente"}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2>Configuración actual</h2>
          <ul className="simple-list">
            <li>
              <span>Slug</span>
              <strong>{organization.slug}</strong>
            </li>
            <li>
              <span>País</span>
              <strong>{organization.countryCode}</strong>
            </li>
            <li>
              <span>Moneda</span>
              <strong>{organization.currencyCode}</strong>
            </li>
            <li>
              <span>Zona horaria</span>
              <strong>{organization.timezone}</strong>
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
