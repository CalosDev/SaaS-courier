import { Metadata } from 'next';
import { backofficeApi } from '@/lib/api/backoffice';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Detalle de Entrega | Courier SaaS',
};

async function getDelivery(id: string) {
  try {
    const res = await backofficeApi.getDelivery(id);
    return res.data;
  } catch (error) {
    console.error('Failed to fetch delivery:', error);
    return null;
  }
}

export default async function DeliveryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const delivery = await getDelivery(params.id);

  if (!delivery) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Entrega: {delivery.deliveryNumber}</h1>
        <p className="text-gray-500">Detalle de entrega final o handoff</p>
      </div>

      <div className="bg-white rounded shadow p-6 border border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Estado</p>
            <span className="inline-block bg-gray-100 border text-xs px-2 py-1 rounded mt-1">
              {delivery.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cliente</p>
            <p className="font-medium mt-1">
              {delivery.customer?.firstName} {delivery.customer?.lastName}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Método</p>
            <p className="font-medium mt-1">{delivery.method}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Notas</p>
            <p className="font-medium mt-1">{delivery.notes || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow p-6 border border-gray-200">
        <h3 className="font-medium mb-4">Paquetes Asignados</h3>
        {delivery.items?.length > 0 ? (
          <ul className="space-y-2">
            {delivery.items.map((item: any) => (
              <li key={item.id} className="border p-2 rounded text-sm text-gray-700">
                {item.package?.externalTrackingNumber || item.packageId}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No hay paquetes asociados.</p>
        )}
      </div>

      <div className="bg-white rounded shadow p-6 border border-gray-200">
        <h3 className="font-medium mb-4">Intentos de Entrega</h3>
        {delivery.attempts?.length > 0 ? (
          <ul className="space-y-2">
            {delivery.attempts.map((attempt: any) => (
              <li key={attempt.id} className="border p-2 rounded flex justify-between text-sm text-gray-700">
                <span>{attempt.result} - {attempt.receiverName || 'Sin receptor'}</span>
                <span className="text-gray-500">{new Date(attempt.attemptedAt).toLocaleString('es-DO')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No hay intentos registrados.</p>
        )}
      </div>
    </div>
  );
}
