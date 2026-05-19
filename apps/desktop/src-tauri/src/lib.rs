mod audio;
mod claude_agent;

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
async fn list_playlist_entries(
    path: String,
    playlist_id: String,
) -> Result<Vec<decks_core::rekordbox_db::PlaylistEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.playlist_entries(&playlist_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_track_by_id(
    path: String,
    track_id: String,
) -> Result<Option<decks_core::rekordbox_db::Track>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.track_by_id(&track_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Find tracks that are likely duplicates (same normalized title + artist).
#[tauri::command]
async fn health_duplicate_scan(
    path: String,
) -> Result<Vec<Vec<decks_core::rekordbox_db::Track>>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        let tracks = db.tracks().map_err(|e| e.to_string())?;

        // Group by (normalized_title, normalized_artist).
        use std::collections::HashMap;
        let mut groups: HashMap<(String, String), Vec<decks_core::rekordbox_db::Track>> =
            HashMap::new();
        for t in tracks {
            let key = (
                t.title.to_lowercase().trim().to_string(),
                t.artist
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .trim()
                    .to_string(),
            );
            groups.entry(key).or_default().push(t);
        }
        Ok(groups
            .into_values()
            .filter(|g| g.len() > 1)
            .collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Find tracks with missing or suspicious metadata (no BPM, no key, no artist,
/// BPM outside the 40–220 range).
#[tauri::command]
async fn health_broken_link_scan(
    path: String,
) -> Result<Vec<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        let tracks = db.tracks().map_err(|e| e.to_string())?;
        let issues = tracks
            .into_iter()
            .filter_map(|t| {
                let mut problems: Vec<&str> = vec![];
                if t.bpm.is_none() {
                    problems.push("missing_bpm");
                } else if t.bpm.map(|b| b < 40.0 || b > 220.0).unwrap_or(false) {
                    problems.push("bpm_out_of_range");
                }
                if t.musical_key.is_none() {
                    problems.push("missing_key");
                }
                if t.artist.is_none() {
                    problems.push("missing_artist");
                }
                if problems.is_empty() {
                    return None;
                }
                Some(serde_json::json!({
                    "track": t,
                    "problems": problems,
                }))
            })
            .collect();
        Ok(issues)
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

// ── Claude CLI agent ──────────────────────────────────────────────────────────

/// Check whether the `claude` binary is on PATH.
#[tauri::command]
async fn claude_available() -> bool {
    tokio::process::Command::new("claude")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Send a message to the claude CLI and stream the response back via a
/// per-request Tauri event named `event_name`.  Returns the session_id for
/// conversation continuity.
#[tauri::command]
async fn chat_with_claude(
    app: tauri::AppHandle,
    message: String,
    session_id: Option<String>,
    event_name: String,
) -> Result<String, String> {
    claude_agent::chat(app, message, session_id, event_name).await
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
            list_playlist_entries,
            get_track_by_id,
            health_duplicate_scan,
            health_broken_link_scan,
            claude_available,
            chat_with_claude,
        ])
        .run(tauri::generate_context!())
        .expect("error while running decks");
}
