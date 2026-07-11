"use client";

import Link from "next/link";
import { Dispatch } from "@/lib/api/contracts";
import { Table } from "@/components/ui/table";
import { DispatchStatusBadge } from "./DispatchStatusBadge";

interface DispatchListProps {
  dispatches: Dispatch[];
  detailBasePath?: string;
  createHref?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
}

export function DispatchList({
  dispatches,
  detailBasePath = "/dispatches",
  createHref = "/dispatches/new",
  emptyMessage = "No hay despachos registrados",
  emptyActionLabel = "Crear el primer despacho",
}: DispatchListProps) {
  if (dispatches.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{emptyMessage}</p>
        <Link href={createHref} className="text-blue-600 hover:underline">
          {emptyActionLabel}
        </Link>
      </div>
    );
  }

  const columns = [
    "Código",
    "Estado",
    "Origen",
    "Destino",
    "Transportista",
    "Acciones",
  ];

  const rows = dispatches.map((dispatch) => [
    <div key="code" className="font-medium">{dispatch.dispatchCode}</div>,
    <DispatchStatusBadge key="status" status={dispatch.status} />,
    <div key="origin">{dispatch.origin || "-"}</div>,
    <div key="destination">{dispatch.destination || "-"}</div>,
    <div key="carrier">{dispatch.carrier || "-"}</div>,
    <Link
      key="actions"
      href={`${detailBasePath}/${dispatch.id}`}
      className="text-blue-600 hover:text-blue-800 hover:underline"
    >
      Ver Detalle
    </Link>,
  ]);

  return <Table columns={columns} rows={rows} />;
}
