import { invoke } from "@tauri-apps/api/core";
import type { ProjectGateway } from "../../application/ports/ProjectGateway";
import type { DiscoveredProject, ProjectSnapshot } from "../../domain/project";

export const tauriProjectGateway: ProjectGateway = {
  createProject(parentPath, name) {
    return invoke<ProjectSnapshot>("create_project", { parentPath, name });
  },

  openProject(rootPath) {
    return invoke<ProjectSnapshot>("open_project", { rootPath });
  },

  discoverProjects(locations) {
    return invoke<DiscoveredProject[]>("discover_projects", { locations });
  },

  createMirroredFolder(rootPath, relativePath) {
    return invoke<ProjectSnapshot>("create_mirrored_folder", {
      rootPath,
      relativePath,
    });
  },

  importDocument(
    rootPath,
    originalSourcePath,
    translationSourcePath,
    relativeFolder,
  ) {
    return invoke<ProjectSnapshot>("import_document", {
      rootPath,
      originalSourcePath,
      translationSourcePath,
      relativeFolder,
    });
  },

  saveProcessedDocument(rootPath, documentId, payload) {
    return invoke<ProjectSnapshot>("save_processed_document", {
      rootPath,
      documentId,
      payload,
    });
  },

  removeDocument(rootPath, documentId, action) {
    return invoke<ProjectSnapshot>("remove_document", {
      rootPath,
      documentId,
      action,
    });
  },

  restoreDocument(rootPath, documentId) {
    return invoke<ProjectSnapshot>("restore_document", {
      rootPath,
      documentId,
    });
  },
};
