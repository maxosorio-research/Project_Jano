use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

use uuid::Uuid;

use crate::{
    domain::project::{DiscoveredProject, Project, ProjectConfig, ProjectSnapshot, SCHEMA_VERSION},
    error::{ProjectError, ProjectResult},
    infrastructure::{project_discovery::ProjectDiscovery, project_repository::ProjectRepository},
};

#[derive(Default)]
pub struct ProjectService;

impl ProjectService {
    pub fn discover_projects(&self, locations: &[String]) -> Vec<DiscoveredProject> {
        let mut roots = Vec::new();
        let mut seen_roots = HashSet::new();
        for location in locations.iter().take(32) {
            let path = PathBuf::from(location);
            let Ok(path) = path.canonicalize() else {
                continue;
            };
            let scan_root = if path.join(".jano/project.json").is_file() {
                path.parent().unwrap_or(&path).to_path_buf()
            } else {
                path
            };
            let key = scan_root.to_string_lossy().to_lowercase();
            if scan_root.is_dir() && seen_roots.insert(key) {
                roots.push(scan_root);
            }
        }

        let mut projects = HashMap::new();
        let mut visited = HashSet::new();
        let mut inspected = 0usize;
        for root in roots {
            discover_under(&root, 0, &mut inspected, &mut visited, &mut projects);
        }
        let mut projects = projects.into_values().collect::<Vec<_>>();
        projects.sort_by(|first, second| {
            first
                .name
                .to_lowercase()
                .cmp(&second.name.to_lowercase())
                .then_with(|| first.root.cmp(&second.root))
        });
        projects
    }

    pub fn create_project(&self, parent: &Path, name: &str) -> ProjectResult<ProjectSnapshot> {
        let name = name.trim();
        validate_name(name)?;
        if !parent.is_dir() {
            return Err(ProjectError::Invalid(
                "Choose an existing directory in which to create the project.".into(),
            ));
        }
        let root = parent.join(name);
        if root.exists() {
            return Err(ProjectError::Invalid(format!(
                "The project directory already exists: {}",
                root.display()
            )));
        }

        let original_dir = format!("{name}_orig");
        let translation_dir = format!("{name}_trad");
        fs::create_dir(&root)
            .map_err(|error| ProjectError::io("Could not create the project directory", error))?;
        fs::create_dir(root.join(&original_dir))
            .map_err(|error| ProjectError::io("Could not create the originals directory", error))?;
        fs::create_dir(root.join(&translation_dir)).map_err(|error| {
            ProjectError::io("Could not create the translations directory", error)
        })?;

        let config = ProjectConfig {
            project_id: Uuid::new_v4().to_string(),
            name: name.to_owned(),
            schema_version: SCHEMA_VERSION,
            original_dir,
            translation_dir,
        };
        ProjectRepository::initialize(&root, &config)?;
        self.open_project(&root)
    }

    pub fn open_project(&self, root: &Path) -> ProjectResult<ProjectSnapshot> {
        let root = canonical_project_root(root)?;
        if !root.is_dir() {
            return Err(ProjectError::Invalid(
                "The selected project path is not a directory.".into(),
            ));
        }
        let config = ProjectRepository::load_config(&root)?;
        validate_config(&root, &config)?;
        let catalog = ProjectRepository::load_catalog(&root)?;
        let (catalog, documents) = ProjectDiscovery::reconcile(&root, &config, catalog)?;
        let hidden_documents = catalog
            .documents
            .iter()
            .filter(|document| document.hidden)
            .map(|document| crate::domain::project::DocumentSummary {
                document_id: document.document_id.clone(),
                title: document
                    .original
                    .as_ref()
                    .or(document.translation.as_ref())
                    .and_then(|file| Path::new(&file.relative_path).file_stem())
                    .and_then(|value| value.to_str())
                    .unwrap_or("Untitled document")
                    .to_owned(),
                pair_state: crate::domain::project::PairState::Unavailable,
                original: document.original.clone(),
                translation: document.translation.clone(),
            })
            .collect();
        let folders = ProjectDiscovery::folders(&root, &config)?;
        ProjectRepository::save_catalog(&root, &catalog)?;
        Ok(ProjectSnapshot {
            project: Project {
                project_id: config.project_id,
                name: config.name,
                root: root.to_string_lossy().into_owned(),
                schema_version: config.schema_version,
            },
            documents,
            hidden_documents,
            folders,
        })
    }

