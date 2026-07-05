"use client";

import { useCallback, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PrealertSummary } from "@/lib/api/contracts";

type SelectablePrealert = {
  id: string;
  label: string;
  prealert: PrealertSummary;
};

export function PendingPrealertSelector({
  value,
  selectedPrealert,
  onChange,
  disabled = false,
}: {
  value: string;
  selectedPrealert?: PrealertSummary | null;
  onChange: (prealert: PrealertSummary | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const resource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listPrealerts({
          page,
          pageSize: 10,
          q: query || undefined,
          status: "PENDING_ARRIVAL",
        }),
      [page, query],
    ),
  );

  const options = useMemo<SelectablePrealert[]>(() => {
    const resourceOptions =
      resource.status === "success"
        ? resource.data.items.map((prealert) => ({
            id: prealert.id,
            label: `${prealert.prealertCode} · ${prealert.customer.displayName} · ${prealert.storeName}`,
            prealert,
          }))
        : [];

    if (!selectedPrealert || resourceOptions.some((item) => item.id === value)) {
      return resourceOptions;
    }

    return [
      {
        id: selectedPrealert.id,
        label: `${selectedPrealert.prealertCode} · ${selectedPrealert.customer.displayName} · ${selectedPrealert.storeName}`,
        prealert: selectedPrealert,
      },
      ...resourceOptions,
    ];
  }, [resource, selectedPrealert, value]);

  return (
    <div className="customer-selector">
      <FormField label="Buscar prealerta">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Codigo, tracking, cliente o tienda"
          disabled={disabled}
        />
      </FormField>

      {resource.status === "loading" ? (
        <LoadingState label="Buscando prealertas pendientes..." />
      ) : null}

      {resource.status === "error" ? (
        <Alert tone="error">
          No fue posible cargar prealertas pendientes para registrar el paquete.
        </Alert>
      ) : null}

      <FormField label="Prealerta pendiente">
        <Select
          value={value}
          onChange={(event) => {
            const selected =
              options.find((option) => option.id === event.target.value)
                ?.prealert ?? null;
            onChange(selected);
          }}
          disabled={disabled || resource.status !== "success"}
        >
          <option value="">Selecciona una prealerta</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>

      {resource.status === "success" && resource.data.items.length === 0 ? (
        <Alert tone="info">
          No hay prealertas pendientes disponibles con los filtros actuales.
        </Alert>
      ) : null}

      {resource.status === "success" ? (
        <Pagination
          page={resource.data.pagination.page}
          totalPages={resource.data.pagination.totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
