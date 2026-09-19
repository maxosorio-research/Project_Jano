import type { DiscoveredProject, ProjectSnapshot } from "../../domain/project";
import type { DocumentProcessingPayload } from "../../domain/processing";

export interface ProjectGateway {
  createProject(parentPath: string, name: string): Promise<ProjectSnapshot>;
  openProject(rootPath: string): Promise<ProjectSnapshot>;
  discoverProjects(locations: string[]): Promise<DiscoveredProject[]>;
  createMirroredFolder(
    rootPath: string,
    relativePath: string,
  ): Promise<ProjectSnapshot>;
  importDocument(
    rootPath: string,
    originalSourcePath: string,
    translationSourcePath: string | null,
    relativeFolder: string,
  ): Promise<ProjectSnapshot>;
  saveProcessedDocument(
    rootPath: string,
    documentId: string,
    payload: DocumentProcessingPayload,
  ): Promise<ProjectSnapshot>;
  removeDocument(
    rootPath: string,
    documentId: string,
    action: DocumentRemovalAction,
  ): Promise<ProjectSnapshot>;
  restoreDocument(
    rootPath: string,
    documentId: string,
  ): Promise<ProjectSnapshot>;
}

export type DocumentRemovalAction =
  "hide" | "delete-original" | "delete-translation" | "delete-both";
