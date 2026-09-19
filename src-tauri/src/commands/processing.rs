use std::path::Path;

use crate::{
    application::processing_service::ProcessingService,
    domain::{
        processing::{DocumentProcessingPayload, ReaderDocumentRecord},
        project::ProjectSnapshot,
    },
};

#[tauri::command]
pub fn save_processed_document(
    root_path: String,
    document_id: String,
    payload: DocumentProcessingPayload,
) -> Result<ProjectSnapshot, String> {
    ProcessingService
        .save(Path::new(&root_path), &document_id, &payload)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_translation_text(root_path: String, relative_path: String) -> Result<String, String> {
    ProcessingService
        .read_translation(Path::new(&root_path), &relative_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_reader_document(
    root_path: String,
    document_id: String,
) -> Result<Option<ReaderDocumentRecord>, String> {
    ProcessingService
        .read_reader_document(Path::new(&root_path), &document_id)
        .map_err(|error| error.to_string())
}
