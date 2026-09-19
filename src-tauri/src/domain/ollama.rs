use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatus {
    pub available: bool,
    pub endpoint: String,
    pub version: Option<String>,
    pub models: Vec<OllamaModel>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaSmokeTestResult {
    pub model: String,
    pub source_text: String,
    pub translated_text: String,
    pub elapsed_ms: u128,
    pub prompt_token_count: Option<u64>,
    pub output_token_count: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationInputSegment {
    pub segment_id: String,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewInputSegment {
    pub segment_id: String,
    pub source_text: String,
    pub base_text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslatedSegment {
    pub segment_id: String,
    pub text: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationBatchResult {
    pub segments: Vec<TranslatedSegment>,
    pub elapsed_ms: u128,
    pub prompt_token_count: Option<u64>,
    pub output_token_count: Option<u64>,
}
