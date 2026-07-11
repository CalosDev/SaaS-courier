import { useEffect, useState } from "react";
import { backofficeApi } from "@/lib/api/backoffice";
import { ExternalTrackingResponse } from "@/lib/api/contracts";
import { LoadingState } from "@/components/ui/loading-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ExternalTrackingTimelineProps {
  prealertId: string;
}

export function ExternalTrackingTimeline({ prealertId }: ExternalTrackingTimelineProps) {
  const [data, setData] = useState<ExternalTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchTracking() {
      try {
        setLoading(true);
        setError(null);
        const response = await backofficeApi.getExternalTracking(prealertId);
        if (mounted) {
          setData(response);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed to fetch external tracking:", err);
          setError("No se pudo cargar el tracking externo en este momento.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void fetchTracking();

    return () => {
      mounted = false;
    };
  }, [prealertId]);

  if (loading) {
    return <LoadingState label="Consultando proveedor de paqueteria..." />;
  }

  if (error) {
    return <Alert tone="warning">{error}</Alert>;
  }

  if (!data) {
    return (
      <Alert tone="info">
        Esta prealerta no tiene información de tracking externo registrada o el transportista no ofrece datos públicos.
      </Alert>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2>Tracking Externo ({data.carrier})</h2>
        {data.isDelivered ? (
          <Badge tone="success">Entregado</Badge>
        ) : (
          <Badge tone="neutral">En transito</Badge>
        )}
      </div>

      <div className="space-y-4">
        {data.events.map((event, index) => (
          <div key={index} className="flex gap-4 p-3 border rounded">
            <div className="text-sm font-semibold text-gray-500 w-32 shrink-0">
              {new Date(event.timestamp).toLocaleDateString("es-DO", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div>
              <p className="font-medium text-gray-900">{event.description}</p>
              <p className="text-sm text-gray-500">
                {event.location} • {event.status}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
