use std::{
    fs,
    path::{Component, Path},
};

use serde::Serialize;
use uuid::Uuid;

use crate::{
    application::project_service::ProjectService,
    domain::{
        processing::{AlignmentRecord, DocumentProcessingPayload, ReaderDocumentRecord},
        project::ProjectSnapshot,
    },
    error::{ProjectError, ProjectResult},
    infrastructure::project_repository::ProjectRepository,
};

#[derive(Default)]
pub struct ProcessingService;

impl ProcessingService {
    pub fn save(
        &self,
        root: &Path,
        document_id: &str,
        payload: &DocumentProcessingPayload,
    ) -> ProjectResult<ProjectSnapshot> {
        validate_payload(document_id, payload)?;
        let root = root.canonicalize().map_err(|error| {
            ProjectError::io(format!("Could not open {}", root.display()), error)
        })?;
        let config = ProjectRepository::load_config(&root)?;
        let catalog = ProjectRepository::load_catalog(&root)?;
        let document = catalog
            .documents
            .iter()
            .find(|document| document.document_id == document_id)
            .ok_or_else(|| {
                ProjectError::Invalid("The selected document no longer exists.".into())
            })?;
        let original = document.original.as_ref().ok_or_else(|| {
            ProjectError::Invalid("The selected document has no original PDF.".into())
        })?;
        let relative_original = Path::new(&original.relative_path)
            .strip_prefix(&config.original_dir)
            .map_err(|_| {
                ProjectError::Invalid("The original path is outside the project.".into())
            })?;
        if relative_original
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
        {
            return Err(ProjectError::Invalid(
                "The original path is not safe to process.".into(),
            ));
        }
        let stem = relative_original
            .file_stem()
            .and_then(|value| value.to_str())
            .ok_or_else(|| ProjectError::Invalid("The original file name is invalid.".into()))?;
        let translation_name = format!("{stem}.{}.md", payload.metadata.target_language);
        let translation_relative = relative_original
            .parent()
            .unwrap_or(Path::new(""))
            .join(translation_name);
        let translation_path = root
            .join(&config.translation_dir)
            .join(&translation_relative);
        let state_directory = root.join(".jano").join("documents").join(document_id);
        let expected_relative_path = Path::new(&config.translation_dir).join(&translation_relative);
        let replaces_generated_translation =
            document.translation.as_ref().is_some_and(|translation| {
                Path::new(&translation.relative_path) == expected_relative_path
                    && state_directory.join("processing.json").is_file()
                    && state_directory.join("translation.json").is_file()
            });
        if document.translation.is_some() && !replaces_generated_translation {
            return Err(ProjectError::Invalid(
                "This document has an imported translation and cannot be overwritten automatically."
                    .into(),
            ));
        }
        if translation_path.exists() && !replaces_generated_translation {
            return Err(ProjectError::Invalid(
                "A translated Markdown file already exists for this document.".into(),
            ));
        }
        let translation_parent = translation_path.parent().ok_or_else(|| {
            ProjectError::Invalid("The translation destination is invalid.".into())
        })?;
        fs::create_dir_all(translation_parent)
            .map_err(|error| ProjectError::io("Could not create the translation folder", error))?;

        fs::create_dir_all(&state_directory).map_err(|error| {
            ProjectError::io("Could not create the document processing directory", error)
        })?;
        write_atomic(
            &state_directory.join("source.txt"),
            payload.source_text.as_bytes(),
        )?;
        write_json_atomic(&state_directory.join("segments.json"), &payload.segments)?;
        write_json_atomic(
            &state_directory.join("translation.json"),
            &payload.translations,
        )?;
        write_json_atomic(&state_directory.join("math.json"), &payload.math_objects)?;
        write_json_atomic(&state_directory.join("processing.json"), &payload.metadata)?;
        let alignments = payload
            .segments
            .iter()
            .map(|segment| AlignmentRecord {
                alignment_id: format!("al_{}", segment.segment_id),
                source_segment_ids: vec![segment.segment_id.clone()],
                target_segment_ids: vec![segment.segment_id.clone()],
                alignment_type: "1:1".into(),
                method: "generated-id".into(),
            })
            .collect::<Vec<_>>();
        write_json_atomic(&state_directory.join("alignment.json"), &alignments)?;
        write_atomic(&translation_path, payload.markdown.as_bytes())?;
        ProjectService.open_project(&root)
    }

