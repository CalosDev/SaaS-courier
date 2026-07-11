"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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

  const swrKey = `/prealerts?page=${page}&q=${q}&status=${status}&invoiceStatus=${invoiceStatus}&customerId=${customerId}&from=${createdFrom}&to=${createdTo}`;
  const { data: listData, error, isLoading, mutate: refetch } = useSWR(
    swrKey,
    () => backofficeApi.listPrealerts({
      page,
      pageSize: 10,
      q: q || undefined,
      status: status || undefined,
      invoiceStatus: invoiceStatus || undefined,
      customerId: customerId || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
    })
  );

  const { data: customersData } = useSWR(
    `/customers-search?q=${customerQuery}`,
    () => backofficeApi.listCustomers({ page: 1, pageSize: 20, q: customerQuery || undefined })
  );

  const customerOptions = (customersData?.items ?? [])
    .filter((c) => c.status === "ACTIVE" || c.status === "PENDING")
    .map((c) => ({ value: c.id, label: `${c.customerCode} · ${c.displayName}` }));

  return (
    <PermissionBoundary
      requiredPermissions={["prealerts.read"]}
      fallback={<ErrorState title="Acceso no autorizado" description="Tu sesión no tiene permisos para consultar prealertas." />}
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Prealertas</h1>
            <p>Compras esperadas que todavía no confirman recepción física.</p>
          </div>
          <PermissionBoundary requiredPermissions={["prealerts.manage"]}>
            <Link href="/prealerts/new" className="ui-button ui-button--primary">
              <Plus style={{ width: 16, height: 16 }} />
              Nueva prealerta
            </Link>
          </PermissionBoundary>
        </section>

        <Card>
          <div className="filters-row">
            <FormField label="Buscar">
              <Input value={q} placeholder="Código, tracking..." onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </FormField>
            <FormField label="Estado">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {Object.entries(PREALERT_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Factura">
              <Select value={invoiceStatus} onChange={(e) => { setInvoiceStatus(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {Object.entries(PREALERT_INVOICE_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="filters-row">
            <FormField label="Buscar cliente">
              <Input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Nombre o código..." />
            </FormField>
            <FormField label="Cliente">
              <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {customerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Desde">
              <Input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
            </FormField>
            <FormField label="Hasta">
              <Input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
            </FormField>
          </div>
        </Card>

        <Card>
          {isLoading ? (
            <LoadingState label="Cargando prealertas..." />
          ) : error ? (
            <ErrorState title="Error al cargar prealertas" description={error.message} onRetry={() => void refetch()} />
          ) : !listData || listData.items.length === 0 ? (
            <EmptyState title="No hay prealertas" description="Cuando registres compras esperadas aparecerán aquí." />
          ) : (
            <>
              <Table
                columns={["Código", "Tracking", "Cliente", "Tienda", "Valor", "Factura", "Estado", "Fecha", "Acciones"]}
                rows={listData.items.map((prealert) => [
                  <span key={`code-${prealert.id}`} className="inline-code">{prealert.prealertCode}</span>,
                  prealert.externalTrackingNumber,
                  prealert.customer.displayName,
                  prealert.storeName,
                  formatPrealertMoney(prealert.declaredValue, prealert.currencyCode),
                  <Badge key={`inv-${prealert.id}`} tone={getPrealertInvoiceTone(prealert.invoiceStatus)}>
                    {PREALERT_INVOICE_STATUS_LABELS[prealert.invoiceStatus]}
                  </Badge>,
                  <Badge key={`st-${prealert.id}`} tone={getPrealertStatusTone(prealert.status)}>
                    {PREALERT_STATUS_LABELS[prealert.status]}
                  </Badge>,
                  prealert.createdAt.slice(0, 10),
                  <Link key={`link-${prealert.id}`} href={`/prealerts/${prealert.id}`} className="inline-link">
                    Ver detalle
                  </Link>,
                ])}
              />
              <Pagination
                page={listData.pagination.page}
                totalPages={listData.pagination.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </div>
    </PermissionBoundary>
  );
}
