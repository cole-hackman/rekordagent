use track_matcher::csv_input::parse_csv;
use track_matcher::{match_all, MatchCandidate, MatchStatus};

#[test]
fn parse_headers_handles_quoted_commas() {
    let input = "\"Last, First\",artist\nDoe Jane,Foo\n";
    let h = track_matcher::csv_input::parse_headers(input).unwrap();
    assert_eq!(h, vec!["Last, First".to_string(), "artist".to_string()]);
}

#[test]
fn parses_simple_two_column_csv() {
    let input = "title,artist\nStrobe,Deadmau5\nGhosts 'n' Stuff,Deadmau5\n";
    let candidates = parse_csv(input, "title", Some("artist")).unwrap();
    assert_eq!(candidates.len(), 2);
    assert_eq!(candidates[0].title, "Strobe");
    assert_eq!(candidates[0].artist.as_deref(), Some("Deadmau5"));
}

#[test]
fn parses_csv_with_extra_columns_ignored() {
    let input = "title,bpm,artist\nStrobe,128,Deadmau5\n";
    let candidates = parse_csv(input, "title", Some("artist")).unwrap();
    assert_eq!(candidates[0].title, "Strobe");
    assert_eq!(candidates[0].artist.as_deref(), Some("Deadmau5"));
}

#[test]
fn parses_csv_with_missing_title_column_errors() {
    let input = "name,artist\nFoo,Bar\n";
    assert!(parse_csv(input, "title", Some("artist")).is_err());
}

#[test]
fn skips_rows_with_empty_title() {
    let input = "title,artist\n,Foo\nReal,Bar\n";
    let c = parse_csv(input, "title", Some("artist")).unwrap();
    assert_eq!(c.len(), 1);
    assert_eq!(c[0].title, "Real");
}

#[test]
fn artist_column_omitted_yields_none() {
    let input = "title\nStrobe\n";
    let c = parse_csv(input, "title", None).unwrap();
    assert_eq!(c.len(), 1);
    assert!(c[0].artist.is_none());
}

#[test]
fn csv_then_match_full_pipeline() {
    let csv = "title,artist\nStrobe,Deadmau5\nCompletely Different Banger,Nobody\n";
    let inputs = parse_csv(csv, "title", Some("artist")).unwrap();

    let library = vec![
        MatchCandidate {
            id: "1".into(),
            title: "Strobe".into(),
            artist: Some("Deadmau5".into()),
        },
        MatchCandidate {
            id: "2".into(),
            title: "Opus".into(),
            artist: Some("Eric Prydz".into()),
        },
    ];

    let results = match_all(&library, &inputs);
    assert_eq!(results.len(), 2);
    // First row should match exactly to id=1.
    assert_eq!(results[0].status, MatchStatus::Exact);
    assert_eq!(results[0].track.as_ref().unwrap().id, "1");
    // Second row has nothing similar in the library.
    assert_eq!(results[1].status, MatchStatus::Unmatched);
    assert!(results[1].track.is_none());
}
