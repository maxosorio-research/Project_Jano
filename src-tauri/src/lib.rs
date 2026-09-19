mod application;
mod commands;
mod domain;
mod error;
mod infrastructure;

pub fn window_title() -> &'static str {
    "Jano"
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::open_project,
            commands::project::discover_projects,
            commands::project::create_mirrored_folder,
            commands::project::import_document,
            commands::project::remove_document,
            commands::project::restore_document,
            commands::project::read_original_pdf,
            commands::processing::save_processed_document,
            commands::processing::read_translation_text,
            commands::processing::read_reader_document,
            commands::ollama::inspect_ollama,
            commands::ollama::run_ollama_smoke_test,
            commands::ollama::translate_segments,
            commands::ollama::review_segments
        ])
        .run(tauri::generate_context!())
        .expect("error while running Jano");
}

#[cfg(test)]
mod tests {
    use super::window_title;

    #[test]
    fn window_title_matches_product_name() {
        assert_eq!(window_title(), "Jano");
    }
}
