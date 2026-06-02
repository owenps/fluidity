use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    env,
    hash::{Hash, Hasher},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    thread,
};
use tauri::{
    menu::{IconMenuItem, Menu, NativeIcon, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Listener, Manager, State,
};
use uuid::Uuid;

const APP_NAME: &str = "Smithing";
const OPEN_SETTINGS_MENU_ID: &str = "settings.open";
const OPEN_SETTINGS_EVENT: &str = "app://open-settings";
const OPEN_PROJECT_MENU_ID: &str = "project.open";
const OPEN_PROJECT_EVENT: &str = "app://open-project";
const COMMANDS_MANIFEST_JSON: &str = include_str!("../../src/commandsManifest.json");

struct WorkspaceState {
    projects: Mutex<Vec<RegisteredProject>>,
    context: Mutex<Option<WorkspaceContext>>,
}

impl WorkspaceState {
    fn new() -> Self {
        Self {
            projects: Mutex::new(Vec::new()),
            context: Mutex::new(None),
        }
    }
}

#[derive(Default)]
struct TerminalState {
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child_killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCreateRequest {
    tile_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCreateResponse {
    session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalWriteRequest {
    session_id: String,
    data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalResizeRequest {
    session_id: String,
    cols: u16,
    rows: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCloseRequest {
    session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputEvent {
    session_id: String,
    data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitEvent {
    session_id: String,
    exit_code: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandManifestEntry {
    id: String,
    native_accelerator: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceContext {
    project: ProjectContext,
    workspace: WorkspaceContextInfo,
    git_branch: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ProjectContext {
    name: String,
    root: String,
    kind: ProjectKind,
}

#[derive(Debug, Clone, Serialize)]
struct WorkspaceContextInfo {
    name: String,
    root: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectOpenResponse {
    context: Option<WorkspaceContext>,
    project: Option<RegisteredProject>,
    duplicate: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisteredProject {
    id: String,
    name: String,
    root: String,
    kind: ProjectKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum ProjectKind {
    Git,
    Plain,
}

#[tauri::command]
fn workspace_context(state: State<'_, WorkspaceState>) -> Result<Option<WorkspaceContext>, String> {
    state
        .context
        .lock()
        .map_err(lock_error)
        .map(|context| context.clone())
}

#[tauri::command]
fn project_open(state: State<'_, WorkspaceState>) -> Result<ProjectOpenResponse, String> {
    let Some(selected_root) = rfd::FileDialog::new()
        .set_title("Open Project")
        .pick_folder()
    else {
        return Ok(ProjectOpenResponse {
            context: None,
            project: None,
            duplicate: false,
        });
    };

    let canonical_root = selected_root
        .canonicalize()
        .map_err(|error| format!("Could not read selected project root: {error}"))?;
    if !canonical_root.is_dir() {
        return Err("Selected project root is not a directory".to_string());
    }

    let canonical_root = path_to_string(&canonical_root);
    let mut projects = state.projects.lock().map_err(lock_error)?;
    let (project, duplicate) = if let Some(project) = projects
        .iter()
        .find(|project| project.root == canonical_root)
        .cloned()
    {
        (project, true)
    } else {
        let project = registered_project_for_root(Path::new(&canonical_root));
        projects.push(project.clone());
        (project, false)
    };
    drop(projects);

    let context = workspace_context_for_project(&project);
    *state.context.lock().map_err(lock_error)? = Some(context.clone());

    Ok(ProjectOpenResponse {
        context: Some(context),
        project: Some(project),
        duplicate,
    })
}

#[tauri::command]
fn application_reset(
    workspace_state: State<'_, WorkspaceState>,
    terminal_state: State<'_, TerminalState>,
) -> Result<(), String> {
    workspace_state.projects.lock().map_err(lock_error)?.clear();
    *workspace_state.context.lock().map_err(lock_error)? = None;

    for (_, mut session) in terminal_state.sessions.lock().map_err(lock_error)?.drain() {
        let _ = session.child_killer.kill();
    }

    Ok(())
}

#[tauri::command]
fn terminal_create(
    app: AppHandle,
    terminal_state: State<'_, TerminalState>,
    workspace_state: State<'_, WorkspaceState>,
    request: TerminalCreateRequest,
) -> Result<TerminalCreateResponse, String> {
    let session_id = format!("terminal-{}", Uuid::new_v4());
    let cwd = normalize_cwd(&workspace_state, &request.cwd)?;
    let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: request.rows.max(1),
            cols: request.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;

    let mut command = CommandBuilder::new(shell);
    command.cwd(cwd);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("SMITHING_TILE_ID", request.tile_id);

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    let child_killer = child.clone_killer();
    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;

    terminal_state.sessions.lock().map_err(lock_error)?.insert(
        session_id.clone(),
        TerminalSession {
            master: pair.master,
            writer,
            child_killer,
        },
    );

    spawn_output_thread(app.clone(), session_id.clone(), reader);
    spawn_wait_thread(app, session_id.clone(), child);

    Ok(TerminalCreateResponse { session_id })
}

#[tauri::command]
fn terminal_write(
    state: State<'_, TerminalState>,
    request: TerminalWriteRequest,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(lock_error)?;
    let session = sessions
        .get_mut(&request.session_id)
        .ok_or_else(|| "terminal session not found".to_string())?;

    session
        .writer
        .write_all(request.data.as_bytes())
        .map_err(|error| error.to_string())?;
    session.writer.flush().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn terminal_resize(
    state: State<'_, TerminalState>,
    request: TerminalResizeRequest,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(lock_error)?;
    let session = sessions
        .get_mut(&request.session_id)
        .ok_or_else(|| "terminal session not found".to_string())?;

    session
        .master
        .resize(PtySize {
            rows: request.rows.max(1),
            cols: request.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn terminal_close(
    state: State<'_, TerminalState>,
    request: TerminalCloseRequest,
) -> Result<(), String> {
    let session = state
        .sessions
        .lock()
        .map_err(lock_error)?
        .remove(&request.session_id);

    if let Some(mut session) = session {
        let _ = session.child_killer.kill();
    }

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(WorkspaceState::new())
        .manage(TerminalState::default())
        .invoke_handler(tauri::generate_handler![
            workspace_context,
            project_open,
            application_reset,
            terminal_create,
            terminal_write,
            terminal_resize,
            terminal_close,
        ])
        .setup(|app| {
            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                if event.id() == OPEN_SETTINGS_MENU_ID {
                    let _ = app.emit(OPEN_SETTINGS_EVENT, ());
                }
                if event.id() == OPEN_PROJECT_MENU_ID {
                    let _ = app.emit(OPEN_PROJECT_EVENT, ());
                }
            });

            let app_handle = app.handle().clone();
            app.listen("tauri://close-requested", move |_| {
                if let Some(state) = app_handle.try_state::<TerminalState>() {
                    if let Ok(mut sessions) = state.sessions.lock() {
                        for (_, mut session) in sessions.drain() {
                            let _ = session.child_killer.kill();
                        }
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| panic!("error while running {APP_NAME}: {error}"));
}

fn build_app_menu<R: tauri::Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let settings_accelerator = native_accelerator_for_command(OPEN_SETTINGS_MENU_ID);
    let settings = IconMenuItem::with_id_and_native_icon(
        app,
        OPEN_SETTINGS_MENU_ID,
        "Settings…",
        true,
        Some(NativeIcon::PreferencesGeneral),
        settings_accelerator.as_deref(),
    )?;
    let open_project = IconMenuItem::with_id_and_native_icon(
        app,
        OPEN_PROJECT_MENU_ID,
        "Open Project…",
        true,
        Some(NativeIcon::Add),
        None::<&str>,
    )?;

    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                APP_NAME,
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &settings,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &open_project,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?,
            #[cfg(not(any(
                target_os = "macos",
                target_os = "linux",
                target_os = "dragonfly",
                target_os = "freebsd",
                target_os = "netbsd",
                target_os = "openbsd"
            )))]
            &Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &open_project,
                    &PredefinedMenuItem::separator(app)?,
                    &settings,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                "View",
                true,
                &[&PredefinedMenuItem::fullscreen(app, None)?],
            )?,
            &Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    #[cfg(target_os = "macos")]
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?,
            &Submenu::with_items(app, "Help", true, &[])?,
        ],
    )
}

fn native_accelerator_for_command(command_id: &str) -> Option<String> {
    serde_json::from_str::<Vec<CommandManifestEntry>>(COMMANDS_MANIFEST_JSON)
        .ok()?
        .into_iter()
        .find(|command| command.id == command_id)?
        .native_accelerator
}

fn spawn_output_thread(app: AppHandle, session_id: String, mut reader: Box<dyn Read + Send>) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    let data = String::from_utf8_lossy(&buffer[..count]).to_string();
                    let _ = app.emit(
                        "terminal://output",
                        TerminalOutputEvent {
                            session_id: session_id.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });
}

fn spawn_wait_thread(app: AppHandle, session_id: String, mut child: Box<dyn Child + Send + Sync>) {
    thread::spawn(move || {
        let exit_code = child
            .wait()
            .ok()
            .and_then(|status| i32::try_from(status.exit_code()).ok());

        if let Some(state) = app.try_state::<TerminalState>() {
            if let Ok(mut sessions) = state.sessions.lock() {
                sessions.remove(&session_id);
            }
        }

        let _ = app.emit(
            "terminal://exit",
            TerminalExitEvent {
                session_id,
                exit_code,
            },
        );
    });
}

fn registered_project_for_root(root: &Path) -> RegisteredProject {
    let root = path_to_string(root);
    RegisteredProject {
        id: project_id_for_root(&root),
        name: project_name_for_root(Path::new(&root)),
        kind: project_kind_for_root(&root),
        root,
    }
}

fn workspace_context_for_project(project: &RegisteredProject) -> WorkspaceContext {
    let git_branch = if project.kind == ProjectKind::Git {
        git_branch_for_root(&project.root)
    } else {
        None
    };
    let workspace_name = match project.kind {
        ProjectKind::Git => git_branch.clone().unwrap_or_else(|| "Git".to_string()),
        ProjectKind::Plain => "Home".to_string(),
    };

    WorkspaceContext {
        project: ProjectContext {
            name: project.name.clone(),
            root: project.root.clone(),
            kind: project.kind,
        },
        workspace: WorkspaceContextInfo {
            name: workspace_name,
            root: project.root.clone(),
        },
        git_branch,
    }
}

fn project_name_for_root(root: &Path) -> String {
    root.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Project")
        .to_string()
}

fn project_id_for_root(root: &str) -> String {
    let mut hasher = DefaultHasher::new();
    root.hash(&mut hasher);
    format!("project-{:016x}", hasher.finish())
}

fn project_kind_for_root(root: &str) -> ProjectKind {
    if git_output(root, &["rev-parse", "--is-inside-work-tree"]).as_deref() == Some("true") {
        ProjectKind::Git
    } else {
        ProjectKind::Plain
    }
}

fn git_branch_for_root(root: &str) -> Option<String> {
    git_output(root, &["branch", "--show-current"])
        .or_else(|| git_output(root, &["rev-parse", "--short", "HEAD"]))
}

fn git_output(root: &str, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn normalize_cwd(workspace_state: &WorkspaceState, cwd: &str) -> Result<PathBuf, String> {
    let workspace_root = workspace_state
        .context
        .lock()
        .map_err(lock_error)?
        .as_ref()
        .ok_or_else(|| "no workspace is open".to_string())?
        .workspace
        .root
        .clone();
    let workspace_root = PathBuf::from(workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let path = Path::new(cwd);
    let candidate = if path.is_absolute() {
        path.to_path_buf()
    } else {
        workspace_root.join(path)
    };
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|error| error.to_string())?;

    if !canonical_candidate.starts_with(&workspace_root) {
        return Err("terminal cwd must be inside the current workspace".to_string());
    }

    Ok(canonical_candidate)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn lock_error<T>(error: std::sync::PoisonError<T>) -> String {
    error.to_string()
}
