import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CorrectionStatusBadge } from "@/components/corrections/CorrectionStatusBadge";

describe("CorrectionStatusBadge", () => {
  it("renders the existing label for correction statuses", () => {
    render(<CorrectionStatusBadge status="REQUESTED" />);

    expect(screen.getByText("Solicitada")).toBeVisible();
  });
});
