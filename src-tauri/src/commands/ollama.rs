use crate::{
    application::ollama_service::OllamaService,
    domain::ollama::{
        OllamaSmokeTestResult, OllamaStatus, ReviewInputSegment, TranslationBatchResult,
        TranslationInputSegment,
    },
};

#[tauri::command]
pub async fn inspect_ollama() -> OllamaStatus {
    OllamaService.inspect().await
}

#[tauri::command]
pub async fn review_segments(
    model: String,
    target_language: String,
    review_level: String,
    segments: Vec<ReviewInputSegment>,
) -> Result<TranslationBatchResult, String> {
    OllamaService
        .review_segments(&model, &target_language, &review_level, &segments)
        .await
}

#[tauri::command]
pub async fn translate_segments(
    model: String,
    target_language: String,
    segments: Vec<TranslationInputSegment>,
) -> Result<TranslationBatchResult, String> {
    OllamaService
        .translate_segments(&model, &target_language, &segments)
        .await
}

#[tauri::command]
pub async fn run_ollama_smoke_test(
    model: String,
    target_language: String,
) -> Result<OllamaSmokeTestResult, String> {
    OllamaService.smoke_test(&model, &target_language).await
}
