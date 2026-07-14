"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type {
  CustomerListResponse,
  DeliveryMethod,
  PackageListResponse,
} from "@/lib/api/contracts";

export default function NewDeliveryPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState<DeliveryMethod>("HOME_DELIVERY");
  const [packageIds, setPackageIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: customers } = useSWR<CustomerListResponse>(
    "/customers?status=ACTIVE",
    () => backofficeApi.listCustomers({ status: "ACTIVE", pageSize: 100 }),
  );
  const { data: packages } = useSWR<PackageListResponse>(
    "/packages?status=ARRIVED_AT_DESTINATION",
    () =>
      backofficeApi.listPackages({
        status: "ARRIVED_AT_DESTINATION",
        pageSize: 100,
      }),
  );
  const eligiblePackages = useMemo(
    () =>
      packages?.items.filter((item) => item.customer.id === customerId) ?? [],
    [customerId, packages],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId || packageIds.length === 0) {
      setError("Selecciona un cliente y al menos un paquete disponible.");
      return;
    }
    const data = new FormData(event.currentTarget);
    const line1 = String(data.get("line1") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    if (method === "HOME_DELIVERY" && (!line1 || !city)) {
      setError("La entrega a domicilio requiere dirección y ciudad.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const delivery = await backofficeApi.createDelivery({
        deliveryNumber: `DEL-${Date.now()}`,
        customerId,
        method,
        deliveryAddressSnap:
          method === "HOME_DELIVERY"
            ? { line1, city, countryCode: "DO" }
            : undefined,
        notes: String(data.get("notes") ?? "").trim() || undefined,
        packageIds,
      });
      router.push(`/deliveries/${delivery.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible crear la entrega.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Nueva entrega</h1>
          <p>Prepara paquetes disponibles para entrega final o retiro.</p>
        </div>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card>
        <form className="form-grid" onSubmit={handleSubmit}>
          <FormField label="Cliente">
            <Select
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setPackageIds([]);
              }}
              required
            >
              <option value="">Selecciona un cliente</option>
              {customers?.items.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerCode} - {customer.displayName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Método">
            <Select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as DeliveryMethod)
              }
            >
              <option value="HOME_DELIVERY">Entrega a domicilio</option>
              <option value="COUNTER_HANDOFF">Entrega en mostrador</option>
              <option value="THIRD_PARTY">Tercero autorizado</option>
            </Select>
          </FormField>
          {method === "HOME_DELIVERY" ? (
            <>
              <FormField label="Dirección">
                <Input name="line1" maxLength={200} required />
              </FormField>
              <FormField label="Ciudad">
                <Input name="city" maxLength={100} required />
              </FormField>
            </>
          ) : null}
          <FormField label="Notas">
            <Textarea name="notes" maxLength={1000} />
          </FormField>
          <fieldset className="form-field" style={{ gridColumn: "1 / -1" }}>
            <legend>Paquetes disponibles</legend>
            {customerId && eligiblePackages.length === 0 ? (
              <p className="ui-state">
                No hay paquetes disponibles para este cliente.
              </p>
            ) : null}
            {eligiblePackages.map((item) => (
              <label key={item.id} className="flex items-center gap-2 py-2">
                <Checkbox
                  checked={packageIds.includes(item.id)}
                  onChange={(event) =>
                    setPackageIds((current) =>
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    )
                  }
                />
                <span>
                  {item.internalTrackingNumber} - {item.externalTrackingNumber}
                </span>
              </label>
            ))}
          </fieldset>
          <div style={{ gridColumn: "1 / -1" }}>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando..." : "Crear entrega"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
