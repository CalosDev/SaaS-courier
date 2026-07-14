"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { backofficeApi } from "@/lib/api/backoffice";
import type { DeliveryOrder } from "@/lib/api/contracts";

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await backofficeApi.listDeliveries();
        setDeliveries(res);
      } catch (e) {
        console.error("Failed to fetch deliveries:", e);
        setError("Error al cargar las entregas");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Final Deliveries</h1>
          <p className="text-gray-500">
            Gestión de entregas finales y handoffs
          </p>
        </div>
        <Link
          href="/deliveries/new"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center hover:bg-blue-700 transition"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Entrega
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded shadow p-4 border border-gray-200">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            Cargando entregas...
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="p-3 font-medium">No. Delivery</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Cliente</th>
                <th className="p-3 font-medium">Método</th>
                <th className="p-3 font-medium">Fecha</th>
                <th className="p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No hay entregas registradas.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr
                    key={delivery.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="p-3">{delivery.deliveryNumber}</td>
                    <td className="p-3">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs border">
                        {delivery.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {delivery.customer
                        ? `${delivery.customer.firstName} ${delivery.customer.lastName}`
                        : "N/A"}
                    </td>
                    <td className="p-3">{delivery.method}</td>
                    <td className="p-3">
                      {new Date(delivery.createdAt).toLocaleString("es-DO")}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/deliveries/${delivery.id}`}
                        className="text-blue-600 hover:underline border border-blue-600 px-3 py-1 rounded text-xs"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
