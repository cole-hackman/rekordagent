use crate::{FixProposal, TrackView};
use regex::Regex;
use std::sync::OnceLock;

fn pattern() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^\d{1,3}[\s.\-_)]+").unwrap())
}

pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let title = match track.title.as_deref() {
        Some(t) if !t.is_empty() => t,
        _ => return Vec::new(),
    };
    let re = pattern();
    if let Some(m) = re.find(title) {
        let stripped = title[m.end()..].trim().to_string();
        if !stripped.is_empty() && stripped != title {
            return vec![FixProposal::new(
                "remove_number_prefix",
                track,
                "Title",
                title,
                &stripped,
            )];
        }
    }
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tv(t: &str) -> TrackView {
        TrackView {
            id: "t".into(),
            title: Some(t.into()),
            artist: None,
            album: None,
            comment: None,
        }
    }

    #[test]
    fn dot_separator() {
        assert_eq!(propose(&tv("01. Song"))[0].new_value, "Song");
    }

    #[test]
    fn dash_separator() {
        assert_eq!(propose(&tv("1 - Song"))[0].new_value, "Song");
    }

    #[test]
    fn untouched_no_prefix() {
        assert!(propose(&tv("Song")).is_empty());
    }
}