    pub fn create_mirrored_folder(
        &self,
        root: &Path,
        relative_path: &str,
    ) -> ProjectResult<ProjectSnapshot> {
        let root = canonical_project_root(root)?;
        let config = ProjectRepository::load_config(&root)?;
        validate_config(&root, &config)?;
        let relative_path = safe_folder_path(relative_path)?;
        for directory in [&config.original_dir, &config.translation_dir] {
            fs::create_dir_all(root.join(directory).join(relative_path)).map_err(|error| {
                ProjectError::io(format!("Could not create the folder in {directory}"), error)
            })?;
        }
        self.open_project(&root)
    }

    pub fn import_document(
        &self,
        root: &Path,
        original_source: &Path,
        translation_source: Option<&Path>,
        relative_folder: &str,
    ) -> ProjectResult<ProjectSnapshot> {
        let root = canonical_project_root(root)?;
        let config = ProjectRepository::load_config(&root)?;
        validate_config(&root, &config)?;
        let folder = if relative_folder.trim().is_empty() {
            Path::new("")
        } else {
            safe_folder_path(relative_folder)?
        };
        let original_source = validate_import_source(original_source, &["pdf"], "original")?;
        let translation_source = translation_source
            .map(|path| {
                validate_import_source(path, &["pdf", "md", "markdown", "txt"], "translation")
            })
            .transpose()?;

        let original_name = original_source.file_name().ok_or_else(|| {
            ProjectError::Invalid("The original PDF must have a valid file name.".into())
        })?;
        let original_stem = original_source.file_stem().ok_or_else(|| {
            ProjectError::Invalid("The original PDF must have a valid file name.".into())
        })?;
        let original_directory = root.join(&config.original_dir).join(folder);
        let translation_directory = root.join(&config.translation_dir).join(folder);
        fs::create_dir_all(&original_directory).map_err(|error| {
            ProjectError::io("Could not create the original destination folder", error)
        })?;
        fs::create_dir_all(&translation_directory).map_err(|error| {
            ProjectError::io("Could not create the translation destination folder", error)
        })?;

        let original_destination = original_directory.join(original_name);
        let translation_destination = translation_source.as_ref().map(|source| {
            let extension = source.extension().expect("validated translation extension");
            translation_directory.join(format!(
                "{}.{}",
                original_stem.to_string_lossy(),
                extension.to_string_lossy()
            ))
        });
        if original_destination.exists()
            || translation_destination
                .as_ref()
                .is_some_and(|path| path.exists())
        {
            return Err(ProjectError::Invalid(
                "A document with that name already exists in the selected folder.".into(),
            ));
        }

        copy_import_file(&original_source, &original_destination)?;
        if let (Some(source), Some(destination)) = (
            translation_source.as_ref(),
            translation_destination.as_ref(),
        ) {
            if let Err(error) = copy_import_file(source, destination) {
                let _ = fs::remove_file(&original_destination);
                return Err(error);
            }
        }
        self.open_project(&root)
    }

