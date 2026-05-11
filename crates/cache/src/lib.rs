//! Local SQLite WAL cache — schema-versioned, with sqlite-vec extension support.
//!
//! All derived data (audio features, embeddings, staged changes, conversation
//! history) lives here, never in the Rekordbox `master.db`.

mod migrations;
pub mod store;

pub use store::{CacheDb, Conversation, ConversationMessage, ConversationWithMessages};
