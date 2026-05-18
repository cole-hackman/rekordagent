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

/// Heuristic duplicate detector. Groups tracks by a heavily-normalized signature
/// derived from title + primary artist: lowercased, punctuation stripped, common
/// parenthetical/bracket annotations removed (e.g. "(Original Mix)",
/// "(Extended Edit)"), feature markers collapsed, whitespace squeezed.
///
/// Catches typo-y duplicates that `duplicate_tracks` (which uses exact
/// normalized title+artist) misses, at the cost of occasional false positives —
/// callers should treat results as "candidates", not authoritative.
pub fn fuzzy_duplicate_tracks(tracks: Vec<Track>) -> Vec<DuplicateGroup> {
    let mut groups: BTreeMap<(String, String), Vec<Track>> = BTreeMap::new();
    for track in tracks {
        let title_key = fuzzy_signature(&track.title);
        let artist_key = fuzzy_artist(track.artist.as_deref().unwrap_or(""));
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

fn fuzzy_signature(value: &str) -> String {
    let lower = value.to_lowercase();
    // Drop bracketed/parenthetical annotations like "(Original Mix)" or "[Remix]".
    let mut out = String::with_capacity(lower.len());
    let mut depth = 0i32;
    for c in lower.chars() {
        match c {
            '(' | '[' | '{' => depth += 1,
            ')' | ']' | '}' if depth > 0 => depth -= 1,
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    // Drop "feat." / "ft." remainders so collabs collapse.
    for marker in [" feat. ", " feat ", " ft. ", " ft "] {
        if let Some(idx) = out.find(marker) {
            out.truncate(idx);
        }
    }
    // Keep only alphanumerics + spaces.
    let stripped: String = out
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect();
    stripped.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn fuzzy_artist(value: &str) -> String {
    // Take the first artist in collaboration lists, then run the signature
    // normalizer on it.
    let primary = value
        .split([',', '&', ';'])
        .next()
        .unwrap_or(value)
        .split(" vs ")
        .next()
        .unwrap_or(value)
        .split(" x ")
        .next()
        .unwrap_or(value);
    fuzzy_signature(primary)
}

pub fn audio_fingerprint_duplicates(
    tracks: Vec<Track>,
    fingerprints: &std::collections::HashMap<String, Vec<u8>>,
) -> Result<Vec<DuplicateGroup>, anyhow::Error> {
    let mut groups = Vec::new();
    let threshold = (128.0 * 0.05) as usize; // 95% similarity

    // Filter to tracks we actually have fingerprints for
    let fps: Vec<(Track, &Vec<u8>)> = tracks
        .into_iter()
        .filter_map(|t| {
            t.folder_path
                .as_deref()
                .and_then(|path| fingerprints.get(path))
                .map(|fp| (t, fp))
        })
        .collect();

    let mut used = vec![false; fps.len()];

    for i in 0..fps.len() {
        if used[i] {
            continue;
        }

        let mut group = vec![fps[i].0.clone()];
        used[i] = true;

        for j in (i + 1)..fps.len() {
            if used[j] {
                continue;
            }

            let dist = hamming_distance(fps[i].1, fps[j].1);
            if dist <= threshold {
                group.push(fps[j].0.clone());
                used[j] = true;
            }
        }

        if group.len() > 1 {
            groups.push(DuplicateGroup {
                title: format!("{} (Audio Match)", group[0].title),
                artist: group[0].artist.clone(),
                tracks: group,
            });
        }
    }

    Ok(groups)
}

fn hamming_distance(a: &[u8], b: &[u8]) -> usize {
    a.iter().zip(b.iter()).filter(|(x, y)| x != y).count()
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
    fn fuzzy_duplicates_collapses_remix_and_feature_markers() {
        let groups = fuzzy_duplicate_tracks(vec![
            track("1", "Test Track (Original Mix)", Some("Artist")),
            track(
                "2",
                "test track [Extended Edit]",
                Some("Artist feat. Guest"),
            ),
            track("3", "Different Song", Some("Artist")),
        ]);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].tracks.len(), 2);
    }

    #[test]
    fn fuzzy_duplicates_primary_artist_for_collabs() {
        let groups = fuzzy_duplicate_tracks(vec![
            track("1", "Anthem", Some("A & B")),
            track("2", "Anthem", Some("A, C")),
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
