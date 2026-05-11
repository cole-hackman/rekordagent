//! Read-only SQLCipher access to the Rekordbox 7 `master.db`.
//!
//! Vendored and adapted from reklawdbox `src/db.rs` (MIT, Ryan Voitiskis).
//!
//! # Quick start
//!
//! ```no_run
//! use rekordbox_db::RekordboxDb;
//! use std::path::Path;
//!
//! let db = RekordboxDb::open(Path::new("/path/to/master.db")).unwrap();
//! let tracks = db.tracks().unwrap();
//! println!("{} tracks", tracks.len());
//! ```

pub mod anlz;
mod connection;
mod queries;
pub mod types;

pub use connection::RekordboxDb;
pub use types::{
    BeatGridEntry, BrokenMetadataReport, CueKind, DuplicateGroup, HotCue, Playlist, PlaylistEntry,
    PlaylistKind, Track,
};
