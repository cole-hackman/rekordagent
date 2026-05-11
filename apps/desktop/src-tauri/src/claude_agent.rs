use std::process::Stdio;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

const DJ_SYSTEM_PROMPT: &str = "You are a DJ assistant. \
You help the user explore and understand their Rekordbox music library. \
Answer questions about tracks, BPM, keys, genres, and playlists concisely. \
Do not use any coding tools — just have a helpful conversation.";

/// Payload emitted to the frontend for each streamed chunk.
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeChunk {
    /// Incremental text from the assistant (may be empty for the final event).
    pub text: String,
    /// Set on the final done=true event with the session ID for continuity.
    pub session_id: Option<String>,
    /// True when the response is fully complete.
    pub done: bool,
    /// Set on the done event if an error occurred.
    pub error: Option<String>,
}

/// Spawn `claude --print --output-format stream-json` and forward text chunks
/// to the frontend via a per-request Tauri event.
///
/// Returns the new session_id (empty string if unavailable).
pub async fn chat(
    app: tauri::AppHandle,
    message: String,
    session_id: Option<String>,
    event_name: String,
) -> Result<String, String> {
    // Minimal settings override: disable all hooks so hook feedback never
    // leaks into our parsed output.
    let settings_override = r#"{"hooks":{}}"#;

    let mut args: Vec<String> = vec![
        "--print".into(),
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--settings".into(),
        settings_override.into(),
        // Prevent claude from running its default coding tools.
        "--disallowedTools".into(),
        "Bash,Edit,Write,Read,NotebookEdit,WebFetch,WebSearch".into(),
    ];

    if let Some(ref sid) = session_id {
        args.push("--resume".into());
        args.push(sid.clone());
    } else {
        // First message: inject the DJ system prompt.
        args.push("--system-prompt".into());
        args.push(DJ_SYSTEM_PROMPT.into());
    }

    args.push(message);

    let mut child = Command::new("claude")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start claude CLI: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut lines = BufReader::new(stdout).lines();

    let mut new_session_id = String::new();

    while let Some(line) = lines.next_line().await.map_err(|e| e.to_string())? {
        if line.trim().is_empty() {
            continue;
        }

        let Ok(obj) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };

        match obj["type"].as_str() {
            // Stop parsing as soon as stop-hooks start firing; anything
            // after this point is hook-generated, not Claude's answer.
            Some("system") if obj["subtype"].as_str() == Some("hook_started") => break,

            Some("assistant") => {
                if let Some(blocks) = obj["message"]["content"].as_array() {
                    for block in blocks {
                        if block["type"].as_str() == Some("text") {
                            let text = block["text"].as_str().unwrap_or("").to_string();
                            if !text.is_empty() {
                                let _ = app.emit(
                                    &event_name,
                                    ClaudeChunk {
                                        text,
                                        session_id: None,
                                        done: false,
                                        error: None,
                                    },
                                );
                            }
                        }
                    }
                }
            }

            Some("result") => {
                if let Some(sid) = obj["session_id"].as_str() {
                    new_session_id = sid.to_string();
                }
                // Emit the final "done" event.
                let _ = app.emit(
                    &event_name,
                    ClaudeChunk {
                        text: String::new(),
                        session_id: Some(new_session_id.clone()),
                        done: true,
                        error: None,
                    },
                );
                break;
            }

            _ => {}
        }
    }

    // Reap the child process.
    let _ = child.wait().await;

    Ok(new_session_id)
}
