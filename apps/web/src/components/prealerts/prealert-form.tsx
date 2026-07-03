"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PrealertInvoiceStatus } from "@/lib/api/contracts";
import { PREALERT_INVOICE_STATUS_LABELS } from "@/lib/prealerts";
import { CustomerSelector } from "./customer-selector";

export type PrealertFormValues = {
  customerId: string;
  customerLabel?: string;
  externalTrackingNumber: string;
  carrierName: string;
  storeName: string;
  purchaseDate: string;
  description: string;
  quantity: string;
  declaredValue: string;
  currencyCode: string;
  invoiceStatus: PrealertInvoiceStatus;
  notes: string;
};

export type PrealertSubmitPayload = {
  customerId: string;
  externalTrackingNumber: string;
  storeName: string;
  description: string;
  quantity: number;
  declaredValue: string;
  carrierName?: string;
  purchaseDate?: string;
  currencyCode?: string;
  invoiceStatus: PrealertInvoiceStatus;
  notes?: string;
};

const DEFAULT_VALUES: PrealertFormValues = {
  customerId: "",
  customerLabel: "",
  externalTrackingNumber: "",
  carrierName: "",
  storeName: "",
  purchaseDate: "",
  description: "",
  quantity: "1",
  declaredValue: "",
  currencyCode: "",
  invoiceStatus: "PENDING",
  notes: "",
};

const INVOICE_STATUS_OPTIONS = Object.entries(
  PREALERT_INVOICE_STATUS_LABELS,
) as Array<[PrealertInvoiceStatus, string]>;

export function PrealertForm({
  initialValues,
  organizationCurrencyCode,
  readOnly = false,
  submitting = false,
  error,
  showWarning = true,
  submitLabel,
  onSubmit,
}: {
  initialValues?: Partial<PrealertFormValues>;
  organizationCurrencyCode?: string;
  readOnly?: boolean;
  submitting?: boolean;
  error?: string | null;
  showWarning?: boolean;
  submitLabel?: string;
  onSubmit?: (payload: PrealertSubmitPayload) => Promise<void>;
}) {
  const [values, setValues] = useState<PrealertFormValues>({
    ...DEFAULT_VALUES,
    currencyCode: organizationCurrencyCode ?? DEFAULT_VALUES.currencyCode,
    ...initialValues,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (readOnly || !onSubmit) {
      return;
    }

    const payload: PrealertSubmitPayload = {
      customerId: values.customerId,
      externalTrackingNumber: values.externalTrackingNumber.trim(),
      storeName: values.storeName.trim(),
      description: values.description.trim(),
      quantity: Number(values.quantity),
      declaredValue: values.declaredValue.trim(),
      invoiceStatus: values.invoiceStatus,
    };

    const carrierName = values.carrierName.trim();
    const purchaseDate = values.purchaseDate.trim();
    const currencyCode = values.currencyCode.trim().toUpperCase();
    const notes = values.notes.trim();

    if (carrierName) {
      payload.carrierName = carrierName;
    }

    if (purchaseDate) {
      payload.purchaseDate = purchaseDate;
    }

    if (currencyCode) {
      payload.currencyCode = currencyCode;
    }

    if (notes) {
      payload.notes = notes;
    }

    await onSubmit(payload);
  }

  const disabled = readOnly || submitting;

  return (
    <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
      {showWarning ? (
        <Alert tone="warning">
          La prealerta informa una compra esperada. No confirma que el paquete
          haya llegado al almacen.
        </Alert>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <CustomerSelector
        value={values.customerId}
        selectedLabel={values.customerLabel}
        onChange={(customerId) =>
          setValues((current) => ({
            ...current,
            customerId,
          }))
        }
        disabled={disabled}
      />

      <FormField label="Tracking externo">
        <Input
          value={values.externalTrackingNumber}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              externalTrackingNumber: event.target.value,
            }))
          }
          placeholder="1Z-999-AA1-01-2345-6784"
          disabled={disabled}
          required
        />
      </FormField>

      <FormField label="Carrier (opcional)">
        <Input
          value={values.carrierName}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              carrierName: event.target.value,
            }))
          }
          placeholder="UPS"
          disabled={disabled}
        />
      </FormField>

      <FormField label="Tienda">
        <Input
          value={values.storeName}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              storeName: event.target.value,
            }))
          }
          disabled={disabled}
          required
        />
      </FormField>

      <FormField label="Fecha de compra (opcional)">
        <Input
          type="date"
          value={values.purchaseDate}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              purchaseDate: event.target.value,
            }))
          }
          disabled={disabled}
        />
      </FormField>

      <FormField label="Descripcion">
        <Textarea
          rows={4}
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          disabled={disabled}
          required
        />
      </FormField>

      <div className="selection-grid">
        <FormField label="Cantidad">
          <Input
            type="number"
            min={1}
            max={999}
            value={values.quantity}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                quantity: event.target.value,
              }))
            }
            disabled={disabled}
            required
          />
        </FormField>

        <FormField label="Valor declarado">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={values.declaredValue}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                declaredValue: event.target.value,
              }))
            }
            disabled={disabled}
            required
          />
        </FormField>
      </div>

      <div className="selection-grid">
        <FormField label="Moneda">
          <Input
            value={values.currencyCode}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                currencyCode: event.target.value.toUpperCase(),
              }))
            }
            placeholder={organizationCurrencyCode || "DOP"}
            maxLength={3}
            disabled={disabled}
          />
        </FormField>

        <FormField label="Estado de factura">
          <Select
            value={values.invoiceStatus}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                invoiceStatus: event.target.value as PrealertInvoiceStatus,
              }))
            }
            disabled={disabled}
          >
            {INVOICE_STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Notas (opcional)">
        <Textarea
          rows={4}
          value={values.notes}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              notes: event.target.value,
            }))
          }
          disabled={disabled}
        />
      </FormField>

      {!readOnly && submitLabel && onSubmit ? (
        <Button
          type="submit"
          disabled={disabled || values.customerId.trim().length === 0}
        >
          {submitting ? "Guardando..." : submitLabel}
        </Button>
      ) : null}
    </form>
  );
}
