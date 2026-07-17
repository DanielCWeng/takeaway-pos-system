import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/domains/eta/eta.repo.js", () => ({
  getModel: vi.fn(),
  saveModel: vi.fn(),
}));

import * as repo from "../../src/domains/eta/eta.repo.js";
import { updateModelWithObservation } from "../../src/domains/eta/eta.service.js";

describe("ETA model learning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.getModel.mockReturnValue({
      theta: [20, 0, 0, 0, 0],
      pMatrix: Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, column) => (row === column ? 1 : 0)),
      ),
      sigmaSq: 0,
      sampleCount: 0,
    });
  });

  it("learns from a normal completed order", () => {
    updateModelWithObservation(2, 1, 0, false, 45);

    expect(repo.saveModel).toHaveBeenCalledOnce();
  });

  it.each([180, 181, 240])("ignores an outlier lasting %i minutes", (actualMins) => {
    updateModelWithObservation(2, 1, 0, false, actualMins);

    expect(repo.getModel).not.toHaveBeenCalled();
    expect(repo.saveModel).not.toHaveBeenCalled();
  });
});