    pub fn remove_document(
        &self,
        root: &Path,
        document_id: &str,
        action: &str,
    ) -> ProjectResult<ProjectSnapshot> {
        let root = canonical_project_root(root)?;
        let config = ProjectRepository::load_config(&root)?;
        validate_config(&root, &config)?;
        let mut catalog = ProjectRepository::load_catalog(&root)?;
        let index = catalog
            .documents
            .iter()
            .position(|document| document.document_id == document_id)
            .ok_or_else(|| {
                ProjectError::Invalid("The selected document no longer exists.".into())
            })?;

        match action {
            "hide" => catalog.documents[index].hidden = true,
            "delete-original" => {
                if let Some(file) = catalog.documents[index].original.take() {
                    delete_project_file(&root, &config.original_dir, &file.relative_path)?;
                }
                catalog.documents[index].hidden = false;
            }
            "delete-translation" => {
                if let Some(file) = catalog.documents[index].translation.take() {
                    delete_project_file(&root, &config.translation_dir, &file.relative_path)?;
                }
                catalog.documents[index].hidden = false;
            }
            "delete-both" => {
                if let Some(file) = catalog.documents[index].original.as_ref() {
                    validate_project_file(&root, &config.original_dir, &file.relative_path)?;
                }
                if let Some(file) = catalog.documents[index].translation.as_ref() {
                    validate_project_file(&root, &config.translation_dir, &file.relative_path)?;
                }
                if let Some(file) = catalog.documents[index].original.take() {
                    delete_project_file(&root, &config.original_dir, &file.relative_path)?;
                }
                if let Some(file) = catalog.documents[index].translation.take() {
                    delete_project_file(&root, &config.translation_dir, &file.relative_path)?;
                }
            }
            _ => {
                return Err(ProjectError::Invalid(
                    "Choose a supported document removal action.".into(),
                ));
            }
        }
        if catalog.documents[index].original.is_none()
            && catalog.documents[index].translation.is_none()
        {
            catalog.documents.remove(index);
        }
        ProjectRepository::save_catalog(&root, &catalog)?;
        self.open_project(&root)
    }

    pub fn restore_document(
        &self,
        root: &Path,
        document_id: &str,
    ) -> ProjectResult<ProjectSnapshot> {
        let root = canonical_project_root(root)?;
        let config = ProjectRepository::load_config(&root)?;
        validate_config(&root, &config)?;
        let mut catalog = ProjectRepository::load_catalog(&root)?;
        let document = catalog
            .documents
            .iter_mut()
            .find(|document| document.document_id == document_id)
            .ok_or_else(|| ProjectError::Invalid("The hidden document no longer exists.".into()))?;
        document.hidden = false;
        ProjectRepository::save_catalog(&root, &catalog)?;
        self.open_project(&root)
    }

    pub fn read_original_pdf(&self, root: &Path, relative_path: &str) -> ProjectResult<Vec<u8>> {
        let root = canonical_project_root(root)?;
        let config = ProjectRepository::load_config(&root)?;
        validate_config(&root, &config)?;
        let relative_path = safe_relative_path(relative_path)?;
        let original_root = root
            .join(&config.original_dir)
            .canonicalize()
            .map_err(|error| {
                ProjectError::io("Could not resolve the originals directory", error)
            })?;
        let file_path = root.join(relative_path).canonicalize().map_err(|error| {
            ProjectError::io("Could not resolve the selected original PDF", error)
        })?;
        let is_pdf = file_path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("pdf"));
        if !file_path.starts_with(&original_root) || !file_path.is_file() || !is_pdf {
            return Err(ProjectError::Invalid(
                "The selected file is not a PDF inside this project's originals directory.".into(),
            ));
        }
        fs::read(&file_path).map_err(|error| {
            ProjectError::io(format!("Could not read {}", file_path.display()), error)
        })
    }
}

