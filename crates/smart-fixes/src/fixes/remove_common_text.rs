use crate::{FixConfig, FixProposal, TrackView};

pub fn propose(track: &TrackView, config: &FixConfig) -> Vec<FixProposal> {
    if config.common_text_patterns.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    super::for_each_text_field(
        track,
        &["Title", "Artist", "Album", "Commnt"],
        |field, val| {
            let mut new = val.to_string();
            let mut lowered = new.to_lowercase();
            for pat in &config.common_text_patterns {
                let lp = pat.to_lowercase();
                while let Some(idx) = lowered.find(&lp) {
                    new.replace_range(idx..idx + pat.len(), "");
                    lowered = new.to_lowercase();
                }
            }
            while new.contains("  ") {
                new = new.replace("  ", " ");
            }
            let trimmed = new.trim().to_string();
            if trimmed != val && !trimmed.is_empty() {
                out.push(FixProposal::new(
                    "remove_common_text",
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
    fn strips_official_audio_tag() {
        let p = propose(&tv("Song (Official Audio)"), &FixConfig::with_defaults());
        assert_eq!(p[0].new_value, "Song");
    }

    #[test]
    fn case_insensitive() {
        let p = propose(&tv("Song hd"), &FixConfig::with_defaults());
        assert_eq!(p[0].new_value, "Song");
    }
}
