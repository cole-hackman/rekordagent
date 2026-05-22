//! Translate `StagedChange` records into SQL mutations on `master.db`.
//!
//! All column names that appear in dynamically-built SQL must come from a
//! private allowlist inside each submodule. All values are bound parameters.

use crate::{ChangeKind, StagedChange};
use rusqlite::Transaction;

mod cues;
mod playlists;
mod tracks;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ApplyResult {
    pub applied: Vec<String>,
    pub failed: Vec<(String, String)>,
}

#[derive(Debug, thiserror::Error)]
pub enum ApplyError {
    #[error("sql error: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("other: {0}")]
    Other(#[from] anyhow::Error),
}

pub fn apply(tx: &Transaction, changes: &[StagedChange]) -> Result<ApplyResult, ApplyError> {
    let mut applied = Vec::new();
    let mut failed = Vec::new();
    for change in changes {
        match apply_single(tx, change) {
            Ok(_) => applied.push(change.id.clone()),
            Err(e) => failed.push((change.id.clone(), e.to_string())),
        }
    }
    Ok(ApplyResult { applied, failed })
}

fn apply_single(tx: &Transaction, change: &StagedChange) -> anyhow::Result<()> {
    match change.kind {
        ChangeKind::TrackMetadataEdit => tracks::apply_metadata_edit(tx, change),
        ChangeKind::TrackDelete => tracks::apply_delete(tx, change),
        ChangeKind::TrackAddCue => cues::apply_add_cue(tx, change),
        ChangeKind::CueMetadataEdit => cues::apply_metadata_edit(tx, change),
        ChangeKind::PlaylistCreate => playlists::apply_create(tx, change),
        ChangeKind::PlaylistRename => playlists::apply_rename(tx, change),
        ChangeKind::PlaylistDelete => playlists::apply_delete(tx, change),
        ChangeKind::PlaylistAddTrack => playlists::apply_add_track(tx, change),
        ChangeKind::PlaylistRemoveTrack => playlists::apply_remove_track(tx, change),
        ChangeKind::PlaylistReorderTrack => playlists::apply_reorder(tx, change),
    }
}
