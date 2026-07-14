"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import type { PublicTrackingResult } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_LABELS: Record<string, string> = {
  PENDING_ARRIVAL: "Prealertado",
  RECEPTION_PENDING: "Registro pendiente",
  RECEIVED_AT_ORIGIN: "Recibido en origen",
  IN_TRANSIT: "En tránsito",
  ARRIVED_AT_DESTINATION: "Disponible en destino",
  OUT_FOR_DELIVERY: "En ruta de entrega",
  DELIVERED: "Entregado",
};

export default function PublicTrackingPage() {
  const organizationSlug = useParams<{ organizationSlug: string }>().organizationSlug;
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<PublicTrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = reference.trim();
    if (!value) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await apiClient.get<PublicTrackingResult>(
          `/public/organizations/${encodeURIComponent(organizationSlug)}/tracking/${encodeURIComponent(value)}`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 404
          ? "No encontramos un envío con esa referencia."
          : "No fue posible consultar el envío. Intenta nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7f8] text-[#17242d]">
      <header className="border-b border-[#d7e0e5] bg-white">
        <div className="mx-auto max-w-3xl px-5 py-6">
          <strong className="text-xl">Seguimiento de envíos</strong>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-semibold">Consulta tu envío</h1>
        <p className="mt-2 text-[#52616b]">Ingresa tu tracking o código de prealerta.</p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input aria-label="Referencia de tracking" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. PKABCDEFGH2345" autoComplete="off" />
          <Button type="submit" disabled={loading || !reference.trim()}><Search className="button-icon" />{loading ? "Consultando..." : "Consultar"}</Button>
        </form>
        {error ? <div role="alert" className="mt-6 border border-[#d6a29d] bg-white p-4 text-[#7a231c]">{error}</div> : null}
        {result ? <section className="mt-8 border border-[#d7e0e5] bg-white p-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[#52616b]">{result.organization.name}</p><h2 className="text-xl font-semibold">{result.internalTrackingNumber ?? "Prealerta registrada"}</h2></div><Badge tone={result.status === "DELIVERED" ? "success" : "neutral"}>{STATUS_LABELS[result.status] ?? result.status}</Badge></div>
          <ol className="mt-6 border-l-2 border-[#b8c8d1] pl-5">{result.timeline.map((event, index) => <li key={`${event.eventType}-${event.createdAt}-${index}`} className="pb-6 last:pb-0"><strong>{STATUS_LABELS[event.eventType] ?? event.eventType}</strong>{event.location ? <p className="text-sm text-[#52616b]">{event.location}</p> : null}<time className="text-sm text-[#52616b]">{new Date(event.createdAt).toLocaleString("es-DO")}</time></li>)}</ol>
        </section> : null}
      </div>
    </main>
  );
}
