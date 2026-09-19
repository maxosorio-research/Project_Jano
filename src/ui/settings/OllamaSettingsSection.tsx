import { useEffect, useState } from "react";
import type { LocalTranslationRuntime } from "../../application/ports/LocalTranslationRuntime";
import type { OllamaSmokeTestResult, OllamaStatus } from "../../domain/ollama";
import type { AppSettings } from "../../domain/settings";

type OllamaSettingsSectionProps = {
  runtime: LocalTranslationRuntime;
  settings: AppSettings;
  onChange(settings: AppSettings): void;
};

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatSize(bytes: number): string {
  if (bytes < 1_000_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

export function OllamaSettingsSection({
  runtime,
  settings,
  onChange,
}: OllamaSettingsSectionProps) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [testResult, setTestResult] = useState<OllamaSmokeTestResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(true);
  const [testing, setTesting] = useState(false);

  async function inspect() {
    setInspecting(true);
    setError(null);
    try {
      setStatus(await runtime.inspect());
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setInspecting(false);
    }
  }

  useEffect(() => {
    let active = true;
    void runtime
      .inspect()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus);
      })
      .catch((caught: unknown) => {
        if (active) setError(messageFrom(caught));
      })
      .finally(() => {
        if (active) setInspecting(false);
      });
    return () => {
      active = false;
    };
  }, [runtime]);

  const selectedModel = status?.models.some(
    (model) => model.name === settings.ollamaModel,
  )
    ? settings.ollamaModel
    : (status?.models[0]?.name ?? "");

  async function runTest() {
    if (!selectedModel) return;
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      setTestResult(
        await runtime.runSmokeTest(selectedModel, settings.targetLanguage),
      );
      if (settings.ollamaModel !== selectedModel) {
        onChange({ ...settings, ollamaModel: selectedModel });
      }
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="settings-section">
      <div className="section-heading-row">
        <h3>Ollama local</h3>
        <span
          className={`runtime-badge ${status?.available ? "available" : ""}`}
        >
          {inspecting
            ? "Comprobando"
            : status?.available
              ? "Detectado"
              : "No disponible"}
        </span>
      </div>
      <p className="settings-note">
        Runtime local usado por el pipeline de documentos. La prueba reproduce
        una muestra breve antes de procesar un PDF completo.
      </p>
      {status?.available ? (
        <>
          <dl className="settings-facts">
            <div>
              <dt>Runtime</dt>
              <dd>Ollama {status.version}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{status.endpoint}</dd>
            </div>
          </dl>
          {status.models.length ? (
            <>
              <label htmlFor="ollama-model">Modelo instalado</label>
              <select
                id="ollama-model"
                onChange={(event) =>
                  onChange({ ...settings, ollamaModel: event.target.value })
                }
                value={selectedModel}
              >
                {status.models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                    {model.name === "translategemma:4b"
                      ? " · recomendado"
                      : ""}{" "}
                    · {model.parameterSize ?? "tamaño desconocido"} ·{" "}
                    {formatSize(model.size)}
                  </option>
                ))}
              </select>
              <button
                className="primary-button"
                disabled={testing}
                onClick={() => void runTest()}
              >
                {testing
                  ? "Traduciendo muestra…"
                  : "Ejecutar prueba EN → idioma de lectura"}
              </button>
            </>
          ) : (
            <p className="warning-copy">
              Ollama está activo, pero no hay modelos instalados.
            </p>
          )}
        </>
      ) : (
        <p className="warning-copy">
          {status?.error ?? error ?? "No se pudo conectar con Ollama."}
        </p>
      )}
      <button
        className="secondary-button"
        disabled={inspecting || testing}
        onClick={() => void inspect()}
      >
        Volver a detectar
      </button>
      {error ? (
        <p className="error-message compact-error" role="alert">
          {error}
        </p>
      ) : null}
      {testResult ? (
        <div className="smoke-test-result">
          <div className="smoke-test-meta">
            <strong>Resultado experimental</strong>
            <span>{(testResult.elapsedMs / 1000).toFixed(1)} s</span>
          </div>
          <p>
            <b>Original:</b> {testResult.sourceText}
          </p>
          <p>
            <b>Salida:</b> {testResult.translatedText}
          </p>
          <small>
            {testResult.model} · {testResult.promptTokenCount ?? "?"} tokens de
            entrada · {testResult.outputTokenCount ?? "?"} de salida
          </small>
        </div>
      ) : null}
    </section>
  );
}
