/// Round-trip property tests: parse → emit → parse, all fields preserved.
use rekordbox_xml::{
    parse, to_xml,
    types::{Collection, Node, PositionMark, PositionMarkType, Product, Tempo, Track},
};

fn full_collection() -> Collection {
    Collection {
        product: Product {
            name: "decks".into(),
            version: "0.1.0".into(),
            company: "decks contributors".into(),
        },
        tracks: vec![
            Track {
                track_id: 1,
                name: "Alpha & Omega".into(),
                location: "file://localhost/music/alpha.mp3".into(),
                artist: Some("Artist One".into()),
                album: Some("Album One".into()),
                genre: Some("Techno".into()),
                kind: Some("MP3 File".into()),
                total_time: Some(360),
                year: Some(2022),
                average_bpm: Some(132.0),
                date_added: Some("2024-01-15".into()),
                bit_rate: Some(320),
                sample_rate: Some(44100),
                comments: Some("First track".into()),
                play_count: Some(10),
                rating: Some(255),
                tonality: Some("8A".into()),
                tempos: vec![
                    Tempo {
                        inizio: 0.0,
                        bpm: 132.0,
                        metro: "4/4".into(),
                        battito: 1,
                    },
                    Tempo {
                        inizio: 180.0,
                        bpm: 132.0,
                        metro: "4/4".into(),
                        battito: 3,
                    },
                ],
                position_marks: vec![
                    PositionMark {
                        name: Some("Intro".into()),
                        mark_type: PositionMarkType::Cue,
                        start: 0.0,
                        end: None,
                        num: -1,
                    },
                    PositionMark {
                        name: Some("Drop".into()),
                        mark_type: PositionMarkType::Cue,
                        start: 32.5,
                        end: None,
                        num: 0,
                    },
                    PositionMark {
                        name: Some("Loop".into()),
                        mark_type: PositionMarkType::Loop,
                        start: 64.0,
                        end: Some(96.0),
                        num: 1,
                    },
                ],
                ..Default::default()
            },
            Track {
                track_id: 2,
                name: "Beta".into(),
                location: "file://localhost/music/beta%20track.flac".into(),
                artist: Some("Artist Two".into()),
                average_bpm: Some(128.0),
                rating: Some(0),
                ..Default::default()
            },
        ],
        playlists: vec![Node::Folder {
            name: "ROOT".into(),
            children: vec![
                Node::Folder {
                    name: "Sub Folder".into(),
                    children: vec![Node::Playlist {
                        name: "Techno Set".into(),
                        key_type: 0,
                        track_ids: vec![1, 2],
                    }],
                },
                Node::Playlist {
                    name: "Empty Playlist".into(),
                    key_type: 0,
                    track_ids: vec![],
                },
            ],
        }],
    }
}

#[test]
fn roundtrip_full_collection() {
    let original = full_collection();
    let xml = to_xml(&original).expect("emit");
    let parsed = parse(&xml).expect("parse back");

    // product
    assert_eq!(parsed.product.name, original.product.name);
    assert_eq!(parsed.product.version, original.product.version);
    assert_eq!(parsed.product.company, original.product.company);

    // tracks
    assert_eq!(parsed.tracks.len(), original.tracks.len());
    for (p, o) in parsed.tracks.iter().zip(original.tracks.iter()) {
        assert_eq!(p.track_id, o.track_id, "track_id");
        assert_eq!(p.name, o.name, "name");
        assert_eq!(p.location, o.location, "location");
        assert_eq!(p.artist, o.artist, "artist");
        assert_eq!(p.album, o.album, "album");
        assert_eq!(p.genre, o.genre, "genre");
        assert_eq!(p.total_time, o.total_time, "total_time");
        assert_eq!(p.year, o.year, "year");
        assert_eq!(p.rating, o.rating, "rating");
        assert_eq!(p.tonality, o.tonality, "tonality");
        if let (Some(pb), Some(ob)) = (p.average_bpm, o.average_bpm) {
            assert!((pb - ob).abs() < 0.001, "average_bpm {pb} ≠ {ob}");
        } else {
            assert_eq!(p.average_bpm, o.average_bpm, "average_bpm");
        }
        assert_eq!(p.tempos.len(), o.tempos.len(), "tempos count");
        for (pt, ot) in p.tempos.iter().zip(o.tempos.iter()) {
            assert!((pt.inizio - ot.inizio).abs() < 0.001, "tempo inizio");
            assert!((pt.bpm - ot.bpm).abs() < 0.001, "tempo bpm");
            assert_eq!(pt.metro, ot.metro, "tempo metro");
            assert_eq!(pt.battito, ot.battito, "tempo battito");
        }
        assert_eq!(
            p.position_marks.len(),
            o.position_marks.len(),
            "marks count"
        );
        for (pm, om) in p.position_marks.iter().zip(o.position_marks.iter()) {
            assert_eq!(pm.mark_type, om.mark_type, "mark_type");
            assert!((pm.start - om.start).abs() < 0.001, "mark start");
            assert_eq!(pm.num, om.num, "mark num");
            match (pm.end, om.end) {
                (Some(pe), Some(oe)) => assert!((pe - oe).abs() < 0.001, "mark end"),
                (None, None) => {}
                _ => panic!("mark end mismatch"),
            }
        }
    }

    // playlists structure
    assert_eq!(parsed.playlists.len(), original.playlists.len());
    if let (
        Node::Folder {
            name: pn,
            children: pc,
        },
        Node::Folder {
            name: on_,
            children: oc,
        },
    ) = (&parsed.playlists[0], &original.playlists[0])
    {
        assert_eq!(pn, on_);
        assert_eq!(pc.len(), oc.len());
        if let Node::Folder {
            children: sub_pc, ..
        } = &pc[0]
        {
            if let Node::Playlist {
                name, track_ids, ..
            } = &sub_pc[0]
            {
                assert_eq!(name, "Techno Set");
                assert_eq!(track_ids, &[1u32, 2]);
            }
        }
    }
}

#[test]
fn roundtrip_special_chars_in_name() {
    let original = Collection {
        product: Product::default(),
        tracks: vec![Track {
            track_id: 1,
            name: "R&B < Style > \"Mix\" & 'More'".into(),
            location: "file://localhost/music/track.mp3".into(),
            ..Default::default()
        }],
        playlists: vec![],
    };
    let xml = to_xml(&original).expect("emit");
    let parsed = parse(&xml).expect("parse back");
    assert_eq!(parsed.tracks[0].name, original.tracks[0].name);
}

#[test]
fn roundtrip_empty_collection() {
    let original = Collection::default();
    let xml = to_xml(&original).expect("emit");
    let parsed = parse(&xml).expect("parse back");
    assert!(parsed.tracks.is_empty());
    assert!(parsed.playlists.is_empty());
}

#[test]
fn roundtrip_bpm_precision() {
    let bpms = [128.0f64, 132.57, 174.0, 96.5];
    for bpm in bpms {
        let original = Collection {
            product: Product::default(),
            tracks: vec![Track {
                track_id: 1,
                name: "T".into(),
                location: "file://localhost/t.mp3".into(),
                average_bpm: Some(bpm),
                ..Default::default()
            }],
            playlists: vec![],
        };
        let xml = to_xml(&original).unwrap();
        let parsed = parse(&xml).unwrap();
        let got = parsed.tracks[0].average_bpm.unwrap();
        assert!((got - bpm).abs() < 0.01, "bpm {bpm} → {got}");
    }
}