    pub fn read_translation(&self, root: &Path, relative_path: &str) -> ProjectResult<String> {
        let root = root.canonicalize().map_err(|error| {
            ProjectError::io(format!("Could not open {}", root.display()), error)
        })?;
        let config = ProjectRepository::load_config(&root)?;
        let translation_root =
            root.join(&config.translation_dir)
                .canonicalize()
                .map_err(|error| {
                    ProjectError::io("Could not resolve the translations directory", error)
                })?;
        let path = root
            .join(relative_path)
            .canonicalize()
            .map_err(|error| ProjectError::io("Could not open the translated document", error))?;
        let supported = path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| {
                matches!(
                    value.to_ascii_lowercase().as_str(),
                    "md" | "markdown" | "txt"
                )
            });
        if !path.starts_with(translation_root) || !path.is_file() || !supported {
            return Err(ProjectError::Invalid(
                "The selected translation is not a Markdown or text file inside this project."
                    .into(),
            ));
        }
        fs::read_to_string(&path)
            .map_err(|error| ProjectError::io(format!("Could not read {}", path.display()), error))
    }

    pub fn read_reader_document(
        &self,
        root: &Path,
        document_id: &str,
    ) -> ProjectResult<Option<ReaderDocumentRecord>> {
        if document_id.is_empty()
            || !document_id
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '-')
        {
            return Err(ProjectError::Invalid(
                "The selected document identifier is invalid.".into(),
            ));
        }
        let root = root.canonicalize().map_err(|error| {
            ProjectError::io(format!("Could not open {}", root.display()), error)
        })?;
        let catalog = ProjectRepository::load_catalog(&root)?;
        if !catalog
            .documents
            .iter()
            .any(|document| document.document_id == document_id)
        {
            return Err(ProjectError::Invalid(
                "The selected document no longer exists.".into(),
            ));
        }
        let state_directory = root.join(".jano").join("documents").join(document_id);
        let segment_path = state_directory.join("segments.json");
        let translation_path = state_directory.join("translation.json");
        let alignment_path = state_directory.join("alignment.json");
        if !segment_path.is_file() || !translation_path.is_file() || !alignment_path.is_file() {
            return Ok(None);
        }
        Ok(Some(ReaderDocumentRecord {
            segments: read_json(&segment_path)?,
            translations: read_json(&translation_path)?,
            alignments: read_json(&alignment_path)?,
        }))
    }
}

fn validate_payload(document_id: &str, payload: &DocumentProcessingPayload) -> ProjectResult<()> {
    if document_id.is_empty()
        || !document_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
        || payload.source_text.trim().is_empty()
        || payload.markdown.trim().is_empty()
        || payload.segments.is_empty()
        || payload.segments.len() != payload.translations.len()
        || payload.metadata.math_object_count as usize != payload.math_objects.len()
    {
        return Err(ProjectError::Invalid(
            "The processed document payload is incomplete or invalid.".into(),
        ));
    }
    let valid_language = matches!(
        payload.metadata.target_language.as_str(),
        "es" | "en" | "pt" | "fr" | "de"
    );
    if !valid_language {
        return Err(ProjectError::Invalid(
            "Choose a supported target language.".into(),
        ));
    }
    if !matches!(
        payload.metadata.review_level.as_str(),
        "none" | "normal" | "strict"
    ) {
        return Err(ProjectError::Invalid(
            "Choose a supported post-translation review level.".into(),
        ));
    }
    Ok(())
}

fn write_json_atomic<T: Serialize + ?Sized>(path: &Path, value: &T) -> ProjectResult<()> {
    let mut bytes = serde_json::to_vec_pretty(value).map_err(|error| {
        ProjectError::json(format!("Could not serialize {}", path.display()), error)
    })?;
    bytes.push(b'\n');
    write_atomic(path, &bytes)
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> ProjectResult<T> {
    let bytes = fs::read(path)
        .map_err(|error| ProjectError::io(format!("Could not read {}", path.display()), error))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| ProjectError::json(format!("Could not parse {}", path.display()), error))
}

