use agent_tools::mcp::{run_stdio, tool_request_from_name_and_arguments};
use agent_tools::AgentToolService;
use anyhow::{Context, Result};
use clap::{Args, Parser, Subcommand};
use serde_json::{Map, Value};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "decks")]
#[command(about = "Rekordagent command-line tools")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Run the local stdio MCP server.
    Mcp(McpArgs),
    /// Diagnostic access to agent tools.
    Tools(ToolsArgs),
}

#[derive(Debug, Args)]
struct McpArgs {
    /// Path to the staged-change cache database.
    #[arg(long, value_name = "PATH")]
    cache: Option<PathBuf>,
}

#[derive(Debug, Args)]
struct ToolsArgs {
    #[command(subcommand)]
    command: ToolsCommand,
}

#[derive(Debug, Subcommand)]
enum ToolsCommand {
    /// Call one tool and print the JSON result.
    Call(CallArgs),
}

#[derive(Debug, Args)]
struct CallArgs {
    /// MCP tool name, such as library_search or library.search.
    tool_name: String,
    /// Path to the Rekordbox master.db file.
    #[arg(long, value_name = "PATH")]
    library: PathBuf,
    /// Tool arguments as a JSON object.
    #[arg(long, value_name = "JSON", default_value = "{}")]
    json: String,
    /// Path to the staged-change cache database.
    #[arg(long, value_name = "PATH")]
    cache: Option<PathBuf>,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Mcp(args) => run_stdio(service(args.cache)),
        Commands::Tools(args) => match args.command {
            ToolsCommand::Call(args) => call_tool(args),
        },
    }
}

fn call_tool(args: CallArgs) -> Result<()> {
    let arguments = parse_arguments(&args.json, args.library)?;
    let request = tool_request_from_name_and_arguments(&args.tool_name, Value::Object(arguments))
        .with_context(|| format!("building request for tool `{}`", args.tool_name))?;
    let value = service(args.cache)
        .execute(request)
        .with_context(|| format!("running tool `{}`", args.tool_name))?;

    println!("{}", serde_json::to_string_pretty(&value)?);
    Ok(())
}

fn parse_arguments(json: &str, library_path: PathBuf) -> Result<Map<String, Value>> {
    let value: Value = serde_json::from_str(json).context("--json must be valid JSON")?;
    let mut arguments = value
        .as_object()
        .cloned()
        .context("--json must be a JSON object")?;
    arguments.insert(
        "library_path".to_owned(),
        Value::String(library_path.display().to_string()),
    );
    Ok(arguments)
}

fn service(cache_path: Option<PathBuf>) -> AgentToolService {
    AgentToolService { cache_path }
}
