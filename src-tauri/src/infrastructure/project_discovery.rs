use std::{
    collections::{BTreeSet, HashMap, HashSet},
    fs::{self, File},
    io::{BufReader, Read},
    path::{Component, Path, PathBuf},
    time::UNIX_EPOCH,
};

use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    domain::project::{
        DocumentCatalog, DocumentFileRef, DocumentRecord, DocumentSummary, PairState,
        ProjectConfig, ProjectFolder, SCHEMA_VERSION,
    },
    error::{ProjectError, ProjectResult},
};

#[derive(Clone)]
struct DiscoveredFile {
    reference: DocumentFileRef,
    pair_key: String,
}

pub struct ProjectDiscovery;

impl ProjectDiscovery {
    pub fn reconcile(
        root: &Path,
        config: &ProjectConfig,
        mut catalog: DocumentCatalog,
    ) -> ProjectResult<(DocumentCatalog, Vec<DocumentSummary>)> {
        let originals = Self::scan(root, &config.original_dir, &["pdf"])?;
        let translations = Self::scan(
            root,
            &config.translation_dir,
            &["pdf", "md", "markdown", "txt"],
        )?;

        let mut original_available = HashSet::new();
        let mut translation_available = HashSet::new();
        let mut unused_originals: HashSet<usize> = (0..originals.len()).collect();
        let mut unused_translations: HashSet<usize> = (0..translations.len()).collect();

        for document in &mut catalog.documents {
            Self::refresh_reference(
                &mut document.original,
                &originals,
                &mut unused_originals,
                &mut original_available,
            );
            Self::refresh_reference(
                &mut document.translation,
                &translations,
                &mut unused_translations,
                &mut translation_available,
            );
        }

        for document in &mut catalog.documents {
            if document.original.is_none() {
                if let Some(counterpart) = document.translation.as_ref() {
                    let key = pair_key(&counterpart.relative_path, &config.translation_dir);
                    if let Some(index) = take_by_key(&originals, &mut unused_originals, &key) {
                        document.original = Some(originals[index].reference.clone());
                        original_available.insert(originals[index].reference.relative_path.clone());
                    }
                }
            }
            if document.translation.is_none() {
                if let Some(counterpart) = document.original.as_ref() {
                    let key = pair_key(&counterpart.relative_path, &config.original_dir);
                    if let Some(index) = take_by_key(&translations, &mut unused_translations, &key)
                    {
                        document.translation = Some(translations[index].reference.clone());
                        translation_available
                            .insert(translations[index].reference.relative_path.clone());
                    }
                }
            }
        }

        let mut grouped: HashMap<String, (Vec<usize>, Vec<usize>)> = HashMap::new();
        for index in &unused_originals {
            grouped
                .entry(originals[*index].pair_key.clone())
                .or_default()
                .0
                .push(*index);
        }
        for index in &unused_translations {
            grouped
                .entry(translations[*index].pair_key.clone())
                .or_default()
                .1
                .push(*index);
        }

        let mut keys: Vec<_> = grouped.into_iter().collect();
        keys.sort_by(|left, right| left.0.cmp(&right.0));
        for (_, (mut original_indexes, mut translation_indexes)) in keys {
            original_indexes.sort_unstable();
            translation_indexes.sort_unstable();
            let count = original_indexes.len().max(translation_indexes.len());
            for offset in 0..count {
                let original = original_indexes
                    .get(offset)
                    .map(|index| originals[*index].reference.clone());
                let translation = translation_indexes
                    .get(offset)
                    .map(|index| translations[*index].reference.clone());
                if let Some(reference) = &original {
                    original_available.insert(reference.relative_path.clone());
                }
                if let Some(reference) = &translation {
                    translation_available.insert(reference.relative_path.clone());
                }
                catalog.documents.push(DocumentRecord {
                    document_id: Uuid::new_v4().to_string(),
                    original,
                    translation,
                    hidden: false,
                });
            }
        }

        catalog.schema_version = SCHEMA_VERSION;
        let conflict_keys = conflict_keys(
            &catalog.documents,
            config,
            &original_available,
            &translation_available,
        );
        let mut summaries: Vec<_> = catalog
            .documents
            .iter()
            .filter(|document| !document.hidden)
            .map(|document| {
                summarize(
                    document,
                    config,
                    &original_available,
                    &translation_available,
                    &conflict_keys,
                )
            })
            .collect();
        summaries.sort_by_key(|item| item.title.to_lowercase());
        Ok((catalog, summaries))
    }

