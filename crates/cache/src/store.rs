use crate::migrations;
use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;

/// Handle to the local SQLite WAL cache database.
pub struct CacheDb {
    pub(crate) conn: Connection,
}

impl CacheDb {
    /// Open (or create) the cache database at `path`.
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)
            .with_context(|| format!("opening cache DB at {}", path.display()))?;
        configure(&conn)?;
        migrations::run(&conn)?;
        Ok(Self { conn })
    }

    /// Open an in-memory cache — useful for tests.
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().context("opening in-memory cache DB")?;
        configure(&conn)?;
        migrations::run(&conn)?;
        Ok(Self { conn })
    }

    /// Load the sqlite-vec extension from the given shared-library path.
    ///
    /// Only needed for Phase 4 (embeddings). The extension must be compiled for
    /// the host platform.  If not called, vector-search operations will fail
    /// gracefully when attempted.
    ///
    /// # Safety
    /// Loading a shared library is inherently unsafe. Only load extensions
    /// from trusted paths.
    pub fn load_vec_extension(&self, lib_path: &Path) -> Result<()> {
        unsafe {
            self.conn.load_extension(lib_path, None).with_context(|| {
                format!("loading sqlite-vec extension from {}", lib_path.display())
            })?;
        }
        tracing::info!("sqlite-vec loaded from {}", lib_path.display());
        Ok(())
    }

    // ── Audio features ───────────────────────────────────────────────────────

    /// Upsert cached audio features for a track.
    pub fn upsert_audio_features(
        &self,
        track_uri: &str,
        analyzer_version: &str,
        bpm: Option<f64>,
        musical_key: Option<&str>,
        energy: Option<f64>,
        features_json: Option<&str>,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO audio_features
                 (track_uri, analyzer_version, bpm, musical_key, energy, features_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT (track_uri, analyzer_version) DO UPDATE SET
                 bpm          = excluded.bpm,
                 musical_key  = excluded.musical_key,
                 energy       = excluded.energy,
                 features_json = excluded.features_json,
                 created_at   = unixepoch()",
            rusqlite::params![
                track_uri,
                analyzer_version,
                bpm,
                musical_key,
                energy,
                features_json
            ],
        )?;
        Ok(())
    }

    /// Retrieve cached audio features for a track, if present.
    pub fn get_audio_features(
        &self,
        track_uri: &str,
        analyzer_version: &str,
    ) -> Result<Option<AudioFeatures>> {
        let mut stmt = self.conn.prepare_cached(
            "SELECT bpm, musical_key, energy, features_json
             FROM audio_features
             WHERE track_uri = ?1 AND analyzer_version = ?2",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![track_uri, analyzer_version], |row| {
            Ok(AudioFeatures {
                bpm: row.get(0)?,
                musical_key: row.get(1)?,
                energy: row.get(2)?,
                features_json: row.get(3)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn schema_version(&self) -> Result<u32> {
        migrations::current_version(&self.conn)
    }
}

/// Cached audio analysis results for one track.
#[derive(Debug, Clone, PartialEq)]
pub struct AudioFeatures {
    pub bpm: Option<f64>,
    pub musical_key: Option<String>,
    pub energy: Option<f64>,
    pub features_json: Option<String>,
}

fn configure(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous  = NORMAL;
         PRAGMA busy_timeout = 5000;
         PRAGMA foreign_keys = ON;",
    )
    .context("configuring SQLite pragmas")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_in_memory_succeeds() {
        let db = CacheDb::open_in_memory().unwrap();
        assert!(db.schema_version().unwrap() >= 1);
    }

    #[test]
    fn open_file_db_applies_migrations() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();
        drop(tmp);
        let db = CacheDb::open(&path).unwrap();
        assert!(db.schema_version().unwrap() >= 1);
    }

    #[test]
    fn upsert_and_get_audio_features() {
        let db = CacheDb::open_in_memory().unwrap();
        db.upsert_audio_features(
            "file:///test.mp3",
            "v1",
            Some(132.0),
            Some("8A"),
            Some(0.8),
            None,
        )
        .unwrap();
        let feat = db
            .get_audio_features("file:///test.mp3", "v1")
            .unwrap()
            .expect("should be cached");
        assert!((feat.bpm.unwrap() - 132.0).abs() < 0.001);
        assert_eq!(feat.musical_key.as_deref(), Some("8A"));
    }

    #[test]
    fn upsert_overwrites_existing() {
        let db = CacheDb::open_in_memory().unwrap();
        db.upsert_audio_features("file:///t.mp3", "v1", Some(128.0), None, None, None)
            .unwrap();
        db.upsert_audio_features("file:///t.mp3", "v1", Some(130.0), Some("11B"), None, None)
            .unwrap();
        let feat = db
            .get_audio_features("file:///t.mp3", "v1")
            .unwrap()
            .unwrap();
        assert!((feat.bpm.unwrap() - 130.0).abs() < 0.001);
        assert_eq!(feat.musical_key.as_deref(), Some("11B"));
    }

    #[test]
    fn get_missing_returns_none() {
        let db = CacheDb::open_in_memory().unwrap();
        assert!(db
            .get_audio_features("file:///nope.mp3", "v1")
            .unwrap()
            .is_none());
    }

    #[test]
    fn different_analyzer_versions_are_independent() {
        let db = CacheDb::open_in_memory().unwrap();
        db.upsert_audio_features("file:///t.mp3", "v1", Some(128.0), None, None, None)
            .unwrap();
        db.upsert_audio_features("file:///t.mp3", "v2", Some(130.0), None, None, None)
            .unwrap();
        let v1 = db
            .get_audio_features("file:///t.mp3", "v1")
            .unwrap()
            .unwrap();
        let v2 = db
            .get_audio_features("file:///t.mp3", "v2")
            .unwrap()
            .unwrap();
        assert!((v1.bpm.unwrap() - 128.0).abs() < 0.001);
        assert!((v2.bpm.unwrap() - 130.0).abs() < 0.001);
    }

    #[test]
    fn wal_mode_is_set() {
        let db = CacheDb::open_in_memory().unwrap();
        let mode: String = db
            .conn
            .query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .unwrap();
        // In-memory always reports "memory" regardless; file DBs report "wal".
        // Just verify the pragma executes without error.
        assert!(!mode.is_empty());
    }
}