fn write_atomic(path: &Path, bytes: &[u8]) -> ProjectResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| ProjectError::Invalid("The processing destination is invalid.".into()))?;
    let temporary = parent.join(format!(".jano-write-{}.tmp", Uuid::new_v4()));
    fs::write(&temporary, bytes).map_err(|error| {
        ProjectError::io(format!("Could not write {}", temporary.display()), error)
    })?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| {
            ProjectError::io(format!("Could not replace {}", path.display()), error)
        })?;
    }
    fs::rename(&temporary, path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        ProjectError::io(
            format!("Could not finish writing {}", path.display()),
            error,
        )
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::ProcessingService;
    use crate::{
        application::project_service::ProjectService,
        domain::{
            processing::{
                DocumentProcessingPayload, ProcessingMetadata, SourceSegmentRecord,
                TranslatedSegmentRecord,
            },
            project::PairState,
        },
    };

    #[test]
    fn persists_processing_artifacts_and_discovers_generated_markdown() {
        let parent = tempdir().expect("temporary directory");
        ProjectService
            .create_project(parent.path(), "Pipeline")
            .unwrap();
        let root = parent.path().join("Pipeline");
        fs::write(root.join("Pipeline_orig/paper.pdf"), b"%PDF source").unwrap();
        let opened = ProjectService.open_project(&root).unwrap();
        let document_id = opened.documents[0].document_id.clone();
        let mut payload = DocumentProcessingPayload {
            source_text: "--- Page 1 ---\n\nSource text.".into(),
            segments: vec![SourceSegmentRecord {
                segment_id: "seg_00001".into(),
                page: 1,
                block_type: "paragraph".into(),
                text: "Source text.".into(),
                extraction_method: "native".into(),
            }],
            translations: vec![TranslatedSegmentRecord {
                segment_id: "seg_00001".into(),
                text: "Texto fuente.".into(),
                base_text: Some("Texto fuente.".into()),
                reviewed_text: Some("Texto fuente.".into()),
                review_status: Some("approved".into()),
                review_warnings: Vec::new(),
            }],
            math_objects: Vec::new(),
            markdown: "Texto fuente.\n".into(),
            metadata: ProcessingMetadata {
                model: "test-model".into(),
                source_language: "en".into(),
                target_language: "es".into(),
                created_at: "2026-09-17T00:00:00Z".into(),
                native_page_count: 1,
                ocr_page_count: 0,
                review_level: "normal".into(),
                reviewed_segment_count: 1,
                base_retained_segment_count: 0,
                math_object_count: 0,
            },
        };

        let saved = ProcessingService
            .save(&root, &document_id, &payload)
            .unwrap();

        assert_eq!(saved.documents.len(), 1);
        assert_eq!(saved.documents[0].pair_state, PairState::Paired);
        assert!(root.join("Pipeline_trad/paper.es.md").is_file());
        let state = root.join(".jano/documents").join(&document_id);
        assert!(state.join("source.txt").is_file());
        assert!(state.join("segments.json").is_file());
        assert!(state.join("translation.json").is_file());
        assert!(state.join("math.json").is_file());
        assert!(state.join("alignment.json").is_file());
        assert_eq!(
            ProcessingService
                .read_translation(&root, "Pipeline_trad/paper.es.md")
                .unwrap(),
            "Texto fuente.\n"
        );
        let reader_document = ProcessingService
            .read_reader_document(&root, &document_id)
            .unwrap()
            .expect("processed reader document");
        assert_eq!(reader_document.segments.len(), 1);
        assert_eq!(reader_document.translations.len(), 1);
        assert_eq!(reader_document.alignments.len(), 1);
        assert_eq!(reader_document.alignments[0].alignment_type, "1:1");

        payload.translations[0].text = "Texto revisado.".into();
        payload.markdown = "Texto revisado.\n".into();
        ProcessingService
            .save(&root, &document_id, &payload)
            .unwrap();
        assert_eq!(
            ProcessingService
                .read_translation(&root, "Pipeline_trad/paper.es.md")
                .unwrap(),
            "Texto revisado.\n"
        );
    }
}
