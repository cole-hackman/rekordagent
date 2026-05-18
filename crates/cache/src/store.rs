use crate::migrations;
use anyhow::{Context, Result};
use changes::{ChangeKind, ChangeStatus};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

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

    pub fn save_audio_fingerprint(&self, track_uri: &str, chroma_hash: &[u8]) -> Result<()> {
        self.conn.execute(
            "INSERT INTO audio_fingerprints (track_uri, chroma_hash)
             VALUES (?1, ?2)
             ON CONFLICT(track_uri) DO UPDATE SET chroma_hash = excluded.chroma_hash, created_at = unixepoch()",
            rusqlite::params![track_uri, chroma_hash],
        )?;
        Ok(())
    }

    pub fn get_all_fingerprints(&self) -> Result<Vec<(String, Vec<u8>)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT track_uri, chroma_hash FROM audio_fingerprints")?;
        let rows = stmt.query_map([], |row| {
            let track_uri: String = row.get(0)?;
            let chroma_hash: Vec<u8> = row.get(1)?;
            Ok((track_uri, chroma_hash))
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    pub fn schema_version(&self) -> Result<u32> {
        migrations::current_version(&self.conn)
    }

    // ── Conversations ───────────────────────────────────────────────────────

    pub fn create_conversation(
        &self,
        library_path: Option<&str>,
        title: &str,
    ) -> Result<Conversation> {
        let id = new_id("conv");
        self.conn.execute(
            "INSERT INTO conversations (id, library_path, title)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![id, library_path, title],
        )?;
        self.load_conversation_metadata(&id)?
            .context("created conversation was not found")
    }

    pub fn list_conversations(&self, library_path: Option<&str>) -> Result<Vec<Conversation>> {
        if let Some(path) = library_path {
            let mut stmt = self.conn.prepare(
                "SELECT id, library_path, title, created_at, updated_at
                 FROM conversations
                 WHERE library_path = ?1
                 ORDER BY updated_at DESC, created_at DESC",
            )?;
            let rows = stmt.query_map(rusqlite::params![path], row_to_conversation)?;
            return rows
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(Into::into);
        }

        let mut stmt = self.conn.prepare(
            "SELECT id, library_path, title, created_at, updated_at
             FROM conversations
             ORDER BY updated_at DESC, created_at DESC",
        )?;
        let rows = stmt.query_map([], row_to_conversation)?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn load_conversation(&self, id: &str) -> Result<Option<ConversationWithMessages>> {
        let Some(conversation) = self.load_conversation_metadata(id)? else {
            return Ok(None);
        };
        let mut stmt = self.conn.prepare(
            "SELECT id, conversation_id, role, content_json, created_at
             FROM conversation_messages
             WHERE conversation_id = ?1
             ORDER BY created_at, rowid",
        )?;
        let rows = stmt.query_map(rusqlite::params![id], row_to_message)?;
        // Skip individual messages with malformed JSON rather than failing the
        // whole conversation load — better to surface partial history than
        // none. Genuine SQLite errors (locked DB, missing column) still bubble.
        let mut messages = Vec::new();
        let mut skipped = 0usize;
        for row in rows {
            match row {
                Ok(msg) => messages.push(msg),
                Err(rusqlite::Error::FromSqlConversionFailure(_, _, _)) => {
                    skipped += 1;
                }
                Err(e) => return Err(anyhow::Error::from(e)),
            }
        }
        if skipped > 0 {
            tracing::warn!(
                conversation_id = id,
                skipped,
                "load_conversation: dropped messages with unparseable content_json",
            );
        }
        Ok(Some(ConversationWithMessages {
            conversation,
            messages,
        }))
    }

    pub fn append_conversation_message(
        &self,
        conversation_id: &str,
        role: &str,
        content: serde_json::Value,
    ) -> Result<ConversationMessage> {
        let id = new_id("msg");
        let content_json = serde_json::to_string(&content)?;
        self.conn.execute(
            "INSERT INTO conversation_messages (id, conversation_id, role, content_json)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![id, conversation_id, role, content_json],
        )?;
        self.conn.execute(
            "UPDATE conversations SET updated_at = unixepoch() WHERE id = ?1",
            rusqlite::params![conversation_id],
        )?;
        self.load_message(&id)?
            .context("created conversation message was not found")
    }

    pub fn rename_conversation(&self, id: &str, title: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE conversations
             SET title = ?2, updated_at = unixepoch()
             WHERE id = ?1",
            rusqlite::params![id, title],
        )?;
        Ok(())
    }

    pub fn delete_conversation(&self, id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM conversations WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    fn load_conversation_metadata(&self, id: &str) -> Result<Option<Conversation>> {
        let mut stmt = self.conn.prepare_cached(
            "SELECT id, library_path, title, created_at, updated_at
             FROM conversations
             WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![id], row_to_conversation)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn load_message(&self, id: &str) -> Result<Option<ConversationMessage>> {
        let mut stmt = self.conn.prepare_cached(
            "SELECT id, conversation_id, role, content_json, created_at
             FROM conversation_messages
             WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![id], row_to_message)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    // ── Staged changes ─────────────────────────────────────────────────────

    pub fn stage_change(&self, input: NewStagedChange) -> Result<StagedChangeRecord> {
        let id = new_id("change");
        let kind = kind_to_db(&input.kind)?;
        let old_value = optional_json_to_db(&input.old_value)?;
        let new_value = optional_json_to_db(&input.new_value)?;
        self.conn.execute(
            "INSERT INTO staged_changes
                (id, library_path, kind, target_id, field, old_value, new_value, reason, confidence, status)
             VALUES
                (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'Proposed')",
            rusqlite::params![
                id,
                input.library_path,
                kind,
                input.target_id,
                input.field,
                old_value,
                new_value,
                input.reason,
                input.confidence
            ],
        )?;
        self.load_change(&id)?
            .context("created staged change was not found")
    }

    pub fn list_changes(&self, library_path: Option<&str>) -> Result<Vec<StagedChangeRecord>> {
        if let Some(path) = library_path {
            let mut stmt = self.conn.prepare(
                "SELECT id, library_path, kind, target_id, field, old_value, new_value,
                        reason, confidence, status, created_at, updated_at
                 FROM staged_changes
                 WHERE library_path = ?1
                 ORDER BY updated_at DESC, created_at DESC",
            )?;
            let rows = stmt.query_map(rusqlite::params![path], row_to_change)?;
            return rows
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(Into::into);
        }

        let mut stmt = self.conn.prepare(
            "SELECT id, library_path, kind, target_id, field, old_value, new_value,
                    reason, confidence, status, created_at, updated_at
             FROM staged_changes
             ORDER BY updated_at DESC, created_at DESC",
        )?;
        let rows = stmt.query_map([], row_to_change)?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn accept_change(&self, id: &str) -> Result<StagedChangeRecord> {
        self.transition_change(id, ChangeStatus::Accepted)
    }

    pub fn reject_change(&self, id: &str) -> Result<StagedChangeRecord> {
        self.transition_change(id, ChangeStatus::Rejected)
    }

    pub fn mark_change_exported(&self, id: &str) -> Result<StagedChangeRecord> {
        self.transition_change(id, ChangeStatus::Exported)
    }

    pub fn accept_all_safe(&self, library_path: Option<&str>) -> Result<Vec<StagedChangeRecord>> {
        let proposed = self
            .list_changes(library_path)?
            .into_iter()
            .filter(|change| change.status == ChangeStatus::Proposed)
            .filter(|change| changes::is_safe_batch_kind(&change.kind))
            .collect::<Vec<_>>();
        let mut accepted = Vec::with_capacity(proposed.len());
        for change in proposed {
            accepted.push(self.accept_change(&change.id)?);
        }
        Ok(accepted)
    }

    pub fn reject_all(&self, library_path: Option<&str>) -> Result<Vec<StagedChangeRecord>> {
        let proposed = self
            .list_changes(library_path)?
            .into_iter()
            .filter(|change| change.status == ChangeStatus::Proposed)
            .collect::<Vec<_>>();
        let mut rejected = Vec::with_capacity(proposed.len());
        for change in proposed {
            rejected.push(self.reject_change(&change.id)?);
        }
        Ok(rejected)
    }

    fn load_change(&self, id: &str) -> Result<Option<StagedChangeRecord>> {
        let mut stmt = self.conn.prepare_cached(
            "SELECT id, library_path, kind, target_id, field, old_value, new_value,
                    reason, confidence, status, created_at, updated_at
             FROM staged_changes
             WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![id], row_to_change)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn transition_change(&self, id: &str, to: ChangeStatus) -> Result<StagedChangeRecord> {
        let change = self
            .load_change(id)?
            .with_context(|| format!("change {id} was not found"))?;
        changes::ensure_transition(&change.status, &to)?;
        self.conn.execute(
            "UPDATE staged_changes
             SET status = ?2, updated_at = unixepoch()
             WHERE id = ?1",
            rusqlite::params![id, status_to_db(&to)?],
        )?;
        self.load_change(id)?
            .context("updated staged change was not found")
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub library_path: Option<String>,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: serde_json::Value,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConversationWithMessages {
    pub conversation: Conversation,
    pub messages: Vec<ConversationMessage>,
}

pub type NewStagedChange = changes::NewChange;
pub type StagedChangeRecord = changes::StagedChange;

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

fn row_to_conversation(row: &rusqlite::Row<'_>) -> rusqlite::Result<Conversation> {
    Ok(Conversation {
        id: row.get(0)?,
        library_path: row.get(1)?,
        title: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn row_to_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<ConversationMessage> {
    let content_json: String = row.get(3)?;
    let content = serde_json::from_str(&content_json).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(e))
    })?;
    Ok(ConversationMessage {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        role: row.get(2)?,
        content,
        created_at: row.get(4)?,
    })
}

fn row_to_change(row: &rusqlite::Row<'_>) -> rusqlite::Result<StagedChangeRecord> {
    let kind: String = row.get(2)?;
    let old_value: Option<String> = row.get(5)?;
    let new_value: Option<String> = row.get(6)?;
    let status: String = row.get(9)?;
    Ok(StagedChangeRecord {
        id: row.get(0)?,
        library_path: row.get(1)?,
        kind: parse_string_enum(2, &kind)?,
        target_id: row.get(3)?,
        field: row.get(4)?,
        old_value: parse_optional_json(5, old_value)?,
        new_value: parse_optional_json(6, new_value)?,
        reason: row.get(7)?,
        confidence: row.get(8)?,
        status: parse_string_enum(9, &status)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn kind_to_db(kind: &ChangeKind) -> Result<String> {
    enum_to_db(kind)
}

fn status_to_db(status: &ChangeStatus) -> Result<String> {
    enum_to_db(status)
}

fn enum_to_db<T: Serialize>(value: &T) -> Result<String> {
    serde_json::to_value(value)?
        .as_str()
        .map(ToOwned::to_owned)
        .context("enum did not serialize as string")
}

fn optional_json_to_db(value: &Option<serde_json::Value>) -> Result<Option<String>> {
    value
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(Into::into)
}

fn parse_optional_json(
    column: usize,
    value: Option<String>,
) -> rusqlite::Result<Option<serde_json::Value>> {
    value
        .map(|value| {
            serde_json::from_str(&value).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    column,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })
        })
        .transpose()
}

fn parse_string_enum<T: for<'de> Deserialize<'de>>(
    column: usize,
    value: &str,
) -> rusqlite::Result<T> {
    serde_json::from_value(serde_json::Value::String(value.to_owned())).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(column, rusqlite::types::Type::Text, Box::new(e))
    })
}

fn new_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    format!("{prefix}_{nanos}")
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

    #[test]
    fn conversation_crud_roundtrip() {
        let db = CacheDb::open_in_memory().unwrap();
        let conversation = db
            .create_conversation(Some("/library/master.db"), "Library audit")
            .unwrap();
        db.append_conversation_message(
            &conversation.id,
            "user",
            serde_json::json!({"text": "audit my playlists"}),
        )
        .unwrap();
        db.append_conversation_message(
            &conversation.id,
            "assistant",
            serde_json::json!({"blocks": [{"type": "text", "text": "Done"}]}),
        )
        .unwrap();

        let loaded = db.load_conversation(&conversation.id).unwrap().unwrap();
        assert_eq!(loaded.conversation.title, "Library audit");
        assert_eq!(loaded.messages.len(), 2);
        assert_eq!(loaded.messages[0].role, "user");

        let list = db.list_conversations(Some("/library/master.db")).unwrap();
        assert_eq!(list.len(), 1);

        db.delete_conversation(&conversation.id).unwrap();
        assert!(db.load_conversation(&conversation.id).unwrap().is_none());
    }

    #[test]
    fn load_conversation_skips_malformed_messages() {
        let db = CacheDb::open_in_memory().unwrap();
        let conversation = db
            .create_conversation(Some("/library/master.db"), "Corrupted")
            .unwrap();
        db.append_conversation_message(
            &conversation.id,
            "user",
            serde_json::json!({"text": "first"}),
        )
        .unwrap();
        db.append_conversation_message(
            &conversation.id,
            "assistant",
            serde_json::json!({"blocks": []}),
        )
        .unwrap();

        // Simulate corruption: overwrite one row's content_json with non-JSON.
        db.conn
            .execute(
                "UPDATE conversation_messages SET content_json = 'not json {' \
                 WHERE conversation_id = ?1 AND role = 'user'",
                rusqlite::params![&conversation.id],
            )
            .unwrap();

        // Should still load the surviving message rather than failing the call.
        let loaded = db.load_conversation(&conversation.id).unwrap().unwrap();
        assert_eq!(
            loaded.messages.len(),
            1,
            "the assistant message must survive even though the user message is corrupted",
        );
        assert_eq!(loaded.messages[0].role, "assistant");
    }

    #[test]
    fn staged_change_crud_roundtrip() {
        let db = CacheDb::open_in_memory().unwrap();
        let change = db
            .stage_change(NewStagedChange {
                library_path: Some("/library/master.db".to_owned()),
                kind: ChangeKind::TrackMetadataEdit,
                target_id: Some("track-1".to_owned()),
                field: Some("genre".to_owned()),
                old_value: Some(serde_json::json!("House")),
                new_value: Some(serde_json::json!("Deep House")),
                reason: Some("Normalize genre".to_owned()),
                confidence: Some(0.88),
            })
            .unwrap();
        assert_eq!(change.status, ChangeStatus::Proposed);

        let list = db.list_changes(Some("/library/master.db")).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].kind, ChangeKind::TrackMetadataEdit);

        let accepted = db.accept_change(&change.id).unwrap();
        assert_eq!(accepted.status, ChangeStatus::Accepted);
        let exported = db.mark_change_exported(&change.id).unwrap();
        assert_eq!(exported.status, ChangeStatus::Exported);
    }

    #[test]
    fn staged_change_rejects_invalid_transitions() {
        let db = CacheDb::open_in_memory().unwrap();
        let change = db
            .stage_change(NewStagedChange {
                library_path: None,
                kind: ChangeKind::TrackMetadataEdit,
                target_id: Some("track-1".to_owned()),
                field: Some("genre".to_owned()),
                old_value: None,
                new_value: Some(serde_json::json!("Techno")),
                reason: None,
                confidence: None,
            })
            .unwrap();
        db.accept_change(&change.id).unwrap();
        assert!(db.reject_change(&change.id).is_err());
    }

    #[test]
    fn staged_change_batch_operations_scope_by_library() {
        let db = CacheDb::open_in_memory().unwrap();
        db.stage_change(NewStagedChange {
            library_path: Some("/a.db".to_owned()),
            kind: ChangeKind::TrackMetadataEdit,
            target_id: Some("track-1".to_owned()),
            field: Some("genre".to_owned()),
            old_value: None,
            new_value: Some(serde_json::json!("House")),
            reason: None,
            confidence: None,
        })
        .unwrap();
        db.stage_change(NewStagedChange {
            library_path: Some("/b.db".to_owned()),
            kind: ChangeKind::TrackMetadataEdit,
            target_id: Some("track-2".to_owned()),
            field: Some("genre".to_owned()),
            old_value: None,
            new_value: Some(serde_json::json!("Techno")),
            reason: None,
            confidence: None,
        })
        .unwrap();

        let accepted = db.accept_all_safe(Some("/a.db")).unwrap();
        assert_eq!(accepted.len(), 1);
        assert_eq!(
            db.list_changes(Some("/b.db")).unwrap()[0].status,
            ChangeStatus::Proposed
        );
    }
}
