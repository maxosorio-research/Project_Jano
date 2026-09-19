import { open } from "@tauri-apps/plugin-dialog";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { AppShellModel } from "../application/createAppShellModel";
import {
  backgroundJobForDocument,
  backgroundProcessingKey,
  backgroundProcessingReducer,
} from "../application/pipeline/backgroundDocumentProcessing";
import { userFacingPipelineError } from "../application/pipeline/pipelineError";
import { processPdfDocument } from "../application/pipeline/processPdfDocument";
import type { PdfDocumentAdapter } from "../application/ports/PdfDocumentAdapter";
import type { LocalTranslationRuntime } from "../application/ports/LocalTranslationRuntime";
import type { OcrEngine } from "../application/ports/OcrEngine";
import type {
  DocumentRemovalAction,
  ProjectGateway,
} from "../application/ports/ProjectGateway";
import type { SettingsRepository } from "../application/ports/SettingsRepository";
import type { SourceFileGateway } from "../application/ports/SourceFileGateway";
import {
  followerScrollTop,
  mapSemanticPosition,
  type ReaderSide,
  type ReaderSurfaceHandle,
} from "../application/reader/semanticScroll";
import {
  projectedSegmentIds,
  type SemanticSelection,
} from "../application/reader/selectionProjection";
import type { ReaderDocument } from "../domain/processing";
import type { DiscoveredProject, ProjectSnapshot } from "../domain/project";
import type { AppSettings } from "../domain/settings";
import { JanoIcon } from "./icons/JanoIcon";
import { ProjectLibrary } from "./library/ProjectLibrary";
import { documentFolder, folderAncestors } from "./library/libraryTree";
import {
  PdfReader,
  type PdfReaderHandle,
  type PdfReaderViewState,
} from "./reader/PdfReader";
import { DocumentTranslationPanel } from "./reader/DocumentTranslationPanel";
import {
  ReadingToolbar,
  type PanelRatio,
  type ScrollMode,
} from "./reader/ReadingToolbar";
import { OllamaSettingsSection } from "./settings/OllamaSettingsSection";

