"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import {
  PREALERT_INVOICE_STATUS_LABELS,
  PREALERT_STATUS_LABELS,
  formatPrealertMoney,
  getPrealertInvoiceTone,
  getPrealertStatusTone,
} from "@/lib/prealerts";

export default function PrealertsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const listResource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listPrealerts({
          page,
          pageSize: 10,
          q: q || undefined,
          status: status || undefined,
          invoiceStatus: invoiceStatus || undefined,
          customerId: customerId || undefined,
          createdFrom: createdFrom || undefined,
          createdTo: createdTo || undefined,
        }),
      [createdFrom, createdTo, customerId, invoiceStatus, page, q, status],
    ),
  );

  const customersResource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listCustomers({
          page: 1,
          pageSize: 20,
          q: customerQuery || undefined,
        }),
      [customerQuery],
    ),
  );

  if (listResource.status === "loading") {
    return <LoadingState label="Cargando prealertas..." />;
  }

  if (listResource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar prealertas"
        description={listResource.error.message}
        onRetry={() => void listResource.refresh()}
      />
    );
  }

  const customerOptions =
    customersResource.status === "success"
      ? customersResource.data.items
          .filter(
            (customer) =>
              customer.status === "ACTIVE" || customer.status === "PENDING",
          )
          .map((customer) => ({
            value: customer.id,
            label: `${customer.customerCode} · ${customer.displayName}`,
          }))
      : [];

  return (
    <PermissionBoundary
      requiredPermissions={["prealerts.read"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesion no tiene permisos para consultar prealertas."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Prealertas</h1>
            <p>Compras esperadas que todavia no confirman recepcion fisica.</p>
          </div>
          <PermissionBoundary requiredPermissions={["prealerts.manage"]}>
            <Link href="/prealerts/new" className="ui-button ui-button--primary">
              Nueva prealerta
            </Link>
          </PermissionBoundary>
        </section>

        <Card>
          <div className="filters-row">
            <FormField label="Buscar">
              <Input value={q} onChange={(event) => setQ(event.target.value)} />
            </FormField>

            <FormField label="Estado">
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(PREALERT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Factura">
              <Select
                value={invoiceStatus}
                onChange={(event) => setInvoiceStatus(event.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(PREALERT_INVOICE_STATUS_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </Select>
            </FormField>
          </div>

          <div className="filters-row">
            <FormField label="Buscar cliente">
              <Input
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
              />
            </FormField>

            <FormField label="Cliente">
              <Select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Todos</option>
                {customerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Desde">
              <Input
                type="date"
                value={createdFrom}
                onChange={(event) => setCreatedFrom(event.target.value)}
              />
            </FormField>

            <FormField label="Hasta">
              <Input
                type="date"
                value={createdTo}
                onChange={(event) => setCreatedTo(event.target.value)}
              />
            </FormField>
          </div>
        </Card>

        <Card>
          {listResource.data.items.length === 0 ? (
            <EmptyState
              title="No hay prealertas"
              description="Cuando registres compras esperadas apareceran aqui."
            />
          ) : (
            <Table
              columns={[
                "Codigo",
                "Tracking",
                "Cliente",
                "Tienda",
                "Descripcion",
                "Valor",
                "Factura",
                "Estado",
                "Fecha",
                "Acciones",
              ]}
              rows={listResource.data.items.map((prealert) => [
                prealert.prealertCode,
                prealert.externalTrackingNumber,
                prealert.customer.displayName,
                prealert.storeName,
                prealert.description,
                formatPrealertMoney(
                  prealert.declaredValue,
                  prealert.currencyCode,
                ),
                (
                  <Badge
                    key={`${prealert.id}-invoice`}
                    tone={getPrealertInvoiceTone(prealert.invoiceStatus)}
                  >
                    {PREALERT_INVOICE_STATUS_LABELS[prealert.invoiceStatus]}
                  </Badge>
                ),
                (
                  <Badge
                    key={`${prealert.id}-status`}
                    tone={getPrealertStatusTone(prealert.status)}
                  >
                    {PREALERT_STATUS_LABELS[prealert.status]}
                  </Badge>
                ),
                prealert.createdAt.slice(0, 10),
                <Link
                  key={prealert.id}
                  href={`/prealerts/${prealert.id}`}
                  className="inline-link"
                >
                  Ver detalle
                </Link>,
              ])}
            />
          )}

          <Pagination
            page={listResource.data.pagination.page}
            totalPages={listResource.data.pagination.totalPages}
            onPageChange={setPage}
          />
        </Card>
      </div>
    </PermissionBoundary>
  );
}
