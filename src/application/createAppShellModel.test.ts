import { describe, expect, it } from "vitest";
import { createAppShellModel } from "./createAppShellModel";

describe("createAppShellModel", () => {
  it("defines only the three Milestone 0 placeholder regions", () => {
    const model = createAppShellModel({ environmentLabel: "test" });

    expect(model.appName).toBe("Jano");
    expect(model.environmentLabel).toBe("test");
    expect(model.panels.map((panel) => panel.id)).toEqual([
      "project",
      "original",
      "translation",
    ]);
  });
});
