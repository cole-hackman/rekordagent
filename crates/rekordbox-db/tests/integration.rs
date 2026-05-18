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

fn make_fixture_db_with_extra(extra_sql: &str) -> (tempfile::TempPath, RekordboxDb) {
    let tmp = NamedTempFile::new().expect("tempfile");
    let path = tmp.into_temp_path();
    {
        let conn = writable_cipher_conn(&path);
        conn.execute_batch(SCHEMA).expect("schema");
        conn.execute_batch(SEED).expect("seed");
        conn.execute_batch(extra_sql).expect("extra sql");
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

#[test]
fn playlist_by_id_found() {
    let (_p, db) = make_fixture_db();
    let playlist = db.playlist_by_id("2").expect("query").expect("playlist");
    assert_eq!(playlist.name, "Techno Set");
    assert_eq!(playlist.kind, PlaylistKind::Playlist);
}

#[test]
fn playlist_by_id_missing() {
    let (_p, db) = make_fixture_db();
    assert!(db.playlist_by_id("9999").expect("query").is_none());
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

// ── Health scans ───────────────────────────────────────────────────────────

#[test]
fn duplicate_tracks_groups_same_artist_title() {
    let (_p, db) = make_fixture_db_with_extra(
        "
        INSERT INTO djmdContent
            (ID, Title, ArtistID, AlbumID, GenreID, KeyID, BPM, Length, Rating, Commnt,
             FolderPath, AnalysisDataPath, rb_local_deleted)
        VALUES
            ('dup-1', 'Test Track Alpha', 1, 1, 1, 1, 13200, 360, 4, 'duplicate',
             '/music/alpha-copy.mp3', NULL, 0);
        ",
    );

    let groups = db.duplicate_tracks().expect("duplicate scan");
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].artist.as_deref(), Some("Artist One"));
    assert_eq!(groups[0].title, "Test Track Alpha");
    assert_eq!(groups[0].tracks.len(), 2);
}

#[test]
fn broken_metadata_report_finds_missing_core_fields() {
    let (_p, db) = make_fixture_db_with_extra(
        "
        INSERT INTO djmdContent
            (ID, Title, ArtistID, AlbumID, GenreID, KeyID, BPM, Length, Rating, Commnt,
             FolderPath, AnalysisDataPath, rb_local_deleted)
        VALUES
            ('broken-1', 'Broken Metadata', NULL, NULL, NULL, NULL, NULL, 180, 0, NULL,
             '/music/broken.mp3', NULL, 0);
        ",
    );

    let report = db.broken_metadata_report().expect("broken metadata scan");
    assert!(report.missing_artist.iter().any(|t| t.id == "broken-1"));
    assert!(report.missing_bpm.iter().any(|t| t.id == "broken-1"));
    assert!(report.missing_key.iter().any(|t| t.id == "broken-1"));
    assert!(report.missing_genre.iter().any(|t| t.id == "broken-1"));
}

// ── Analytics ──────────────────────────────────────────────────────────────

#[test]
fn library_analytics_excludes_deleted_and_distributes_by_genre_key_bpm() {
    let (_p, db) = make_fixture_db();
    let a = db.library_analytics().expect("analytics");

    // Seed has 4 djmdContent rows, 1 of which has rb_local_deleted = 1.
    assert_eq!(a.total_tracks, 3);

    // Genres: tracks 1 & 3 are Techno, track 2 is House. Deleted track excluded.
    assert_eq!(a.genre_distribution.get("Techno").copied(), Some(2));
    assert_eq!(a.genre_distribution.get("House").copied(), Some(1));

    // Keys: tracks 1 & 3 use 8A, track 2 uses 11B.
    assert_eq!(a.key_distribution.get("8A").copied(), Some(2));
    assert_eq!(a.key_distribution.get("11B").copied(), Some(1));

    // BPM bucketed by floor of BPM/100 (seed stores BPM*100).
    assert_eq!(a.bpm_histogram.get(&132).copied(), Some(1));
    assert_eq!(a.bpm_histogram.get(&128).copied(), Some(1));
    assert_eq!(a.bpm_histogram.get(&140).copied(), Some(1));
    // Deleted track's BPM (128) should not double-count.
    assert_eq!(a.bpm_histogram.values().sum::<usize>(), 3);
}

#[test]
fn library_analytics_skips_null_and_empty_genre_key() {
    // Insert a track with NULL genre/key/BPM so we can assert those don't break the
    // aggregation or get counted as empty-string buckets.
    let extra = "INSERT INTO djmdContent
            (ID, Title, ArtistID, AlbumID, GenreID, KeyID, BPM, Length, Rating, Commnt,
             FolderPath, AnalysisDataPath, rb_local_deleted)
        VALUES
            (99, 'No Metadata', 1, 1, NULL, NULL, NULL, 200, 0, NULL,
             '/music/none.mp3', NULL, 0);";
    let (_p, db) = make_fixture_db_with_extra(extra);
    let a = db.library_analytics().expect("analytics");

    assert_eq!(a.total_tracks, 4);
    // No empty-string keys should appear in the distributions.
    assert!(!a.genre_distribution.contains_key(""));
    assert!(!a.key_distribution.contains_key(""));
    // BPM histogram must not gain a 0 bucket from the NULL row.
    assert!(!a.bpm_histogram.contains_key(&0));
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
