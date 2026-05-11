use crate::types::Track;
use anyhow::Result;
use rusqlite::{params, Connection};

/// Core SELECT — reused by every track query.
/// BPM is stored as integer × 100; we convert to actual bpm here.
const SELECT: &str = "
SELECT
    c.ID,
    COALESCE(c.Title, '') AS Title,
    a.Name              AS Artist,
    al.Name             AS Album,
    g.Name              AS Genre,
    k.ScaleName         AS MusicKey,
    CAST(c.BPM AS REAL) / 100.0 AS BPM,
    c.Length,
    c.Rating,
    c.Commnt,
    c.FolderPath,
    c.AnalysisDataPath,
    c.FileType,
    c.SampleRate,
    c.BitRate,
    c.ReleaseYear,
    c.DJPlayCount
FROM djmdContent c
LEFT JOIN djmdArtist a  ON c.ArtistID = a.ID
LEFT JOIN djmdAlbum  al ON c.AlbumID  = al.ID
LEFT JOIN djmdGenre  g  ON c.GenreID  = g.ID
LEFT JOIN djmdKey    k  ON c.KeyID    = k.ID
WHERE (c.rb_local_deleted IS NULL OR c.rb_local_deleted = 0)
";

fn row_to_track(row: &rusqlite::Row<'_>) -> rusqlite::Result<Track> {
    Ok(Track {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        album: row.get(3)?,
        genre: row.get(4)?,
        musical_key: row.get(5)?,
        bpm: row.get(6)?,
        duration_secs: row.get(7)?,
        rating: row.get(8)?,
        comment: row.get(9)?,
        folder_path: row.get(10)?,
        analysis_data_path: row.get(11)?,
        file_type: row.get(12)?,
        sample_rate: row.get(13)?,
        bit_rate: row.get(14)?,
        release_year: row.get(15)?,
        dj_play_count: row.get(16)?,
    })
}

pub fn all(conn: &Connection) -> Result<Vec<Track>> {
    let sql = format!("{SELECT} ORDER BY a.Name, c.Title");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_track)?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

pub fn by_id(conn: &Connection, id: &str) -> Result<Option<Track>> {
    let sql = format!("{SELECT} AND c.ID = ?1");
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map(params![id], row_to_track)?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

/// Case-insensitive substring search across title, artist, album, genre, comment.
pub fn search(conn: &Connection, query: &str) -> Result<Vec<Track>> {
    let pattern = format!("%{query}%");
    let sql = format!(
        "{SELECT}
         AND (
             c.Title  LIKE ?1 OR
             a.Name   LIKE ?1 OR
             al.Name  LIKE ?1 OR
             g.Name   LIKE ?1 OR
             c.Commnt LIKE ?1
         )
         ORDER BY a.Name, c.Title"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![pattern], row_to_track)?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::test_helpers::create_test_db;
    use tempfile::NamedTempFile;

    fn make_db() -> (tempfile::TempPath, Connection) {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.into_temp_path();
        let conn = create_test_db(&path).unwrap();
        conn.execute_batch(include_str!("../sql/schema.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../sql/seed.sql")).unwrap();
        (path, conn)
    }

    #[test]
    fn all_returns_non_deleted_tracks() {
        let (_path, conn) = make_db();
        let tracks = all(&conn).unwrap();
        assert_eq!(tracks.len(), 3, "seed has 3 live tracks");
        assert!(tracks.iter().all(|t| !t.id.is_empty()));
    }

    #[test]
    fn by_id_found() {
        let (_path, conn) = make_db();
        let t = by_id(&conn, "1").unwrap();
        assert!(t.is_some());
        assert_eq!(t.unwrap().title, "Test Track Alpha");
    }

    #[test]
    fn by_id_not_found() {
        let (_path, conn) = make_db();
        assert!(by_id(&conn, "9999").unwrap().is_none());
    }

    #[test]
    fn search_by_title() {
        let (_path, conn) = make_db();
        let results = search(&conn, "beta").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Test Track Beta");
    }

    #[test]
    fn bpm_converted_from_integer_x100() {
        let (_path, conn) = make_db();
        let tracks = all(&conn).unwrap();
        let alpha = tracks
            .iter()
            .find(|t| t.title == "Test Track Alpha")
            .unwrap();
        // seed.sql inserts BPM = 13200 → 132.00
        assert!((alpha.bpm.unwrap() - 132.0).abs() < 0.001);
    }

    #[test]
    fn deleted_tracks_excluded() {
        let (_path, conn) = make_db();
        let tracks = all(&conn).unwrap();
        assert!(tracks.iter().all(|t| t.title != "Deleted Track"));
    }
}
