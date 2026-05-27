use anyhow::{Context, Result};
use rekordbox_db::RekordboxDb;
use rusqlite::Connection;
use std::env;
use std::path::{Path, PathBuf};

const RB_KEY: &str = "402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497";
const SCHEMA: &str = include_str!("../src/sql/schema.sql");
const SEED: &str = include_str!("../src/sql/seed.sql");

fn main() -> Result<()> {
    let output = env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("fixtures/tiny-library/master.db"));
    seed_library(&output)?;
    let db = RekordboxDb::open(&output)?;
    let track_count = db.tracks()?.len();
    anyhow::ensure!(track_count > 0, "fixture should contain tracks");
    println!("{}", output.display());
    Ok(())
}

fn seed_library(output: &Path) -> Result<()> {
    let root = output
        .parent()
        .context("output path must include a parent directory")?;
    let music_dir = root.join("music");
    std::fs::create_dir_all(&music_dir)
        .with_context(|| format!("creating {}", music_dir.display()))?;
    for name in ["alpha.mp3", "beta.mp3", "gamma.mp3"] {
        let path = music_dir.join(name);
        if !path.exists() {
            std::fs::write(&path, b"synthetic fixture audio placeholder\n")
                .with_context(|| format!("writing {}", path.display()))?;
        }
    }

    if output.exists() {
        std::fs::remove_file(output).with_context(|| format!("removing {}", output.display()))?;
    }

    let conn = Connection::open(output).with_context(|| format!("opening {}", output.display()))?;
    conn.execute_batch(&format!(
        "PRAGMA key = '{RB_KEY}'; PRAGMA busy_timeout = 5000;"
    ))?;
    conn.execute_batch(SCHEMA)?;
    conn.execute_batch(SEED)?;
    conn.execute(
        "UPDATE djmdContent SET FolderPath = ?1 WHERE ID = '1'",
        [music_dir.join("alpha.mp3").to_string_lossy().as_ref()],
    )?;
    conn.execute(
        "UPDATE djmdContent SET FolderPath = ?1 WHERE ID = '2'",
        [music_dir.join("beta.mp3").to_string_lossy().as_ref()],
    )?;
    conn.execute(
        "UPDATE djmdContent SET FolderPath = ?1 WHERE ID = '3'",
        [music_dir.join("gamma.mp3").to_string_lossy().as_ref()],
    )?;
    Ok(())
}
