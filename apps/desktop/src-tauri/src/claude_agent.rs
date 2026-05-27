//! Spawn the local `claude` CLI as a subprocess and stream its output back
//! to the frontend via per-request Tauri events.
//!
//! Frontend expects events named `claude-stream:{event_id}` with payload:
//! ```ignore
//! { kind: "tool_call" | "text" | "done" | "error",
//!   text?: string, tool_name?: string }
//! ```

use std::path::PathBuf;
use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    ToolCall,
    Text,
    Done,
    Error,
}

#[derive(Serialize, Clone, Debug)]
pub struct StreamEvent {
    pub kind: EventKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
}

impl StreamEvent {
    fn text(t: impl Into<String>) -> Self {
        Self {
            kind: EventKind::Text,
            text: Some(t.into()),
            tool_name: None,
        }
    }
    fn tool_call(name: impl Into<String>) -> Self {
        Self {
            kind: EventKind::ToolCall,
            text: None,
            tool_name: Some(name.into()),
        }
    }
    fn done() -> Self {
        Self {
            kind: EventKind::Done,
            text: None,
            tool_name: None,
        }
    }
    fn error(msg: impl Into<String>) -> Self {
        Self {
            kind: EventKind::Error,
            text: Some(msg.into()),
            tool_name: None,
        }
    }
}

/// Pure parser for one line of the `claude --output-format stream-json` output.
/// Returns `None` for empty lines, malformed JSON, or event types we don't care
/// about. Returns `Some(Done)` when the stream should terminate.
pub fn parse_stream_line(line: &str) -> Option<StreamEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let obj: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    match obj.get("type")?.as_str()? {
        "assistant" => {
            let blocks = obj.get("message")?.get("content")?.as_array()?;
            for block in blocks {
                match block.get("type").and_then(|v| v.as_str()) {
                    Some("text") => {
                        let text = block.get("text").and_then(|v| v.as_str()).unwrap_or("");
                        if !text.is_empty() {
                            return Some(StreamEvent::text(text));
                        }
                    }
                    Some("tool_use") => {
                        let name = block
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("(tool)");
                        return Some(StreamEvent::tool_call(name));
                    }
                    _ => {}
                }
            }
            None
        }
        "result" => Some(StreamEvent::done()),
        _ => None,
    }
}

/// Locate the `claude` binary. Mirrors `find_claude_binary` in lib.rs.
fn find_claude_binary() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("claude"),
        PathBuf::from("/opt/homebrew/bin/claude"),
        PathBuf::from("/usr/local/bin/claude"),
    ];
    candidates.into_iter().find(|c| {
        std::process::Command::new(c)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    })
}

