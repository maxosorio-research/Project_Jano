import type { ReaderSide } from "../../application/reader/semanticScroll";
import type { PdfReaderViewState } from "./PdfReader";
import { JanoIcon, type JanoIconName } from "../icons/JanoIcon";

export type ScrollMode = "synchronized" | "independent";
export type PanelRatio = "50-50" | "70-30" | "30-70" | "100-0" | "0-100";

const RATIOS: Array<{
  value: PanelRatio;
  label: string;
  icon: JanoIconName;
}> = [
  { value: "50-50", label: "50/50", icon: "proporcion-igual" },
  { value: "70-30", label: "70/30", icon: "proporcion-original" },
  { value: "30-70", label: "30/70", icon: "proporcion-traduccion" },
  { value: "100-0", label: "100/0", icon: "solo-original" },
  { value: "0-100", label: "0/100", icon: "solo-traduccion" },
];

export function ReadingToolbar({
  active,
  locks,
  mode,
  onNextPage,
  onPreviousPage,
  onRatioChange,
  onRealign,
  onToggleLibrary,
  onToggleLock,
  onToggleMode,
  onZoomIn,
  onZoomOut,
  ratio,
  syncAvailable,
  viewState,
}: {
  active: boolean;
  locks: Record<ReaderSide, boolean>;
  mode: ScrollMode;
  onNextPage(): void;
  onPreviousPage(): void;
  onRatioChange(ratio: PanelRatio): void;
  onRealign(): void;
  onToggleLibrary(): void;
  onToggleLock(side: ReaderSide): void;
  onToggleMode(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  ratio: PanelRatio;
  syncAvailable: boolean;
  viewState: PdfReaderViewState;
}) {
  const synchronized = mode === "synchronized";
  const syncLabel = syncAvailable
    ? synchronized
      ? "Sincronización activa"
      : "Desplazamiento asincrónico"
    : "Sin alineación disponible";

  return (
    <nav aria-label="Herramientas de lectura" className="reading-toolbar">
      <button
        aria-label="Mostrar u ocultar biblioteca"
        className="reading-tool icon-only"
        onClick={onToggleLibrary}
        title="Biblioteca"
        type="button"
      >
        <JanoIcon name="biblioteca" size={17} />
      </button>

      <span className="reading-toolbar-divider" />

      <div className="reading-tool-group page-tools">
        <button
          aria-label="Página anterior"
          className="reading-tool icon-only"
          disabled={!active || locks.source || viewState.pageNumber <= 1}
          onClick={onPreviousPage}
          title="Página anterior"
          type="button"
        >
          <JanoIcon name="pagina-anterior" size={16} />
        </button>
        <span className="reading-value" aria-live="polite">
          {viewState.pageNumber} / {viewState.pageCount || "—"}
        </span>
        <button
          aria-label="Página siguiente"
          className="reading-tool icon-only"
          disabled={
            !active ||
            locks.source ||
            viewState.pageNumber >= viewState.pageCount
          }
          onClick={onNextPage}
          title="Página siguiente"
          type="button"
        >
          <JanoIcon name="pagina-siguiente" size={16} />
        </button>
      </div>

      <span className="reading-toolbar-divider" />

      <div className="reading-tool-group sync-tools">
        <button
          aria-pressed={synchronized}
          className={`reading-tool sync-mode ${synchronized && syncAvailable ? "active" : ""}`}
          disabled={!active || !syncAvailable}
          onClick={onToggleMode}
          title="Alternar desplazamiento sincronizado o asincrónico"
          type="button"
        >
          <JanoIcon name="sync-scroll" size={16} />
          <span>{syncLabel}</span>
        </button>
        <button
          aria-label="Realinear visores"
          className="reading-tool icon-only"
          disabled={!active || !syncAvailable || !synchronized}
          onClick={onRealign}
          title="Realinear visores"
          type="button"
        >
          <JanoIcon name="realinear" size={16} />
        </button>
        <span
          aria-label="La sincronización usa segmentos, no números de página"
          className="reading-info"
          role="img"
          title="La sincronización sigue pasajes alineados. Los bloqueos de panel son independientes de este modo."
        >
          <JanoIcon name="informacion" size={15} />
        </span>
      </div>

      <span className="reading-toolbar-divider" />

      <div
        aria-label="Bloqueos de panel"
        className="reading-tool-group lock-tools"
      >
        <button
          aria-pressed={locks.source}
          className={`reading-tool panel-lock ${locks.source ? "active" : ""}`}
          disabled={!active}
          onClick={() => onToggleLock("source")}
          title="Bloquear o desbloquear el desplazamiento del original"
          type="button"
        >
          <JanoIcon
            name={locks.source ? "bloquear-panel" : "desbloquear-panel"}
            size={15}
          />
          <span>Original</span>
        </button>
        <button
          aria-pressed={locks.translation}
          className={`reading-tool panel-lock ${locks.translation ? "active" : ""}`}
          disabled={!active}
          onClick={() => onToggleLock("translation")}
          title="Bloquear o desbloquear el desplazamiento de la traducción"
          type="button"
        >
          <JanoIcon
            name={locks.translation ? "bloquear-panel" : "desbloquear-panel"}
            size={15}
          />
          <span>Traducción</span>
        </button>
      </div>

      <span className="reading-toolbar-divider" />

      <div className="reading-tool-group zoom-tools">
        <button
          aria-label="Alejar original"
          className="reading-tool icon-only"
          disabled={!active || locks.source || viewState.scale <= 0.5}
          onClick={onZoomOut}
          title="Alejar original"
          type="button"
        >
          <JanoIcon name="zoom-menos" size={16} />
        </button>
        <span className="reading-value">
          {Math.round(viewState.scale * 100)}%
        </span>
        <button
          aria-label="Acercar original"
          className="reading-tool icon-only"
          disabled={!active || locks.source || viewState.scale >= 2.5}
          onClick={onZoomIn}
          title="Acercar original"
          type="button"
        >
          <JanoIcon name="zoom-mas" size={16} />
        </button>
      </div>

      <span className="reading-toolbar-divider" />

      <div aria-label="Proporción de paneles" className="ratio-tools">
        {RATIOS.map((option) => (
          <button
            aria-pressed={ratio === option.value}
            className={`ratio-button ${ratio === option.value ? "active" : ""}`}
            disabled={!active}
            key={option.value}
            onClick={() => onRatioChange(option.value)}
            type="button"
          >
            <JanoIcon name={option.icon} size={15} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <span className="reading-toolbar-divider" />

      <div
        className="reading-tool-group language-direction"
        title="Dirección de lectura"
      >
        <JanoIcon name="par-idiomas" size={15} />
        <span>EN → ES</span>
      </div>
    </nav>
  );
}
