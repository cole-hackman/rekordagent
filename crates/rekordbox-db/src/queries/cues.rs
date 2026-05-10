use crate::types::{CueKind, HotCue};
use anyhow::Result;
use rusqlite::{params, Connection};

const SELECT: &str = "
SELECT ID, ContentID, InMsec, OutMsec, Kind, Color, Commnt
FROM djmdCue
";

fn row_to_cue(row: &rusqlite::Row<'_>) -> rusqlite::Result<HotCue> {
    let kind_raw: i64 = row.get(4)?;
    Ok(HotCue {
        id: row.get(0)?,
        content_id: row.get(1)?,
        in_msec: row.get(2)?,
        out_msec: row.get(3)?,
        kind: CueKind::from_db(kind_raw),
        color: row.get(5)?,
        comment: row.get(6)?,
    })
}

pub fn for_track(conn: &Connection, content_id: i64) -> Result<Vec<HotCue>> {
    let sql = format!("{SELECT} WHERE ContentID = ?1 ORDER BY InMsec");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![content_id], row_to_cue)?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

pub fn all(conn: &Connection) -> Result<Vec<HotCue>> {
    let sql = format!("{SELECT} ORDER BY ContentID, InMsec");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_cue)?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
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
        conn.execute_batch(include_str!("../sql/schema.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../sql/seed.sql")).unwrap();
        drop(conn);
        path
    }

    #[test]
    fn hot_cues_for_track() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        // seed gives track 1 two cues
        let cues = for_track(&conn, 1).unwrap();
        assert_eq!(cues.len(), 2);
        // ordered by InMsec ascending
        assert!(cues[0].in_msec <= cues[1].in_msec);
    }

    #[test]
    fn cue_kinds() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        let cues = for_track(&conn, 1).unwrap();
        assert_eq!(cues[0].kind, CueKind::MemoryCue);
        assert_eq!(cues[1].kind, CueKind::HotCue(1));
    }

    #[test]
    fn all_cues_count() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        // seed inserts 3 cues total
        let cues = all(&conn).unwrap();
        assert_eq!(cues.len(), 3);
    }

    #[test]
    fn no_cues_for_unknown_track() {
        let path = make_db();
        let conn = create_test_db(&path).unwrap();
        assert!(for_track(&conn, 9999).unwrap().is_empty());
    }
}
