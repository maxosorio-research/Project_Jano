use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSegmentRecord {
    pub segment_id: String,
    pub page: u32,
    pub block_type: String,
    pub text: String,
    pub extraction_method: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslatedSegmentRecord {
    pub segment_id: String,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewed_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_status: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub review_warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MathObjectRecord {
    pub math_id: String,
    pub segment_id: String,
    #[serde(rename = "type")]
    pub math_type: String,
    pub page: u32,
    pub placeholder: String,
    pub source: String,
    pub latex: Option<String>,
    pub confidence: f64,
    pub original_crop: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingMetadata {
    pub model: String,
    pub source_language: String,
    pub target_language: String,
    pub created_at: String,
    pub native_page_count: u32,
    pub ocr_page_count: u32,
    pub review_level: String,
    pub reviewed_segment_count: u32,
    pub base_retained_segment_count: u32,
    pub math_object_count: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentProcessingPayload {
    pub source_text: String,
    pub segments: Vec<SourceSegmentRecord>,
    pub translations: Vec<TranslatedSegmentRecord>,
    pub math_objects: Vec<MathObjectRecord>,
    pub markdown: String,
    pub metadata: ProcessingMetadata,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentRecord {
    pub alignment_id: String,
    pub source_segment_ids: Vec<String>,
    pub target_segment_ids: Vec<String>,
    #[serde(rename = "type")]
    pub alignment_type: String,
    pub method: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderDocumentRecord {
    pub segments: Vec<SourceSegmentRecord>,
    pub translations: Vec<TranslatedSegmentRecord>,
    pub alignments: Vec<AlignmentRecord>,
}
