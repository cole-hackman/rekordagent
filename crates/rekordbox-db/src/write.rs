use crate::connection::apply_pragmas;
use anyhow::Result;
use chrono::Local;
use rusqlite::{Connection, OpenFlags, Transaction};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum WriteError {
    #[error("Rekordbox is currently running (master.db-wal is not empty). Please close Rekordbox to sync.")]
    Locked,
    #[error("Failed to open or backup database: {0}")]
    Io(#[from] std::io::Error),
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Other error: {0}")]
    Other(#[from] anyhow::Error),
}

/// Session-scoped backup ledger. One entry per library_path the session has
/// already backed up. Held in Tauri-managed state for the app lifetime.
#[derive(Debug, Default)]
pub struct WriteSession {
    backed_up: HashMap<PathBuf, PathBuf>,
}

impl WriteSession {
    pub fn new() -> Self {
        Self::default()
    }

    /// Backup file recorded for `library_path` this session, if any.
    pub fn backup_for(&self, library_path: &Path) -> Option<&Path> {
        self.backed_up.get(library_path).map(PathBuf::as_path)
    }

    /// Drop the recorded backup entry (e.g. on library switch).
    #[allow(dead_code)]
    pub fn forget(&mut self, library_path: &Path) {
        self.backed_up.remove(library_path);
    }
}

pub struct WriteGuard {
    conn: Connection,
    #[allow(dead_code)]
    library_path: PathBuf,
    backup_path: Option<PathBuf>,
}

impl WriteGuard {
    /// Derive the sibling `*-wal` path for a given DB path.
    fn wal_path_for(library_path: &Path) -> PathBuf {
        if let Some(ext) = library_path.extension() {
            let mut s = ext.to_string_lossy().to_string();
            s.push_str("-wal");
            library_path.with_extension(s)
        } else {
            library_path.with_extension("db-wal")
        }
    }

    /// Cheap probe: returns `true` if a sibling `master.db-wal` exists and is
    /// non-empty (indicating Rekordbox holds the DB open). Performs only a
    /// `fs::metadata` stat — never opens the DB, never creates a backup.
    pub fn probe_lock(library_path: &Path) -> Result<bool, WriteError> {
        let wal = Self::wal_path_for(library_path);
        match fs::metadata(&wal) {
            Ok(m) => Ok(m.len() > 0),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e.into()),
        }
    }

    /// Acquire a writable handle to `master.db`. Backs up the DB the first
    /// time this session sees `library_path`; subsequent acquires reuse the
    /// recorded backup path. Returns `Err(Locked)` if Rekordbox is open.
    pub fn acquire_for_write(
        library_path: &Path,
        session: &mut WriteSession,
    ) -> Result<Self, WriteError> {
        if Self::probe_lock(library_path)? {
            return Err(WriteError::Locked);
        }

        let backup_path = if let Some(existing) = session.backed_up.get(library_path) {
            existing.clone()
        } else {
            let now = Local::now().format("%Y%m%d-%H%M%S");
            let ext = library_path
                .extension()
                .unwrap_or_default()
                .to_string_lossy();
            let backup_ext = format!("{}.bak.{}", ext, now);
            let backup = library_path.with_extension(backup_ext);
            fs::copy(library_path, &backup)?;
            session
                .backed_up
                .insert(library_path.to_path_buf(), backup.clone());
            backup
        };

        let conn = Connection::open_with_flags(
            library_path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        apply_pragmas(&conn).map_err(WriteError::Other)?;

        Ok(Self {
            conn,
            library_path: library_path.to_path_buf(),
            backup_path: Some(backup_path),
        })
    }

    pub fn conn(&mut self) -> &mut Connection {
        &mut self.conn
    }

    pub fn backup_path(&self) -> Option<&Path> {
        self.backup_path.as_deref()
    }

    /// Run `f` inside a transaction; rolls back on inner error.
    pub fn with_tx<R>(
        &mut self,
        f: impl FnOnce(&Transaction) -> Result<R, anyhow::Error>,
    ) -> Result<R, anyhow::Error> {
        let tx = self.conn.transaction()?;
        let res = f(&tx)?;
        tx.commit()?;
        Ok(res)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::test_helpers::create_test_db;
    use tempfile::NamedTempFile;

    fn fresh_db_path() -> PathBuf {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();
        drop(tmp);
        let _db = create_test_db(&path).unwrap();
        path
    }

    #[test]
    fn probe_lock_returns_false_when_no_wal() {
        let path = fresh_db_path();
        assert!(!WriteGuard::probe_lock(&path).unwrap());
    }

    #[test]
    fn probe_lock_returns_true_when_wal_nonempty() {
        let path = fresh_db_path();
        let wal = WriteGuard::wal_path_for(&path);
        fs::write(&wal, b"not empty").unwrap();
        assert!(WriteGuard::probe_lock(&path).unwrap());
        fs::remove_file(&wal).ok();
    }

    #[test]
    fn probe_lock_does_not_create_backup() {
        let path = fresh_db_path();
        let _ = WriteGuard::probe_lock(&path).unwrap();
        let parent = path.parent().unwrap();
        let basename = path.file_name().unwrap().to_string_lossy().to_string();
        let any_bak = fs::read_dir(parent)
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| {
                let n = e.file_name().to_string_lossy().to_string();
                n != basename && n.starts_with(&basename) && n.contains(".bak.")
            });
        assert!(!any_bak, "probe_lock must not create a backup file");
    }

    #[test]
    fn acquire_for_write_errors_when_locked() {
        let path = fresh_db_path();
        let wal = WriteGuard::wal_path_for(&path);
        fs::write(&wal, b"locked").unwrap();
        let mut session = WriteSession::new();
        let res = WriteGuard::acquire_for_write(&path, &mut session);
        assert!(matches!(res, Err(WriteError::Locked)));
        fs::remove_file(&wal).ok();
    }

    #[test]
    fn acquire_for_write_backs_up_once_per_session() {
        let path = fresh_db_path();
        let mut session = WriteSession::new();

        let g1 = WriteGuard::acquire_for_write(&path, &mut session).unwrap();
        let b1 = g1.backup_path().unwrap().to_path_buf();
        drop(g1);

        let g2 = WriteGuard::acquire_for_write(&path, &mut session).unwrap();
        let b2 = g2.backup_path().unwrap().to_path_buf();
        drop(g2);

        assert_eq!(b1, b2, "second acquire must reuse the same backup path");

        let parent = path.parent().unwrap();
        let basename = path.file_name().unwrap().to_string_lossy().to_string();
        let bak_count = fs::read_dir(parent)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let n = e.file_name().to_string_lossy().to_string();
                n != basename && n.starts_with(&basename) && n.contains(".bak.")
            })
            .count();
        assert_eq!(bak_count, 1, "exactly one backup file must exist");
    }

    #[test]
    fn with_tx_commits_on_success_rolls_back_on_error() {
        let path = fresh_db_path();
        {
            let db = create_test_db(&path).unwrap();
            db.execute_batch("CREATE TABLE t (x INTEGER);").unwrap();
        }

        let mut session = WriteSession::new();
        let mut guard = WriteGuard::acquire_for_write(&path, &mut session).unwrap();

        guard
            .with_tx(|tx| {
                tx.execute("INSERT INTO t VALUES (1)", [])?;
                Ok(())
            })
            .unwrap();

        let count: i64 = guard
            .conn()
            .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);

        let err_res: Result<(), anyhow::Error> = guard.with_tx(|tx| {
            tx.execute("INSERT INTO t VALUES (2)", [])?;
            Err(anyhow::anyhow!("abort"))
        });
        assert!(err_res.is_err());

        let count: i64 = guard
            .conn()
            .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