type AppProps = {
  localTranslationRuntime: LocalTranslationRuntime;
  ocrEngine: OcrEngine;
  model: AppShellModel;
  pdfDocumentAdapter: PdfDocumentAdapter;
  projectGateway: ProjectGateway;
  settingsRepository: SettingsRepository;
  sourceFileGateway: SourceFileGateway;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fileName(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

function parentDirectory(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  const separator = normalized.lastIndexOf("/");
  return separator > 2 ? normalized.slice(0, separator) : normalized;
}

export function App({
  localTranslationRuntime,
  ocrEngine,
  model,
  pdfDocumentAdapter,
  projectGateway,
  settingsRepository,
  sourceFileGateway,
}: AppProps) {
  const [projectName, setProjectName] = useState("");
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => settingsRepository.load().sidebarOpenByDefault,
  );
  const [settings, setSettings] = useState<AppSettings>(() =>
    settingsRepository.load(),
  );
  const [existingProjects, setExistingProjects] = useState<DiscoveredProject[]>(
    [],
  );
  const [discoveringProjects, setDiscoveringProjects] = useState(false);
  const [discoveryRevision, setDiscoveryRevision] = useState(0);
  const [dialog, setDialog] = useState<
    "settings" | "folder" | "file" | "remove" | null
  >(null);
  const [folderPath, setFolderPath] = useState("");
  const [activeFolderPath, setActiveFolderPath] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [locateRequest, setLocateRequest] = useState(0);
  const [importOriginalPath, setImportOriginalPath] = useState("");
  const [importTranslationPath, setImportTranslationPath] = useState("");
  const [importFolderPath, setImportFolderPath] = useState("");
  const [loadedReaderDocument, setLoadedReaderDocument] = useState<{
    documentId: string;
    value: ReaderDocument | null;
  } | null>(null);
  const [backgroundJobs, dispatchBackgroundJob] = useReducer(
    backgroundProcessingReducer,
    {},
  );
  const [scrollMode, setScrollMode] = useState<ScrollMode>("synchronized");
  const [panelRatio, setPanelRatio] = useState<PanelRatio>("50-50");
  const [panelLocks, setPanelLocks] = useState<Record<ReaderSide, boolean>>({
    source: false,
    translation: false,
  });
  const [semanticSelection, setSemanticSelection] = useState<
    (SemanticSelection & { documentId: string }) | null
  >(null);
  const [pdfViewState, setPdfViewState] = useState<PdfReaderViewState>({
    pageNumber: 1,
    pageCount: 0,
    scale: settings.defaultZoom,
  });
  const projectNameRef = useRef<HTMLInputElement>(null);
  const sourceReaderRef = useRef<PdfReaderHandle>(null);
  const translationReaderRef = useRef<ReaderSurfaceHandle>(null);
  const lastLeaderRef = useRef<ReaderSide>("source");
  const suppressedScrollRef = useRef<{
    side: ReaderSide;
    until: number;
  } | null>(null);
  const activeProcessingPromisesRef = useRef(new Map<string, Promise<void>>());

  const selectedDocument = useMemo(
    () =>
      snapshot?.documents.find(
        (document) => document.documentId === selectedId,
      ) ??
      snapshot?.documents[0] ??
      null,
    [selectedId, snapshot],
  );
  const activeDocumentId = selectedDocument?.documentId ?? null;
  const activeTranslationHash = selectedDocument?.translation?.sha256 ?? null;
  const activeProjectRoot = snapshot?.project.root ?? null;
  const selectedProcessingJob = backgroundJobForDocument(
    backgroundJobs,
    snapshot?.project.projectId,
    selectedDocument?.documentId,
  );
  const readerDocument =
    loadedReaderDocument?.documentId === activeDocumentId
      ? loadedReaderDocument.value
      : null;
  const activeSemanticSelection =
    semanticSelection?.documentId === activeDocumentId
      ? semanticSelection
      : null;
  const projectedSourceSegmentIds = projectedSegmentIds(
    readerDocument?.alignments ?? [],
    activeSemanticSelection,
    "source",
  );
  const projectedTranslationSegmentIds = projectedSegmentIds(
    readerDocument?.alignments ?? [],
    activeSemanticSelection,
    "translation",
  );
  const originalPanel = model.panels.find((panel) => panel.id === "original");
  const translationPanel = model.panels.find(
    (panel) => panel.id === "translation",
  );
  const projectDiscoveryLocations = useMemo(
    () =>
      [
        ...settings.projectLocations,
        ...settings.recentProjects.map((item) => item.root),
      ].filter(
        (value, index, values) =>
          values.findIndex(
            (candidate) => candidate.toLowerCase() === value.toLowerCase(),
          ) === index,
      ),
    [settings.projectLocations, settings.recentProjects],
  );
  const otherExistingProjects = useMemo(() => {
    const recentIds = new Set(
      settings.recentProjects.map((project) => project.projectId),
    );
    return existingProjects.filter(
      (project) => !recentIds.has(project.projectId),
    );
  }, [existingProjects, settings.recentProjects]);

  useEffect(() => {
    let active = true;
    if (!activeProjectRoot || !activeDocumentId) {
      return () => {
        active = false;
      };
    }
    void sourceFileGateway
      .readReaderDocument(activeProjectRoot, activeDocumentId)
      .then((document) => {
        if (active) {
          setLoadedReaderDocument({
            documentId: activeDocumentId,
            value: document,
          });
        }
      })
      .catch(() => {
        if (active) {
          setLoadedReaderDocument({
            documentId: activeDocumentId,
            value: null,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [
    activeDocumentId,
    activeProjectRoot,
    activeTranslationHash,
    sourceFileGateway,
  ]);

  useEffect(() => {
    let active = true;
    if (!projectDiscoveryLocations.length) {
      return () => {
        active = false;
      };
    }
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setDiscoveringProjects(true);
      void projectGateway
        .discoverProjects(projectDiscoveryLocations)
        .then((projects) => {
          if (active) setExistingProjects(projects);
        })
        .catch(() => {
          if (active) setExistingProjects([]);
        })
        .finally(() => {
          if (active) setDiscoveringProjects(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [discoveryRevision, projectDiscoveryLocations, projectGateway]);

  async function run(
    action: () => Promise<ProjectSnapshot>,
  ): Promise<ProjectSnapshot | null> {
    setBusy(true);
    setError(null);
    try {
      const nextSnapshot = await action();
      const projectChanged =
        snapshot?.project.projectId !== nextSnapshot.project.projectId;
      setSnapshot(nextSnapshot);
      rememberProject(nextSnapshot);
      if (projectChanged) {
        setExpandedPaths(
          new Set(nextSnapshot.folders.map((folder) => folder.relativePath)),
        );
        setActiveFolderPath("");
      }
      setSelectedId((current) =>
        nextSnapshot.documents.some((item) => item.documentId === current)
          ? current
          : (nextSnapshot.documents[0]?.documentId ?? null),
      );
      setDialog(null);
      return nextSnapshot;
    } catch (caught) {
      setError(errorMessage(caught));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function rememberProject(projectSnapshot: ProjectSnapshot) {
    setSettings((current) => {
      const project = projectSnapshot.project;
      const next = {
        ...current,
        recentProjects: [
          {
            projectId: project.projectId,
            name: project.name,
            root: project.root,
            lastOpenedAt: new Date().toISOString(),
          },
          ...current.recentProjects.filter(
            (recent) => recent.projectId !== project.projectId,
          ),
        ].slice(0, 8),
        projectLocations: [
          parentDirectory(project.root),
          ...current.projectLocations.filter(
            (location) =>
              location.toLowerCase() !==
              parentDirectory(project.root).toLowerCase(),
          ),
        ].slice(0, 24),
      };
      settingsRepository.save(next);
      return next;
    });
  }

  function forgetRecentProject(projectId: string) {
    setSettings((current) => {
      const next = {
        ...current,
        recentProjects: current.recentProjects.filter(
          (project) => project.projectId !== projectId,
        ),
      };
      settingsRepository.save(next);
      return next;
    });
  }

  async function createProject() {
    const parentPath = await open({
      directory: true,
      multiple: false,
      title: "Elige dónde crear el proyecto Jano",
    });
    if (parentPath) {
      await run(() => projectGateway.createProject(parentPath, projectName));
      setProjectName("");
    }
  }

  async function openProject() {
    const rootPath = await open({
      directory: true,
      multiple: false,
      title: "Abrir un proyecto Jano",
    });
    if (rootPath) {
      await run(() => projectGateway.openProject(rootPath));
    }
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (readerDocument?.alignments.length) {
          setScrollMode((current) =>
            current === "synchronized" ? "independent" : "synchronized",
          );
        }
      } else if (event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        realignReaders();
      } else if (!event.shiftKey && event.key === "1") {
        event.preventDefault();
        setPanelRatio("50-50");
      } else if (!event.shiftKey && event.key === "2") {
        event.preventDefault();
        setPanelRatio("70-30");
      } else if (!event.shiftKey && event.key === "3") {
        event.preventDefault();
        setPanelRatio("30-70");
      } else if (event.shiftKey && event.key === "1") {
        event.preventDefault();
        setPanelRatio("100-0");
      } else if (event.shiftKey && event.key === "2") {
        event.preventDefault();
        setPanelRatio("0-100");
      } else if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarOpen((current) => !current);
      } else if (event.key === ",") {
        event.preventDefault();
        setDialog("settings");
      } else if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openProject();
      } else if (event.key.toLowerCase() === "n" && snapshot && !dialog) {
        event.preventDefault();
        if (event.shiftKey) openFolderDialog();
        else openFileDialog();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  function returnHome() {
    setSnapshot(null);
    setSelectedId(null);
    setDialog(null);
    setError(null);
    setExpandedPaths(new Set());
    setActiveFolderPath("");
    window.setTimeout(() => projectNameRef.current?.focus(), 0);
  }

  function openFolderDialog() {
    setFolderPath("");
    setDialog("folder");
  }

  function openFileDialog() {
    setImportOriginalPath("");
    setImportTranslationPath("");
    setImportFolderPath(activeFolderPath);
    setDialog("file");
  }

  async function refreshProject() {
    if (snapshot) {
      await run(() => projectGateway.openProject(snapshot.project.root));
    }
  }

  function processDocumentInBackground() {
    if (!snapshot || !selectedDocument?.original) return;
    const projectId = snapshot.project.projectId;
    const rootPath = snapshot.project.root;
    const documentId = selectedDocument.documentId;
    const key = backgroundProcessingKey(projectId, documentId);
    if (activeProcessingPromisesRef.current.has(key)) return;

    dispatchBackgroundJob({ type: "started", projectId, documentId });
    const task = processPdfDocument({
      documentId,
      originalRelativePath: selectedDocument.original.relativePath,
      rootPath,
      settings,
      documentAdapter: pdfDocumentAdapter,
      fileGateway: sourceFileGateway,
      ocrEngine,
      projectGateway,
      translationRuntime: localTranslationRuntime,
      onProgress: (progress) =>
        dispatchBackgroundJob({
          type: "progressed",
          projectId,
          documentId,
          progress,
        }),
    })
      .then((nextSnapshot) => {
        setSnapshot((current) =>
          current?.project.projectId === projectId ? nextSnapshot : current,
        );
        dispatchBackgroundJob({ type: "finished", projectId, documentId });
      })
      .catch((caught) => {
        dispatchBackgroundJob({
          type: "failed",
          projectId,
          documentId,
          error: userFacingPipelineError(caught),
        });
      });
    activeProcessingPromisesRef.current.set(key, task);
    void task.finally(() => {
      activeProcessingPromisesRef.current.delete(key);
    });
  }

  async function createFolder() {
    if (snapshot) {
      const relativePath = [activeFolderPath, folderPath.trim()]
        .filter(Boolean)
        .join("/");
      const next = await run(() =>
        projectGateway.createMirroredFolder(
          snapshot.project.root,
          relativePath,
        ),
      );
      if (next) {
        setExpandedPaths(
          (current) => new Set([...current, ...folderAncestors(relativePath)]),
        );
        setActiveFolderPath(relativePath);
        setFolderPath("");
      }
    }
  }

  async function chooseImportFile(side: "original" | "translation") {
    const selected = await open({
      multiple: false,
      title:
        side === "original"
          ? "Seleccionar PDF original"
          : "Seleccionar archivo de traducción",
      filters: [
        side === "original"
          ? { name: "PDF", extensions: ["pdf"] }
          : {
              name: "Traducción",
              extensions: ["pdf", "md", "markdown", "txt"],
            },
      ],
    });
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (path && side === "original") setImportOriginalPath(path);
    if (path && side === "translation") setImportTranslationPath(path);
  }

  async function importDocument() {
    if (!snapshot || !importOriginalPath) return;
    const previousIds = new Set(
      snapshot.documents.map((document) => document.documentId),
    );
    const destinationFolder = importFolderPath.trim();
    const next = await run(() =>
      projectGateway.importDocument(
        snapshot.project.root,
        importOriginalPath,
        importTranslationPath || null,
        destinationFolder,
      ),
    );
    if (next) {
      setExpandedPaths(
        (current) =>
          new Set([...current, ...folderAncestors(destinationFolder)]),
      );
      setActiveFolderPath(destinationFolder);
      const imported = next.documents.find(
        (document) => !previousIds.has(document.documentId),
      );
      if (imported) setSelectedId(imported.documentId);
    }
  }

  function setFolderExpanded(path: string, expanded: boolean) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (expanded) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  function locateCurrentDocument() {
    if (!selectedDocument) return;
    const folder = documentFolder(selectedDocument);
    setExpandedPaths(
      (current) => new Set([...current, ...folderAncestors(folder)]),
    );
    setLocateRequest((current) => current + 1);
  }

  async function removeDocument(action: DocumentRemovalAction) {
    if (snapshot && selectedDocument) {
      await run(() =>
        projectGateway.removeDocument(
          snapshot.project.root,
          selectedDocument.documentId,
          action,
        ),
      );
    }
  }

  function updateSettings(next: AppSettings) {
    const previousSidebarDefault = settings.sidebarOpenByDefault;
    settingsRepository.save(next);
    setSettings(next);
    if (previousSidebarDefault !== next.sidebarOpenByDefault) {
      setSidebarOpen(next.sidebarOpenByDefault);
    }
  }

  const synchronizeFrom = useCallback(
    (leaderSide: ReaderSide, behavior: ScrollBehavior = "auto") => {
      if (scrollMode !== "synchronized" || !readerDocument) return;
      const followerSide: ReaderSide =
        leaderSide === "source" ? "translation" : "source";
      const sourceVisible = panelRatio !== "0-100";
      const translationVisible = panelRatio !== "100-0";
      if (
        (leaderSide === "source" && !sourceVisible) ||
        (leaderSide === "translation" && !translationVisible) ||
        (followerSide === "source" && !sourceVisible) ||
        (followerSide === "translation" && !translationVisible)
      ) {
        return;
      }
      if (panelLocks[leaderSide] || panelLocks[followerSide]) return;

      const leader =
        leaderSide === "source"
          ? sourceReaderRef.current
          : translationReaderRef.current;
      const follower =
        followerSide === "source"
          ? sourceReaderRef.current
          : translationReaderRef.current;
      const leaderSnapshot = leader?.snapshot();
      const followerSnapshot = follower?.snapshot();
      if (!leaderSnapshot || !followerSnapshot) return;

      const focusRatio = 0.35;
      const leaderPosition =
        leaderSnapshot.scrollTop + leaderSnapshot.viewportHeight * focusRatio;
      const mappedPosition = mapSemanticPosition(
        readerDocument.alignments,
        leaderSnapshot.segments,
        followerSnapshot.segments,
        leaderPosition,
        leaderSide,
      );
      if (mappedPosition === null) return;
      const nextScrollTop = followerScrollTop(
        mappedPosition,
        followerSnapshot,
        focusRatio,
      );
      if (
        behavior === "auto" &&
        Math.abs(nextScrollTop - followerSnapshot.scrollTop) < 18
      ) {
        return;
      }
      suppressedScrollRef.current = {
        side: followerSide,
        until: performance.now() + (behavior === "smooth" ? 700 : 160),
      };
      follower?.scrollTo(nextScrollTop, behavior);
    },
    [panelLocks, panelRatio, readerDocument, scrollMode],
  );

  const handleReaderIntent = useCallback((side: ReaderSide) => {
    suppressedScrollRef.current = null;
    lastLeaderRef.current = side;
  }, []);

  const handleReaderScroll = useCallback(
    (side: ReaderSide) => {
      const suppressed = suppressedScrollRef.current;
      if (suppressed?.side === side && performance.now() < suppressed.until) {
        return;
      }
      if (suppressed?.side === side) suppressedScrollRef.current = null;
      lastLeaderRef.current = side;
      synchronizeFrom(side);
    },
    [synchronizeFrom],
  );

  const handleSourceIntent = useCallback(
    () => handleReaderIntent("source"),
    [handleReaderIntent],
  );
  const handleTranslationIntent = useCallback(
    () => handleReaderIntent("translation"),
    [handleReaderIntent],
  );
  const handleSourceScroll = useCallback(
    () => handleReaderScroll("source"),
    [handleReaderScroll],
  );
  const handleTranslationScroll = useCallback(
    () => handleReaderScroll("translation"),
    [handleReaderScroll],
  );
  const handleReaderSelection = useCallback(
    (side: ReaderSide, segmentIds: string[]) => {
      setSemanticSelection(
        activeDocumentId && segmentIds.length
          ? { documentId: activeDocumentId, side, segmentIds }
          : null,
      );
    },
    [activeDocumentId],
  );
  const handleSourceSelection = useCallback(
    (segmentIds: string[]) => handleReaderSelection("source", segmentIds),
    [handleReaderSelection],
  );
  const handleTranslationSelection = useCallback(
    (segmentIds: string[]) => handleReaderSelection("translation", segmentIds),
    [handleReaderSelection],
  );

  const realignReaders = useCallback(() => {
    let leader = lastLeaderRef.current;
    if (panelLocks[leader]) {
      leader = leader === "source" ? "translation" : "source";
    }
    synchronizeFrom(leader, "smooth");
  }, [panelLocks, synchronizeFrom]);

  function togglePanelLock(side: ReaderSide) {
    setPanelLocks((current) => ({ ...current, [side]: !current[side] }));
  }

  const syncAvailable = Boolean(readerDocument?.alignments.length);
  const readerActive = Boolean(snapshot && selectedDocument);

  return (
    <main className={`app-shell ${readerActive ? "reader-active" : ""}`}>
      <header className="topbar">
        <div className="topbar-navigation">
          <button
            aria-label={
              sidebarOpen ? "Ocultar biblioteca" : "Mostrar biblioteca"
            }
            className="icon-button"
            onClick={() => setSidebarOpen((current) => !current)}
            title="Mostrar u ocultar biblioteca (Ctrl+B)"
          >
            <JanoIcon name="sidebar" size={18} />
          </button>
          <button
            className="toolbar-button button-with-icon"
            onClick={returnHome}
          >
            <JanoIcon name="inicio" size={16} />
            <span>Inicio</span>
          </button>
          <button
            className="toolbar-button button-with-icon"
            onClick={returnHome}
          >
            <JanoIcon name="nuevo-proyecto" size={16} />
            <span>Nuevo proyecto</span>
          </button>
          <button
            className="toolbar-button button-with-icon"
            disabled={busy}
            onClick={() => void openProject()}
          >
            <JanoIcon name="abrir-proyecto" size={16} />
            <span>Abrir</span>
          </button>
        </div>

        <div className="window-title">
          <strong>{model.appName}</strong>
          <span>{snapshot ? snapshot.project.name : "Biblioteca local"}</span>
        </div>

        <div className="topbar-actions">
          {snapshot ? (
            <button
              aria-label="Actualizar archivos"
              className="icon-button"
              disabled={busy}
              onClick={() => void refreshProject()}
              title="Actualizar archivos"
            >
              <JanoIcon name="actualizar" size={17} />
            </button>
          ) : null}
          <button
            aria-label="Ajustes"
            className="icon-button"
            onClick={() => setDialog("settings")}
            title="Ajustes (Ctrl+,)"
          >
            <JanoIcon name="ajustes" size={18} />
          </button>
        </div>
      </header>

      <section
        className={`workspace ratio-${panelRatio} ${sidebarOpen ? "" : "sidebar-collapsed"}`}
        aria-label="Espacio de trabajo de Jano"
      >
        {sidebarOpen ? (
          <aside
            className={`panel panel-project ${snapshot ? "has-library" : "project-home"}`}
          >
            {snapshot ? (
              <ProjectLibrary
                activeFolderPath={activeFolderPath}
                busy={busy}
                expandedPaths={expandedPaths}
                locateRequest={locateRequest}
                onActiveFolderChange={setActiveFolderPath}
                onCollapseAll={() => setExpandedPaths(new Set())}
                onFolderExpandedChange={setFolderExpanded}
                onLocateCurrent={locateCurrentDocument}
                onNewFile={openFileDialog}
                onNewFolder={openFolderDialog}
                onRemove={() => setDialog("remove")}
                onSelectDocument={setSelectedId}
                onSortChange={(librarySort) =>
                  updateSettings({ ...settings, librarySort })
                }
                selectedDocumentId={selectedDocument?.documentId ?? null}
                processingJobs={backgroundJobs}
                snapshot={snapshot}
                sort={settings.librarySort}
              />
            ) : (
              <>
                <div className="panel-heading">
                  <span className="panel-marker" aria-hidden="true" />
                  <h2>Biblioteca</h2>
                </div>
                <div className="project-panel-content">
                  <form
                    className="create-project-card"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!busy && projectName.trim()) void createProject();
                    }}
                  >
                    <p className="section-label">Nuevo proyecto portable</p>
                    <label htmlFor="project-name">Nombre del proyecto</label>
                    <input
                      id="project-name"
                      ref={projectNameRef}
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="Mi investigación"
                    />
                    <button
                      className="primary-button button-with-icon"
                      disabled={busy || projectName.trim() === ""}
                      type="submit"
                    >
                      <JanoIcon name="nuevo-proyecto" size={17} />
                      <span>Elegir carpeta y crear</span>
                    </button>
                    <button
                      className="secondary-button button-with-icon"
                      disabled={busy}
                      onClick={() => void openProject()}
                      type="button"
                    >
                      <JanoIcon name="abrir-proyecto" size={16} />
                      <span>Abrir proyecto existente</span>
                    </button>
                    <p className="helper-copy">
                      Jano crea carpetas <code>_orig</code> y <code>_trad</code>{" "}
                      equivalentes.
                    </p>
                  </form>
                  {settings.recentProjects.length ? (
                    <section className="recent-projects">
                      <p className="section-label">Proyectos recientes</p>
                      {settings.recentProjects.map((project) => (
                        <div
                          className="recent-project-row"
                          key={project.projectId}
                        >
                          <button
                            className="recent-project-open"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                projectGateway.openProject(project.root),
                              )
                            }
                            title={project.root}
                            type="button"
                          >
                            <JanoIcon name="biblioteca" size={17} />
                            <span>
                              <strong>{project.name}</strong>
                              <small>{project.root}</small>
                            </span>
                          </button>
                          <button
                            aria-label={`Quitar ${project.name} de proyectos recientes`}
                            className="recent-project-remove"
                            onClick={() =>
                              forgetRecentProject(project.projectId)
                            }
                            title="Quitar de recientes"
                            type="button"
                          >
                            <JanoIcon name="cerrar" size={14} />
                          </button>
                        </div>
                      ))}
                    </section>
                  ) : null}
                  {projectDiscoveryLocations.length ? (
                    <section className="recent-projects existing-projects">
                      <div className="project-list-heading">
                        <p className="section-label">
                          Otros proyectos existentes
                        </p>
                        <button
                          aria-label="Actualizar proyectos existentes"
                          className="project-discovery-refresh"
                          disabled={discoveringProjects}
                          onClick={() =>
                            setDiscoveryRevision((current) => current + 1)
                          }
                          title="Volver a buscar proyectos"
                          type="button"
                        >
                          <JanoIcon name="actualizar" size={15} />
                        </button>
                      </div>
                      {otherExistingProjects.map((project) => (
                        <div
                          className="recent-project-row existing-project-row"
                          key={`${project.projectId}:${project.root}`}
                        >
                          <button
                            className="recent-project-open"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                projectGateway.openProject(project.root),
                              )
                            }
                            title={project.root}
                            type="button"
                          >
                            <JanoIcon name="biblioteca" size={17} />
                            <span>
                              <strong>{project.name}</strong>
                              <small>{project.root}</small>
                            </span>
                          </button>
                        </div>
                      ))}
                      {!discoveringProjects && !otherExistingProjects.length ? (
                        <p className="project-list-empty">
                          No se encontraron otros proyectos en las carpetas
                          conocidas.
                        </p>
                      ) : null}
                      {discoveringProjects ? (
                        <p className="project-list-empty">
                          Buscando proyectos…
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </>
            )}
          </aside>
        ) : null}

        <article className="panel panel-original">
          <div className="panel-heading">
            <span className="panel-marker" aria-hidden="true" />
            <h2>{originalPanel?.title ?? "Original"}</h2>
          </div>
          {snapshot && selectedDocument?.original ? (
            <PdfReader
              documentAdapter={pdfDocumentAdapter}
              fileGateway={sourceFileGateway}
              initialScale={settings.defaultZoom}
              key={`${snapshot.project.projectId}:${selectedDocument.documentId}:${selectedDocument.original.sha256}:${settings.defaultZoom}`}
              locked={panelLocks.source}
              onSelectionChange={handleSourceSelection}
              onUserIntent={handleSourceIntent}
              onViewportChange={handleSourceScroll}
              onViewStateChange={setPdfViewState}
              projectedSegmentIds={projectedSourceSegmentIds}
              ref={sourceReaderRef}
              segments={readerDocument?.segments}
              source={{
                rootPath: snapshot.project.root,
                relativePath: selectedDocument.original.relativePath,
              }}
            />
          ) : (
            <div className="panel-placeholder">
              <p>
                {selectedDocument
                  ? "Este documento no tiene un PDF original disponible."
                  : (originalPanel?.description ?? "Abre un PDF original.")}
              </p>
              <span>
                {snapshot ? "Selecciona un documento" : "Abre un proyecto"}
              </span>
            </div>
          )}
        </article>

        <article className="panel panel-translation">
          <div className="panel-heading">
            <span className="panel-marker" aria-hidden="true" />
            <h2>{translationPanel?.title ?? "Traducción"}</h2>
          </div>
          <DocumentTranslationPanel
            document={selectedDocument}
            fileGateway={sourceFileGateway}
            key={selectedDocument?.documentId ?? "empty"}
            locked={panelLocks.translation}
            onProcess={processDocumentInBackground}
            onSelectionChange={handleTranslationSelection}
            onUserIntent={handleTranslationIntent}
            onViewportChange={handleTranslationScroll}
            processingJob={selectedProcessingJob}
            projectedSegmentIds={projectedTranslationSegmentIds}
            readerDocument={readerDocument}
            ref={translationReaderRef}
            rootPath={snapshot?.project.root ?? null}
          />
        </article>
      </section>

      {readerActive ? (
        <ReadingToolbar
          active={readerActive}
          locks={panelLocks}
          mode={scrollMode}
          onNextPage={() => sourceReaderRef.current?.nextPage()}
          onPreviousPage={() => sourceReaderRef.current?.previousPage()}
          onRatioChange={setPanelRatio}
          onRealign={realignReaders}
          onToggleLibrary={() => setSidebarOpen((current) => !current)}
          onToggleLock={togglePanelLock}
          onToggleMode={() =>
            setScrollMode((current) =>
              current === "synchronized" ? "independent" : "synchronized",
            )
          }
          onZoomIn={() => sourceReaderRef.current?.zoomIn()}
          onZoomOut={() => sourceReaderRef.current?.zoomOut()}
          ratio={panelRatio}
          syncAvailable={syncAvailable}
          viewState={pdfViewState}
        />
      ) : null}

      <footer className="statusbar">
        <span title={error ?? snapshot?.project.root}>
          {error ??
            (busy
              ? "Actualizando proyecto…"
              : (snapshot?.project.root ?? "Ningún proyecto abierto"))}
        </span>
        <span>{model.environmentLabel} · rutas portables · datos locales</span>
      </footer>

      {dialog === "folder" && snapshot ? (
        <Modal title="Nueva carpeta" onClose={() => setDialog(null)}>
          <form
            className="dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && folderPath.trim()) void createFolder();
            }}
          >
            <p>
              Se creará en <code>_orig</code> y <code>_trad</code>
              {activeFolderPath ? (
                <>
                  {" "}
                  dentro de <strong>{activeFolderPath}</strong>
                </>
              ) : null}
              . Presiona Enter para confirmar.
            </p>
            <label htmlFor="folder-path">Nombre o subruta</label>
            <input
              autoFocus
              id="folder-path"
              onChange={(event) => setFolderPath(event.target.value)}
              placeholder="Instituciones"
              value={folderPath}
            />
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setDialog(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={busy || folderPath.trim() === ""}
                type="submit"
              >
                Crear en ambos lados
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "file" && snapshot ? (
        <Modal title="Nuevo archivo" onClose={() => setDialog(null)}>
          <form
            className="dialog-form import-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && importOriginalPath) void importDocument();
            }}
          >
            <p>
              Importa un PDF original y, opcionalmente, su traducción. Jano no
              sobrescribirá archivos existentes.
            </p>
            <div className="file-picker-row">
              <div>
                <label>PDF original</label>
                <span>
                  {importOriginalPath
                    ? fileName(importOriginalPath)
                    : "Obligatorio"}
                </span>
              </div>
              <button
                className="secondary-button"
                onClick={() => void chooseImportFile("original")}
                type="button"
              >
                Elegir…
              </button>
            </div>
            <div className="file-picker-row">
              <div>
                <label>Traducción</label>
                <span>
                  {importTranslationPath
                    ? fileName(importTranslationPath)
                    : "Opcional · PDF, Markdown o texto"}
                </span>
              </div>
              <button
                className="secondary-button"
                onClick={() => void chooseImportFile("translation")}
                type="button"
              >
                Elegir…
              </button>
            </div>
            <label htmlFor="import-folder">Carpeta lógica</label>
            <input
              id="import-folder"
              onChange={(event) => setImportFolderPath(event.target.value)}
              placeholder="Raíz del proyecto"
              value={importFolderPath}
            />
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setDialog(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={busy || !importOriginalPath}
                type="submit"
              >
                Importar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "remove" && snapshot && selectedDocument ? (
        <Modal
          title={`Eliminar ${selectedDocument.title}`}
          onClose={() => setDialog(null)}
        >
          <p>
            La opción recomendada solo oculta el documento de Jano y conserva
            los archivos. Puedes restaurarlo desde Ajustes.
          </p>
          <div className="removal-options">
            <button
              className="primary-button button-with-icon"
              disabled={busy}
              onClick={() => void removeDocument("hide")}
            >
              <JanoIcon name="quitar-de-jano" size={17} />
              <span>Quitar de Jano (recomendado)</span>
            </button>
            {selectedDocument.original ? (
              <button
                className="danger-button button-with-icon"
                disabled={busy}
                onClick={() => void removeDocument("delete-original")}
              >
                <JanoIcon name="eliminar" size={16} />
                <span>Eliminar original permanentemente</span>
              </button>
            ) : null}
            {selectedDocument.translation ? (
              <button
                className="danger-button button-with-icon"
                disabled={busy}
                onClick={() => void removeDocument("delete-translation")}
              >
                <JanoIcon name="eliminar" size={16} />
                <span>Eliminar traducción permanentemente</span>
              </button>
            ) : null}
            {selectedDocument.original && selectedDocument.translation ? (
              <button
                className="danger-button danger-strong button-with-icon"
                disabled={busy}
                onClick={() => void removeDocument("delete-both")}
              >
                <JanoIcon name="eliminar" size={16} />
                <span>Eliminar ambos archivos permanentemente</span>
              </button>
            ) : null}
          </div>
          <p className="warning-copy">
            La eliminación de archivos no usa todavía la Papelera del sistema y
            no se puede deshacer.
          </p>
        </Modal>
      ) : null}

      {dialog === "settings" ? (
        <SettingsDialog
          busy={busy}
          localTranslationRuntime={localTranslationRuntime}
          onChange={updateSettings}
          onClose={() => setDialog(null)}
          onRestore={(documentId) => {
            if (snapshot)
              void run(() =>
                projectGateway.restoreDocument(
                  snapshot.project.root,
                  documentId,
                ),
              );
          }}
          settings={settings}
          snapshot={snapshot}
        />
      ) : null}
    </main>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-label={title}
        aria-modal="true"
        className="modal-card"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="modal-heading">
          <h2>{title}</h2>
          <button aria-label="Cerrar" className="icon-button" onClick={onClose}>
            <JanoIcon name="cerrar" size={17} />
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}

function SettingsDialog({
  busy,
  localTranslationRuntime,
  settings,
  snapshot,
  onChange,
  onClose,
  onRestore,
}: {
  busy: boolean;
  localTranslationRuntime: LocalTranslationRuntime;
  settings: AppSettings;
  snapshot: ProjectSnapshot | null;
  onChange(settings: AppSettings): void;
  onClose(): void;
  onRestore(documentId: string): void;
}) {
  return (
    <Modal title="Ajustes" onClose={onClose}>
      <section className="settings-section">
        <h3>Lector</h3>
        <label htmlFor="default-zoom">Zoom inicial del PDF</label>
        <select
          id="default-zoom"
          onChange={(event) =>
            onChange({ ...settings, defaultZoom: Number(event.target.value) })
          }
          value={settings.defaultZoom}
        >
          {[0.5, 0.75, 1, 1.25, 1.5].map((zoom) => (
            <option key={zoom} value={zoom}>
              {Math.round(zoom * 100)}%
            </option>
          ))}
        </select>
        <label className="toggle-row">
          <input
            checked={settings.sidebarOpenByDefault}
            onChange={(event) =>
              onChange({
                ...settings,
                sidebarOpenByDefault: event.target.checked,
              })
            }
            type="checkbox"
          />
          Mostrar la biblioteca al abrir
        </label>
      </section>

      <section className="settings-section">
        <div className="section-heading-row">
          <h3>Procesamiento y traducción</h3>
          <span className="planned-badge active">Disponible</span>
        </div>
        <p className="settings-note">
          El procesamiento se inicia manualmente desde el panel Traducción. Se
          usa texto nativo cuando es suficiente y OCR local solo en páginas que
          lo necesitan.
        </p>
        <label htmlFor="target-language">Idioma de lectura</label>
        <select
          id="target-language"
          onChange={(event) =>
            onChange({ ...settings, targetLanguage: event.target.value })
          }
          value={settings.targetLanguage}
        >
          <option value="es">Español</option>
          <option value="en">Inglés</option>
          <option value="pt">Portugués</option>
          <option value="fr">Francés</option>
          <option value="de">Alemán</option>
        </select>
        <label htmlFor="ocr-policy">OCR futuro</label>
        <select
          id="ocr-policy"
          onChange={(event) =>
            onChange({
              ...settings,
              ocrPolicy:
                event.target.value === "never" ? "never" : "when-needed",
            })
          }
          value={settings.ocrPolicy}
        >
          <option value="when-needed">Solo si el texto no es extraíble</option>
          <option value="never">No usar OCR</option>
        </select>
        <label htmlFor="review-level">Revisión post-traducción</label>
        <select
          id="review-level"
          onChange={(event) =>
            onChange({
              ...settings,
              reviewLevel:
                event.target.value === "none" || event.target.value === "strict"
                  ? event.target.value
                  : "normal",
            })
          }
          value={settings.reviewLevel}
        >
          <option value="none">Ninguna · conservar traducción base</option>
          <option value="normal">Normal · gramática y naturalidad</option>
          <option value="strict">
            Estricta · controles semánticos adicionales
          </option>
        </select>
        <dl className="settings-facts">
          <div>
            <dt>Privacidad</dt>
            <dd>Solo local</dd>
          </div>
          <div>
            <dt>Pipeline de documentos</dt>
            <dd>Manual · local</dd>
          </div>
        </dl>
        <p className="privacy-note">
          Jano seguirá siendo local-first. Un proveedor remoto requerirá
          activación y consentimiento explícitos antes de enviar contenido.
        </p>
      </section>

      <OllamaSettingsSection
        onChange={onChange}
        runtime={localTranslationRuntime}
        settings={settings}
      />

      {snapshot?.hiddenDocuments.length ? (
        <section className="settings-section">
          <h3>Documentos ocultos</h3>
          <div className="hidden-document-list">
            {snapshot.hiddenDocuments.map((document) => (
              <div key={document.documentId}>
                <span>{document.title}</span>
                <button
                  className="secondary-button button-with-icon"
                  disabled={busy}
                  onClick={() => onRestore(document.documentId)}
                >
                  <JanoIcon name="restaurar" size={16} />
                  <span>Restaurar</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </Modal>
  );
}
