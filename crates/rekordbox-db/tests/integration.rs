/// Integration tests for rekordbox-db against a synthetic SQLCipher fixture.
///
/// The fixture is created fresh each test via `make_fixture_db`, which opens a
/// write-mode SQLCipher connection (using the same key as production), builds the
/// schema, and inserts seed data. Tests then re-open the file with
/// `RekordboxDb::open` (read-only) and exercise every public query.
use rekordbox_db::{CueKind, PlaylistKind, RekordboxDb};
use rusqlite::Connection;
use std::path::Path;
use tempfile::NamedTempFile;

const RB_KEY: &str = "402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497";
const SCHEMA: &str = include_str!("../src/sql/schema.sql");
const SEED: &str = include_str!("../src/sql/seed.sql");

fn make_fixture_db() -> (tempfile::TempPath, RekordboxDb) {
    let tmp = NamedTempFile::new().expect("tempfile");
    let path = tmp.into_temp_path();
    {
        let conn = writable_cipher_conn(&path);
        conn.execute_batch(SCHEMA).expect("schema");
        conn.execute_batch(SEED).expect("seed");
    }
    let db = RekordboxDb::open(&path).expect("open read-only");
    (path, db)
}

fn writable_cipher_conn(path: &Path) -> Connection {
    let conn = Connection::open(path).expect("open writable");
    conn.execute_batch(&format!(
        "PRAGMA key = '{RB_KEY}'; PRAGMA busy_timeout = 5000;"
    ))
    .expect("pragmas");
    conn
}

// ── Track queries ──────────────────────────────────────────────────────────

#[test]
fn tracks_returns_live_tracks_only() {
    let (_p, db) = make_fixture_db();
    let tracks = db.tracks().expect("tracks");
    assert_eq!(tracks.len(), 3, "seed has 3 live tracks (1 deleted)");
    assert!(tracks.iter().all(|t| t.title != "Deleted Track"));
}

#[test]
fn track_bpm_converted_correctly() {
    let (_p, db) = make_fixture_db();
    let tracks = db.tracks().expect("tracks");
    let alpha = tracks
        .iter()
        .find(|t| t.title == "Test Track Alpha")
        .unwrap();
    // seed inserts BPM = 13200 → 132.00
    let bpm = alpha.bpm.expect("bpm present");
    assert!((bpm - 132.0).abs() < 0.001, "bpm was {bpm}");
}

#[test]
fn track_by_id_found() {
    let (_p, db) = make_fixture_db();
    let t = db.track_by_id("1").expect("query").expect("row");
    assert_eq!(t.title, "Test Track Alpha");
    assert_eq!(t.artist.as_deref(), Some("Artist One"));
    assert_eq!(t.genre.as_deref(), Some("Techno"));
    assert_eq!(t.musical_key.as_deref(), Some("8A"));
}

#[test]
fn track_by_id_missing() {
    let (_p, db) = make_fixture_db();
    assert!(db.track_by_id("9999").expect("query").is_none());
}

#[test]
fn search_tracks_by_title() {
    let (_p, db) = make_fixture_db();
    let results = db.search_tracks("Beta").expect("search");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Test Track Beta");
}

#[test]
fn search_tracks_no_results() {
    let (_p, db) = make_fixture_db();
    let results = db.search_tracks("zzz_no_match_zzz").expect("search");
    assert!(results.is_empty());
}

// ── Playlist queries ───────────────────────────────────────────────────────

#[test]
fn playlists_returns_all() {
    let (_p, db) = make_fixture_db();
    let playlists = db.playlists().expect("playlists");
    assert_eq!(playlists.len(), 3);
}

#[test]
fn playlist_kind_folder() {
    let (_p, db) = make_fixture_db();
    let playlists = db.playlists().expect("playlists");
    let folder = playlists.iter().find(|p| p.name == "Root Folder").unwrap();
    assert_eq!(folder.kind, PlaylistKind::Folder);
}

