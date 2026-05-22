use crate::{FixProposal, TrackView};

const LOWERCASE_WORDS: &[&str] = &[
    "a", "an", "the", "and", "but", "or", "in", "on", "at", "to", "for", "of", "with",
];

pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let mut out = Vec::new();
    super::for_each_text_field(track, &["Title", "Artist", "Album"], |field, val| {
        let all_caps = val.chars().any(|c| c.is_alphabetic())
            && val.chars().filter(|c| c.is_alphabetic()).all(|c| c.is_uppercase());
        let all_lower = val.chars().any(|c| c.is_alphabetic())
            && val.chars().filter(|c| c.is_alphabetic()).all(|c| c.is_lowercase());
        if !all_caps && !all_lower {
            return;
        }
        let titled = title_case(val);
        if titled != val {
            out.push(FixProposal::new("fix_casing", track, field, val, &titled));
        }
    });
    out
}

fn title_case(input: &str) -> String {
    let words: Vec<&str> = input.split(' ').collect();
    let last_idx = words.len().saturating_sub(1);
    let mut out = String::with_capacity(input.len());
    for (i, w) in words.iter().enumerate() {
        if !out.is_empty() {
            out.push(' ');
        }
        let lower = w.to_lowercase();
        if i != 0 && i != last_idx && LOWERCASE_WORDS.contains(&lower.as_str()) {
            out.push_str(&lower);
        } else {
            out.push_str(&capitalize_first(&lower));
        }
    }
    out
}

fn capitalize_first(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().chain(c).collect(),
        None => String::new(),
    }
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
    fn all_caps_becomes_title_case() {
        let p = propose(&tv("HELLO WORLD"));
        assert_eq!(p.len(), 1);
        assert_eq!(p[0].new_value, "Hello World");
    }

    #[test]
    fn all_lower_with_small_word_uses_lowercase_word() {
        let p = propose(&tv("hold on to me"));
        assert_eq!(p.len(), 1);
        // first + last capitalised, "on" and "to" remain lowercase
        assert_eq!(p[0].new_value, "Hold on to Me");
    }

    #[test]
    fn mixed_case_is_left_alone() {
        let p = propose(&tv("Already Mixed Case"));
        assert!(p.is_empty());
    }
}
