//! Facade crate — re-exports and high-level workflows across all decks crates.

pub use cache;
pub use changes;
pub use classify;
pub use rekordbox_db;
pub use rekordbox_xml;
pub use scoring;

#[cfg(test)]
mod tests {
    #[test]
    fn placeholder() {}
}
