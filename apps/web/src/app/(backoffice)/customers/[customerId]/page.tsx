"use client";

import { use, useCallback, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type {
  CustomerAddress,
  CustomerCustomsProfile,
} from "@/lib/api/contracts";
import { useAuth } from "@/lib/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = use(params);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { state } = useAuth();

  const resource = useAsyncState(
    useCallback(async () => {
      const customer = await backofficeApi.getCustomer(customerId);
      const addresses = await backofficeApi.listCustomerAddresses(customerId);
      let customsProfile: CustomerCustomsProfile | null = null;

      if (
        state.status === "authenticated" &&
        hasPermission(state.permissionCodes, "customers.customs.read")
      ) {
        try {
          customsProfile = await backofficeApi.getCustomerCustomsProfile(customerId);
        } catch {
          customsProfile = null;
        }
      }

      return { customer, addresses, customsProfile };
    }, [customerId, state]),
  );

  if (resource.status === "loading") {
    return <LoadingState label="Cargando cliente..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el cliente"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  const { customer, addresses, customsProfile } = resource.data;

  async function handleCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await backofficeApi.updateCustomer(customerId, {
        firstName: String(formData.get("firstName") || "") || null,
        lastName: String(formData.get("lastName") || "") || null,
        businessName: String(formData.get("businessName") || "") || null,
        email: String(formData.get("email") || "") || null,
        phone: String(formData.get("phone") || "") || null,
        mobilePhone: String(formData.get("mobilePhone") || "") || null,
        status: String(formData.get("status") || ""),
        notes: String(formData.get("notes") || "") || null,
      });
      setMessage("Cliente actualizado.");
      setError(null);
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No fue posible guardar.");
    }
  }

  async function handleAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await backofficeApi.createCustomerAddress(customerId, {
        type: String(formData.get("type") || ""),
        label: String(formData.get("label") || "") || undefined,
        recipientName: String(formData.get("recipientName") || "") || undefined,
        phone: String(formData.get("phone") || "") || undefined,
        addressLine1: String(formData.get("addressLine1") || ""),
        addressLine2: String(formData.get("addressLine2") || "") || undefined,
        city: String(formData.get("city") || ""),
        province: String(formData.get("province") || ""),
        postalCode: String(formData.get("postalCode") || "") || undefined,
        countryCode: String(formData.get("countryCode") || "DO"),
        isPrimary: formData.get("isPrimary") === "on",
        isActive: formData.get("isActive") === "on",
      });
      setMessage("Direccion agregada.");
      setError(null);
      event.currentTarget.reset();
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No fue posible guardar.");
    }
  }

  async function handleCustoms(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await backofficeApi.upsertCustomerCustomsProfile(customerId, {
        documentType: String(formData.get("documentType") || ""),
        documentNumber: String(formData.get("documentNumber") || ""),
        notes: String(formData.get("notes") || "") || undefined,
      });
      await backofficeApi.updateCustomerCustomsVerification(customerId, {
        status: String(formData.get("ruaStatus") || ""),
        source: String(formData.get("verificationSource") || "") || undefined,
        externalReference:
          String(formData.get("externalReference") || "") || undefined,
        notes: String(formData.get("notes") || "") || undefined,
      });
      setMessage("Perfil aduanero actualizado.");
      setError(null);
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No fue posible guardar.");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>{customer.displayName}</h1>
          <p>{customer.customerCode}</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="content-grid">
        <Card>
          <h2>Ficha del cliente</h2>
          <form className="form-grid" onSubmit={handleCustomer}>
            <FormField label="Nombres">
              <Input name="firstName" defaultValue={customer.firstName || ""} />
            </FormField>
            <FormField label="Apellidos">
              <Input name="lastName" defaultValue={customer.lastName || ""} />
            </FormField>
            <FormField label="Empresa">
              <Input name="businessName" defaultValue={customer.businessName || ""} />
            </FormField>
            <FormField label="Correo">
              <Input name="email" defaultValue={customer.email || ""} />
            </FormField>
            <FormField label="Telefono">
              <Input name="phone" defaultValue={customer.phone || ""} />
            </FormField>
            <FormField label="Celular">
              <Input name="mobilePhone" defaultValue={customer.mobilePhone || ""} />
            </FormField>
            <FormField label="Estado">
              <Select name="status" defaultValue={customer.status}>
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CLOSED">CLOSED</option>
              </Select>
            </FormField>
            <FormField label="Notas">
              <Textarea name="notes" rows={4} defaultValue={customer.notes || ""} />
            </FormField>
            <Button type="submit">Guardar cliente</Button>
          </form>
        </Card>

        <Card>
          <h2>Direcciones</h2>
          <ul className="simple-list">
            {addresses.map((address: CustomerAddress) => (
              <li key={address.id}>
                <span>{address.type}</span>
                <strong>{address.addressLine1}</strong>
              </li>
            ))}
          </ul>
          <form className="form-grid" onSubmit={handleAddress}>
            <FormField label="Tipo">
              <Select name="type" defaultValue="DELIVERY">
                <option value="HOME">HOME</option>
                <option value="WORK">WORK</option>
                <option value="BILLING">BILLING</option>
                <option value="DELIVERY">DELIVERY</option>
                <option value="OTHER">OTHER</option>
              </Select>
            </FormField>
            <FormField label="Etiqueta">
              <Input name="label" />
            </FormField>
            <FormField label="Destinatario">
              <Input name="recipientName" />
            </FormField>
            <FormField label="Telefono">
              <Input name="phone" />
            </FormField>
            <FormField label="Direccion 1">
              <Input name="addressLine1" required />
            </FormField>
            <FormField label="Direccion 2">
              <Input name="addressLine2" />
            </FormField>
            <FormField label="Ciudad">
              <Input name="city" required />
            </FormField>
            <FormField label="Provincia">
              <Input name="province" required />
            </FormField>
            <FormField label="Codigo postal">
              <Input name="postalCode" />
            </FormField>
            <FormField label="Pais">
              <Input name="countryCode" defaultValue="DO" required />
            </FormField>
            <label className="toggle-row">
              <input type="checkbox" name="isPrimary" defaultChecked />
              <span>Primaria</span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" name="isActive" defaultChecked />
              <span>Activa</span>
            </label>
            <Button type="submit">Agregar direccion</Button>
          </form>
        </Card>

        {state.status === "authenticated" &&
        hasPermission(state.permissionCodes, "customers.customs.read") ? (
          <Card>
            <h2>Perfil aduanero</h2>
            <form className="form-grid" onSubmit={handleCustoms}>
              <FormField label="Tipo de documento">
                <Select
                  name="documentType"
                  defaultValue={customsProfile?.documentType || "CEDULA"}
                >
                  <option value="CEDULA">CEDULA</option>
                  <option value="PASSPORT">PASSPORT</option>
                  <option value="RNC">RNC</option>
                </Select>
              </FormField>
              <FormField label="Numero">
                <Input
                  name="documentNumber"
                  defaultValue={customsProfile?.documentNumber || ""}
                  required
                />
              </FormField>
              <FormField label="Estado RUA">
                <Select name="ruaStatus" defaultValue={customsProfile?.ruaStatus || "UNKNOWN"}>
                  <option value="UNKNOWN">UNKNOWN</option>
                  <option value="PENDING">PENDING</option>
                  <option value="REGISTERED">REGISTERED</option>
                  <option value="NOT_REGISTERED">NOT_REGISTERED</option>
                  <option value="VERIFICATION_FAILED">VERIFICATION_FAILED</option>
                </Select>
              </FormField>
              <FormField label="Fuente de verificacion">
                <Select
                  name="verificationSource"
                  defaultValue={customsProfile?.verificationSource || "MANUAL"}
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="DGA_PORTAL">DGA_PORTAL</option>
                  <option value="OFFICIAL_INTEGRATION">OFFICIAL_INTEGRATION</option>
                </Select>
              </FormField>
              <FormField label="Referencia externa">
                <Input
                  name="externalReference"
                  defaultValue={customsProfile?.externalReference || ""}
                />
              </FormField>
              <FormField label="Notas">
                <Textarea name="notes" rows={4} defaultValue={customsProfile?.notes || ""} />
              </FormField>
              <Button type="submit">Guardar perfil aduanero</Button>
            </form>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
