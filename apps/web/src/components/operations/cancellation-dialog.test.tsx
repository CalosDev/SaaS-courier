import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CancellationDialog } from "@/components/operations/cancellation-dialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof CancellationDialog>> = {},
) {
  const props: React.ComponentProps<typeof CancellationDialog> = {
    open: true,
    title: "Cancelar paquete",
    reason: "",
    reasonPlaceholder: "Explica el motivo.",
    submitting: false,
    onClose: vi.fn(),
    onReasonChange: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };

  render(<CancellationDialog {...props} />);

  return props;
}

describe("CancellationDialog", () => {
  it("requires a reason with at least three non-whitespace characters", () => {
    const { rerender } = render(
      <CancellationDialog
        open
        title="Cancelar paquete"
        reason="  "
        reasonPlaceholder="Explica el motivo."
        submitting={false}
        onClose={vi.fn()}
        onReasonChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Confirmar cancelacion" }),
    ).toBeDisabled();

    rerender(
      <CancellationDialog
        open
        title="Cancelar paquete"
        reason="Daño"
        reasonPlaceholder="Explica el motivo."
        submitting={false}
        onClose={vi.fn()}
        onReasonChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Confirmar cancelacion" }),
    ).toBeEnabled();
  });

  it("forwards reason changes and confirmation", () => {
    const props = renderDialog({ reason: "Daño" });

    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Empaque dañado" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelacion" }),
    );

    expect(props.onReasonChange).toHaveBeenCalledWith("Empaque dañado");
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("prevents closing while the cancellation is being submitted", () => {
    const props = renderDialog({ submitting: true });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancelando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled();
  });
});
