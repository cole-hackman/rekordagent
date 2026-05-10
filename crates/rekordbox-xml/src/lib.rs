//! Rekordbox XML import format — parse and emit.
//!
//! Vendored and adapted from reklawdbox `src/xml.rs` (MIT, Ryan Voitiskis).
//!
//! # Quick start
//!
//! ```
//! use rekordbox_xml::{parse, to_xml};
//!
//! let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
//! <DJ_PLAYLISTS Version="1.0.0">
//!   <PRODUCT Name="rekordbox" Version="7.0" Company="Pioneer DJ"/>
//!   <COLLECTION Entries="0"/>
//!   <PLAYLISTS/>
//! </DJ_PLAYLISTS>"#;
//!
//! let collection = parse(xml).unwrap();
//! let out = to_xml(&collection).unwrap();
//! assert!(out.contains("DJ_PLAYLISTS"));
//! ```

mod emit;
mod parse;
pub mod types;
pub mod uri;

pub use emit::to_xml;
pub use parse::parse;
pub use types::{Collection, Node, PositionMark, PositionMarkType, Product, Tempo, Track};
