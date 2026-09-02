import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailList } from "@/components/ui/detail-list";

describe("DetailList", () => {
  it("renders each label with its corresponding value", () => {
    render(
      <DetailList
        entries={[
          { label: "Estado", value: "Activo" },
          { label: "Tracking", value: "PK123" },
        ]}
      />,
    );

    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Tracking")).toBeInTheDocument();
    expect(screen.getByText("PK123")).toBeInTheDocument();
  });
});
