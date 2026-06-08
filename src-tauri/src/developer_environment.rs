use std::{collections::HashMap, env, path::Path, process::Command};

const DEFAULT_SHELL: &str = "/bin/zsh";
const DEFAULT_DEVELOPER_PATH: &str = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin";
const PATH_START_MARKER: &str = "__FLUIDITY_PATH_START__";
const PATH_END_MARKER: &str = "__FLUIDITY_PATH_END__";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DeveloperEnvironment {
    pub(crate) shell: String,
    pub(crate) variables: HashMap<String, String>,
}

impl DeveloperEnvironment {
    #[cfg(test)]
    pub(crate) fn with_shell(shell: impl Into<String>) -> Self {
        Self {
            shell: shell.into(),
            variables: HashMap::new(),
        }
    }
}

pub(crate) fn resolve_for_cwd(cwd: &Path) -> DeveloperEnvironment {
    let shell = user_shell();
    let path = shell_login_path(&shell, cwd).unwrap_or_else(fallback_developer_path);
    let mut variables = HashMap::new();
    variables.insert("SHELL".to_string(), shell.clone());
    variables.insert("PATH".to_string(), path);

    DeveloperEnvironment { shell, variables }
}

fn user_shell() -> String {
    env::var("SHELL")
        .ok()
        .filter(|shell| valid_shell(shell))
        .or_else(login_shell_from_directory_services)
        .unwrap_or_else(|| DEFAULT_SHELL.to_string())
}

fn valid_shell(shell: &str) -> bool {
    let shell = shell.trim();
    !shell.is_empty() && Path::new(shell).is_file()
}

fn login_shell_from_directory_services() -> Option<String> {
    let user = env::var("USER").ok()?;
    let output = Command::new("/usr/bin/dscl")
        .args([".", "-read", &format!("/Users/{user}"), "UserShell"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .last()
        .map(str::to_string)
        .filter(|shell| valid_shell(shell))
}

fn shell_login_path(shell: &str, cwd: &Path) -> Option<String> {
    let output = Command::new(shell)
        .arg("-lic")
        .arg(format!(
            "printf '%s%s%s' {} \"$PATH\" {}",
            shell_quote(PATH_START_MARKER),
            shell_quote(PATH_END_MARKER),
        ))
        .current_dir(cwd)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    extract_between_markers(&stdout, PATH_START_MARKER, PATH_END_MARKER)
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(str::to_string)
}

fn fallback_developer_path() -> String {
    let mut entries = Vec::new();
    push_path_entries(&mut entries, DEFAULT_DEVELOPER_PATH);
    if let Ok(path) = env::var("PATH") {
        push_path_entries(&mut entries, &path);
    }
    entries.join(":")
}

fn push_path_entries(entries: &mut Vec<String>, path: &str) {
    for entry in path
        .split(':')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        if !entries.iter().any(|existing| existing == entry) {
            entries.push(entry.to_string());
        }
    }
}

fn extract_between_markers<'a>(text: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let start_index = text.find(start)? + start.len();
    let end_index = text[start_index..].find(end)? + start_index;
    Some(&text[start_index..end_index])
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_path_between_markers_despite_startup_output() {
        assert_eq!(
            extract_between_markers(
                "hello\n__FLUIDITY_PATH_START__/opt/homebrew/bin:/usr/bin__FLUIDITY_PATH_END__\n",
                PATH_START_MARKER,
                PATH_END_MARKER,
            ),
            Some("/opt/homebrew/bin:/usr/bin")
        );
    }

    #[test]
    fn fallback_path_contains_common_macos_developer_locations() {
        let path = fallback_developer_path();

        assert!(path.split(':').any(|entry| entry == "/opt/homebrew/bin"));
        assert!(path.split(':').any(|entry| entry == "/usr/local/bin"));
        assert!(path.split(':').any(|entry| entry == "/usr/bin"));
    }
}
