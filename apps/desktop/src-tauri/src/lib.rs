mod audio;

use std::collections::HashMap;
use std::path::Path;
use tauri::Manager;

#[derive(serde::Serialize)]
struct PlaylistDetail {
    playlist: decks_core::rekordbox_db::Playlist,
    tracks: Vec<decks_core::rekordbox_db::Track>,
}

#[derive(serde::Serialize)]
struct ExportResult {
    output_path: String,
    exported_count: usize,
}

fn cache_db(app: &tauri::AppHandle) -> Result<cache::CacheDb, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    cache::CacheDb::open(&data_dir.join("cache.sqlite3")).map_err(|e| e.to_string())
}

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
async fn get_track(
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
async fn get_playlist(path: String, playlist_id: String) -> Result<Option<PlaylistDetail>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        let Some(playlist) = db.playlist_by_id(&playlist_id).map_err(|e| e.to_string())? else {
            return Ok(None);
        };
        let entries = db
            .playlist_entries(&playlist_id)
            .map_err(|e| e.to_string())?;
        let mut tracks = Vec::new();
        for entry in entries {
            if let Some(track) = db
                .track_by_id(&entry.content_id)
                .map_err(|e| e.to_string())?
            {
                tracks.push(track);
            }
        }
        Ok(Some(PlaylistDetail { playlist, tracks }))
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

#[tauri::command]
async fn health_duplicate_scan(
    path: String,
) -> Result<Vec<decks_core::rekordbox_db::DuplicateGroup>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.duplicate_tracks().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn health_broken_link_scan(
    path: String,
) -> Result<decks_core::rekordbox_db::BrokenMetadataReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&path))
            .map_err(|e| e.to_string())?;
        db.broken_metadata_report().map_err(|e| e.to_string())
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

// ── Conversation commands ────────────────────────────────────────────────────