/// Locate the bundled `decks` CLI used as the rekordagent MCP server.
///
/// Resolution order:
/// 1. `REKORDAGENT_MCP_BIN` env override (absolute path)
/// 2. Sibling of the running executable (production bundle layout)
/// 3. `target/debug/decks` and `target/release/decks` relative to cwd (dev)
fn find_decks_binary() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("REKORDAGENT_MCP_BIN") {
        let path = PathBuf::from(p);
        if path.is_file() {
            return Some(path);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let sibling = dir.join("decks");
            if sibling.is_file() {
                return Some(sibling);
            }
        }
    }
    for rel in ["target/debug/decks", "target/release/decks"] {
        let path = PathBuf::from(rel);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

fn emit(app: &AppHandle, event_name: &str, ev: StreamEvent) {
    let _ = app.emit(event_name, ev);
}

/// Spawn `claude -p` and stream its output back via `claude-stream:{event_id}`.
pub async fn run(
    app: AppHandle,
    event_id: String,
    history: String,
    message: String,
    system: String,
) -> Result<(), String> {
    let event_name = format!("claude-stream:{event_id}");

    let Some(binary) = find_claude_binary() else {
        emit(
            &app,
            &event_name,
            StreamEvent::error("Claude CLI not found on PATH"),
        );
        emit(&app, &event_name, StreamEvent::done());
        return Ok(());
    };

    let prompt = if history.is_empty() {
        message
    } else {
        format!("{history}\n\nHuman: {message}")
    };

    let mut args: Vec<String> = vec![
        "--print".into(),
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--settings".into(),
        r#"{"hooks":{}}"#.into(),
        // Prevent claude from running coding tools — this is a chat surface.
        "--disallowedTools".into(),
        "Bash,Edit,Write,Read,NotebookEdit,WebFetch,WebSearch".into(),
        "--system-prompt".into(),
        system,
    ];

    // Auto-wire the rekordagent MCP server so library tools are available
    // without the user having to `claude mcp add` it themselves. Bypass
    // permissions because (a) the spawn is fully local and (b) `--print`
    // mode cannot prompt interactively.
    if let Some(decks_bin) = find_decks_binary() {
        let mcp_config = serde_json::json!({
            "mcpServers": {
                "rekordagent": {
                    "command": decks_bin.to_string_lossy(),
                    "args": ["mcp"],
                }
            }
        })
        .to_string();
        args.extend([
            "--mcp-config".into(),
            mcp_config,
            "--permission-mode".into(),
            "bypassPermissions".into(),
        ]);
    } else {
        emit(
            &app,
            &event_name,
            StreamEvent::error(
                "rekordagent MCP binary (decks) not found — library tools unavailable. \
                 Set REKORDAGENT_MCP_BIN or build with `cargo build -p decks-cli`.",
            ),
        );
    }

    let mut child = match Command::new(&binary)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            emit(
                &app,
                &event_name,
                StreamEvent::error(format!("Failed to spawn claude: {e}")),
            );
            emit(&app, &event_name, StreamEvent::done());
            return Ok(());
        }
    };

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(prompt.as_bytes()).await;
        let _ = stdin.shutdown().await;
        drop(stdin);
    }

    // Drain stderr concurrently so the pipe never fills (which would block
    // the child), and surface its contents for debugging.
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[claude stderr] {line}");
            }
        });
    }

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            emit(
                &app,
                &event_name,
                StreamEvent::error("no stdout from claude"),
            );
            emit(&app, &event_name, StreamEvent::done());
            let _ = child.wait().await;
            return Ok(());
        }
    };

    let mut lines = BufReader::new(stdout).lines();
    let mut got_done = false;
    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(ev) = parse_stream_line(&line) {
            if matches!(ev.kind, EventKind::Done) {
                emit(&app, &event_name, ev);
                got_done = true;
                break;
            }
            emit(&app, &event_name, ev);
        }
    }

    let status = child.wait().await;
    match status {
        Ok(s) if s.success() => {
            if !got_done {
                emit(&app, &event_name, StreamEvent::done());
            }
        }
        Ok(s) => {
            emit(
                &app,
                &event_name,
                StreamEvent::error(format!("claude exited with status {s}")),
            );
            if !got_done {
                emit(&app, &event_name, StreamEvent::done());
            }
        }
        Err(e) => {
            emit(
                &app,
                &event_name,
                StreamEvent::error(format!("claude wait failed: {e}")),
            );
            if !got_done {
                emit(&app, &event_name, StreamEvent::done());
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_empty_line() {
        assert!(parse_stream_line("").is_none());
        assert!(parse_stream_line("   ").is_none());
    }

    #[test]
    fn parse_malformed_json() {
        assert!(parse_stream_line("not json {").is_none());
    }

    #[test]
    fn parse_assistant_text() {
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]}}"#;
        let ev = parse_stream_line(line).expect("event");
        assert!(matches!(ev.kind, EventKind::Text));
        assert_eq!(ev.text.as_deref(), Some("hello"));
    }

    #[test]
    fn parse_assistant_text_empty_skipped() {
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":""}]}}"#;
        assert!(parse_stream_line(line).is_none());
    }

    #[test]
    fn parse_assistant_tool_use() {
        let line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"library__search","input":{}}]}}"#;
        let ev = parse_stream_line(line).expect("event");
        assert!(matches!(ev.kind, EventKind::ToolCall));
        assert_eq!(ev.tool_name.as_deref(), Some("library__search"));
    }

    #[test]
    fn parse_result_emits_done() {
        let line = r#"{"type":"result","subtype":"success"}"#;
        let ev = parse_stream_line(line).expect("event");
        assert!(matches!(ev.kind, EventKind::Done));
    }

    #[test]
    fn parse_hook_started_is_ignored() {
        // SessionStart hooks always fire first in the stream; they must NOT
        // terminate the read loop. Only `type:"result"` does.
        let line = r#"{"type":"system","subtype":"hook_started"}"#;
        assert!(parse_stream_line(line).is_none());
    }

    #[test]
    fn parse_unknown_type_ignored() {
        let line = r#"{"type":"system","subtype":"init"}"#;
        assert!(parse_stream_line(line).is_none());
    }
}