fn discover_under(
    directory: &Path,
    depth: usize,
    inspected: &mut usize,
    visited: &mut HashSet<String>,
    projects: &mut HashMap<String, DiscoveredProject>,
) {
    const MAX_DEPTH: usize = 4;
    const MAX_DIRECTORIES: usize = 2_500;
    if depth > MAX_DEPTH || *inspected >= MAX_DIRECTORIES {
        return;
    }
    let Ok(directory) = directory.canonicalize() else {
        return;
    };
    let key = directory.to_string_lossy().to_lowercase();
    if !visited.insert(key.clone()) {
        return;
    }
    *inspected += 1;

    let config_path = directory.join(".jano/project.json");
    if config_path.is_file() {
        if let Ok(config) = ProjectRepository::load_config(&directory) {
            if validate_config(&directory, &config).is_ok() {
                let modified_at = config_path
                    .metadata()
                    .and_then(|metadata| metadata.modified())
                    .ok()
                    .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_secs())
                    .unwrap_or(0);
                projects.insert(
                    key,
                    DiscoveredProject {
                        project_id: config.project_id,
                        name: config.name,
                        root: directory.to_string_lossy().into_owned(),
                        modified_at,
                    },
                );
            }
        }
    }

    if depth == MAX_DEPTH {
        return;
    }
    let Ok(entries) = fs::read_dir(&directory) else {
        return;
    };
    for entry in entries.flatten() {
        if *inspected >= MAX_DIRECTORIES {
            break;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip_discovery_directory(&name) {
            continue;
        }
        discover_under(&entry.path(), depth + 1, inspected, visited, projects);
    }
}

fn should_skip_discovery_directory(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.starts_with('.')
        || matches!(
            lower.as_str(),
            "node_modules" | "target" | "dist" | "build" | "__pycache__"
        )
        || lower.ends_with("_orig")
        || lower.ends_with("_trad")
}

fn canonical_project_root(root: &Path) -> ProjectResult<std::path::PathBuf> {
    root.canonicalize()
        .map_err(|error| ProjectError::io(format!("Could not open {}", root.display()), error))
}

fn safe_relative_path(relative_path: &str) -> ProjectResult<&Path> {
    use std::path::Component;

    let path = Path::new(relative_path);
    if path.as_os_str().is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_) | Component::CurDir))
    {
        return Err(ProjectError::Invalid(
            "The original PDF path must be project-relative.".into(),
        ));
    }
    Ok(path)
}

fn safe_folder_path(relative_path: &str) -> ProjectResult<&Path> {
    use std::path::Component;

    let path = Path::new(relative_path.trim());
    let reserved = ['<', '>', ':', '"', '|', '?', '*'];
    if path.as_os_str().is_empty()
        || path.is_absolute()
        || path.components().any(|component| match component {
            Component::Normal(value) => {
                let name = value.to_string_lossy();
                name.is_empty()
                    || name.ends_with([' ', '.'])
                    || name
                        .chars()
                        .any(|character| character.is_control() || reserved.contains(&character))
            }
            _ => true,
        })
    {
        return Err(ProjectError::Invalid(
            "Use a relative folder path without reserved characters or parent traversal.".into(),
        ));
    }
    Ok(path)
}

fn validate_import_source(
    source: &Path,
    extensions: &[&str],
    kind: &str,
) -> ProjectResult<PathBuf> {
    let source = source.canonicalize().map_err(|error| {
        ProjectError::io(format!("Could not open the selected {kind} file"), error)
    })?;
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_lowercase);
    if !source.is_file()
        || !extension
            .as_deref()
            .is_some_and(|value| extensions.contains(&value))
    {
        return Err(ProjectError::Invalid(format!(
            "Choose a supported {kind} file."
        )));
    }
    Ok(source)
}

fn copy_import_file(source: &Path, destination: &Path) -> ProjectResult<()> {
    let parent = destination.parent().ok_or_else(|| {
        ProjectError::Invalid("The selected destination folder is invalid.".into())
    })?;
    let temporary = parent.join(format!(".jano-import-{}.tmp", Uuid::new_v4()));
    fs::copy(source, &temporary)
        .map_err(|error| ProjectError::io(format!("Could not copy {}", source.display()), error))?;
    if destination.exists() {
        let _ = fs::remove_file(&temporary);
        return Err(ProjectError::Invalid(
            "A document with that name already exists in the selected folder.".into(),
        ));
    }
    if let Err(error) = fs::rename(&temporary, destination) {
        let _ = fs::remove_file(&temporary);
        return Err(ProjectError::io(
            format!("Could not finish importing {}", destination.display()),
            error,
        ));
    }
    Ok(())
}

