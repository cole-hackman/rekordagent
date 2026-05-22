use crate::StagedChange;
use anyhow::{anyhow, bail};
use rusqlite::{params, Transaction};
use serde_json::Value;

/// Columns on `djmdContent` writable via `TrackMetadataEdit`.
/// FK-shaped fields (Artist/Genre/Album/Key/Label) are intercepted before
/// the direct-column path; everything else here is a plain scalar column.
const ALLOWED_CONTENT_FIELDS: &[&str] = &[
    "Title",
    "Commnt",
    "Rating",
    "BPM",
    "ReleaseYear",
    "DJPlayCount",
    "Artist",
    "Genre",
    "Album",
    "Key",
    "Label",
];

pub(super) fn apply_metadata_edit(tx: &Transaction, change: &StagedChange) -> anyhow::Result<()> {
    let target_id = change
        .target_id
        .as_ref()
        .ok_or_else(|| anyhow!("Missing target_id"))?;
    let field = change
        .field
        .as_ref()
        .ok_or_else(|| anyhow!("Missing field"))?;
    let new_value = change
        .new_value
        .as_ref()
        .ok_or_else(|| anyhow!("Missing new_value"))?;

    if !ALLOWED_CONTENT_FIELDS.contains(&field.as_str()) {
        bail!("Field {} is not in the allowlist", field);
    }

    match field.as_str() {
        "Artist" | "Genre" | "Album" | "Key" | "Label" => {
            apply_fk_edit(tx, target_id, field, new_value)
        }
        _ => apply_scalar_edit(tx, target_id, field, new_value),
    }
}

fn apply_fk_edit(
    tx: &Transaction,
    target_id: &str,
    field: &str,
    new_value: &Value,
) -> anyhow::Result<()> {
    let table = match field {
        "Artist" => "djmdArtist",
        "Genre" => "djmdGenre",
        "Album" => "djmdAlbum",
        "Key" => "djmdKey",
        "Label" => "djmdLabel",
        _ => unreachable!(),
    };
    let name_col = if field == "Key" { "ScaleName" } else { "Name" };
    let id_col = format!("{}ID", field);

    let fk_id = match new_value {
        Value::Null => None,
        Value::String(s) => Some(get_or_create_fk(tx, table, name_col, s)?),
        _ => bail!("FK fields must be string or null"),
    };

    let sql = format!("UPDATE djmdContent SET {} = ? WHERE ID = ?", id_col);
    let rows = match fk_id {
        Some(id) => tx.execute(&sql, params![id, target_id])?,
        None => tx.execute(&sql, params![rusqlite::types::Null, target_id])?,
    };
    if rows == 0 {
        bail!("No rows updated (target_id {} not found)", target_id);
    }
    Ok(())
}

fn apply_scalar_edit(
    tx: &Transaction,
    target_id: &str,
    field: &str,
    new_value: &Value,
) -> anyhow::Result<()> {
    let sql = format!("UPDATE djmdContent SET {} = ? WHERE ID = ?", field);
    let val = json_to_sql(new_value)?;
    let rows = tx.execute(&sql, params![val, target_id])?;
    if rows == 0 {
        bail!("No rows updated (target_id {} not found)", target_id);
    }
    Ok(())
}

/// `TrackDelete`:
/// - `target_id` = content (track) ID
///
/// Soft-delete: sets `rb_local_deleted = 1` rather than removing the row.
/// Rekordbox uses this flag to hide tracks; preserving the row keeps cue +
/// playlist references valid.
pub(super) fn apply_delete(tx: &Transaction, change: &crate::StagedChange) -> anyhow::Result<()> {
    let target_id = change
        .target_id
        .as_ref()
        .ok_or_else(|| anyhow!("Missing target_id"))?;
    let rows = tx.execute(
        "UPDATE djmdContent SET rb_local_deleted = 1 WHERE ID = ?",
        params![target_id],
    )?;
    if rows == 0 {
        bail!("No track soft-deleted (id {} not found)", target_id);
    }
    Ok(())
}

pub(super) fn json_to_sql(v: &Value) -> anyhow::Result<rusqlite::types::Value> {
    Ok(match v {
        Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                bail!("Unsupported number type");
            }
        }
        Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
        Value::Null => rusqlite::types::Value::Null,
        _ => bail!("Unsupported JSON type for SQL"),
    })
}

