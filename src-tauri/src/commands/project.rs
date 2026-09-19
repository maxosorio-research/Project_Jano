use std::path::Path;

use crate::{
    application::project_service::ProjectService,
    domain::project::{DiscoveredProject, ProjectSnapshot},
};
use tauri::ipc::Response;

#[tauri::command]
pub fn create_project(parent_path: String, name: String) -> Result<ProjectSnapshot, String> {
    ProjectService
        .create_project(Path::new(&parent_path), &name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_project(root_path: String) -> Result<ProjectSnapshot, String> {
    ProjectService
        .open_project(Path::new(&root_path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn discover_projects(locations: Vec<String>) -> Vec<DiscoveredProject> {
    ProjectService.discover_projects(&locations)
}

#[tauri::command]
pub fn create_mirrored_folder(
    root_path: String,
    relative_path: String,
) -> Result<ProjectSnapshot, String> {
    ProjectService
        .create_mirrored_folder(Path::new(&root_path), &relative_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn import_document(
    root_path: String,
    original_source_path: String,
    translation_source_path: Option<String>,
    relative_folder: String,
) -> Result<ProjectSnapshot, String> {
    ProjectService
        .import_document(
            Path::new(&root_path),
            Path::new(&original_source_path),
            translation_source_path.as_deref().map(Path::new),
            &relative_folder,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_document(
    root_path: String,
    document_id: String,
    action: String,
) -> Result<ProjectSnapshot, String> {
    ProjectService
        .remove_document(Path::new(&root_path), &document_id, &action)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn restore_document(root_path: String, document_id: String) -> Result<ProjectSnapshot, String> {
    ProjectService
        .restore_document(Path::new(&root_path), &document_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_original_pdf(root_path: String, relative_path: String) -> Result<Response, String> {
    ProjectService
        .read_original_pdf(Path::new(&root_path), &relative_path)
        .map(Response::new)
        .map_err(|error| error.to_string())
}
