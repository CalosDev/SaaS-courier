import type {
  PackageDocumentType,
  PackageSource,
  PackageStatus,
  StoredObjectStatus,
} from "@/lib/api/contracts";

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  RECEPTION_PENDING: "Recepcion pendiente",
  RECEIVED_AT_ORIGIN: "Recibido en origen",
  IN_TRANSIT: "En transito",
  ARRIVED_AT_DESTINATION: "Llegado a destino",
  OUT_FOR_DELIVERY: "En ruta de entrega",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const PACKAGE_SOURCE_LABELS: Record<PackageSource, string> = {
  MANUAL: "Manual",
  PREALERT: "Prealerta",
};

export function getPackageStatusTone(
  status: PackageStatus,
): "warning" | "success" | "danger" {
  switch (status) {
    case "RECEIVED_AT_ORIGIN":
    case "ARRIVED_AT_DESTINATION":
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "danger";
    default:
      return "warning";
  }
}

export const PACKAGE_DOCUMENT_TYPE_LABELS: Record<PackageDocumentType, string> =
  {
    INVOICE: "Factura",
    PURCHASE_RECEIPT: "Recibo de compra",
    PACKAGE_PHOTO: "Foto del paquete",
    DAMAGE_PHOTO: "Foto de dano",
    IDENTITY_SUPPORT: "Soporte de identidad",
    OTHER: "Otro",
  };

export const STORED_OBJECT_STATUS_LABELS: Record<StoredObjectStatus, string> = {
  PENDING_UPLOAD: "Carga pendiente",
  AVAILABLE: "Disponible",
  QUARANTINED: "En cuarentena",
  DELETED: "Eliminado",
};

export function getStoredObjectStatusTone(
  status: StoredObjectStatus,
): "warning" | "success" | "danger" | "neutral" {
  switch (status) {
    case "PENDING_UPLOAD":
      return "warning";
    case "AVAILABLE":
      return "success";
    case "QUARANTINED":
      return "danger";
    case "DELETED":
      return "neutral";
    default:
      return "neutral";
  }
}
