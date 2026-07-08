import type {
  InventoryMovementType,
  WarehouseLocationType,
} from "@/lib/api/contracts";

export const WAREHOUSE_LOCATION_TYPE_LABELS: Record<
  WarehouseLocationType,
  string
> = {
  RECEIVING: "Recepción",
  SHELF: "Estante",
  RACK: "Rack",
  BIN: "Bin",
  STAGING: "Staging",
  HOLD: "Retención",
  DISPATCH: "Despacho",
};

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<
  InventoryMovementType,
  string
> = {
  PUTAWAY: "Ubicar",
  MOVE: "Mover",
  HOLD: "Retener",
  RELEASE: "Liberar",
  REMOVE: "Retirar",
};

export function inventoryPositionLabel(
  position: { location: { code: string; name: string } } | null,
): string {
  if (!position) {
    return "Sin ubicación";
  }

  return `${position.location.code} · ${position.location.name}`;
}
