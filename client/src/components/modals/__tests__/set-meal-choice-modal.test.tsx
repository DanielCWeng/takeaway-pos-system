import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetMealChoiceModal } from "../set-meal-choice-modal";

describe("SetMealChoiceModal", () => {
  it("requires exact required-count selections before confirming", () => {
    const onConfirm = vi.fn();

    render(
      <SetMealChoiceModal
        choice={{
          type: "choice",
          description: "Choose 2 Soups",
          options: ["Hot & Sour", "Chicken", "Sweetcorn"],
        }}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Confirm Selection" });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Hot & Sour/ }));
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Chicken/ }));
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith(["Hot & Sour", "Chicken"]);
  });

  it("allows the same option to supply both portions", () => {
    const onConfirm = vi.fn();

    render(
      <SetMealChoiceModal
        choice={{
          type: "choice",
          description: "Choose 2 Soups",
          options: ["Hot & Sour", "Chicken", "Sweetcorn"],
        }}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    const soupButton = screen.getByRole("button", { name: /Hot & Sour/ });
    fireEvent.click(soupButton);
    fireEvent.click(soupButton);

    const confirmButton = screen.getByRole("button", { name: "Confirm Selection" });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith(["Hot & Sour", "Hot & Sour"]);
  });

  it("does not allow selections beyond required count", () => {
    render(
      <SetMealChoiceModal
        choice={{
          type: "choice",
          description: "Choose 2 Starters",
          options: ["Spring Roll", "Satay", "Dumpling"],
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Spring Roll/ }));
    fireEvent.click(screen.getByRole("button", { name: /Satay/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dumpling/ }));

    expect(screen.getByText("2 / 2 SELECTED")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Confirm Selection" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
