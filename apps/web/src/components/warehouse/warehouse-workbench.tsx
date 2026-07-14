"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { PackageCheck, ScanLine, Search, Trash2 } from "lucide-react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type {
  WarehouseBatchPutawayResult,
  WarehouseLookupResult,
} from "@/lib/api/contracts";

const linkButtonClass =
  "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#dde6ed] px-4 font-medium text-[#17242d] transition-colors hover:bg-[#c8d6e0]";

type WorkbenchMode = "search" | "receive" | "putaway";

const MODE_COPY: Record<
  WorkbenchMode,
  { title: string; description: string }
> = {
  search: {
    title: "Búsqueda de almacén",
    description: "Consulta por tracking interno, externo o código de prealerta.",
  },
  receive: {
    title: "Recepción por escaneo",
    description: "Localiza el paquete y continúa a su registro físico.",
  },
  putaway: {
    title: "Ubicación por lote",
    description: "Escanea hasta 50 paquetes y asígnalos a una ubicación activa.",
  },
};

export function WarehouseWorkbench({ mode }: { mode: WorkbenchMode }) {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<WarehouseLookupResult | null>(null);
  const [scans, setScans] = useState<string[]>([]);
  const [result, setResult] = useState<WarehouseBatchPutawayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locations = useAsyncState(
    useCallback(
      () =>
        mode === "putaway"
          ? backofficeApi.listInventoryLocations({
              page: 1,
              pageSize: 100,
              isActive: true,
            })
          : Promise.resolve({
              items: [],
              pagination: {
                page: 1,
                pageSize: 100,
                totalItems: 0,
                totalPages: 0,
              },
            }),
      [mode],
    ),
  );

  async function scan() {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setError(null);
    setResult(null);
    if (mode === "putaway") {
      if (scans.length >= 50) {
        setError("El lote admite un máximo de 50 scans.");
      } else if (!scans.includes(normalized)) {
        setScans((current) => [...current, normalized]);
      }
      setCode("");
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      setLookup(await backofficeApi.lookupWarehouseItem(normalized));
    } catch (caught) {
      setLookup(null);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible resolver el código.",
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function submitPutaway(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const toLocationId = String(formData.get("toLocationId") || "");
    if (!toLocationId || scans.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await backofficeApi.batchPutawayWarehouseItems({
        codes: scans,
        toLocationId,
        note: String(formData.get("note") || "") || undefined,
      });
      setResult(response);
      setScans([]);
      form.reset();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible procesar el lote.",
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  if (locations.status === "loading") {
    return <LoadingState label="Cargando ubicaciones..." />;
  }
  if (locations.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar ubicaciones"
        description={locations.error.message}
        onRetry={() => void locations.refresh()}
      />
    );
  }

  return (
    <PermissionBoundary requiredPermissions={["inventory.read"]}>
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>{MODE_COPY[mode].title}</h1>
            <p>{MODE_COPY[mode].description}</p>
          </div>
          <nav className="button-row" aria-label="Flujos de almacén">
            <Link className={linkButtonClass} href="/warehouse/search">Buscar</Link>
            <Link className={linkButtonClass} href="/warehouse/receive">Recibir</Link>
            <Link className={linkButtonClass} href="/warehouse/putaway">Ubicar</Link>
          </nav>
        </section>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {result ? (
          <Alert tone={result.summary.failed ? "info" : "success"}>
            Procesados: {result.summary.requested}. Ubicados: {result.summary.placed}.
            Fallidos: {result.summary.failed}. Omitidos: {result.summary.skipped}.
          </Alert>
        ) : null}

        <Card>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void scan();
            }}
          >
            <FormField label="Código escaneado">
              <Input
                ref={inputRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoFocus
                autoComplete="off"
                placeholder="Tracking o prealerta"
              />
            </FormField>
            <Button type="submit" disabled={busy || !code.trim()}>
              {mode === "putaway" ? <ScanLine className="button-icon" /> : <Search className="button-icon" />}
              <span>{mode === "putaway" ? "Agregar scan" : "Buscar"}</span>
            </Button>
          </form>
        </Card>

        {lookup ? <LookupCard lookup={lookup} mode={mode} /> : null}

        {mode === "putaway" ? (
          <PermissionBoundary requiredPermissions={["inventory.manage"]}>
            <Card>
              <form className="form-grid" onSubmit={(event) => void submitPutaway(event)}>
                <FormField label={`Scans (${scans.length}/50)`}>
                  {scans.length ? (
                    <Table
                      columns={["Código", "Acción"]}
                      rows={scans.map((item) => [
                        item,
                        <Button
                          key={item}
                          type="button"
                          variant="secondary"
                          aria-label={`Eliminar ${item}`}
                          onClick={() => setScans((current) => current.filter((entry) => entry !== item))}
                        >
                          <Trash2 className="button-icon" />
                        </Button>,
                      ])}
                    />
                  ) : (
                    <p>No hay códigos en el lote.</p>
                  )}
                </FormField>
                <FormField label="Ubicación destino">
                  <Select name="toLocationId" required defaultValue="">
                    <option value="">Selecciona una ubicación</option>
                    {locations.data.items.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.facility.code} · {location.code} · {location.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Nota del lote">
                  <Textarea name="note" maxLength={500} rows={3} />
                </FormField>
                <Button type="submit" disabled={busy || scans.length === 0}>
                  <PackageCheck className="button-icon" />
                  <span>Procesar lote</span>
                </Button>
              </form>
            </Card>
          </PermissionBoundary>
        ) : null}

        {result ? (
          <Card>
            <Table
              columns={["Código", "Resultado", "Detalle"]}
              rows={result.results.map((item) => [
                item.code,
                <Badge key={`${item.code}-status`} tone={item.status === "FAILED" ? "danger" : "success"}>
                  {item.status}
                </Badge>,
                item.reasonCode || item.locationCode || "Procesado",
              ])}
            />
          </Card>
        ) : null}
      </div>
    </PermissionBoundary>
  );
}

function LookupCard({
  lookup,
  mode,
}: {
  lookup: WarehouseLookupResult;
  mode: WorkbenchMode;
}) {
  if (lookup.kind === "PREALERT") {
    return (
      <Card>
        <h2>{lookup.prealert.prealertCode}</h2>
        <p>Cliente: {lookup.prealert.customerCode}</p>
        <p>Estado: {lookup.prealert.status}</p>
        <Alert tone="info">La prealerta todavía no tiene un paquete recibido.</Alert>
      </Card>
    );
  }
  const item = lookup.package;
  return (
    <Card>
      <h2>{item.internalTrackingNumber}</h2>
      <p>Tracking externo: {item.externalTrackingNumber}</p>
      <p>Cliente: {item.customerCode}</p>
      <p>
        Ubicación: {item.currentLocation ? `${item.currentLocation.code} · ${item.currentLocation.name}` : "Sin ubicación"}
      </p>
      {mode === "receive" ? (
        item.reception ? (
          <Alert tone="info">Este paquete ya fue recibido.</Alert>
        ) : (
          <Link className={linkButtonClass} href={`/packages/${item.id}/receive`}>
            Continuar recepción
          </Link>
        )
      ) : null}
    </Card>
  );
}
