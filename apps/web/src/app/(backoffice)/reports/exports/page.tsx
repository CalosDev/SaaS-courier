"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { backofficeApi } from "@/lib/api/backoffice";
import type { ReportExportJob } from "@/lib/api/contracts";

function ExportStatus() {
  const searchParams = useSearchParams();
  const exportId = searchParams.get("exportId");
  const [job, setJob] = useState<ReportExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exportId) return;
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      try {
        const result = await backofficeApi.getReportExport(exportId!);
        if (!active) return;
        setJob(result);
        if (result.status === "PENDING" || result.status === "PROCESSING") {
          timeout = setTimeout(() => void refresh(), 1500);
        }
      } catch {
        if (active) setError("No fue posible consultar la exportacion.");
      }
    }

    void refresh();
    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [exportId]);

  async function download() {
    if (!job) return;
    const response = await fetch(`/backend/report-exports/${job.id}/download`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      setError("La exportacion no esta disponible para descargar.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = job.fileName || "reporte.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!exportId) return <Alert tone="error">Falta el identificador de exportacion.</Alert>;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!job) return <LoadingState label="Consultando exportacion..." />;

  return (
    <Card>
      <div className="page-stack">
        <div>
          <h2>{job.reportType}</h2>
          <Badge>{job.status}</Badge>
        </div>
        <p>Filas: {job.rowCount ?? "-"}</p>
        <p>Expira: {job.expiresAt ? new Date(job.expiresAt).toLocaleString() : "-"}</p>
        {job.truncated ? (
          <Alert tone="warning">La exportacion alcanzo el limite de 5,000 filas.</Alert>
        ) : null}
        {job.status === "COMPLETED" ? (
          <Button onClick={() => void download()}>Descargar CSV</Button>
        ) : null}
        {job.status === "FAILED" ? (
          <Alert tone="error">La exportacion no pudo completarse.</Alert>
        ) : null}
      </div>
    </Card>
  );
}

export default function ReportExportsPage() {
  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Exportacion de reporte</h1>
        </div>
      </section>
      <Suspense fallback={<LoadingState label="Consultando exportacion..." />}>
        <ExportStatus />
      </Suspense>
    </div>
  );
}