#[tauri::command]
async fn list_conversations(
    app: tauri::AppHandle,
    library_path: Option<String>,
) -> Result<Vec<cache::Conversation>, String> {
    let db = cache_db(&app)?;
    db.list_conversations(library_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_conversation(
    app: tauri::AppHandle,
    library_path: Option<String>,
    title: String,
) -> Result<cache::Conversation, String> {
    let db = cache_db(&app)?;
    db.create_conversation(library_path.as_deref(), &title)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_conversation(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<cache::ConversationWithMessages>, String> {
    let db = cache_db(&app)?;
    db.load_conversation(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn append_conversation_message(
    app: tauri::AppHandle,
    conversation_id: String,
    role: String,
    content: serde_json::Value,
) -> Result<cache::ConversationMessage, String> {
    let db = cache_db(&app)?;
    db.append_conversation_message(&conversation_id, &role, content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_conversation(
    app: tauri::AppHandle,
    id: String,
    title: String,
) -> Result<(), String> {
    let db = cache_db(&app)?;
    db.rename_conversation(&id, &title)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_conversation(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = cache_db(&app)?;
    db.delete_conversation(&id).map_err(|e| e.to_string())
}

// ── Staged change commands ──────────────────────────────────────────────────

#[tauri::command]
async fn stage_change(
    app: tauri::AppHandle,
    change: changes::NewChange,
) -> Result<cache::StagedChangeRecord, String> {
    let db = cache_db(&app)?;
    db.stage_change(change).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_changes(
    app: tauri::AppHandle,
    library_path: Option<String>,
) -> Result<Vec<cache::StagedChangeRecord>, String> {
    let db = cache_db(&app)?;
    db.list_changes(library_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn accept_change(
    app: tauri::AppHandle,
    id: String,
) -> Result<cache::StagedChangeRecord, String> {
    let db = cache_db(&app)?;
    db.accept_change(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn reject_change(
    app: tauri::AppHandle,
    id: String,
) -> Result<cache::StagedChangeRecord, String> {
    let db = cache_db(&app)?;
    db.reject_change(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn accept_all_safe(
    app: tauri::AppHandle,
    library_path: Option<String>,
) -> Result<Vec<cache::StagedChangeRecord>, String> {
    let db = cache_db(&app)?;
    db.accept_all_safe(library_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn reject_all(
    app: tauri::AppHandle,
    library_path: Option<String>,
) -> Result<Vec<cache::StagedChangeRecord>, String> {
    let db = cache_db(&app)?;
    db.reject_all(library_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_accepted_changes(
    app: tauri::AppHandle,
    library_path: String,
    output_path: String,
) -> Result<ExportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cache = cache_db(&app)?;
        let accepted = cache
            .list_changes(Some(&library_path))
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|change| change.status == changes::ChangeStatus::Accepted)
            .collect::<Vec<_>>();
        if accepted.is_empty() {
            return Err("No accepted changes to export".to_owned());
        }

        let db = decks_core::rekordbox_db::RekordboxDb::open(Path::new(&library_path))
            .map_err(|e| e.to_string())?;
        let tracks = db.tracks().map_err(|e| e.to_string())?;
        let playlists = db.playlists().map_err(|e| e.to_string())?;
        let mut track_id_map = HashMap::new();
        let mut xml_tracks = tracks
            .iter()
            .enumerate()
            .map(|(idx, track)| {
                let xml_id = track.id.parse::<u32>().unwrap_or((idx + 1) as u32);
                track_id_map.insert(track.id.clone(), xml_id);
                db_track_to_xml_track(track, xml_id)
            })
            .collect::<Vec<_>>();

        for change in &accepted {
            apply_xml_overlay(&mut xml_tracks, &track_id_map, change)?;
        }

        let mut playlist_tracks: HashMap<String, Vec<u32>> = HashMap::new();
        let mut playlist_names: HashMap<String, String> = HashMap::new();
        let mut playlist_order: Vec<String> = Vec::new();
        let mut deleted_playlists = std::collections::HashSet::new();

        // 1. Initialize from DB
        for playlist in playlists.iter().filter(|playlist| {
            matches!(
                playlist.kind,
                decks_core::rekordbox_db::PlaylistKind::Playlist
            )
        }) {
            let entries = db
                .playlist_entries(&playlist.id)
                .map_err(|e| e.to_string())?;
            let track_ids = entries
                .iter()
                .filter_map(|entry| track_id_map.get(&entry.content_id).copied())
                .collect::<Vec<_>>();
            playlist_tracks.insert(playlist.id.clone(), track_ids);
            playlist_names.insert(playlist.id.clone(), playlist.name.clone());
            playlist_order.push(playlist.id.clone());
        }

        // 2. Apply mutations
        for change in &accepted {
            let Some(target_id) = change.target_id.as_deref() else { continue; };
            match change.kind {
                changes::ChangeKind::PlaylistRename => {
                    if let Some(name) = change.new_value.as_ref().and_then(json_to_string) {
                        playlist_names.insert(target_id.to_owned(), name);
                    }
                }
                changes::ChangeKind::PlaylistDelete => {
                    deleted_playlists.insert(target_id.to_owned());
                }
                changes::ChangeKind::PlaylistCreate => {
                    if let Some(name) = change.new_value.as_ref().and_then(json_to_string) {
                        playlist_names.insert(target_id.to_owned(), name);
                        playlist_tracks.insert(target_id.to_owned(), Vec::new());
                        playlist_order.push(target_id.to_owned());
                    }
                }
                changes::ChangeKind::PlaylistAddTrack => {
                    if let Some(track_id) = change.new_value.as_ref().and_then(json_to_string) {
                        if let Some(xml_track_id) = track_id_map.get(&track_id) {
                            if let Some(tracks) = playlist_tracks.get_mut(target_id) {
                                tracks.push(*xml_track_id);
                            }
                        }
                    }
                }
                changes::ChangeKind::PlaylistRemoveTrack => {
                    if let Some(track_id) = change.old_value.as_ref().and_then(json_to_string) {
                        if let Some(xml_track_id) = track_id_map.get(&track_id) {
                            if let Some(tracks) = playlist_tracks.get_mut(target_id) {
                                tracks.retain(|&id| id != *xml_track_id);
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        let mut playlist_nodes = Vec::new();
        for playlist_id in playlist_order {
            if deleted_playlists.contains(&playlist_id) {
                continue;
            }
            if let Some(name) = playlist_names.get(&playlist_id) {
                if let Some(track_ids) = playlist_tracks.get(&playlist_id) {
                    playlist_nodes.push(decks_core::rekordbox_xml::Node::Playlist {
                        name: name.clone(),
                        key_type: 0,
                        track_ids: track_ids.clone(),
                    });
                }
            }
        }

        let collection = decks_core::rekordbox_xml::Collection {
            product: decks_core::rekordbox_xml::Product::default(),
            tracks: xml_tracks,
            playlists: vec![decks_core::rekordbox_xml::Node::Folder {
                name: "ROOT".to_owned(),
                children: playlist_nodes,
            }],
        };
        let xml = decks_core::rekordbox_xml::to_xml(&collection).map_err(|e| e.to_string())?;
        decks_core::rekordbox_xml::parse(&xml).map_err(|e| e.to_string())?;
        std::fs::write(&output_path, xml).map_err(|e| e.to_string())?;

        let mut exported_count = 0;
        for change in &accepted {
            cache
                .mark_change_exported(&change.id)
                .map_err(|e| e.to_string())?;
            exported_count += 1;
        }
        Ok(ExportResult {
            output_path,
            exported_count,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn generate_export_xml(
    tracks: &[decks_core::rekordbox_db::Track],
    playlists: &[decks_core::rekordbox_db::Playlist],
    playlist_entries_map: &HashMap<String, Vec<decks_core::rekordbox_db::PlaylistEntry>>,
    accepted: &[cache::StagedChangeRecord],
) -> Result<String, String> {
    let mut track_id_map = HashMap::new();
    let mut xml_tracks = tracks
        .iter()
        .enumerate()
        .map(|(idx, track)| {
            let xml_id = track.id.parse::<u32>().unwrap_or((idx + 1) as u32);
            track_id_map.insert(track.id.clone(), xml_id);
            db_track_to_xml_track(track, xml_id)
        })
        .collect::<Vec<_>>();

    for change in accepted {
        apply_xml_overlay(&mut xml_tracks, &track_id_map, change)?;
    }

    let mut playlist_tracks: HashMap<String, Vec<u32>> = HashMap::new();
    let mut playlist_names: HashMap<String, String> = HashMap::new();
    let mut playlist_order: Vec<String> = Vec::new();
    let mut deleted_playlists = std::collections::HashSet::new();

    // 1. Initialize from DB
    for playlist in playlists.iter().filter(|playlist| {
        matches!(
            playlist.kind,
            decks_core::rekordbox_db::PlaylistKind::Playlist
        )
    }) {
        let entries = playlist_entries_map.get(&playlist.id).cloned().unwrap_or_default();
        let track_ids = entries
            .iter()
            .filter_map(|entry| track_id_map.get(&entry.content_id).copied())
            .collect::<Vec<_>>();
        playlist_tracks.insert(playlist.id.clone(), track_ids);
        playlist_names.insert(playlist.id.clone(), playlist.name.clone());
        playlist_order.push(playlist.id.clone());
    }

    // 2. Apply mutations
    for change in accepted {
        let Some(target_id) = change.target_id.as_deref() else { continue; };
        match change.kind {
            changes::ChangeKind::PlaylistRename => {
                if let Some(name) = change.new_value.as_ref().and_then(json_to_string) {
                    playlist_names.insert(target_id.to_owned(), name);
                }
            }
            changes::ChangeKind::PlaylistDelete => {
                deleted_playlists.insert(target_id.to_owned());
            }
            changes::ChangeKind::PlaylistCreate => {
                if let Some(name) = change.new_value.as_ref().and_then(json_to_string) {
                    playlist_names.insert(target_id.to_owned(), name);
                    playlist_tracks.insert(target_id.to_owned(), Vec::new());
                    playlist_order.push(target_id.to_owned());
                }
            }
            changes::ChangeKind::PlaylistAddTrack => {
                if let Some(track_id) = change.new_value.as_ref().and_then(json_to_string) {
                    if let Some(xml_track_id) = track_id_map.get(&track_id) {
                        if let Some(tracks) = playlist_tracks.get_mut(target_id) {
                            tracks.push(*xml_track_id);
                        }
                    }
                }
            }
            changes::ChangeKind::PlaylistRemoveTrack => {
                if let Some(track_id) = change.old_value.as_ref().and_then(json_to_string) {
                    if let Some(xml_track_id) = track_id_map.get(&track_id) {
                        if let Some(tracks) = playlist_tracks.get_mut(target_id) {
                            tracks.retain(|&id| id != *xml_track_id);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    let mut playlist_nodes = Vec::new();
    for playlist_id in playlist_order {
        if deleted_playlists.contains(&playlist_id) {
            continue;
        }
        if let Some(name) = playlist_names.get(&playlist_id) {
            if let Some(track_ids) = playlist_tracks.get(&playlist_id) {
                playlist_nodes.push(decks_core::rekordbox_xml::Node::Playlist {
                    name: name.clone(),
                    key_type: 0,
                    track_ids: track_ids.clone(),
                });
            }
        }
    }

    let collection = decks_core::rekordbox_xml::Collection {
        product: decks_core::rekordbox_xml::Product::default(),
        tracks: xml_tracks,
        playlists: vec![decks_core::rekordbox_xml::Node::Folder {
            name: "ROOT".to_owned(),
            children: playlist_nodes,
        }],
    };
    let xml = decks_core::rekordbox_xml::to_xml(&collection).map_err(|e| e.to_string())?;
    decks_core::rekordbox_xml::parse(&xml).map_err(|e| e.to_string())?;
    Ok(xml)
}

fn db_track_to_xml_track(
    track: &decks_core::rekordbox_db::Track,
    xml_id: u32,
) -> decks_core::rekordbox_xml::Track {
    decks_core::rekordbox_xml::Track {
        track_id: xml_id,
        name: track.title.clone(),
        location: track
            .folder_path
            .as_deref()
            .map(decks_core::rekordbox_xml::uri::path_to_location)
            .unwrap_or_default(),
        artist: track.artist.clone(),
        album: track.album.clone(),
        genre: track.genre.clone(),
        total_time: track.duration_secs.and_then(|v| u32::try_from(v).ok()),
        year: track.release_year.and_then(|v| u32::try_from(v).ok()),
        average_bpm: track.bpm,
        bit_rate: track.bit_rate.and_then(|v| u32::try_from(v).ok()),
        sample_rate: track.sample_rate.and_then(|v| u32::try_from(v).ok()),
        comments: track.comment.clone(),
        play_count: track.dj_play_count.and_then(|v| u32::try_from(v).ok()),
        rating: track.rating.and_then(|v| u8::try_from(v).ok()),
        tonality: track.musical_key.clone(),
        ..Default::default()
    }
}

fn apply_xml_overlay(
    tracks: &mut [decks_core::rekordbox_xml::Track],
    track_id_map: &HashMap<String, u32>,
    change: &cache::StagedChangeRecord,
) -> Result<(), String> {
    if change.kind != changes::ChangeKind::TrackMetadataEdit {
        return Ok(());
    }
    let Some(target_id) = change.target_id.as_deref() else {
        return Ok(());
    };
    let Some(xml_id) = track_id_map.get(target_id) else {
        return Err(format!(
            "Accepted change references missing track {target_id}"
        ));
    };
    let Some(track) = tracks.iter_mut().find(|track| track.track_id == *xml_id) else {
        return Err(format!("Export track mapping failed for track {target_id}"));
    };
    let field = change.field.as_deref().unwrap_or_default();
    match field {
        "title" | "name" => {
            if let Some(value) = change.new_value.as_ref().and_then(json_to_string) {
                track.name = value;
            }
        }
        "artist" => track.artist = change.new_value.as_ref().and_then(json_to_string),
        "album" => track.album = change.new_value.as_ref().and_then(json_to_string),
        "genre" => track.genre = change.new_value.as_ref().and_then(json_to_string),
        "musical_key" | "key" | "tonality" => {
            track.tonality = change.new_value.as_ref().and_then(json_to_string);
        }
        "bpm" | "average_bpm" => {
            track.average_bpm = change.new_value.as_ref().and_then(json_to_f64)
        }
        "comment" | "comments" => {
            track.comments = change.new_value.as_ref().and_then(json_to_string)
        }
        "rating" => track.rating = change.new_value.as_ref().and_then(json_to_u8),
        "release_year" | "year" => track.year = change.new_value.as_ref().and_then(json_to_u32),
        _ => {}
    }
    Ok(())
}

fn json_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Null => None,
        other => Some(other.to_string()),
    }
}

fn json_to_f64(value: &serde_json::Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|s| s.parse::<f64>().ok()))
}

fn json_to_u32(value: &serde_json::Value) -> Option<u32> {
    value
        .as_u64()
        .and_then(|v| u32::try_from(v).ok())
        .or_else(|| value.as_str().and_then(|s| s.parse::<u32>().ok()))
}

fn json_to_u8(value: &serde_json::Value) -> Option<u8> {
    value
        .as_u64()
        .and_then(|v| u8::try_from(v).ok())
        .or_else(|| value.as_str().and_then(|s| s.parse::<u8>().ok()))
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
            get_track,
            get_track_cues,
            get_library_path,
            set_library_path,
            library_search,
            list_playlists,
            get_playlist,
            health_orphan_scan,
            health_duplicate_scan,
            health_broken_link_scan,
            get_theme,
            set_theme,
            get_api_key,
            set_api_key,
            delete_api_key,
            list_conversations,
            create_conversation,
            load_conversation,
            append_conversation_message,
            rename_conversation,
            delete_conversation,
            stage_change,
            list_changes,
            accept_change,
            reject_change,
            accept_all_safe,
            reject_all,
            export_accepted_changes,
            play_track,
            pause_audio,
            resume_audio,
            stop_audio,
            get_playback_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running decks");
}

#[cfg(test)]
mod tests {
    use super::*;
    use changes::{ChangeKind, ChangeStatus};
    use decks_core::rekordbox_db::{Playlist, PlaylistEntry, PlaylistKind, Track};
    use serde_json::json;

    #[test]
    fn test_generate_export_xml_playlist_mutations() {
        let tracks = vec![
            Track {
                id: "track1".into(),
                title: "Track One".into(),
                artist: None,
                album: None,
                genre: None,
                duration_secs: None,
                release_year: None,
                bpm: None,
                bit_rate: None,
                sample_rate: None,
                comment: None,
                dj_play_count: None,
                rating: None,
                musical_key: None,
                folder_path: None,
                analysis_data_path: None,
                file_type: None,
            },
            Track {
                id: "track2".into(),
                title: "Track Two".into(),
                artist: None,
                album: None,
                genre: None,
                duration_secs: None,
                release_year: None,
                bpm: None,
                bit_rate: None,
                sample_rate: None,
                comment: None,
                dj_play_count: None,
                rating: None,
                musical_key: None,
                folder_path: None,
                analysis_data_path: None,
                file_type: None,
            },
        ];

        let playlists = vec![Playlist {
            id: "pl1".into(),
            name: "Original Playlist".into(),
            kind: PlaylistKind::Playlist,
            parent_id: Some("root".into()),
            seq: Some(1),
        }];

        let mut playlist_entries_map = HashMap::new();
        playlist_entries_map.insert(
            "pl1".into(),
            vec![PlaylistEntry {
                playlist_id: "pl1".into(),
                content_id: "track1".into(),
                track_no: Some(1),
            }],
        );

        let accepted = vec![
            cache::StagedChangeRecord {
                id: "c1".into(),
                library_path: None,
                kind: ChangeKind::PlaylistRename,
                target_id: Some("pl1".into()),
                field: None,
                old_value: Some(json!("Original Playlist")),
                new_value: Some(json!("Renamed Playlist")),
                reason: None,
                confidence: None,
                status: ChangeStatus::Accepted,
                created_at: 0,
                updated_at: 0,
            },
            cache::StagedChangeRecord {
                id: "c2".into(),
                library_path: None,
                kind: ChangeKind::PlaylistAddTrack,
                target_id: Some("pl1".into()),
                field: None,
                old_value: None,
                new_value: Some(json!("track2")),
                reason: None,
                confidence: None,
                status: ChangeStatus::Accepted,
                created_at: 0,
                updated_at: 0,
            },
            cache::StagedChangeRecord {
                id: "c3".into(),
                library_path: None,
                kind: ChangeKind::PlaylistCreate,
                target_id: Some("pl2".into()),
                field: None,
                old_value: None,
                new_value: Some(json!("New Playlist")),
                reason: None,
                confidence: None,
                status: ChangeStatus::Accepted,
                created_at: 0,
                updated_at: 0,
            },
            cache::StagedChangeRecord {
                id: "c4".into(),
                library_path: None,
                kind: ChangeKind::PlaylistAddTrack,
                target_id: Some("pl2".into()),
                field: None,
                old_value: None,
                new_value: Some(json!("track1")),
                reason: None,
                confidence: None,
                status: ChangeStatus::Accepted,
                created_at: 0,
                updated_at: 0,
            },
        ];

        let xml = generate_export_xml(&tracks, &playlists, &playlist_entries_map, &accepted)
            .expect("should generate xml");

        let parsed = decks_core::rekordbox_xml::parse(&xml).expect("should parse back");
        let root = &parsed.playlists[0];
        
        let mut pl_names = Vec::new();
        let mut pl_tracks = Vec::new();
        if let decks_core::rekordbox_xml::Node::Folder { children, .. } = root {
            for child in children {
                if let decks_core::rekordbox_xml::Node::Playlist { name, track_ids, .. } = child {
                    pl_names.push(name.clone());
                    pl_tracks.push(track_ids.clone());
                }
            }
        }

        assert_eq!(pl_names, vec!["Renamed Playlist", "New Playlist"]);
        // Track IDs are assigned sequentially if they aren't numbers. track1 -> 1, track2 -> 2.
        assert_eq!(pl_tracks[0], vec![1, 2]); 
        assert_eq!(pl_tracks[1], vec![1]);
    }
}
