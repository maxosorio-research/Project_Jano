use std::{fs, path::Path};

use serde::{de::DeserializeOwned, Serialize};

use crate::{
    domain::project::{DocumentCatalog, ProjectConfig},
    error::{ProjectError, ProjectResult},
};

const STATE_DIRECTORY: &str = ".jano";
const PROJECT_FILE: &str = "project.json";
const DOCUMENTS_FILE: &str = "documents.json";

pub struct ProjectRepository;

impl ProjectRepository {
    pub fn initialize(root: &Path, config: &ProjectConfig) -> ProjectResult<()> {
        let state_dir = root.join(STATE_DIRECTORY);
        fs::create_dir(&state_dir)
            .map_err(|error| ProjectError::io("Could not create the .jano directory", error))?;
        Self::write_json(&state_dir.join(PROJECT_FILE), config)?;
        Self::write_json(&state_dir.join(DOCUMENTS_FILE), &DocumentCatalog::default())
    }

    pub fn load_config(root: &Path) -> ProjectResult<ProjectConfig> {
        Self::read_json(&root.join(STATE_DIRECTORY).join(PROJECT_FILE))
    }

    pub fn load_catalog(root: &Path) -> ProjectResult<DocumentCatalog> {
        let path = root.join(STATE_DIRECTORY).join(DOCUMENTS_FILE);
        if !path.exists() {
            return Ok(DocumentCatalog::default());
        }
        Self::read_json(&path)
    }

    pub fn save_catalog(root: &Path, catalog: &DocumentCatalog) -> ProjectResult<()> {
        Self::write_json(&root.join(STATE_DIRECTORY).join(DOCUMENTS_FILE), catalog)
    }

    fn read_json<T: DeserializeOwned>(path: &Path) -> ProjectResult<T> {
        let contents = fs::read(path).map_err(|error| {
            ProjectError::io(format!("Could not read {}", path.display()), error)
        })?;
        serde_json::from_slice(&contents).map_err(|error| {
            ProjectError::json(format!("Could not parse {}", path.display()), error)
        })
    }

    fn write_json<T: Serialize>(path: &Path, value: &T) -> ProjectResult<()> {
        let mut contents = serde_json::to_vec_pretty(value).map_err(|error| {
            ProjectError::json(format!("Could not serialize {}", path.display()), error)
        })?;
        contents.push(b'\n');
        fs::write(path, contents)
            .map_err(|error| ProjectError::io(format!("Could not write {}", path.display()), error))
    }
}
