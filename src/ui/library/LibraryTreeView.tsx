import { useEffect, useMemo, useRef } from "react";
import {
  backgroundJobForDocument,
  type BackgroundProcessingJobs,
} from "../../application/pipeline/backgroundDocumentProcessing";
import { presentPairState } from "../../domain/pairState";
import type { LibrarySort } from "../../domain/settings";
import {
  buildLibraryTree,
  flattenVisibleNodes,
  type LibraryFolderNode,
  type LibraryNode,
} from "./libraryTree";
import type { ProjectSnapshot } from "../../domain/project";
import type { PairState } from "../../domain/project";
import { JanoIcon, type JanoIconName } from "../icons/JanoIcon";

const pairStateIcons: Record<PairState, JanoIconName> = {
  paired: "par-completo",
  "missing-original": "falta-original",
  "missing-translation": "falta-traduccion",
  unavailable: "ruta-perdida",
  "manually-linked": "vinculo-manual",
  conflict: "conflicto-pareja",
};

type LibraryTreeProps = {
  activeFolderPath: string;
  expandedPaths: ReadonlySet<string>;
  locateRequest: number;
  onActiveFolderChange(path: string): void;
  onFolderExpandedChange(path: string, expanded: boolean): void;
  onSelectDocument(documentId: string): void;
  processingJobs: BackgroundProcessingJobs;
  selectedDocumentId: string | null;
  snapshot: ProjectSnapshot;
  sort: LibrarySort;
};

export function LibraryTree({
  activeFolderPath,
  expandedPaths,
  locateRequest,
  onActiveFolderChange,
  onFolderExpandedChange,
  onSelectDocument,
  processingJobs,
  selectedDocumentId,
  snapshot,
  sort,
}: LibraryTreeProps) {
  const nodes = useMemo(
    () => buildLibraryTree(snapshot, sort),
    [snapshot, sort],
  );
  const visibleNodes = useMemo(
    () => flattenVisibleNodes(nodes, expandedPaths),
    [expandedPaths, nodes],
  );
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!locateRequest || !selectedDocumentId) return;
    const frame = window.requestAnimationFrame(() => {
      const row = rowRefs.current.get(`document:${selectedDocumentId}`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedPaths, locateRequest, selectedDocumentId]);

  function focusNode(key: string | undefined) {
    if (key) rowRefs.current.get(key)?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent, node: LibraryNode) {
    const index = visibleNodes.findIndex((item) => item.key === node.key);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusNode(visibleNodes[index + 1]?.key);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusNode(visibleNodes[index - 1]?.key);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusNode(visibleNodes[0]?.key);
    } else if (event.key === "End") {
      event.preventDefault();
      focusNode(visibleNodes.at(-1)?.key);
    } else if (event.key === "ArrowRight" && node.kind === "folder") {
      event.preventDefault();
      if (!expandedPaths.has(node.path)) {
        onFolderExpandedChange(node.path, true);
      } else {
        focusNode(node.children[0]?.key);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (node.kind === "folder" && expandedPaths.has(node.path)) {
        onFolderExpandedChange(node.path, false);
      } else if (node.parentPath) {
        focusNode(`folder:${node.parentPath}`);
      }
    }
  }

  function activateNode(node: LibraryNode) {
    if (node.kind === "folder") {
      onActiveFolderChange(node.path);
      onFolderExpandedChange(node.path, !expandedPaths.has(node.path));
    } else {
      onActiveFolderChange(node.parentPath);
      onSelectDocument(node.document.documentId);
    }
  }

  function renderNodes(items: LibraryNode[], depth: number): React.ReactNode {
    return items.map((node) => {
      if (node.kind === "folder") {
        const expanded = expandedPaths.has(node.path);
        return (
          <div className="library-branch" key={node.key}>
            <FolderRow
              active={activeFolderPath === node.path}
              depth={depth}
              expanded={expanded}
              node={node}
              onActivate={() => activateNode(node)}
              onKeyDown={(event) => handleKeyDown(event, node)}
              setRef={(element) => setRowRef(node.key, element)}
            />
            {expanded ? (
              <div className="library-group" role="group">
                {renderNodes(node.children, depth + 1)}
              </div>
            ) : null}
          </div>
        );
      }

      const processingJob = backgroundJobForDocument(
        processingJobs,
        snapshot.project.projectId,
        node.document.documentId,
      );
      const state = presentPairState(node.document.pairState);
      const indicator = processingJob
        ? processingJob.phase === "running"
          ? {
              className: "processing",
              icon: "traduccion-en-proceso" as const,
              label: processingJob.progress?.message ?? "Procesando traducción",
            }
          : {
              className: "processing-failed",
              icon: "error" as const,
              label: processingJob.error ?? "La traducción no pudo completarse",
            }
        : {
            className: node.document.pairState,
            icon: pairStateIcons[node.document.pairState],
            label: state.label,
          };
      const selected = node.document.documentId === selectedDocumentId;
      return (
        <button
          aria-current={selected ? "page" : undefined}
          aria-label={`${node.document.title}. ${indicator.label}`}
          className={`library-document-row ${selected ? "selected" : ""}`}
          data-document-id={node.document.documentId}
          key={node.key}
          onClick={() => activateNode(node)}
          onKeyDown={(event) => handleKeyDown(event, node)}
          ref={(element) => setRowRef(node.key, element)}
          role="treeitem"
          style={{ "--tree-depth": depth } as React.CSSProperties}
          title={`${node.document.title} · ${indicator.label}`}
          type="button"
        >
          <span className="library-file-icon" aria-hidden="true">
            <JanoIcon name="pagina" size={14} />
          </span>
          <span className="library-row-name">{node.document.title}</span>
          <span
            className={`library-state state-${indicator.className}`}
            title={indicator.label}
          >
            <JanoIcon name={indicator.icon} size={14} />
            <span className="sr-only">{indicator.label}</span>
          </span>
        </button>
      );
    });
  }

  function setRowRef(key: string, element: HTMLButtonElement | null) {
    if (element) rowRefs.current.set(key, element);
    else rowRefs.current.delete(key);
  }

  return (
    <div
      aria-label="Documentos del proyecto"
      className="library-tree"
      role="tree"
    >
      {renderNodes(nodes, 0)}
    </div>
  );
}

function FolderRow({
  active,
  depth,
  expanded,
  node,
  onActivate,
  onKeyDown,
  setRef,
}: {
  active: boolean;
  depth: number;
  expanded: boolean;
  node: LibraryFolderNode;
  onActivate(): void;
  onKeyDown(event: React.KeyboardEvent): void;
  setRef(element: HTMLButtonElement | null): void;
}) {
  return (
    <button
      aria-expanded={expanded}
      className={`library-folder-row ${active ? "active" : ""}`}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      ref={setRef}
      role="treeitem"
      style={{ "--tree-depth": depth } as React.CSSProperties}
      title={node.path}
      type="button"
    >
      <span className="library-chevron" aria-hidden="true">
        <JanoIcon
          name={expanded ? "contraer-carpeta" : "expandir-carpeta"}
          size={12}
        />
      </span>
      <span className="library-folder-icon" aria-hidden="true">
        <JanoIcon name="carpeta" size={14} />
      </span>
      <span className="library-row-name">{node.name}</span>
    </button>
  );
}
