use serde::{Deserialize, Serialize};

/// Top-level Rekordbox XML collection.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Collection {
    pub product: Product,
    pub tracks: Vec<Track>,
    /// Root-level playlist nodes (usually a single "ROOT" folder node).
    pub playlists: Vec<Node>,
}

/// `<PRODUCT>` element — identifies the writing application.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Product {
    pub name: String,
    pub version: String,
    pub company: String,
}

impl Default for Product {
    fn default() -> Self {
        Self {
            name: "decks".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            company: "decks contributors".into(),
        }
    }
}

/// A `<TRACK>` element inside `<COLLECTION>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Track {
    pub track_id: u32,
    pub name: String,
    /// `file://localhost/...` URI.
    pub location: String,

    pub artist: Option<String>,
    pub composer: Option<String>,
    pub album: Option<String>,
    pub grouping: Option<String>,
    pub genre: Option<String>,
    /// e.g. "MP3 File", "FLAC File".
    pub kind: Option<String>,
    pub size: Option<u64>,
    /// Duration in seconds.
    pub total_time: Option<u32>,
    pub disc_number: Option<u32>,
    pub track_number: Option<u32>,
    pub year: Option<u32>,
    /// BPM as a float (already the actual value, e.g. 128.00).
    pub average_bpm: Option<f64>,
    /// ISO date string: "2024-01-15".
    pub date_added: Option<String>,
    pub bit_rate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub comments: Option<String>,
    pub play_count: Option<u32>,
    /// 0–255 (0 = no stars, 255 = 5 stars; steps of 51).
    pub rating: Option<u8>,
    pub remixer: Option<String>,
    /// Camelot-wheel key, e.g. "8A".
    pub tonality: Option<String>,
    pub label: Option<String>,
    pub mix: Option<String>,
    /// Hex colour, e.g. "0xFF0000".
    pub colour: Option<String>,

    pub tempos: Vec<Tempo>,
    pub position_marks: Vec<PositionMark>,
}

/// `<TEMPO>` child of `<TRACK>` — one beat-grid anchor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tempo {
    /// Start position in seconds.
    pub inizio: f64,
    pub bpm: f64,
    /// Time signature denominator, e.g. "4/4".
    pub metro: String,
    /// Beat position within the bar: 1–4.
    pub battito: u32,
}

/// `<POSITION_MARK>` child of `<TRACK>` — a cue or loop point.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PositionMark {
    pub name: Option<String>,
    pub mark_type: PositionMarkType,
    /// Position in seconds.
    pub start: f64,
    /// Loop end in seconds; `None` for non-loop marks.
    pub end: Option<f64>,
    /// -1 = memory cue; 0–7 = hot cue slot.
    pub num: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum PositionMarkType {
    Cue = 0,
    FadeIn = 1,
    FadeOut = 2,
    Load = 3,
    Loop = 4,
}

impl PositionMarkType {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::Cue),
            1 => Some(Self::FadeIn),
            2 => Some(Self::FadeOut),
            3 => Some(Self::Load),
            4 => Some(Self::Loop),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }
}

/// A `<NODE>` element inside `<PLAYLISTS>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Node {
    Folder {
        name: String,
        children: Vec<Node>,
    },
    Playlist {
        name: String,
        /// 0 = TrackID key, 1 = Location key.
        key_type: u8,
        /// TrackIDs (when key_type = 0).
        track_ids: Vec<u32>,
    },
}
