use crate::types::{Playlist, PlaylistEntry, PlaylistKind};
use anyhow::Result;
use rusqlite::{params, Connection};

pub fn all(conn: &Connection) -> Result<Vec<Playlist>> {
    let mut stmt = conn.prepare(
        "SELECT ID, Name, ParentID, Seq, Attribute
         FROM djmdPlaylist
         ORDER BY ParentID NULLS FIRST, Seq",
    )?;
    let rows = stmt.query_map([], |row| {
        let kind = PlaylistKind::from_attribute(row.get::<_, i64>(4)?);
        Ok(Playlist {
            id: row.get(0)?,
            name: row.get(1)?,
            parent_id: row.get(2)?,
            seq: row.get(3)?,
            kind,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

pub fn entries(conn: &Connection, playlist_id: i64) -> Result<Vec<PlaylistEntry>> {
    let mut stmt = conn.prepare(
        "SELECT PlaylistID, ContentID, TrackNo
         FROM djmdSongPlaylist
         WHERE PlaylistID = ?1
         ORDER BY TrackNo",
    )?;
    let rows = stmt.query_map(params![playlist_id], |row| {
        Ok(PlaylistEntry {
            playlist_id: row.get(0)?,
            content_id: row.get(1)?,
            track_no: row.get(2)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::test_helpers::create_test_db;
    use tempfile::NamedTempFile;

    fn make_db() -> tempfile::TempPath {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.into_temp_path();
        let conn = create_test_db(&path).unwrap();
        conn.execute_batch(include_str!("../sql/schema.sql")).unwrap();
        conn.execute_batch(include_str!("../sql/seed.sql")).unwrap();
        drop(conn);
        path
    }

    #[test]
    fn all_playlists() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        let playlists = all(&conn).unwrap();
        // seed has 1 folder + 2 playlists
        assert_eq!(playlists.len(), 3);
    }

    #[test]
    fn folder_kind() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        let playlists = all(&conn).unwrap();
        let folder = playlists.iter().find(|p| p.name == "Root Folder").unwrap();
        assert_eq!(folder.kind, PlaylistKind::Folder);
    }

    #[test]
    fn playlist_entries_ordered() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        // playlist ID 2 has 2 entries in seed
        let entries = entries(&conn, 2).unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries[0].track_no <= entries[1].track_no);
    }

    #[test]
    fn entries_empty_playlist() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        let entries = entries(&conn, 9999).unwrap();
        assert!(entries.is_empty());
    }
}
