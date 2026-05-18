// Adapted from reklawdbox src/tags.rs (MIT, Ryan Voitiskis).
// See NOTICE at the workspace root for full attribution.

use std::path::Path;

use lofty::config::{ParseOptions, ParsingMode, WriteOptions};
use lofty::file::FileType;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::ItemKey;
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum TagError {
    #[error("unsupported file format: {0}")]
    Unsupported(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("parse error: {0}")]
    Parse(String),
}

type Result<T> = std::result::Result<T, TagError>;

/// Metadata read directly from an audio file's embedded tags.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrackTags {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    /// BPM parsed from the embedded BPM tag (integer or float string).
    pub bpm: Option<f64>,
    /// Musical key in whatever notation is embedded (e.g. "8A", "Am", "C major").
    pub musical_key: Option<String>,
    pub comment: Option<String>,
    pub year: Option<u32>,
    /// Rating on 0–255 scale (ID3 POPM; other formats map to 0/64/128/196/255).
    pub rating: Option<u8>,
    /// Duration in seconds from audio properties.
    pub duration_secs: Option<f64>,
    /// "mp3" | "flac" | "m4a" | "wav" | "aiff" | etc.
    pub file_type: Option<String>,
}

/// Fields that `write_tag_fields` will update. Only `Some(_)` values are written;
/// `None` leaves the existing tag value untouched.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TagWriteFields {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub bpm: Option<f64>,
    pub musical_key: Option<String>,
    pub comment: Option<String>,
    pub year: Option<u32>,
}

fn parse_opts() -> ParseOptions {
    ParseOptions::new()
        .read_cover_art(false)
        .parsing_mode(ParsingMode::BestAttempt)
}

fn file_type_str(ft: FileType) -> &'static str {
    match ft {
        FileType::Mpeg => "mp3",
        FileType::Flac => "flac",
        FileType::Mp4 => "m4a",
        FileType::Wav => "wav",
        FileType::Aiff => "aiff",
        FileType::Aac => "aac",
        _ => "unknown",
    }
}

fn get_str(tag: &lofty::tag::Tag, key: ItemKey) -> Option<String> {
    tag.get(&key)
        .and_then(|item| item.value().text())
        .map(|s| s.to_string())
}

fn get_first_str(tag: &lofty::tag::Tag, keys: &[ItemKey]) -> Option<String> {
    for key in keys {
        if let Some(v) = get_str(tag, key.clone()) {
            if !v.is_empty() {
                return Some(v);
            }
        }
    }
    None
}

fn parse_bpm(s: &str) -> Option<f64> {
    let trimmed = s.trim();
    // Try float first, then integer
    trimmed
        .parse::<f64>()
        .ok()
        .or_else(|| trimmed.parse::<u32>().ok().map(|n| n as f64))
        .filter(|&v| v > 0.0 && v < 400.0)
}

fn parse_year(s: &str) -> Option<u32> {
    // Year may be a full date string like "2019-04-12" — extract leading 4 digits
    s.trim()
        .get(..4)
        .and_then(|y| y.parse::<u32>().ok())
        .filter(|&y| y > 1900 && y < 2100)
}

/// Read tags embedded in an audio file.
pub fn read_tags(path: &Path) -> Result<TrackTags> {
    let tagged = Probe::open(path)
        .map_err(|e| TagError::Io(e.to_string()))?
        .options(parse_opts())
        .read()
        .map_err(|e| TagError::Parse(e.to_string()))?;

    let ft = tagged.file_type();
    let props = tagged.properties();
    let duration_secs = Some(props.duration().as_secs_f64()).filter(|&d| d > 0.0);

    let tag = match tagged.primary_tag().or_else(|| tagged.first_tag()) {
        Some(t) => t,
        None => {
            return Ok(TrackTags {
                file_type: Some(file_type_str(ft).to_string()),
                duration_secs,
                ..Default::default()
            })
        }
    };

    let bpm = get_first_str(tag, &[ItemKey::IntegerBpm, ItemKey::Bpm]).and_then(|s| parse_bpm(&s));

    let year =
        get_first_str(tag, &[ItemKey::RecordingDate, ItemKey::Year]).and_then(|s| parse_year(&s));

    // Popularimeter stores "email\0rating\0counter" — skip for now; return None
    let rating: Option<u8> = None;

    Ok(TrackTags {
        title: get_str(tag, ItemKey::TrackTitle),
        artist: get_str(tag, ItemKey::TrackArtist),
        album: get_str(tag, ItemKey::AlbumTitle),
        genre: get_str(tag, ItemKey::Genre),
        bpm,
        musical_key: get_str(tag, ItemKey::InitialKey),
        comment: get_str(tag, ItemKey::Comment),
        year,
        rating,
        duration_secs,
        file_type: Some(file_type_str(ft).to_string()),
    })
}