fn validate_project_file(root: &Path, directory: &str, relative_path: &str) -> ProjectResult<()> {
    let relative_path = safe_relative_path(relative_path)?;
    let allowed_root = root.join(directory).canonicalize().map_err(|error| {
        ProjectError::io(
            format!("Could not resolve the {directory} directory"),
            error,
        )
    })?;
    let file_path = root
        .join(relative_path)
        .canonicalize()
        .map_err(|error| ProjectError::io("Could not resolve the selected project file", error))?;
    if !file_path.starts_with(&allowed_root) || !file_path.is_file() {
        return Err(ProjectError::Invalid(
            "The selected file is outside the expected project directory.".into(),
        ));
    }
    Ok(())
}

fn delete_project_file(root: &Path, directory: &str, relative_path: &str) -> ProjectResult<()> {
    validate_project_file(root, directory, relative_path)?;
    let path = root.join(safe_relative_path(relative_path)?);
    fs::remove_file(&path)
        .map_err(|error| ProjectError::io(format!("Could not delete {}", path.display()), error))
}

fn validate_name(name: &str) -> ProjectResult<()> {
    let reserved = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    if name.is_empty()
        || matches!(name, "." | "..")
        || name.ends_with([' ', '.'])
        || name
            .chars()
            .any(|value| value.is_control() || reserved.contains(&value))
    {
        return Err(ProjectError::Invalid(
            "Use a non-empty project name without reserved path characters.".into(),
        ));
    }
    Ok(())
}

