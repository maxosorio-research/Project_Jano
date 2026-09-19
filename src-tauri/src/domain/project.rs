use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    pub project_id: String,
    pub name: String,
    pub schema_version: u32,
    pub original_dir: String,
    pub translation_dir: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub project_id: String,
    pub name: String,
    pub root: String,
    pub schema_version: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredProject {
    pub project_id: String,
    pub name: String,
    pub root: String,
    pub modified_at: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentFileRef {
    pub relative_path: String,
    pub sha256: String,
    pub size: u64,
    pub modified_at: u64,
    pub media_type: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    pub document_id: String,
    pub original: Option<DocumentFileRef>,
    pub translation: Option<DocumentFileRef>,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentCatalog {
    pub schema_version: u32,
    pub documents: Vec<DocumentRecord>,
}

impl Default for DocumentCatalog {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            documents: Vec::new(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PairState {
    Paired,
    MissingOriginal,
    MissingTranslation,
    Unavailable,
    ManuallyLinked,
    Conflict,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    pub document_id: String,
    pub title: String,
    pub pair_state: PairState,
    pub original: Option<DocumentFileRef>,
    pub translation: Option<DocumentFileRef>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFolder {
    pub relative_path: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub project: Project,
    pub documents: Vec<DocumentSummary>,
    pub hidden_documents: Vec<DocumentSummary>,
    pub folders: Vec<ProjectFolder>,
}
