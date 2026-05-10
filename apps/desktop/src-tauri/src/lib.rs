use std::path::Path;
use tauri::Manager;

#[tauri::command]
async fn validate_library_path(path: String) -> Result<u64, String> {
    let p = path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&p);
        if !path.exists() {
            return Err("File not found".into());
        }
        let db = decks_core::rekordbox_db::RekordboxDb::open(path).map_err(|e| e.to_string())?;
        let tracks = db.tracks().map_err(|e| e.to_string())?;
        Ok(tracks.len() as u64)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_tracks(
    path: String,
) -> Result<Vec<decks_core::rekordbox_db::Track>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.tracks().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_library_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    let config_file = config_dir.join("config.json");
    if !config_file.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&config_file).map_err(|e| e.to_string())?;
    let config: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config["library_path"].as_str().map(|s| s.to_owned()))
}

#[tauri::command]
async fn set_library_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_file = config_dir.join("config.json");
    let config = serde_json::json!({ "library_path": path });
    std::fs::write(
        &config_file,
        serde_json::to_string_pretty(&config).unwrap(),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            validate_library_path,
            list_tracks,
            get_library_path,
            set_library_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running decks");
}
