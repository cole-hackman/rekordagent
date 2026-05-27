import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EnergyBar } from "./EnergyBar";

function fillWidth() {
  const fill = screen.getByTestId("energy-bar-fill") as HTMLElement;
  return fill.style.width;
}

describe("EnergyBar", () => {
  it("renders 0% width for value 0", () => {
    render(<EnergyBar value={0} />);
    expect(fillWidth()).toBe("0%");
  });

  it("renders 50% width for value 0.5", () => {
    render(<EnergyBar value={0.5} />);
    expect(fillWidth()).toBe("50%");
  });

  it("renders 100% width for value 1", () => {
    render(<EnergyBar value={1} />);
    expect(fillWidth()).toBe("100%");
  });

  it("clamps values above 1", () => {
    render(<EnergyBar value={2} />);
    expect(fillWidth()).toBe("100%");
  });

  it("clamps negative values", () => {
    render(<EnergyBar value={-0.5} />);
    expect(fillWidth()).toBe("0%");
  });

  it("exposes ARIA progressbar role with current value", () => {
    render(<EnergyBar value={0.42} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0.42");
  });
});
