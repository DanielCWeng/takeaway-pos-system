import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmationModal } from "../confirmation-modal";

describe("ConfirmationModal", () => {
  it("uses order total as default payment when no amount is entered", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<ConfirmationModal orderTotal={18.5} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith({ amountPaid: 18.5, changeDue: 0 });
  });

  it("supports numpad input and backspace interactions", () => {
    const onConfirm = vi.fn();

    render(<ConfirmationModal orderTotal={10} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));

    expect(screen.getByText("123")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "←" }));
    expect(screen.getByText("12")).toBeTruthy();
  });
});
