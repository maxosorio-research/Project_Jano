import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot } from "../../domain/project";
import type { LibrarySort } from "../../domain/settings";
import { JanoIcon } from "../icons/JanoIcon";
import { LibraryTree } from "./LibraryTreeView";

type ProjectLibraryProps = {
  activeFolderPath: string;
  busy: boolean;
  expandedPaths: ReadonlySet<string>;
  locateRequest: number;
  onActiveFolderChange(path: string): void;
  onCollapseAll(): void;
  onFolderExpandedChange(path: string, expanded: boolean): void;
  onLocateCurrent(): void;
  onNewFile(): void;
  onNewFolder(): void;
  onRemove(): void;
  onSelectDocument(documentId: string): void;
  onSortChange(sort: LibrarySort): void;
  selectedDocumentId: string | null;
  snapshot: ProjectSnapshot;
  sort: LibrarySort;
};

const sortLabels: Record<LibrarySort, string> = {
  "name-asc": "Nombre A–Z",
  "name-desc": "Nombre Z–A",
  "modified-desc": "Modificados recientemente",
  "modified-asc": "Modificados antiguamente",
};

export function ProjectLibrary({
  activeFolderPath,
  busy,
  expandedPaths,
  locateRequest,
  onActiveFolderChange,
  onCollapseAll,
  onFolderExpandedChange,
  onLocateCurrent,
  onNewFile,
  onNewFolder,
  onRemove,
  onSelectDocument,
  onSortChange,
  selectedDocumentId,
  snapshot,
  sort,
}: ProjectLibraryProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    function closeMenu(event: MouseEvent) {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
    }
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, [sortOpen]);

  const empty =
    snapshot.documents.length === 0 && snapshot.folders.length === 0;

  return (
    <>
      <div className="library-heading">
        <div className="library-title-row">
          <h2>Biblioteca</h2>
          <span className="document-count">{snapshot.documents.length}</span>
        </div>
        <div className="library-toolbar" aria-label="Acciones de la biblioteca">
          <ToolbarButton
            disabled={busy}
            icon="file"
            label="Nuevo archivo (Ctrl+N)"
            onClick={onNewFile}
          />
          <ToolbarButton
            disabled={busy}
            icon="folder"
            label="Nueva carpeta (Ctrl+Shift+N)"
            onClick={onNewFolder}
          />
          <div className="library-sort" ref={sortMenuRef}>
            <ToolbarButton
              icon="sort"
              label={`Cambiar orden · ${sortLabels[sort]}`}
              onClick={() => setSortOpen((current) => !current)}
              pressed={sortOpen}
            />
            {sortOpen ? (
              <div className="library-sort-menu" role="menu">
                {(Object.keys(sortLabels) as LibrarySort[]).map((option) => (
                  <button
                    className={option === sort ? "selected" : ""}
                    key={option}
                    onClick={() => {
                      onSortChange(option);
                      setSortOpen(false);
                    }}
                    role="menuitemradio"
                    aria-checked={option === sort}
                    type="button"
                  >
                    <span aria-hidden="true">
                      {option === sort ? (
                        <JanoIcon name="seleccionado" size={14} />
                      ) : null}
                    </span>
                    {sortLabels[option]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <ToolbarButton
            disabled={!selectedDocumentId}
            icon="locate"
            label="Mostrar el archivo actual"
            onClick={onLocateCurrent}
          />
          <ToolbarButton
            disabled={expandedPaths.size === 0}
            icon="collapse"
            label="Colapsar todo"
            onClick={onCollapseAll}
          />
        </div>
      </div>

      <div className="project-panel-content">
        {empty ? (
          <div className="empty-library">
            <p>No hay documentos ni carpetas.</p>
            <span>Importa un PDF o crea una carpeta para comenzar.</span>
          </div>
        ) : (
          <LibraryTree
            activeFolderPath={activeFolderPath}
            expandedPaths={expandedPaths}
            locateRequest={locateRequest}
            onActiveFolderChange={onActiveFolderChange}
            onFolderExpandedChange={onFolderExpandedChange}
            onSelectDocument={onSelectDocument}
            selectedDocumentId={selectedDocumentId}
            snapshot={snapshot}
            sort={sort}
          />
        )}
        {selectedDocumentId ? (
          <div className="sidebar-actions">
            <button
              className="danger-quiet-button button-with-icon"
              onClick={onRemove}
            >
              <JanoIcon name="quitar-de-jano" size={16} />
              <span>Quitar o eliminar…</span>
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function ToolbarButton({
  disabled,
  icon,
  label,
  onClick,
  pressed,
}: {
  disabled?: boolean;
  icon: "file" | "folder" | "sort" | "locate" | "collapse";
  label: string;
  onClick(): void;
  pressed?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className="library-tool-button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <ToolbarIcon name={icon} />
    </button>
  );
}

function ToolbarIcon({
  name,
}: {
  name: "file" | "folder" | "sort" | "locate" | "collapse";
}) {
  if (name === "file") {
    return <JanoIcon name="importar" size={17} />;
  }
  if (name === "folder") {
    return <JanoIcon name="nueva-carpeta" size={17} />;
  }
  if (name === "sort") {
    return <JanoIcon name="ordenar" size={17} />;
  }
  if (name === "locate") {
    return <JanoIcon name="localizar-documento" size={17} />;
  }
  return <JanoIcon name="colapsar-todo" size={17} />;
}
