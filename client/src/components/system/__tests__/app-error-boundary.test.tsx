import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FC } from "react";
import { AppErrorBoundary } from "../app-error-boundary";

vi.mock("../../../lib/runtime-monitor", () => ({
  reportRenderError: vi.fn(),
}));

import { reportRenderError } from "../../../lib/runtime-monitor";

const Thrower: FC = () => {
  throw new Error("kaboom");
};

describe("AppErrorBoundary", () => {
  it("renders fallback UI and reports caught errors", () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Session interrupted")).toBeTruthy();
    expect(reportRenderError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "kaboom" }),
      expect.any(String),
    );
    expect(screen.getByRole("button", { name: "Reload POS" })).toBeTruthy();
  });
});
