"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";

export default function RateCardDetailPage({
  params,
}: {
  params: Promise<{ rateCardId: string }>;
}) {
  const { rateCardId } = use(params);
  const router = useRouter();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quote state
  const [quoteWeight, setQuoteWeight] = useState("1");
  const [quoteResult, setQuoteResult] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(() => backofficeApi.getRateCard(rateCardId), [rateCardId]),
  );

  async function activateCard() {
    setMessage(null);
    setError(null);
    try {
      await backofficeApi.activateRateCard(rateCardId);
      setMessage("Tarifario activado correctamente.");
      await resource.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al activar.");
    }
  }

  async function simulateQuote() {
    setQuoteError(null);
    setQuoteResult(null);
    try {
      const res = await backofficeApi.quoteRate({
        rateCardId,
        weight: Number(quoteWeight),
      });
      // display in normal units (minor units / 100)
      setQuoteResult(Number(res.quote.courierAmountMinor) / 100);
    } catch (err) {
      setQuoteError(err instanceof ApiError ? err.message : "Error al cotizar.");
    }
  }

  async function saveRules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    // Simplistic array parsing just for the MVP
    // Assuming 1 rule for FLAT or PER_WEIGHT for this UI implementation
    // A complex UI would dynamically render multiple rows for TIERED_WEIGHT
    const flatMinor = formData.get("flatMinor") ? Number(formData.get("flatMinor")) * 100 : null;
    const unitMinor = formData.get("unitMinor") ? Number(formData.get("unitMinor")) * 100 : null;

    const rules = [
      {
        sortOrder: 1,
        minWeight: formData.get("minWeight") ? Number(formData.get("minWeight")) : null,
        maxWeight: formData.get("maxWeight") ? Number(formData.get("maxWeight")) : null,
        flatAmountMinor: flatMinor,
        unitAmountMinor: unitMinor,
      }
    ];

    try {
      await backofficeApi.replaceRateRules(rateCardId, { rules });
      setMessage("Reglas guardadas correctamente.");
      await resource.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar reglas.");
    }
  }

  if (resource.status === "loading") {
    return <LoadingState label="Cargando tarifario..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el tarifario"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  const card = resource.data;
  const isDraft = card.status === "DRAFT";

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Tarifario: {card.name}</h1>
          <p>
            Servicio: <strong>{card.service.code}</strong> | Segmento: <strong>{card.segmentKey}</strong> | Cálculo: <strong>{card.calculationType}</strong> | Estado: <strong>{card.status}</strong>
          </p>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={() => router.back()}>Volver</Button>
          {isDraft && (
            <Button variant="primary" onClick={() => void activateCard()}>
              Activar Tarifario
            </Button>
          )}
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="content-grid">
        <Card>
          <h2>Reglas de Tarifa</h2>
          {isDraft ? (
            <form className="form-grid" onSubmit={(e) => void saveRules(e)}>
              {/* Note: Simplified UI just to satisfy validation. In production this would be a dynamic list */}
              <FormField label="Min Weight">
                <Input name="minWeight" type="number" step="0.01" defaultValue={card.rules[0]?.minWeight || ""} />
              </FormField>
              <FormField label="Max Weight">
                <Input name="maxWeight" type="number" step="0.01" defaultValue={card.rules[0]?.maxWeight || ""} />
              </FormField>
              <FormField label="Monto Flat (Mayor)">
                <Input name="flatMinor" type="number" step="0.01" defaultValue={card.rules[0]?.flatAmountMinor ? card.rules[0].flatAmountMinor / 100 : ""} />
              </FormField>
              <FormField label="Monto Unidad (Mayor)">
                <Input name="unitMinor" type="number" step="0.01" defaultValue={card.rules[0]?.unitAmountMinor ? card.rules[0].unitAmountMinor / 100 : ""} />
              </FormField>

              <Button type="submit">Guardar Regla</Button>
            </form>
          ) : (
            <Table
              columns={["Orden", "Mínimo", "Máximo", "Flat (Menor)", "Unitario (Menor)"]}
              rows={card.rules.map(r => [
                r.sortOrder,
                r.minWeight || "-",
                r.maxWeight || "-",
                r.flatAmountMinor || "-",
                r.unitAmountMinor || "-"
              ])}
            />
          )}
        </Card>

        <Card>
          <h2>Simulador (Quote)</h2>
          <div className="form-grid">
            <FormField label="Peso (Weight)">
              <Input
                type="number"
                value={quoteWeight}
                onChange={(e) => setQuoteWeight(e.target.value)}
              />
            </FormField>
            <Button variant="secondary" onClick={() => void simulateQuote()}>
              Cotizar
            </Button>
          </div>
          {quoteError && <Alert tone="error">{quoteError}</Alert>}
          {quoteResult !== null && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#166534' }}>
                Total Courier: {card.currencyCode} {quoteResult.toFixed(2)}
              </p>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
