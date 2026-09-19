export type PipelineStage =
  | "loading"
  | "extracting"
  | "ocr"
  | "translating"
  | "reviewing"
  | "saving"
  | "cleanup";

export type PipelineErrorCode =
  | "PDF_LOAD_FAILED"
  | "TEXT_EXTRACTION_FAILED"
  | "OCR_FAILED"
  | "MODEL_UNAVAILABLE"
  | "MODEL_OUTPUT_INVALID"
  | "MODEL_SERVER_ERROR"
  | "SAVE_FAILED"
  | "CLEANUP_FAILED"
  | "UNKNOWN";

const STAGE_LABELS: Record<PipelineStage, string> = {
  loading: "abrir el PDF",
  extracting: "extraer el texto",
  ocr: "reconocer el texto con OCR",
  translating: "traducir el documento",
  reviewing: "revisar la traducción",
  saving: "guardar el resultado",
  cleanup: "liberar los recursos de procesamiento",
};

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly stage: PipelineStage;
  readonly recoverable: boolean;
  readonly detail: string;

  constructor({
    code,
    stage,
    message,
    recoverable = false,
    cause,
  }: {
    code: PipelineErrorCode;
    stage: PipelineStage;
    message: string;
    recoverable?: boolean;
    cause?: unknown;
  }) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "PipelineError";
    this.code = code;
    this.stage = stage;
    this.recoverable = recoverable;
    this.detail = errorDetail(cause);
  }
}

export function pipelineError(
  stage: PipelineStage,
  caught: unknown,
  fallbackCode?: PipelineErrorCode,
): PipelineError {
  if (caught instanceof PipelineError) return caught;
  const detail = errorDetail(caught);
  const classified = classifyPipelineFailure(detail, fallbackCode);
  return new PipelineError({
    ...classified,
    stage,
    message: `No se pudo ${STAGE_LABELS[stage]}. ${classified.action}`,
    cause: caught,
  });
}

export function classifyPipelineFailure(
  detail: string,
  fallbackCode: PipelineErrorCode = "UNKNOWN",
): { code: PipelineErrorCode; recoverable: boolean; action: string } {
  if (
    /not responding|connection refused|failed to connect|timed?\s*out/i.test(
      detail,
    )
  ) {
    return {
      code: "MODEL_UNAVAILABLE",
      recoverable: true,
      action: "Comprueba que Ollama esté abierto y vuelve a intentarlo.",
    };
  }
  if (
    /model.*not installed|model.*not found|select an installed.*model/i.test(
      detail,
    )
  ) {
    return {
      code: "MODEL_UNAVAILABLE",
      recoverable: false,
      action: "Selecciona en Ajustes un modelo local que esté instalado.",
    };
  }
  if (
    /http 5\d\d|internal server error|model runner.*(?:stopped|crash)/i.test(
      detail,
    )
  ) {
    return {
      code: "MODEL_SERVER_ERROR",
      recoverable: true,
      action: "Ollama tuvo un fallo temporal; vuelve a intentarlo.",
    };
  }
  if (
    /invalid translation json|empty translation|segment identifier|marcadores matemáticos|marcadores de cifras o referencias|cifras o referencias|math placeholder|protected marker/i.test(
      detail,
    )
  ) {
    return {
      code: "MODEL_OUTPUT_INVALID",
      recoverable: true,
      action:
        "El modelo devolvió una respuesta incompleta o alteró contenido protegido.",
    };
  }

  const actions: Partial<Record<PipelineErrorCode, string>> = {
    PDF_LOAD_FAILED: "Verifica que el archivo sea un PDF válido y legible.",
    TEXT_EXTRACTION_FAILED:
      "La página no pudo leerse mediante su capa de texto.",
    OCR_FAILED:
      "El reconocimiento local falló; puedes reintentar o desactivar OCR.",
    SAVE_FAILED:
      "El original no fue modificado. Revisa el acceso a la carpeta del proyecto.",
    CLEANUP_FAILED: "Cierra y vuelve a abrir el documento antes de reintentar.",
    UNKNOWN: "Vuelve a intentarlo; el original no fue modificado.",
  };
  return {
    code: fallbackCode,
    recoverable: fallbackCode !== "PDF_LOAD_FAILED",
    action: actions[fallbackCode] ?? actions.UNKNOWN!,
  };
}

export function errorDetail(caught: unknown): string {
  if (caught instanceof PipelineError) return caught.detail || caught.message;
  if (caught instanceof Error) return caught.message;
  if (typeof caught === "string") return caught;
  try {
    return JSON.stringify(caught);
  } catch {
    return String(caught);
  }
}

export function userFacingPipelineError(caught: unknown): string {
  if (!(caught instanceof PipelineError)) return errorDetail(caught);
  const diagnostic = caught.detail.trim();
  return diagnostic && !caught.message.includes(diagnostic)
    ? `${caught.message} Detalle: ${diagnostic}`
    : caught.message;
}
