use crate::{mcp::handle_jsonrpc_message, AgentToolService};
use anyhow::{Context, Result};
use axum::{
    body::Bytes,
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use std::{
    future::{ready, IntoFuture},
    net::SocketAddr,
    sync::Arc,
};

pub fn run_http(service: AgentToolService, bind: SocketAddr) -> Result<()> {
    let runtime = tokio::runtime::Runtime::new().context("creating HTTP MCP runtime")?;
    let listener = runtime
        .block_on(tokio::net::TcpListener::bind(bind))
        .with_context(|| format!("binding HTTP MCP listener at {bind}"))?;

    runtime
        .block_on(axum::serve(listener, router(service)).into_future())
        .context("serving HTTP MCP")
}

fn router(service: AgentToolService) -> Router {
    Router::new()
        .route("/mcp", post(post_mcp))
        .with_state(Arc::new(service))
}

fn post_mcp(
    State(service): State<Arc<AgentToolService>>,
    headers: HeaderMap,
    body: Bytes,
) -> std::future::Ready<Response> {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    let origin = headers
        .get(header::ORIGIN)
        .map(|value| value.to_str().unwrap_or(""));
    let (status, body) = handle_http_jsonrpc(&service, content_type, origin, &body);
    ready(match body {
        Some(body) => (status, Json(body)).into_response(),
        None => status.into_response(),
    })
}

pub fn handle_http_jsonrpc(
    service: &AgentToolService,
    content_type: Option<&str>,
    origin: Option<&str>,
    body: &[u8],
) -> (StatusCode, Option<Value>) {
    if !is_json_content_type(content_type) {
        return (
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            Some(jsonrpc_error(
                -32600,
                "Invalid request: content-type must be application/json",
            )),
        );
    }

    if !is_allowed_origin(origin) {
        return (
            StatusCode::FORBIDDEN,
            Some(jsonrpc_error(
                -32600,
                "Invalid request: origin is not allowed",
            )),
        );
    }

    let message = match std::str::from_utf8(body) {
        Ok(message) => message,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Some(jsonrpc_error(-32700, format!("Parse error: {error}"))),
            );
        }
    };

    if let Err(error) = serde_json::from_str::<Value>(message) {
        return (
            StatusCode::BAD_REQUEST,
            Some(jsonrpc_error(-32700, format!("Parse error: {error}"))),
        );
    }

    match handle_jsonrpc_message(service, message) {
        Ok(Some(response)) => (StatusCode::OK, Some(response)),
        // Notifications do not produce JSON-RPC responses. HTTP MCP returns 202 with an empty body.
        Ok(None) => (StatusCode::ACCEPTED, None),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Some(json!({
                "jsonrpc": "2.0",
                "id": null,
                "error": {
                    "code": -32603,
                    "message": error.to_string()
                }
            })),
        ),
    }
}

fn is_json_content_type(content_type: Option<&str>) -> bool {
    content_type
        .map(|content_type| {
            content_type == "application/json" || content_type.starts_with("application/json;")
        })
        .unwrap_or(false)
}

fn is_allowed_origin(origin: Option<&str>) -> bool {
    let Some(origin) = origin else {
        return true;
    };

    [
        "http://localhost",
        "https://localhost",
        "http://127.0.0.1",
        "https://127.0.0.1",
        "http://[::1]",
        "https://[::1]",
    ]
    .iter()
    .any(|prefix| {
        origin
            .strip_prefix(prefix)
            .map(|suffix| suffix.is_empty() || is_port_suffix(suffix))
            .unwrap_or(false)
    })
}

fn is_port_suffix(suffix: &str) -> bool {
    suffix
        .strip_prefix(':')
        .map(|port| !port.is_empty() && port.bytes().all(|byte| byte.is_ascii_digit()))
        .unwrap_or(false)
}

fn jsonrpc_error(code: i64, message: impl Into<String>) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": null,
        "error": {
            "code": code,
            "message": message.into()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::handle_http_jsonrpc;
    use crate::AgentToolService;
    use axum::http::StatusCode;

    fn call(body: &[u8]) -> (StatusCode, Option<serde_json::Value>) {
        handle_http_jsonrpc(
            &AgentToolService::default(),
            Some("application/json"),
            None,
            body,
        )
    }

    #[test]
    fn http_valid_json_content_type_returns_jsonrpc_response() {
        let (status, body) = handle_http_jsonrpc(
            &AgentToolService::default(),
            Some("application/json; charset=utf-8"),
            None,
            br#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#,
        );

        assert_eq!(status, StatusCode::OK);
        let body = body.expect("json response body");
        let tools = body["result"]["tools"].as_array().expect("tools array");
        assert!(tools.iter().any(|tool| tool["name"] == "library_search"));
    }

    #[test]
    fn http_missing_content_type_is_rejected() {
        let (status, body) = handle_http_jsonrpc(
            &AgentToolService::default(),
            None,
            None,
            br#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#,
        );

        assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
        let body = body.expect("json error body");
        assert_eq!(body["error"]["code"], -32600);
    }

    #[test]
    fn http_wrong_content_type_is_rejected() {
        let (status, body) = handle_http_jsonrpc(
            &AgentToolService::default(),
            Some("text/plain"),
            None,
            br#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#,
        );

        assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
        let body = body.expect("json error body");
        assert_eq!(body["error"]["code"], -32600);
    }

    #[test]
    fn http_non_local_origin_is_rejected() {
        let (status, body) = handle_http_jsonrpc(
            &AgentToolService::default(),
            Some("application/json"),
            Some("https://example.com"),
            br#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#,
        );

        assert_eq!(status, StatusCode::FORBIDDEN);
        let body = body.expect("json error body");
        assert_eq!(body["error"]["code"], -32600);
    }

    #[test]
    fn http_localhost_origin_is_accepted() {
        let (status, body) = handle_http_jsonrpc(
            &AgentToolService::default(),
            Some("application/json"),
            Some("http://localhost:8787"),
            br#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#,
        );

        assert_eq!(status, StatusCode::OK);
        let body = body.expect("json response body");
        assert!(body["result"]["tools"].is_array());
    }

    #[test]
    fn http_invalid_utf8_returns_bad_request_parse_error() {
        let (status, body) = call(b"\xff");

        assert_eq!(status, StatusCode::BAD_REQUEST);
        let body = body.expect("json response body");
        assert_eq!(body["error"]["code"], -32700);
    }

    #[test]
    fn http_malformed_json_returns_bad_request_parse_error() {
        let (status, body) = call(b"{nope");

        assert_eq!(status, StatusCode::BAD_REQUEST);
        let body = body.expect("json response body");
        assert_eq!(body["error"]["code"], -32700);
    }

    #[test]
    fn http_notification_returns_accepted_empty_body() {
        let (status, body) = call(br#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#);

        assert_eq!(status, StatusCode::ACCEPTED);
        assert!(body.is_none());
    }
}
