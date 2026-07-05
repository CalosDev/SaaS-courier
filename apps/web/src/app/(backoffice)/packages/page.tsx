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
  PACKAGE_SOURCE_LABELS,
  PACKAGE_STATUS_LABELS,
  getPackageStatusTone,
} from "@/lib/packages";

export default function PackagesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [registeredFrom, setRegisteredFrom] = useState("");
  const [registeredTo, setRegisteredTo] = useState("");

  const listResource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listPackages({
          page,
          pageSize: 10,
          q: q || undefined,
          status: status || undefined,
          source: source || undefined,
          customerId: customerId || undefined,
          registeredFrom: registeredFrom || undefined,
          registeredTo: registeredTo || undefined,
        }),
      [customerId, page, q, registeredFrom, registeredTo, source, status],
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
    return <LoadingState label="Cargando paquetes..." />;
  }

  if (listResource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar paquetes"
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
      requiredPermissions={["packages.read"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesion no tiene permisos para consultar paquetes."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Paquetes</h1>
            <p>
              Registro operativo inicial de paquetes antes de completar su
              recepcion fisica.
            </p>
          </div>
          <PermissionBoundary requiredPermissions={["packages.manage"]}>
            <Link href="/packages/new" className="ui-button ui-button--primary">
              Registrar paquete
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
                {Object.entries(PACKAGE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Origen">
              <Select
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(PACKAGE_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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
                value={registeredFrom}
                onChange={(event) => setRegisteredFrom(event.target.value)}
              />
            </FormField>

            <FormField label="Hasta">
              <Input
                type="date"
                value={registeredTo}
                onChange={(event) => setRegisteredTo(event.target.value)}
              />
            </FormField>
          </div>
        </Card>

        <Card>
          {listResource.data.items.length === 0 ? (
            <EmptyState
              title="No hay paquetes"
              description="Los registros operativos apareceran aqui cuando inicies la identificacion."
            />
          ) : (
            <Table
              columns={[
                "Tracking interno",
                "Tracking externo",
                "Cliente",
                "Origen",
                "Prealerta",
                "Estado",
                "Fecha de registro",
                "Acciones",
              ]}
              rows={listResource.data.items.map((packageItem) => [
                packageItem.internalTrackingNumber,
                packageItem.externalTrackingNumber,
                packageItem.customer.displayName,
                PACKAGE_SOURCE_LABELS[packageItem.source],
                packageItem.prealert?.prealertCode || "Manual",
                (
                  <Badge
                    key={`${packageItem.id}-status`}
                    tone={getPackageStatusTone(packageItem.status)}
                  >
                    {PACKAGE_STATUS_LABELS[packageItem.status]}
                  </Badge>
                ),
                packageItem.registeredAt.slice(0, 10),
                <Link
                  key={packageItem.id}
                  href={`/packages/${packageItem.id}`}
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
