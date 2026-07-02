"use client";

import { Button } from "@/components/ui/button";

export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="ui-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-dialog__header">
          <h2>{title}</h2>
          <Button variant="ghost" aria-label="Cerrar" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="ui-dialog__body">{children}</div>
        {actions ? <div className="ui-dialog__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
