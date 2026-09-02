"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

type CancellationDialogProps = {
  open: boolean;
  title: string;
  reason: string;
  reasonPlaceholder: string;
  submitting: boolean;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
};

export function CancellationDialog({
  open,
  title,
  reason,
  reasonPlaceholder,
  submitting,
  onClose,
  onReasonChange,
  onConfirm,
}: CancellationDialogProps) {
  const closeIfIdle = () => {
    if (!submitting) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      title={title}
      onClose={closeIfIdle}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={closeIfIdle}
            disabled={submitting}
          >
            Volver
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "Cancelando..." : "Confirmar cancelacion"}
          </Button>
        </>
      }
    >
      <FormField label="Motivo">
        <Textarea
          rows={4}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={reasonPlaceholder}
        />
      </FormField>
    </Dialog>
  );
}
