use crate::ToolRequest;
use anyhow::{bail, Context, Result};
use decks_core::rekordbox_db::{Playlist, RekordboxDb, Track};
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Default)]
pub struct AgentToolService {
    pub cache_path: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
struct PlaylistDetail {
    playlist: Playlist,
    tracks: Vec<Track>,
}

impl AgentToolService {
    pub fn execute(&self, request: ToolRequest) -> Result<Value> {
        match request {
            ToolRequest::LibrarySearch {
                library_path,
                query,
                limit,
            } => {
                let db = open_library(&library_path)?;
                let mut results = db.search_tracks(&query)?;
                if let Some(limit) = limit {
                    results.truncate(limit);
                }
                to_value(results)
            }
            ToolRequest::LibraryGetTrack { library_path, id } => {
                let db = open_library(&library_path)?;
                to_value(db.track_by_id(&id)?)
            }
            ToolRequest::LibraryListPlaylists { library_path } => {
                let db = open_library(&library_path)?;
                to_value(db.playlists()?)
            }
            ToolRequest::LibraryGetPlaylist { library_path, id } => {
                let db = open_library(&library_path)?;
                let Some(playlist) = db.playlist_by_id(&id)? else {
                    return to_value(Option::<PlaylistDetail>::None);
                };

                let tracks = db
                    .playlist_entries(&id)?
                    .into_iter()
                    .filter_map(|entry| db.track_by_id(&entry.content_id).transpose())
                    .collect::<Result<Vec<_>>>()?;

                to_value(Some(PlaylistDetail { playlist, tracks }))
            }
            ToolRequest::LibraryListCues {
                library_path,
                track_id,
            } => {
                let db = open_library(&library_path)?;
                to_value(db.hot_cues_for_track(&track_id)?)
            }
            ToolRequest::HealthOrphanScan { library_path } => {
                let db = open_library(&library_path)?;
                let tracks = db.tracks()?;
                to_value(
                    tracks
                        .into_iter()
                        .filter(|track| {
                            track
                                .folder_path
                                .as_deref()
                                .map(|path| !Path::new(path).exists())
                                .unwrap_or(false)
                        })
                        .collect::<Vec<_>>(),
                )
            }
            ToolRequest::HealthDuplicateScan { library_path } => {
                let db = open_library(&library_path)?;
                to_value(db.duplicate_tracks()?)
            }
            ToolRequest::HealthBrokenLinkScan { library_path } => {
                let db = open_library(&library_path)?;
                to_value(db.broken_metadata_report()?)
            }
            ToolRequest::StagingListChanges { library_path } => {
                let cache_path = self
                    .cache_path
                    .as_deref()
                    .context("cache_path is required for staging tools")?;
                let db = cache::CacheDb::open(cache_path)?;
                to_value(db.list_changes(library_path.as_deref())?)
            }
            ToolRequest::ExportAcceptedChanges { .. } => {
                bail!("export.accepted_changes not implemented in shared service yet")
            }
        }
    }
}

fn open_library(library_path: &str) -> Result<RekordboxDb> {
    RekordboxDb::open(Path::new(library_path))
}

fn to_value(value: impl Serialize) -> Result<Value> {
    serde_json::to_value(value).context("serializing tool response")
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::path::Path;
    use tempfile::{NamedTempFile, TempPath};

    const RB_KEY: &str = "402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497";
    const SCHEMA: &str = include_str!("../../rekordbox-db/src/sql/schema.sql");
    const SEED: &str = include_str!("../../rekordbox-db/src/sql/seed.sql");

    fn make_fixture_db() -> TempPath {
        make_fixture_db_with_extra("")
    }

    fn make_fixture_db_with_extra(extra_sql: &str) -> TempPath {
        let tmp = NamedTempFile::new().expect("tempfile");
        let path = tmp.into_temp_path();
        {
            let conn = writable_cipher_conn(&path);
            conn.execute_batch(SCHEMA).expect("schema");
            conn.execute_batch(SEED).expect("seed");
            conn.execute_batch(extra_sql).expect("extra sql");
        }
        path
    }

    fn writable_cipher_conn(path: &Path) -> Connection {
        let conn = Connection::open(path).expect("open writable");
        conn.execute_batch(&format!(
            "PRAGMA key = '{RB_KEY}'; PRAGMA busy_timeout = 5000;"
        ))
        .expect("pragmas");
        conn
    }

    fn service() -> AgentToolService {
        AgentToolService::default()
    }

    #[test]
    fn library_search_returns_seeded_tracks() {
        let library_path = make_fixture_db();

        let value = service()
            .execute(ToolRequest::LibrarySearch {
                library_path: library_path.display().to_string(),
                query: "Beta".to_owned(),
                limit: Some(10),
            })
            .expect("search");

        assert_eq!(value[0]["title"], "Test Track Beta");
    }

    #[test]
    fn library_get_playlist_returns_playlist_with_ordered_tracks() {
        let library_path = make_fixture_db();

        let value = service()
            .execute(ToolRequest::LibraryGetPlaylist {
                library_path: library_path.display().to_string(),
                id: "2".to_owned(),
            })
            .expect("playlist");

        assert_eq!(value["playlist"]["name"], "Techno Set");
        assert_eq!(value["tracks"][0]["id"], "1");
        assert_eq!(value["tracks"][1]["id"], "2");
    }

    #[test]
    fn library_list_cues_returns_track_cues() {
        let library_path = make_fixture_db();

        let value = service()
            .execute(ToolRequest::LibraryListCues {
                library_path: library_path.display().to_string(),
                track_id: "1".to_owned(),
            })
            .expect("cues");

        assert_eq!(value.as_array().expect("array").len(), 2);
        assert_eq!(value[0]["content_id"], "1");
        assert!(value[0]["in_msec"].as_i64() <= value[1]["in_msec"].as_i64());
    }

    #[test]
    fn health_duplicate_scan_returns_duplicate_groups() {
        let library_path = make_fixture_db_with_extra(
            "
            INSERT INTO djmdContent
                (ID, Title, ArtistID, AlbumID, GenreID, KeyID, BPM, Length, Rating, Commnt,
                 FolderPath, AnalysisDataPath, rb_local_deleted)
            VALUES
                ('dup-1', 'Test Track Alpha', 1, 1, 1, 1, 13200, 360, 4, 'duplicate',
                 '/music/alpha-copy.mp3', NULL, 0);
            ",
        );

        let value = service()
            .execute(ToolRequest::HealthDuplicateScan {
                library_path: library_path.display().to_string(),
            })
            .expect("duplicate scan");

        assert_eq!(value.as_array().expect("array").len(), 1);
        assert_eq!(value[0]["title"], "Test Track Alpha");
        assert_eq!(value[0]["tracks"].as_array().expect("tracks").len(), 2);
    }

    #[test]
    fn staging_list_changes_without_library_path_returns_all_changes() {
        let cache_file = NamedTempFile::new().expect("cache tempfile");
        let cache = cache::CacheDb::open(cache_file.path()).expect("cache open");
        cache
            .stage_change(cache::NewStagedChange {
                library_path: Some("/library/a.db".to_owned()),
                kind: changes::ChangeKind::TrackMetadataEdit,
                target_id: Some("track-1".to_owned()),
                field: Some("genre".to_owned()),
                old_value: None,
                new_value: Some(serde_json::json!("House")),
                reason: None,
                confidence: None,
            })
            .expect("stage a");
        cache
            .stage_change(cache::NewStagedChange {
                library_path: Some("/library/b.db".to_owned()),
                kind: changes::ChangeKind::TrackMetadataEdit,
                target_id: Some("track-2".to_owned()),
                field: Some("genre".to_owned()),
                old_value: None,
                new_value: Some(serde_json::json!("Techno")),
                reason: None,
                confidence: None,
            })
            .expect("stage b");

        let value = AgentToolService {
            cache_path: Some(cache_file.path().to_path_buf()),
        }
        .execute(ToolRequest::StagingListChanges { library_path: None })
        .expect("list changes");

        assert_eq!(value.as_array().expect("array").len(), 2);
    }
}
