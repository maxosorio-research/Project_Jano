import { describe, expect, it } from "vitest";
import {
  classifyPipelineFailure,
  pipelineError,
  userFacingPipelineError,
} from "./pipelineError";

describe("pipeline errors", () => {
  it("classifies transient runtime and invalid model output failures", () => {
    expect(
      classifyPipelineFailure("Ollama rechazó la traducción (HTTP 500)."),
    ).toMatchObject({ code: "MODEL_SERVER_ERROR", recoverable: true });
    expect(
      classifyPipelineFailure(
        "Ollama no conservó los marcadores matemáticos de seg_00001.",
      ),
    ).toMatchObject({ code: "MODEL_OUTPUT_INVALID", recoverable: true });
  });

  it("keeps a user action and the underlying diagnostic", () => {
    const error = pipelineError(
      "saving",
      new Error("Access is denied"),
      "SAVE_FAILED",
    );
    const message = userFacingPipelineError(error);

    expect(message).toContain("guardar el resultado");
    expect(message).toContain("original no fue modificado");
    expect(message).toContain("Access is denied");
  });
});