pub(super) fn get_or_create_fk(
    tx: &Transaction,
    table: &str,
    name_col: &str,
    value: &str,
) -> anyhow::Result<String> {
    let sql_select = format!("SELECT ID FROM {} WHERE {} = ? COLLATE NOCASE", table, name_col);
    if let Ok(id) = tx.query_row(&sql_select, params![value], |r| r.get::<_, String>(0)) {
        return Ok(id);
    }
    let new_id = uuid::Uuid::new_v4().to_string();
    let sql_insert = format!("INSERT INTO {} (ID, {}) VALUES (?, ?)", table, name_col);
    tx.execute(&sql_insert, params![new_id, value])?;
    Ok(new_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ChangeKind, ChangeStatus};
    use rusqlite::Connection;

    fn fixture() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE djmdContent (ID TEXT PRIMARY KEY, Title TEXT, Commnt TEXT, BPM REAL, GenreID TEXT, ArtistID TEXT, rb_local_deleted INTEGER DEFAULT 0);
             CREATE TABLE djmdGenre (ID TEXT PRIMARY KEY, Name TEXT);
             CREATE TABLE djmdArtist (ID TEXT PRIMARY KEY, Name TEXT);
             INSERT INTO djmdContent (ID, Title, BPM) VALUES ('t1', 'Old Title', 120.0);",
        )
        .unwrap();
        conn
    }

    fn change(field: &str, new_value: Value) -> StagedChange {
        StagedChange {
            id: "c".into(),
            library_path: None,
            kind: ChangeKind::TrackMetadataEdit,
            target_id: Some("t1".into()),
            field: Some(field.into()),
            old_value: None,
            new_value: Some(new_value),
            reason: None,
            confidence: None,
            status: ChangeStatus::Accepted,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn scalar_field_updates() {
        let mut conn = fixture();
        let tx = conn.transaction().unwrap();
        apply_metadata_edit(&tx, &change("Title", Value::String("New".into()))).unwrap();
        let t: String = tx
            .query_row("SELECT Title FROM djmdContent WHERE ID='t1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(t, "New");
    }

    #[test]
    fn fk_field_creates_genre_row() {
        let mut conn = fixture();
        let tx = conn.transaction().unwrap();
        apply_metadata_edit(&tx, &change("Genre", Value::String("Deep House".into()))).unwrap();
        let genre_id: String = tx
            .query_row(
                "SELECT GenreID FROM djmdContent WHERE ID='t1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let name: String = tx
            .query_row(
                "SELECT Name FROM djmdGenre WHERE ID=?",
                params![genre_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(name, "Deep House");
    }

    #[test]
    fn fk_field_null_clears_link() {
        let mut conn = fixture();
        let tx = conn.transaction().unwrap();
        apply_metadata_edit(&tx, &change("Genre", Value::String("House".into()))).unwrap();
        apply_metadata_edit(&tx, &change("Genre", Value::Null)).unwrap();
        let g: Option<String> = tx
            .query_row(
                "SELECT GenreID FROM djmdContent WHERE ID='t1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(g.is_none());
    }

    #[test]
    fn track_delete_sets_rb_local_deleted() {
        let mut conn = fixture();
        let tx = conn.transaction().unwrap();
        let mut change = change("Title", Value::Null);
        change.kind = crate::ChangeKind::TrackDelete;
        apply_delete(&tx, &change).unwrap();
        let flag: i64 = tx
            .query_row(
                "SELECT rb_local_deleted FROM djmdContent WHERE ID='t1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(flag, 1);
    }

    #[test]
    fn track_delete_errors_when_missing() {
        let mut conn = fixture();
        let tx = conn.transaction().unwrap();
        let mut change = change("Title", Value::Null);
        change.kind = crate::ChangeKind::TrackDelete;
        change.target_id = Some("ghost".into());
        let res = apply_delete(&tx, &change);
        assert!(res.is_err());
    }

    #[test]
    fn disallowed_field_errors() {
        let mut conn = fixture();
        let tx = conn.transaction().unwrap();
        let res = apply_metadata_edit(
            &tx,
            &change("rb_local_deleted", Value::Number(1.into())),
        );
        assert!(res.is_err());
    }
}
