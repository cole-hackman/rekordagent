use crate::{FixProposal, TrackView};

/// Target: Artist empty AND Title contains exactly one ` - ` (or `:`),
/// AND the left part is plausibly an artist (not e.g. "01" or "Vol. 5").
pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    if track.artist.as_deref().is_some_and(|a| !a.trim().is_empty()) {
        return Vec::new();
    }
    let title = match track.title.as_deref() {
        Some(t) if !t.is_empty() => t,
        _ => return Vec::new(),
    };

    let sep = if title.matches(" - ").count() == 1 {
        " - "
    } else if title.matches(": ").count() == 1 {
        ": "
    } else {
        return Vec::new();
    };

    let (left, right) = match title.split_once(sep) {
        Some(pair) => pair,
        None => return Vec::new(),
    };
    let left = left.trim();
    let right = right.trim();
    if left.is_empty() || right.is_empty() {
        return Vec::new();
    }
    if left.chars().all(|c| c.is_ascii_digit()) {
        return Vec::new();
    }

    vec![
        FixProposal::new("extract_artist", track, "Artist", "", left),
        FixProposal::new("extract_artist", track, "Title", title, right),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tv(title: &str, artist: Option<&str>) -> TrackView {
        TrackView {
            id: "t".into(),
            title: Some(title.into()),
            artist: artist.map(str::to_string),
            album: None,
            comment: None,
        }
    }

    #[test]
    fn splits_when_artist_empty() {
        let p = propose(&tv("Artist - Title", None));
        assert_eq!(p.len(), 2);
        assert_eq!(p[0].new_value, "Artist");
        assert_eq!(p[1].new_value, "Title");
    }

    #[test]
    fn skipped_when_artist_set() {
        let p = propose(&tv("Artist - Title", Some("X")));
        assert!(p.is_empty());
    }

    #[test]
    fn skipped_on_multiple_separators() {
        let p = propose(&tv("Tom - Dick - Harry", None));
        assert!(p.is_empty());
    }

    #[test]
    fn skipped_when_left_is_digits_only() {
        let p = propose(&tv("01 - Track", None));
        assert!(p.is_empty());
    }
}
