//! Smart Fixes — pure metadata transformation proposals.
//!
//! Each fix takes a `TrackView` and returns zero or more `FixProposal`s.
//! Proposals are not staged; the Tauri layer turns kept proposals into
//! `TrackMetadataEdit` staged changes (status `Proposed`).
//!
//! Proposal IDs are deterministic: `hash(fix_name + track_id + field)`. This
//! lets a preview→apply round-trip work without persisting proposals — apply
//! re-runs `propose` and filters by the IDs the user kept.

use serde::Serialize;
use sha2::{Digest, Sha256};

pub mod fixes;

/// A minimal view of a track for proposal generation. The Tauri layer
/// constructs these from `RekordboxDb`.
#[derive(Debug, Clone)]
pub struct TrackView {
    pub id: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct FixProposal {
    pub id: String,
    pub track_id: String,
    pub track_title: String,
    pub field: String,
    pub old_value: String,
    pub new_value: String,
}

impl FixProposal {
    pub fn new(fix_name: &str, track: &TrackView, field: &str, old: &str, new: &str) -> Self {
        let id = proposal_id(fix_name, &track.id, field, old);
        Self {
            id,
            track_id: track.id.clone(),
            track_title: track.title.clone().unwrap_or_default(),
            field: field.to_string(),
            old_value: old.to_string(),
            new_value: new.to_string(),
        }
    }
}

fn proposal_id(fix_name: &str, track_id: &str, field: &str, old: &str) -> String {
    let mut h = Sha256::new();
    h.update(fix_name.as_bytes());
    h.update(b"|");
    h.update(track_id.as_bytes());
    h.update(b"|");
    h.update(field.as_bytes());
    h.update(b"|");
    h.update(old.as_bytes());
    hex::encode(&h.finalize()[..12])
}

#[derive(Debug, Default, Clone)]
pub struct FixConfig {
    /// Common-text blocklist (used by `remove_common_text`).
    pub common_text_patterns: Vec<String>,
    /// Junk separator characters (used by `replace_with_space`).
    pub junk_separators: Vec<char>,
}

impl FixConfig {
    pub fn with_defaults() -> Self {
        Self {
            common_text_patterns: vec![
                "(Official Audio)".into(),
                "(Official Video)".into(),
                "(Lyric Video)".into(),
                "(Music Video)".into(),
                "HD".into(),
                "HQ".into(),
                "4K".into(),
                "[Premiere]".into(),
                "Provided to YouTube by".into(),
            ],
            junk_separators: vec!['_', '/', '\\', '|'],
        }
    }
}

/// All available fix names.
pub const ALL_FIXES: &[&str] = &[
    "fix_casing",
    "replace_with_space",
    "fix_encoded_chars",
    "extract_artist",
    "extract_remixer",
    "remove_garbage",
    "remove_promo",
    "remove_number_prefix",
    "remove_urls",
    "add_mix_parens",
    "remove_common_text",
];

pub fn propose(
    fix_name: &str,
    track: &TrackView,
    config: &FixConfig,
) -> Vec<FixProposal> {
    match fix_name {
        "fix_casing" => fixes::casing::propose(track),
        "replace_with_space" => fixes::replace_with_space::propose(track, config),
        "fix_encoded_chars" => fixes::encoded_chars::propose(track),
        "extract_artist" => fixes::extract_artist::propose(track),
        "extract_remixer" => fixes::extract_remixer::propose(track),
        "remove_garbage" => fixes::remove_garbage::propose(track),
        "remove_promo" => fixes::remove_promo::propose(track),
        "remove_number_prefix" => fixes::remove_number_prefix::propose(track),
        "remove_urls" => fixes::remove_urls::propose(track),
        "add_mix_parens" => fixes::add_mix_parens::propose(track),
        "remove_common_text" => fixes::remove_common_text::propose(track, config),
        _ => Vec::new(),
    }
}