    pub fn folders(root: &Path, config: &ProjectConfig) -> ProjectResult<Vec<ProjectFolder>> {
        let mut paths = BTreeSet::new();
        Self::collect_folders(&root.join(&config.original_dir), Path::new(""), &mut paths)?;
        Self::collect_folders(
            &root.join(&config.translation_dir),
            Path::new(""),
            &mut paths,
        )?;
        Ok(paths
            .into_iter()
            .map(|relative_path| ProjectFolder {
                name: relative_path
                    .rsplit('/')
                    .next()
                    .unwrap_or(&relative_path)
                    .to_owned(),
                relative_path,
            })
            .collect())
    }

    fn collect_folders(
        directory: &Path,
        relative: &Path,
        folders: &mut BTreeSet<String>,
    ) -> ProjectResult<()> {
        for entry in fs::read_dir(directory).map_err(|error| {
            ProjectError::io(format!("Could not scan {}", directory.display()), error)
        })? {
            let entry = entry.map_err(|error| {
                ProjectError::io(format!("Could not scan {}", directory.display()), error)
            })?;
            let file_type = entry.file_type().map_err(|error| {
                ProjectError::io(
                    format!("Could not inspect {}", entry.path().display()),
                    error,
                )
            })?;
            if file_type.is_symlink() || !file_type.is_dir() {
                continue;
            }
            let child = relative.join(entry.file_name());
            let normalized = child
                .components()
                .filter_map(|component| match component {
                    Component::Normal(value) => Some(value.to_string_lossy()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("/");
            folders.insert(normalized);
            Self::collect_folders(&entry.path(), &child, folders)?;
        }
        Ok(())
    }

    fn refresh_reference(
        reference: &mut Option<DocumentFileRef>,
        discovered: &[DiscoveredFile],
        unused: &mut HashSet<usize>,
        available: &mut HashSet<String>,
    ) {
        let Some(previous) = reference.as_ref() else {
            return;
        };
        let exact = unused
            .iter()
            .copied()
            .find(|index| discovered[*index].reference.relative_path == previous.relative_path);
        let matched = exact.or_else(|| {
            unused.iter().copied().find(|index| {
                discovered[*index].reference.sha256 == previous.sha256
                    && discovered[*index].reference.size == previous.size
            })
        });
        if let Some(index) = matched {
            let current = discovered[index].reference.clone();
            unused.remove(&index);
            available.insert(current.relative_path.clone());
            *reference = Some(current);
        }
    }

    fn scan(
        root: &Path,
        directory: &str,
        extensions: &[&str],
    ) -> ProjectResult<Vec<DiscoveredFile>> {
        let base = root.join(directory);
        let mut paths = Vec::new();
        Self::collect_files(&base, extensions, &mut paths)?;
        paths.sort();
        paths
            .into_iter()
            .map(|path| {
                let relative_path = relative_path(root, &path)?;
                let metadata = fs::metadata(&path).map_err(|error| {
                    ProjectError::io(format!("Could not inspect {}", path.display()), error)
                })?;
                let modified_at = metadata
                    .modified()
                    .ok()
                    .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                    .map_or(0, |value| value.as_secs());
                let extension = path
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default()
                    .to_lowercase();
                let media_type = match extension.as_str() {
                    "pdf" => "application/pdf",
                    "md" | "markdown" => "text/markdown",
                    _ => "text/plain",
                };
                Ok(DiscoveredFile {
                    pair_key: pair_key(&relative_path, directory),
                    reference: DocumentFileRef {
                        relative_path,
                        sha256: sha256(&path)?,
                        size: metadata.len(),
                        modified_at,
                        media_type: media_type.to_owned(),
                    },
                })
            })
            .collect()
    }

    fn collect_files(
        directory: &Path,
        extensions: &[&str],
        files: &mut Vec<PathBuf>,
    ) -> ProjectResult<()> {
        let entries = fs::read_dir(directory).map_err(|error| {
            ProjectError::io(format!("Could not scan {}", directory.display()), error)
        })?;
        for entry in entries {
            let entry = entry.map_err(|error| {
                ProjectError::io(format!("Could not scan {}", directory.display()), error)
            })?;
            let file_type = entry.file_type().map_err(|error| {
                ProjectError::io(
                    format!("Could not inspect {}", entry.path().display()),
                    error,
                )
            })?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                Self::collect_files(&entry.path(), extensions, files)?;
            } else if file_type.is_file()
                && entry
                    .path()
                    .extension()
                    .and_then(|value| value.to_str())
                    .is_some_and(|value| extensions.contains(&value.to_lowercase().as_str()))
            {
                files.push(entry.path());
            }
        }
        Ok(())
    }
}

fn take_by_key(
    discovered: &[DiscoveredFile],
    unused: &mut HashSet<usize>,
    key: &str,
) -> Option<usize> {
    let index = unused
        .iter()
        .copied()
        .filter(|index| discovered[*index].pair_key == key)
        .min();
    if let Some(index) = index {
        unused.remove(&index);
    }
    index
}

fn summarize(
    document: &DocumentRecord,
    config: &ProjectConfig,
    original_available: &HashSet<String>,
    translation_available: &HashSet<String>,
    conflict_keys: &HashSet<String>,
) -> DocumentSummary {
    let original_exists = document
        .original
        .as_ref()
        .is_some_and(|file| original_available.contains(&file.relative_path));
    let translation_exists = document
        .translation
        .as_ref()
        .is_some_and(|file| translation_available.contains(&file.relative_path));
    let original_key = document
        .original
        .as_ref()
        .map(|file| pair_key(&file.relative_path, &config.original_dir));
    let translation_key = document
        .translation
        .as_ref()
        .map(|file| pair_key(&file.relative_path, &config.translation_dir));
    let key = original_key.as_ref().or(translation_key.as_ref());
    let pair_state = if key.is_some_and(|key| conflict_keys.contains(key)) {
        PairState::Conflict
    } else if (document.original.is_some() && !original_exists)
        || (document.translation.is_some() && !translation_exists)
    {
        PairState::Unavailable
    } else {
        match (original_exists, translation_exists) {
            (true, true) if original_key == translation_key => PairState::Paired,
            (true, true) => PairState::ManuallyLinked,
            (true, false) => PairState::MissingTranslation,
            (false, true) => PairState::MissingOriginal,
            (false, false) => PairState::Unavailable,
        }
    };
    let title = key
        .and_then(|value| value.rsplit('/').next())
        .filter(|value| !value.is_empty())
        .unwrap_or("Untitled document")
        .to_owned();
    DocumentSummary {
        document_id: document.document_id.clone(),
        title,
        pair_state,
        original: document.original.clone(),
        translation: document.translation.clone(),
    }
}

fn conflict_keys(
    documents: &[DocumentRecord],
    config: &ProjectConfig,
    original_available: &HashSet<String>,
    translation_available: &HashSet<String>,
) -> HashSet<String> {
    let mut original_counts: HashMap<String, usize> = HashMap::new();
    let mut translation_counts: HashMap<String, usize> = HashMap::new();
    for document in documents {
        if let Some(file) = &document.original {
            if original_available.contains(&file.relative_path) {
                *original_counts
                    .entry(pair_key(&file.relative_path, &config.original_dir))
                    .or_default() += 1;
            }
        }
        if let Some(file) = &document.translation {
            if translation_available.contains(&file.relative_path) {
                *translation_counts
                    .entry(pair_key(&file.relative_path, &config.translation_dir))
                    .or_default() += 1;
            }
        }
    }
    original_counts
        .into_iter()
        .filter_map(|(key, count)| (count > 1).then_some(key))
        .chain(
            translation_counts
                .into_iter()
                .filter_map(|(key, count)| (count > 1).then_some(key)),
        )
        .collect()
}

fn relative_path(root: &Path, path: &Path) -> ProjectResult<String> {
    path.strip_prefix(root)
        .map_err(|_| ProjectError::Invalid("A discovered file escaped the project root.".into()))
        .map(|relative| {
            relative
                .components()
                .filter_map(|component| match component {
                    Component::Normal(value) => Some(value.to_string_lossy()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("/")
        })
}

fn pair_key(relative_path: &str, directory: &str) -> String {
    let normalized = relative_path.replace('\\', "/");
    let prefix = format!("{}/", directory.replace('\\', "/"));
    let without_directory = normalized.strip_prefix(&prefix).unwrap_or(&normalized);
    let path = Path::new(without_directory);
    let parent = path.parent().filter(|value| !value.as_os_str().is_empty());
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let stem = [".es", ".en", ".pt", ".fr", ".de"]
        .iter()
        .find_map(|suffix| stem.to_lowercase().strip_suffix(suffix).map(str::to_owned))
        .unwrap_or_else(|| stem.to_owned());
    parent
        .map(|value| format!("{}/{}", value.to_string_lossy().replace('\\', "/"), stem))
        .unwrap_or_else(|| stem.to_owned())
        .to_lowercase()
}

fn sha256(path: &Path) -> ProjectResult<String> {
    let file = File::open(path)
        .map_err(|error| ProjectError::io(format!("Could not open {}", path.display()), error))?;
    let mut reader = BufReader::new(file);
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let bytes = reader.read(&mut buffer).map_err(|error| {
            ProjectError::io(format!("Could not read {}", path.display()), error)
        })?;
        if bytes == 0 {
            break;
        }
        digest.update(&buffer[..bytes]);
    }
    Ok(format!("{:x}", digest.finalize()))
}