/// Write selected fields to an audio file's embedded tags. Only `Some(_)` fields
/// are written; `None` fields leave existing values untouched.
///
/// The file is written via a temp file + atomic rename to protect against partial
/// writes (important for WAV which has no backup copy mechanism).
pub fn write_tag_fields(path: &Path, fields: &TagWriteFields) -> Result<()> {
    let mut tagged = Probe::open(path)
        .map_err(|e| TagError::Io(e.to_string()))?
        .options(parse_opts())
        .read()
        .map_err(|e| TagError::Parse(e.to_string()))?;

    let ft = tagged.file_type();

    // Ensure there's a writable tag. For formats that support multiple tag types
    // we prefer the primary one.
    if tagged.primary_tag().is_none() {
        let tag_type = match ft {
            FileType::Mpeg => lofty::tag::TagType::Id3v2,
            FileType::Flac => lofty::tag::TagType::VorbisComments,
            FileType::Mp4 => lofty::tag::TagType::Mp4Ilst,
            FileType::Wav => lofty::tag::TagType::Id3v2,
            FileType::Aiff => lofty::tag::TagType::Id3v2,
            other => {
                return Err(TagError::Unsupported(format!(
                    "no writable tag type for {:?}",
                    other
                )))
            }
        };
        tagged.insert_tag(lofty::tag::Tag::new(tag_type));
    }

    let tag = tagged
        .primary_tag_mut()
        .ok_or_else(|| TagError::Io("could not get mutable primary tag".to_string()))?;

    macro_rules! write_str {
        ($key:expr, $val:expr) => {
            if let Some(v) = $val {
                tag.insert_text($key, v.clone());
            }
        };
    }

    write_str!(ItemKey::TrackTitle, &fields.title);
    write_str!(ItemKey::TrackArtist, &fields.artist);
    write_str!(ItemKey::AlbumTitle, &fields.album);
    write_str!(ItemKey::Genre, &fields.genre);
    write_str!(ItemKey::InitialKey, &fields.musical_key);
    write_str!(ItemKey::Comment, &fields.comment);

    if let Some(bpm) = fields.bpm {
        let bpm_str = format!("{:.0}", bpm);
        tag.insert_text(ItemKey::IntegerBpm, bpm_str.clone());
        tag.insert_text(ItemKey::Bpm, bpm_str);
    }

    if let Some(year) = fields.year {
        tag.insert_text(ItemKey::RecordingDate, year.to_string());
        tag.insert_text(ItemKey::Year, year.to_string());
    }

    // Write atomically: write to a temp path then rename over the original.
    let dir = path
        .parent()
        .ok_or_else(|| TagError::Io("path has no parent directory".to_string()))?;
    let tmp_path = dir.join(format!(
        ".{}.tmp",
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("audio_tags_write")
    ));

    {
        let mut tmp_file =
            std::fs::File::create(&tmp_path).map_err(|e| TagError::Io(e.to_string()))?;

        // Copy original content first, then save tags into the copy.
        let original = std::fs::read(path).map_err(|e| TagError::Io(e.to_string()))?;
        std::io::Write::write_all(&mut tmp_file, &original)
            .map_err(|e| TagError::Io(e.to_string()))?;
    }

    tagged
        .save_to_path(&tmp_path, WriteOptions::default())
        .map_err(|e| TagError::Io(e.to_string()))?;

    std::fs::rename(&tmp_path, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        TagError::Io(e.to_string())
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_bpm_valid() {
        assert_eq!(parse_bpm("128"), Some(128.0));
        assert_eq!(parse_bpm("128.5"), Some(128.5));
        assert_eq!(parse_bpm(" 95 "), Some(95.0));
    }

    #[test]
    fn parse_bpm_invalid() {
        assert_eq!(parse_bpm("0"), None);
        assert_eq!(parse_bpm("500"), None);
        assert_eq!(parse_bpm("abc"), None);
        assert_eq!(parse_bpm(""), None);
    }

    #[test]
    fn parse_year_full_date() {
        assert_eq!(parse_year("2019-04-12"), Some(2019));
        assert_eq!(parse_year("2023"), Some(2023));
        assert_eq!(parse_year("1800"), None);
        assert_eq!(parse_year("abc"), None);
    }
}
