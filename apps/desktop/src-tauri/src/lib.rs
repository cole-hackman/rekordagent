mod audio;

use std::path::Path;
use tauri::Manager;

// ── Config helpers ────────────────────────────────────────────────────────────

fn read_config(app: &tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("config.json");
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn write_config(app: &tauri::AppHandle, config: &serde_json::Value) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let path = config_dir.join("config.json");
    std::fs::write(&path, serde_json::to_string_pretty(config).unwrap()).map_err(|e| e.to_string())
}

// ── Library commands ─────────────────────────────────────────────────────────

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
async fn list_tracks(path: String) -> Result<Vec<decks_core::rekordbox_db::Track>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.tracks().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_track_cues(
    path: String,
    track_id: String,
) -> Result<Vec<decks_core::rekordbox_db::HotCue>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.hot_cues_for_track(&track_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_library_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let config = read_config(&app)?;
    Ok(config["library_path"].as_str().map(|s| s.to_owned()))
}

#[tauri::command]
async fn set_library_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut config = read_config(&app)?;
    config["library_path"] = serde_json::json!(path);
    write_config(&app, &config)
}

#[tauri::command]
async fn library_search(
    path: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<decks_core::rekordbox_db::Track>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        let mut results = db.search_tracks(&query).map_err(|e| e.to_string())?;
        if let Some(n) = limit {
            results.truncate(n);
        }
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_playlists(path: String) -> Result<Vec<decks_core::rekordbox_db::Playlist>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.playlists().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn health_orphan_scan(path: String) -> Result<Vec<decks_core::rekordbox_db::Track>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        let tracks = db.tracks().map_err(|e| e.to_string())?;
        Ok(tracks
            .into_iter()
            .filter(|t| {
                t.folder_path
                    .as_deref()
                    .map(|p| !Path::new(p).exists())
                    .unwrap_or(false)
            })
            .collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── Settings commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn get_theme(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let config = read_config(&app)?;
    Ok(config["theme"].as_str().map(|s| s.to_owned()))
}

#[tauri::command]
async fn set_theme(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    let mut config = read_config(&app)?;
    config["theme"] = serde_json::json!(theme);
    write_config(&app, &config)
}

#[tauri::command]
async fn get_api_key(service: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = keyring::Entry::new("decks", &service).map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(pw) => Ok(Some(pw)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn set_api_key(service: String, key: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = keyring::Entry::new("decks", &service).map_err(|e| e.to_string())?;
        entry.set_password(&key).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn delete_api_key(service: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = keyring::Entry::new("decks", &service).map_err(|e| e.to_string())?;
        match entry.delete_password() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── Audio commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn play_track(
    path: String,
    player: tauri::State<'_, audio::AudioPlayer>,
) -> Result<(), String> {
    if path.is_empty() {
        return Err("empty path".into());
    }
    player.send(audio::AudioCmd::Play(std::path::PathBuf::from(path)))
}

#[tauri::command]
async fn pause_audio(player: tauri::State<'_, audio::AudioPlayer>) -> Result<(), String> {
    player.send(audio::AudioCmd::Pause)
}

#[tauri::command]
async fn resume_audio(player: tauri::State<'_, audio::AudioPlayer>) -> Result<(), String> {
    player.send(audio::AudioCmd::Resume)
}

#[tauri::command]
async fn stop_audio(player: tauri::State<'_, audio::AudioPlayer>) -> Result<(), String> {
    player.send(audio::AudioCmd::Stop)
}

#[tauri::command]
async fn get_playback_state(
    player: tauri::State<'_, audio::AudioPlayer>,
) -> Result<audio::PlaybackState, String> {
    Ok(player.playback_state())
}

// ── App entry point ───────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(audio::AudioPlayer::new())
        .invoke_handler(tauri::generate_handler![
            validate_library_path,
            list_tracks,
            get_track_cues,
            get_library_path,
            set_library_path,
            library_search,
            list_playlists,
            health_orphan_scan,
            get_theme,
            set_theme,
            get_api_key,
            set_api_key,
            delete_api_key,
            play_track,
            pause_audio,
            resume_audio,
            stop_audio,
            get_playback_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running decks");
}
