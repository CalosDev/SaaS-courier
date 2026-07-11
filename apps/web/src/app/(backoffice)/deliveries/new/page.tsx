import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nueva Entrega | Courier SaaS',
};

export default function NewDeliveryPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Crear Nueva Entrega</h1>
        <p className="text-gray-500">Registra una nueva entrega o handoff</p>
      </div>

      <div className="bg-white rounded shadow p-6 border border-gray-200">
        <p className="text-gray-500 text-sm">
          Formulario de nueva entrega se implementará aquí.
        </p>
      </div>
    </div>
  );
}
