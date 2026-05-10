/// Schema migrations. Each entry is (target_version, sql).
/// Versions are sequential from 1; the migration at index i brings the DB
/// from version i to version i+1.
pub const MIGRATIONS: &[(u32, &str)] = &[
    // v0 → v1: initial schema
    (
        1,
        "
        CREATE TABLE IF NOT EXISTS audio_features (
            track_uri       TEXT    NOT NULL,
            analyzer_version TEXT   NOT NULL,
            bpm             REAL,
            musical_key     TEXT,
            energy          REAL,
            features_json   TEXT,
            created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
            PRIMARY KEY (track_uri, analyzer_version)
        );
        ",
    ),
];

pub fn current_version(conn: &rusqlite::Connection) -> anyhow::Result<u32> {
    Ok(conn.query_row("PRAGMA user_version", [], |r| r.get(0))?)
}

pub fn set_version(conn: &rusqlite::Connection, v: u32) -> anyhow::Result<()> {
    conn.execute_batch(&format!("PRAGMA user_version = {v};"))?;
    Ok(())
}

pub fn run(conn: &rusqlite::Connection) -> anyhow::Result<()> {
    let mut version = current_version(conn)?;
    for &(target, sql) in MIGRATIONS {
        if version < target {
            conn.execute_batch(sql)?;
            set_version(conn, target)?;
            version = target;
            tracing::debug!("cache DB migrated to schema v{target}");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn migrations_run_idempotently() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();
        let v1 = current_version(&conn).unwrap();
        // Running again must be a no-op.
        run(&conn).unwrap();
        let v2 = current_version(&conn).unwrap();
        assert_eq!(v1, v2);
        assert!(v1 >= 1);
    }

    #[test]
    fn schema_version_increases() {
        let conn = Connection::open_in_memory().unwrap();
        assert_eq!(current_version(&conn).unwrap(), 0);
        run(&conn).unwrap();
        assert_eq!(
            current_version(&conn).unwrap(),
            MIGRATIONS.last().unwrap().0
        );
    }

    #[test]
    fn audio_features_table_exists_after_migration() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();
        // Should not error.
        conn.execute_batch(
            "INSERT INTO audio_features (track_uri, analyzer_version, bpm)
             VALUES ('file:///test.mp3', 'v1', 128.0);",
        )
        .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM audio_features", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
