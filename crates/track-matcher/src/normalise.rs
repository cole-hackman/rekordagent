//! String normalisation used by both library and input sides of the match.

use regex::Regex;
use std::sync::OnceLock;

fn feat_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)\s+(feat\.?|featuring|ft\.?)\s+[^()\[\]]*").unwrap())
}

fn suffix_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(
            r"(?i)\s*[\(\[][^\(\)\[\]]*?(original mix|extended mix|extended|radio edit|club mix|dub mix|instrumental|acapella|vip|bootleg|remix|edit|mix)[\)\]]\s*",
        )
        .unwrap()
    })
}

/// Aggressive normalisation: lowercase, strip feat./ft., strip mix-suffix
/// parentheticals, drop punctuation, collapse whitespace.
pub fn title_only(input: &str) -> String {
    let mut s = input.to_lowercase();
    s = feat_re().replace_all(&s, "").to_string();
    s = suffix_re().replace_all(&s, "").to_string();
    let cleaned: String = s
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c.is_whitespace() {
                c
            } else {
                ' '
            }
        })
        .collect();
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Normalised "artist + title" key for exact-match comparisons.
pub fn full(input: &str) -> String {
    title_only(input)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drops_feat_clause() {
        assert_eq!(title_only("Title feat. Some Artist"), "title");
    }

    #[test]
    fn strips_mix_suffix() {
        assert_eq!(title_only("Strobe (Original Mix)"), "strobe");
    }

    #[test]
    fn drops_punctuation_and_lowercases() {
        assert_eq!(title_only("HELLO, World!"), "hello world");
    }
}
