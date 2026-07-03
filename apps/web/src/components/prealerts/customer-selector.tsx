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

type SelectableCustomer = {
  id: string;
  label: string;
};

const SELECTABLE_STATUSES = new Set(["PENDING", "ACTIVE"]);

export function CustomerSelector({
  value,
  onChange,
  selectedLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  selectedLabel?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const resource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listCustomers({
          page,
          pageSize: 10,
          q: query || undefined,
        }),
      [page, query],
    ),
  );

  const selectableCustomers = useMemo<SelectableCustomer[]>(() => {
    if (resource.status !== "success") {
      return [];
    }

    return resource.data.items
      .filter((customer) => SELECTABLE_STATUSES.has(customer.status))
      .map((customer) => ({
        id: customer.id,
        label: `${customer.customerCode} · ${customer.displayName}`,
      }));
  }, [resource]);

  const selectedOption =
    value && selectedLabel
      ? {
          id: value,
          label: selectedLabel,
        }
      : null;

  const options = selectedOption
    ? [
        selectedOption,
        ...selectableCustomers.filter((customer) => customer.id !== value),
      ]
    : selectableCustomers;

  const hiddenCustomersCount =
    resource.status === "success"
      ? resource.data.items.length - selectableCustomers.length
      : 0;

  return (
    <div className="customer-selector">
      <FormField
        label="Buscar cliente"
        hint="Solo se pueden seleccionar clientes PENDING o ACTIVE."
      >
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Codigo o nombre del cliente"
          disabled={disabled}
        />
      </FormField>

      {resource.status === "loading" ? (
        <LoadingState label="Buscando clientes..." />
      ) : null}

      {resource.status === "error" ? (
        <Alert tone="error">
          No fue posible cargar clientes para la prealerta.
        </Alert>
      ) : null}

      <FormField label="Cliente">
        <Select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || resource.status !== "success"}
        >
          <option value="">Selecciona un cliente</option>
          {options.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </Select>
      </FormField>

      {hiddenCustomersCount > 0 ? (
        <Alert tone="warning">
          {hiddenCustomersCount} cliente(s) del resultado no estan disponibles
          para nuevas prealertas.
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
