import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VirtualKeyboard } from "../virtual-keyboard";

function TestInputs() {
  return (
    <div>
      <input aria-label="name-input" defaultValue="" />
      <textarea aria-label="notes-textarea" defaultValue="" />
      <VirtualKeyboard />
    </div>
  );
}

function getEnterButton() {
  return screen
    .getAllByRole("button")
    .find((btn) => btn.className.includes("bg-primary/10")) as HTMLButtonElement;
}

function getBackspaceButton() {
  const wideButtons = screen
    .getAllByRole("button")
    .filter((btn) => btn.className.includes("w-[84px]"));
  return wideButtons[1] as HTMLButtonElement;
}

describe("VirtualKeyboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("inserts characters and backspaces for focused input", async () => {
    render(<TestInputs />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const input = screen.getByLabelText("name-input") as HTMLInputElement;
    input.focus();
    fireEvent.focusIn(input);

    await waitFor(() => {
      expect(screen.getByText("q")).toBeTruthy();
    });

    input.focus();
    fireEvent.mouseDown(screen.getByText("q"));
    input.focus();
    fireEvent.mouseDown(screen.getByText("SPACE"));
    input.focus();
    fireEvent.mouseDown(screen.getByText("w"));

    expect(input.value).toBe("q w");

    input.focus();
    fireEvent.mouseDown(getBackspaceButton());
    expect(input.value).toBe("q ");
  });

  it("handles enter differently for input and textarea", async () => {
    render(<TestInputs />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const input = screen.getByLabelText("name-input") as HTMLInputElement;
    const textarea = screen.getByLabelText("notes-textarea") as HTMLTextAreaElement;
    const inputKeydown = vi.fn();
    input.addEventListener("keydown", inputKeydown);

    input.focus();
    fireEvent.focusIn(input);
    await waitFor(() => {
      expect(screen.getByText("q")).toBeTruthy();
    });
    input.focus();
    fireEvent.mouseDown(getEnterButton());
    expect(inputKeydown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }));

    textarea.focus();
    fireEvent.focusIn(textarea);
    textarea.focus();
    fireEvent.mouseDown(screen.getByText("q"));
    textarea.focus();
    fireEvent.mouseDown(getEnterButton());

    expect(textarea.value).toBe("q\n");
  });
});
