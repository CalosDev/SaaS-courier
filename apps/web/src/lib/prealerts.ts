import type {
  PrealertInvoiceStatus,
  PrealertStatus,
} from "@/lib/api/contracts";

export const PREALERT_STATUS_LABELS: Record<PrealertStatus, string> = {
  PENDING_ARRIVAL: "Pendiente de llegada",
  MATCHED: "Vinculada",
  CANCELLED: "Cancelada",
};

export const PREALERT_INVOICE_STATUS_LABELS: Record<
  PrealertInvoiceStatus,
  string
> = {
  NOT_REQUIRED: "No requerida",
  PENDING: "Pendiente",
  PROVIDED: "Provista",
  REJECTED: "Rechazada",
  VERIFIED: "Verificada",
};

export function getPrealertStatusTone(
  status: PrealertStatus,
): "warning" | "success" | "danger" {
  switch (status) {
    case "PENDING_ARRIVAL":
      return "warning";
    case "MATCHED":
      return "success";
    default:
      return "danger";
  }
}

export function getPrealertInvoiceTone(
  invoiceStatus: PrealertInvoiceStatus,
): "neutral" | "warning" | "success" | "danger" {
  switch (invoiceStatus) {
    case "VERIFIED":
      return "success";
    case "REJECTED":
      return "danger";
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatPrealertMoney(
  amount: string,
  currencyCode: string,
): string {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return `${amount} ${currencyCode}`;
  }

  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