#[test]
fn playlist_kind_regular() {
    let (_p, db) = make_fixture_db();
    let playlists = db.playlists().expect("playlists");
    let pl = playlists.iter().find(|p| p.name == "Techno Set").unwrap();
    assert_eq!(pl.kind, PlaylistKind::Playlist);
}

#[test]
fn playlist_entries_for_techno_set() {
    let (_p, db) = make_fixture_db();
    let entries = db.playlist_entries("2").expect("entries");
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].content_id, "1");
    assert_eq!(entries[1].content_id, "2");
}

#[test]
fn playlist_entries_empty() {
    let (_p, db) = make_fixture_db();
    assert!(db.playlist_entries("9999").expect("entries").is_empty());
}

// ── Cue queries ────────────────────────────────────────────────────────────

#[test]
fn hot_cues_for_track_ordered_by_position() {
    let (_p, db) = make_fixture_db();
    let cues = db.hot_cues_for_track("1").expect("cues");
    assert_eq!(cues.len(), 2);
    assert!(cues[0].in_msec <= cues[1].in_msec);
}

#[test]
fn cue_kinds_parsed_correctly() {
    let (_p, db) = make_fixture_db();
    let cues = db.hot_cues_for_track("1").expect("cues");
    assert_eq!(cues[0].kind, CueKind::MemoryCue);
    assert_eq!(cues[1].kind, CueKind::HotCue(1));
}

#[test]
fn all_hot_cues_total_count() {
    let (_p, db) = make_fixture_db();
    let cues = db.all_hot_cues().expect("all cues");
    assert_eq!(cues.len(), 3);
}

#[test]
fn cues_for_unknown_track_empty() {
    let (_p, db) = make_fixture_db();
    assert!(db.hot_cues_for_track("9999").expect("cues").is_empty());
}

// ── ANLZ beat grid ─────────────────────────────────────────────────────────

#[test]
fn beat_grid_from_anlz_file() {
    use std::io::Write;
    use tempfile::NamedTempFile;

    let beats: &[(u16, u16, u32)] = &[
        (1, 12800, 0),
        (2, 12800, 468),
        (3, 12800, 937),
        (4, 12800, 1406),
    ];
    let blob = make_anlz_blob(beats);
    let mut f = NamedTempFile::new().unwrap();
    f.write_all(&blob).unwrap();

    let entries = RekordboxDb::beat_grid(f.path()).expect("beat grid");
    assert_eq!(entries.len(), 4);
    assert_eq!(entries[0].beat_number, 1);
    assert!((entries[0].bpm() - 128.0).abs() < 0.001);
    assert_eq!(entries[3].time_ms, 1406);
}

fn make_anlz_blob(beats: &[(u16, u16, u32)]) -> Vec<u8> {
    let beat_count = beats.len() as u32;
    let section_header_len: u32 = 24;
    let section_total_len = section_header_len + beat_count * 8;
    let file_header_len: u32 = 28;
    let file_total_len = file_header_len + section_total_len;

    let mut buf = Vec::new();
    buf.extend_from_slice(b"PMAI");
    buf.extend_from_slice(&file_header_len.to_be_bytes());
    buf.extend_from_slice(&file_total_len.to_be_bytes());
    buf.extend_from_slice(&[0u8; 16]);

    buf.extend_from_slice(b"PQTZ");
    buf.extend_from_slice(&section_header_len.to_be_bytes());
    buf.extend_from_slice(&section_total_len.to_be_bytes());

    buf.extend_from_slice(&[0x00, 0x80, 0x00, 0x00]);
    buf.extend_from_slice(&beat_count.to_be_bytes());
    buf.extend_from_slice(&[0u8; 4]);

    for &(beat_num, tempo, time_ms) in beats {
        buf.extend_from_slice(&beat_num.to_be_bytes());
        buf.extend_from_slice(&tempo.to_be_bytes());
        buf.extend_from_slice(&time_ms.to_be_bytes());
    }
    buf
}
