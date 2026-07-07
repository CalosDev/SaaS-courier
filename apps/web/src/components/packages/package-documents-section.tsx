"use client";

import { useCallback, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PackageDocumentType } from "@/lib/api/contracts";
import {
  getStoredObjectStatusTone,
  PACKAGE_DOCUMENT_TYPE_LABELS,
  STORED_OBJECT_STATUS_LABELS,
} from "@/lib/packages";

const PACKAGE_DOCUMENT_TYPES = Object.keys(
  PACKAGE_DOCUMENT_TYPE_LABELS,
) as PackageDocumentType[];

const DOCUMENT_ACCEPT: Record<PackageDocumentType, string> = {
  INVOICE: ".pdf,image/jpeg,image/png,image/webp",
  PURCHASE_RECEIPT: ".pdf,image/jpeg,image/png,image/webp",
  PACKAGE_PHOTO: "image/jpeg,image/png,image/webp",
  DAMAGE_PHOTO: "image/jpeg,image/png,image/webp",
  IDENTITY_SUPPORT: ".pdf,image/jpeg,image/png,image/webp",
  OTHER: ".pdf,image/jpeg,image/png,image/webp",
};

export function PackageDocumentsSection({
  packageId,
  canManage,
}: {
  packageId: string;
  canManage: boolean;
}) {
  const [documentType, setDocumentType] =
    useState<PackageDocumentType>("INVOICE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const resource = useAsyncState(
    useCallback(
      async () => (await backofficeApi.listPackageDocuments(packageId)).items,
      [packageId],
    ),
  );

  const accept = useMemo(
    () => DOCUMENT_ACCEPT[documentType],
    [documentType],
  );

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!selectedFile) {
      setError("Selecciona un archivo antes de iniciar la carga.");
      return;
    }

    if (!selectedFile.type) {
      setError("El archivo seleccionado no informa un tipo MIME valido.");
      return;
    }

    setSubmitting(true);

    try {
      const intent = await backofficeApi.createPackageDocumentUploadIntent(
        packageId,
        {
          documentType,
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          contentLength: selectedFile.size,
        },
      );

      const uploadResponse = await fetch(intent.upload.url, {
        method: intent.upload.method,
        headers: intent.upload.headers,
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      await backofficeApi.completePackageDocument(packageId, intent.document.id);
      setMessage("Documento cargado y confirmado.");
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible cargar el documento.",
      );
      await resource.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    setError(null);
    setMessage(null);

    try {
      await backofficeApi.deletePackageDocument(packageId, documentId);
      setMessage("Documento eliminado.");
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible eliminar el documento.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="form-grid">
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canManage ? (
        <form className="form-grid" onSubmit={(event) => void handleUpload(event)}>
          <FormField label="Tipo de documento">
            <Select
              value={documentType}
              onChange={(event) =>
                setDocumentType(event.target.value as PackageDocumentType)
              }
              disabled={submitting}
            >
              {PACKAGE_DOCUMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {PACKAGE_DOCUMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Archivo">
            <Input
              key={fileInputKey}
              type="file"
              accept={accept}
              disabled={submitting}
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
            />
          </FormField>

          <Button type="submit" disabled={submitting || !selectedFile}>
            {submitting ? "Cargando..." : "Cargar documento"}
          </Button>
        </form>
      ) : null}

      {resource.status === "loading" ? (
        <LoadingState label="Cargando documentos..." />
      ) : null}

      {resource.status === "error" ? (
        <Alert tone="error">
          No fue posible cargar los documentos del paquete.
        </Alert>
      ) : null}

      {resource.status === "success" && resource.data.length === 0 ? (
        <Alert tone="info">
          Este paquete todavia no tiene documentos asociados.
        </Alert>
      ) : null}

      {resource.status === "success" && resource.data.length > 0 ? (
        <div className="table-wrapper">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Archivo</th>
                <th>Estado</th>
                <th>Tamano</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.map((document) => (
                <tr key={document.id}>
                  <td>{PACKAGE_DOCUMENT_TYPE_LABELS[document.documentType]}</td>
                  <td>
                    <div>
                      <strong>{document.originalFilename}</strong>
                      <div>{document.contentType}</div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={getStoredObjectStatusTone(document.status)}>
                      {STORED_OBJECT_STATUS_LABELS[document.status]}
                    </Badge>
                  </td>
                  <td>{formatBytes(document.contentLength)}</td>
                  <td>{document.createdAt.slice(0, 10)}</td>
                  <td>
                    <div className="actions-row">
                      <a
                        href={`/backend/packages/${packageId}/documents/${document.id}/download`}
                        className="ui-button ui-button--secondary"
                      >
                        Descargar
                      </a>
                      {canManage ? (
                        <Button
                          variant="danger"
                          onClick={() => void handleDelete(document.id)}
                          disabled={deletingId === document.id}
                        >
                          {deletingId === document.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
