use crate::{FixConfig, FixProposal, TrackView};

pub fn propose(track: &TrackView, config: &FixConfig) -> Vec<FixProposal> {
    let mut out = Vec::new();
    let seps: &[char] = if config.junk_separators.is_empty() {
        &['_', '/', '\\', '|']
    } else {
        &config.junk_separators
    };
    super::for_each_text_field(
        track,
        &["Title", "Artist", "Album", "Commnt"],
        |field, val| {
            if !val.chars().any(|c| seps.contains(&c)) {
                return;
            }
            let mut s: String = val
                .chars()
                .map(|c| if seps.contains(&c) { ' ' } else { c })
                .collect();
            // collapse runs of whitespace
            while s.contains("  ") {
                s = s.replace("  ", " ");
            }
            let trimmed = s.trim().to_string();
            if trimmed != val {
                out.push(FixProposal::new(
                    "replace_with_space",
                    track,
                    field,
                    val,
                    &trimmed,
                ));
            }
        },
    );
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tv(title: &str) -> TrackView {
        TrackView {
            id: "t".into(),
            title: Some(title.into()),
            artist: None,
            album: None,
            comment: None,
        }
    }

    #[test]
    fn replaces_and_collapses() {
        let p = propose(&tv("Some_Track__Name"), &FixConfig::with_defaults());
        assert_eq!(p[0].new_value, "Some Track Name");
    }

    #[test]
    fn unchanged_when_clean() {
        let p = propose(&tv("Already Clean"), &FixConfig::with_defaults());
        assert!(p.is_empty());
    }
}
