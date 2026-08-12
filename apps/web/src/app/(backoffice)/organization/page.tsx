"use client";

import { useCallback, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";

export default function OrganizationPage() {
  const resource = useAsyncState(
    useCallback(
      () =>
        Promise.all([
          backofficeApi.getCurrentOrganization(),
          backofficeApi.getCurrentSettings(),
          backofficeApi.getCurrentRegulatoryProfile(),
        ]).then(([organization, settings, regulatoryProfile]) => ({
          organization,
          settings,
          regulatoryProfile,
        })),
      [],
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (resource.status === "loading") {
    return <LoadingState label="Cargando organización..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar la organización"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  const { organization, settings, regulatoryProfile } = resource.data;

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    try {
      await backofficeApi.updateCurrentOrganization({
        legalName: String(formData.get("legalName") || ""),
        commercialName: String(formData.get("commercialName") || ""),
        rnc: String(formData.get("rnc") || ""),
        email: String(formData.get("email") || ""),
        phone: String(formData.get("phone") || ""),
      });
      setMessage("Perfil de organización actualizado.");
      await resource.refresh();
    } catch (error) {
      setError(
        error instanceof ApiError ? error.message : "No fue posible guardar.",
      );
    }
  }

  async function handleSettingsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    try {
      await backofficeApi.updateCurrentSettings({
        locale: String(formData.get("locale") || ""),
        dateFormat: String(formData.get("dateFormat") || "") as
          | "DMY"
          | "MDY"
          | "YMD",
        weightUnit: String(formData.get("weightUnit") || "") as "LB" | "KG",
        dimensionUnit: String(formData.get("dimensionUnit") || "") as
          | "IN"
          | "CM",
        timezone: String(formData.get("timezone") || ""),
        currencyCode: String(formData.get("currencyCode") || ""),
        countryCode: String(formData.get("countryCode") || ""),
        customerCodeStrategy: String(
          formData.get("customerCodeStrategy") || "",
        ) as "AUTO_RANDOM" | "AUTO_SEQUENTIAL",
        customerCodePrefix: String(formData.get("customerCodePrefix") || ""),
        customerCodeRandomLength: Number(
          formData.get("customerCodeRandomLength") || 0,
        ),
        customerCodeSequencePadding: Number(
          formData.get("customerCodeSequencePadding") || 0,
        ),
      });
      setMessage("Configuración operativa actualizada.");
      await resource.refresh();
    } catch (error) {
      setError(
        error instanceof ApiError ? error.message : "No fue posible guardar.",
      );
    }
  }

  async function handleRegulatorySubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    try {
      await backofficeApi.updateCurrentRegulatoryProfile({
        fiscalAddress: String(formData.get("fiscalAddress") || ""),
        authorizedRepresentativeName: String(
          formData.get("authorizedRepresentativeName") || "",
        ),
        authorizedRepresentativeEmail: String(
          formData.get("authorizedRepresentativeEmail") || "",
        ),
        authorizedRepresentativePhone: String(
          formData.get("authorizedRepresentativePhone") || "",
        ),
        courierRegistrationStatus: String(
          formData.get("courierRegistrationStatus") || "UNKNOWN",
        ) as typeof regulatoryProfile.courierRegistrationStatus,
        dgaOperatorCode: String(formData.get("dgaOperatorCode") || ""),
        electronicInvoicingStatus: String(
          formData.get("electronicInvoicingStatus") || "UNKNOWN",
        ) as typeof regulatoryProfile.electronicInvoicingStatus,
      });
      setMessage("Perfil regulatorio actualizado.");
      await resource.refresh();
    } catch (error) {
      setError(
        error instanceof ApiError ? error.message : "No fue posible guardar.",
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Organización</h1>
          <p>Perfil institucional y configuración operativa.</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="content-grid">
        <Card>
          <h2>Perfil</h2>
          <form className="form-grid" onSubmit={handleProfileSubmit}>
            <FormField label="Razón social">
              <Input
                name="legalName"
                defaultValue={organization.legalName}
                required
              />
            </FormField>
            <FormField label="Nombre comercial">
              <Input
                name="commercialName"
                defaultValue={organization.commercialName}
                required
              />
            </FormField>
            <FormField label="RNC">
              <Input name="rnc" defaultValue={organization.rnc || ""} />
            </FormField>
            <FormField label="Correo">
              <Input name="email" defaultValue={organization.email || ""} />
            </FormField>
            <FormField label="Teléfono">
              <Input name="phone" defaultValue={organization.phone || ""} />
            </FormField>
            <Button type="submit">Guardar perfil</Button>
          </form>
        </Card>

        <Card>
          <h2>Configuración</h2>
          <form className="form-grid" onSubmit={handleSettingsSubmit}>
            <FormField label="Locale">
              <Input name="locale" defaultValue={settings.locale} required />
            </FormField>
            <FormField label="Formato de fecha">
              <Select name="dateFormat" defaultValue={settings.dateFormat}>
                <option value="DMY">DMY</option>
                <option value="MDY">MDY</option>
                <option value="YMD">YMD</option>
              </Select>
            </FormField>
            <FormField label="Unidad de peso">
              <Select name="weightUnit" defaultValue={settings.weightUnit}>
                <option value="LB">LB</option>
                <option value="KG">KG</option>
              </Select>
            </FormField>
            <FormField label="Unidad de dimensión">
              <Select
                name="dimensionUnit"
                defaultValue={settings.dimensionUnit}
              >
                <option value="IN">IN</option>
                <option value="CM">CM</option>
              </Select>
            </FormField>
            <FormField label="Zona horaria">
              <Input
                name="timezone"
                defaultValue={settings.timezone}
                required
              />
            </FormField>
            <FormField label="Moneda">
              <Input
                name="currencyCode"
                defaultValue={settings.currencyCode}
                required
              />
            </FormField>
            <FormField label="País">
              <Input
                name="countryCode"
                defaultValue={settings.countryCode}
                required
              />
            </FormField>
            <FormField label="Estrategia de código">
              <Select
                name="customerCodeStrategy"
                defaultValue={settings.customerCodeStrategy}
              >
                <option value="AUTO_RANDOM">AUTO_RANDOM</option>
                <option value="AUTO_SEQUENTIAL">AUTO_SEQUENTIAL</option>
              </Select>
            </FormField>
            <FormField label="Prefijo de cliente">
              <Input
                name="customerCodePrefix"
                defaultValue={settings.customerCodePrefix}
              />
            </FormField>
            <FormField label="Longitud aleatoria">
              <Input
                name="customerCodeRandomLength"
                type="number"
                min={4}
                defaultValue={settings.customerCodeRandomLength}
              />
            </FormField>
            <FormField label="Padding secuencial">
              <Input
                name="customerCodeSequencePadding"
                type="number"
                min={1}
                defaultValue={settings.customerCodeSequencePadding}
              />
            </FormField>
            <Button type="submit">Guardar configuración</Button>
          </form>
        </Card>

        <Card>
          <h2>Perfil regulatorio</h2>
          <form className="form-grid" onSubmit={handleRegulatorySubmit}>
            <FormField label="Dirección fiscal">
              <Input
                name="fiscalAddress"
                defaultValue={regulatoryProfile.fiscalAddress || ""}
              />
            </FormField>
            <FormField label="Representante autorizado">
              <Input
                name="authorizedRepresentativeName"
                defaultValue={
                  regulatoryProfile.authorizedRepresentativeName || ""
                }
              />
            </FormField>
            <FormField label="Correo del representante">
              <Input
                name="authorizedRepresentativeEmail"
                type="email"
                defaultValue={
                  regulatoryProfile.authorizedRepresentativeEmail || ""
                }
              />
            </FormField>
            <FormField label="Teléfono del representante">
              <Input
                name="authorizedRepresentativePhone"
                defaultValue={
                  regulatoryProfile.authorizedRepresentativePhone || ""
                }
              />
            </FormField>
            <FormField label="Registro como courier">
              <Select
                name="courierRegistrationStatus"
                defaultValue={regulatoryProfile.courierRegistrationStatus}
              >
                <option value="UNKNOWN">Sin declarar</option>
                <option value="IN_PROCESS">En proceso</option>
                <option value="AUTHORIZED">Autorizado</option>
                <option value="SUSPENDED">Suspendido</option>
                <option value="REVOKED">Revocado</option>
              </Select>
            </FormField>
            <FormField label="Identificación interna DGA">
              <Input
                name="dgaOperatorCode"
                defaultValue={regulatoryProfile.dgaOperatorCode || ""}
              />
            </FormField>
            <FormField label="Facturación electrónica">
              <Select
                name="electronicInvoicingStatus"
                defaultValue={regulatoryProfile.electronicInvoicingStatus}
              >
                <option value="UNKNOWN">Sin declarar</option>
                <option value="NOT_ENROLLED">No incorporado</option>
                <option value="IN_PROCESS">En proceso</option>
                <option value="ENABLED">Habilitado</option>
                <option value="EXEMPT">Exento</option>
              </Select>
            </FormField>
            <Button type="submit">Guardar perfil regulatorio</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
