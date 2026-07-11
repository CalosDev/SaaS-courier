"use client";

export default function HouseShipmentsPage() {
  // For minimal list, we will need a master shipment ID. Since this is a global list,
  // maybe we don't have a global endpoint yet (it requires shipmentId).
  // I will just show a placeholder or call an empty state since the API requires a shipmentId.

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Envíos (House Shipments)</h1>
          <p>Gestión de envíos y HAWBs.</p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-state">
          Para ver los envíos (House Shipments), selecciona un Master Shipment.
        </div>
      </div>
    </div>
  );
}