fn validate_config(root: &Path, config: &ProjectConfig) -> ProjectResult<()> {
    if config.schema_version != SCHEMA_VERSION {
        return Err(ProjectError::Invalid(format!(
            "Unsupported project schema version {}.",
            config.schema_version
        )));
    }
    if config.project_id.trim().is_empty() || config.name.trim().is_empty() {
        return Err(ProjectError::Invalid(
            "The project metadata is incomplete.".into(),
        ));
    }
    for directory in [&config.original_dir, &config.translation_dir] {
        let path = Path::new(directory);
        if path.is_absolute() || path.components().count() != 1 || !root.join(path).is_dir() {
            return Err(ProjectError::Invalid(format!(
                "The configured project directory is missing or unsafe: {directory}"
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::ProjectService;
    use crate::domain::project::PairState;

    #[test]
    fn creates_the_portable_project_structure() {
        let parent = tempdir().expect("temporary directory");
        let snapshot = ProjectService
            .create_project(parent.path(), "Research")
            .expect("project should be created");
        let root = parent.path().join("Research");

        assert_eq!(snapshot.project.name, "Research");
        assert!(root.join("Research_orig").is_dir());
        assert!(root.join("Research_trad").is_dir());
        assert!(root.join(".jano/project.json").is_file());
        assert!(root.join(".jano/documents.json").is_file());

        let project_json = fs::read_to_string(root.join(".jano/project.json")).unwrap();
        assert!(!project_json.contains(&root.to_string_lossy().to_string()));
    }

    #[test]
    fn discovers_existing_projects_beside_a_known_project() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        let first = service
            .create_project(parent.path(), "First")
            .expect("first project");
        service
            .create_project(parent.path(), "Second")
            .expect("second project");

        let discovered = service.discover_projects(&[first.project.root]);
        assert_eq!(
            discovered
                .iter()
                .map(|project| project.name.as_str())
                .collect::<Vec<_>>(),
            vec!["First", "Second"]
        );
    }

    #[test]
    fn discovers_a_pair_and_preserves_identity_after_a_rename() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service
            .create_project(parent.path(), "Study")
            .expect("project should be created");
        let root = parent.path().join("Study");
        fs::write(root.join("Study_orig/article.pdf"), b"original bytes").unwrap();
        fs::write(root.join("Study_trad/article.md"), b"translated text").unwrap();

        let first = service.open_project(&root).expect("project should open");
        assert_eq!(first.documents.len(), 1);
        assert_eq!(first.documents[0].pair_state, PairState::Paired);
        let document_id = first.documents[0].document_id.clone();

        fs::create_dir(root.join("Study_orig/archive")).unwrap();
        fs::rename(
            root.join("Study_orig/article.pdf"),
            root.join("Study_orig/archive/renamed.pdf"),
        )
        .unwrap();

        let second = service.open_project(&root).expect("project should reopen");
        assert_eq!(second.documents.len(), 1);
        assert_eq!(second.documents[0].document_id, document_id);
        assert_eq!(second.documents[0].pair_state, PairState::ManuallyLinked);
        assert_eq!(
            second.documents[0].original.as_ref().unwrap().relative_path,
            "Study_orig/archive/renamed.pdf"
        );

        let documents_json = fs::read_to_string(root.join(".jano/documents.json")).unwrap();
        assert!(!documents_json.contains(&root.to_string_lossy().to_string()));
    }

    #[test]
    fn reports_a_missing_translation() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Solo").unwrap();
        let root = parent.path().join("Solo");
        fs::write(root.join("Solo_orig/source.pdf"), b"source").unwrap();

        let snapshot = service.open_project(&root).unwrap();
        assert_eq!(
            snapshot.documents[0].pair_state,
            PairState::MissingTranslation
        );
    }

    #[test]
    fn reports_an_unavailable_file_without_discarding_its_identity() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Archive").unwrap();
        let root = parent.path().join("Archive");
        let source = root.join("Archive_orig/source.pdf");
        fs::write(&source, b"source").unwrap();

        let first = service.open_project(&root).unwrap();
        let document_id = first.documents[0].document_id.clone();
        fs::remove_file(source).unwrap();

        let second = service.open_project(&root).unwrap();
        assert_eq!(second.documents[0].document_id, document_id);
        assert_eq!(second.documents[0].pair_state, PairState::Unavailable);
    }

    #[test]
    fn reports_duplicate_translation_candidates_as_conflicts() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Conflict").unwrap();
        let root = parent.path().join("Conflict");
        fs::write(root.join("Conflict_orig/paper.pdf"), b"source").unwrap();
        fs::write(root.join("Conflict_trad/paper.pdf"), b"translated pdf").unwrap();
        fs::write(root.join("Conflict_trad/paper.md"), b"translated markdown").unwrap();

        let snapshot = service.open_project(&root).unwrap();
        assert_eq!(snapshot.documents.len(), 2);
        assert!(snapshot
            .documents
            .iter()
            .all(|document| document.pair_state == PairState::Conflict));
    }

    #[test]
    fn reads_only_pdfs_from_the_originals_directory() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Reader").unwrap();
        let root = parent.path().join("Reader");
        fs::write(root.join("Reader_orig/paper.pdf"), b"%PDF-test").unwrap();
        fs::write(root.join("Reader_trad/paper.pdf"), b"translated").unwrap();

        assert_eq!(
            service
                .read_original_pdf(&root, "Reader_orig/paper.pdf")
                .unwrap(),
            b"%PDF-test"
        );
        assert!(service
            .read_original_pdf(&root, "Reader_trad/paper.pdf")
            .is_err());
        assert!(service.read_original_pdf(&root, "../outside.pdf").is_err());
    }

    #[test]
    fn creates_a_mirrored_nested_folder_and_rejects_traversal() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Folders").unwrap();
        let root = parent.path().join("Folders");

        let snapshot = service
            .create_mirrored_folder(&root, "Theory/Institutions")
            .unwrap();

        assert!(root.join("Folders_orig/Theory/Institutions").is_dir());
        assert!(root.join("Folders_trad/Theory/Institutions").is_dir());
        assert!(snapshot
            .folders
            .iter()
            .any(|folder| folder.relative_path == "Theory/Institutions"));
        assert!(service.create_mirrored_folder(&root, "../Outside").is_err());
        assert!(!parent.path().join("Outside").exists());
    }

    #[test]
    fn imports_a_paired_document_into_a_nested_logical_folder() {
        let parent = tempdir().expect("temporary directory");
        let external = tempdir().expect("external directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Import").unwrap();
        let root = parent.path().join("Import");
        let original = external.path().join("Paper.pdf");
        let translation = external.path().join("Traduccion.md");
        fs::write(&original, b"source").unwrap();
        fs::write(&translation, b"translation").unwrap();

        let snapshot = service
            .import_document(&root, &original, Some(&translation), "Theory/Institutions")
            .unwrap();

        assert!(root
            .join("Import_orig/Theory/Institutions/Paper.pdf")
            .is_file());
        assert!(root
            .join("Import_trad/Theory/Institutions/Paper.md")
            .is_file());
        assert_eq!(snapshot.documents.len(), 1);
        assert_eq!(snapshot.documents[0].pair_state, PairState::Paired);
    }

    #[test]
    fn refuses_to_overwrite_an_imported_document() {
        let parent = tempdir().expect("temporary directory");
        let external = tempdir().expect("external directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Import").unwrap();
        let root = parent.path().join("Import");
        let original = external.path().join("Paper.pdf");
        fs::write(&original, b"source").unwrap();

        service.import_document(&root, &original, None, "").unwrap();
        assert!(service.import_document(&root, &original, None, "").is_err());
        assert_eq!(
            fs::read(root.join("Import_orig/Paper.pdf")).unwrap(),
            b"source"
        );
    }

    #[test]
    fn hides_and_restores_a_document_without_changing_user_files() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Hidden").unwrap();
        let root = parent.path().join("Hidden");
        let source = root.join("Hidden_orig/paper.pdf");
        fs::write(&source, b"source").unwrap();

        let opened = service.open_project(&root).unwrap();
        let document_id = opened.documents[0].document_id.clone();
        let hidden = service
            .remove_document(&root, &document_id, "hide")
            .unwrap();

        assert!(source.is_file());
        assert!(hidden.documents.is_empty());
        assert_eq!(hidden.hidden_documents.len(), 1);

        let refreshed = service.open_project(&root).unwrap();
        assert!(refreshed.documents.is_empty());
        assert_eq!(refreshed.hidden_documents[0].document_id, document_id);

        let restored = service.restore_document(&root, &document_id).unwrap();
        assert_eq!(restored.documents[0].document_id, document_id);
        assert!(restored.hidden_documents.is_empty());
    }

    #[test]
    fn deletes_only_the_explicitly_selected_counterpart() {
        let parent = tempdir().expect("temporary directory");
        let service = ProjectService;
        service.create_project(parent.path(), "Removal").unwrap();
        let root = parent.path().join("Removal");
        let original = root.join("Removal_orig/paper.pdf");
        let translation = root.join("Removal_trad/paper.md");
        fs::write(&original, b"source").unwrap();
        fs::write(&translation, b"translation").unwrap();

        let opened = service.open_project(&root).unwrap();
        let document_id = opened.documents[0].document_id.clone();
        let result = service
            .remove_document(&root, &document_id, "delete-original")
            .unwrap();

        assert!(!original.exists());
        assert!(translation.is_file());
        assert_eq!(result.documents.len(), 1);
        assert_eq!(result.documents[0].document_id, document_id);
        assert_eq!(result.documents[0].pair_state, PairState::MissingOriginal);
    }
}
