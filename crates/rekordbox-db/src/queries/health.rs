use crate::types::{BrokenMetadataReport, DuplicateGroup, Track};
use anyhow::Result;
use std::collections::BTreeMap;

pub fn duplicate_tracks(tracks: Vec<Track>) -> Vec<DuplicateGroup> {
    let mut groups: BTreeMap<(String, String), Vec<Track>> = BTreeMap::new();
    for track in tracks {
        let title_key = normalize(&track.title);
        let artist_key = normalize(track.artist.as_deref().unwrap_or(""));
        if title_key.is_empty() {
            continue;
        }
        groups
            .entry((title_key, artist_key))
            .or_default()
            .push(track);
    }

    groups
        .into_values()
        .filter(|tracks| tracks.len() > 1)
        .map(|tracks| DuplicateGroup {
            title: tracks[0].title.clone(),
            artist: tracks[0].artist.clone(),
            tracks,
        })
        .collect()
}

pub fn broken_metadata_report(tracks: Vec<Track>) -> Result<BrokenMetadataReport> {
    let mut report = BrokenMetadataReport::default();

    for track in tracks {
        if is_blank(track.artist.as_deref()) {
            report.missing_artist.push(track.clone());
        }
        if track.bpm.is_none() || track.bpm == Some(0.0) {
            report.missing_bpm.push(track.clone());
        }
        if is_blank(track.musical_key.as_deref()) {
            report.missing_key.push(track.clone());
        }
        if is_blank(track.genre.as_deref()) {
            report.missing_genre.push(track.clone());
        }
        if looks_suspicious(&track) {
            report.suspicious.push(track);
        }
    }

    Ok(report)
}

fn normalize(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_blank(value: Option<&str>) -> bool {
    value.map(|v| v.trim().is_empty()).unwrap_or(true)
}

fn looks_suspicious(track: &Track) -> bool {
    let title = track.title.trim().to_lowercase();
    title.is_empty()
        || matches!(
            title.as_str(),
            "unknown" | "untitled" | "track" | "audio track" | "new track"
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str, title: &str, artist: Option<&str>) -> Track {
        Track {
            id: id.to_owned(),
            title: title.to_owned(),
            artist: artist.map(str::to_owned),
            album: None,
            genre: Some("Techno".to_owned()),
            musical_key: Some("8A".to_owned()),
            bpm: Some(128.0),
            duration_secs: Some(300),
            rating: None,
            comment: None,
            folder_path: None,
            analysis_data_path: None,
            file_type: None,
            sample_rate: None,
            bit_rate: None,
            release_year: None,
            dj_play_count: None,
        }
    }

    #[test]
    fn duplicates_use_normalized_title_and_artist() {
        let groups = duplicate_tracks(vec![
            track("1", " Test  Track ", Some("Artist")),
            track("2", "test track", Some("artist")),
            track("3", "Other", Some("artist")),
        ]);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].tracks.len(), 2);
    }

    #[test]
    fn broken_report_finds_missing_values() {
        let mut broken = track("1", "Untitled", None);
        broken.genre = None;
        broken.musical_key = None;
        broken.bpm = None;
        let report = broken_metadata_report(vec![broken]).unwrap();
        assert_eq!(report.missing_artist.len(), 1);
        assert_eq!(report.missing_genre.len(), 1);
        assert_eq!(report.missing_key.len(), 1);
        assert_eq!(report.missing_bpm.len(), 1);
        assert_eq!(report.suspicious.len(), 1);
    }
}
