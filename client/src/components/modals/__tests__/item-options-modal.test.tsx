import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ItemOptionsModal } from "../item-options-modal";
import type { MenuItem } from "../../../types";

describe("ItemOptionsModal", () => {
  it("translates known English options into Chinese and appends them to zhName", () => {
    const mockItem: MenuItem = {
      id: "D01",
      name: {
        en: "Crispy Duck",
        zh: "?????????",
      },
      price: 15,
      options: [
        { name: "Half", price: 15 },
        { name: "Whole", price: 28 },
      ],
      contents: [
        {
          type: "choice",
          description: "Side",
          options: ["Chips", "Fried Rice", "Boiled Rice"],
        },
      ],
    };

    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(<ItemOptionsModal item={mockItem} onConfirm={handleConfirm} onClose={handleClose} />);

    fireEvent.click(screen.getByText("Whole"));
    fireEvent.click(screen.getByText("Fried Rice"));
    fireEvent.click(screen.getByText("Confirm & Add"));

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    const finalized = handleConfirm.mock.calls[0][0];
    expect(finalized.name.en).toBe("Crispy Duck (Whole, Fried Rice)");
    expect(finalized.name.zh).toContain("Fried Rice");
    expect(finalized.price).toBe(28);
  });

  it("falls back to English if the translation is not in the dictionary", () => {
    const mockItem: MenuItem = {
      id: "D02",
      name: {
        en: "Special Drink",
        zh: "??????",
      },
      options: [
        { name: "Normal", price: 2.5 },
        { name: "Extra Cold", price: 3.0 },
      ],
    };

    const handleConfirm = vi.fn();

    render(<ItemOptionsModal item={mockItem} onConfirm={handleConfirm} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Extra Cold"));
    fireEvent.click(screen.getByText("Confirm & Add"));

    expect(handleConfirm).toHaveBeenCalledWith({
      name: {
        en: "Special Drink (Extra Cold)",
        zh: "?????? (Extra Cold)",
      },
      price: 3.0,
    });
  });
});
