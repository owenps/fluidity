use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{IconMenuItem, Menu, NativeIcon, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Listener, Manager, Runtime, State,
};
use uuid::Uuid;

const APP_NAME: &str = "Smithing";
const OPEN_SETTINGS_MENU_ID: &str = "settings.open";
const OPEN_SETTINGS_EVENT: &str = "app://open-settings";
const ADD_PROJECT_MENU_ID: &str = "project.add";
const ADD_PROJECT_EVENT: &str = "app://add-project";
const COMMANDS_MANIFEST_JSON: &str = include_str!("../../src/commandsManifest.json");
const APP_STATE_FILE: &str = "app-state.json";
const APP_STATE_VERSION: u32 = 1;
const GRID_COLUMNS: i32 = 12;
const GRID_ROWS: i32 = 8;
const MIN_TILE_WIDTH: i32 = 3;
const MIN_TILE_HEIGHT: i32 = 2;

struct WorkspaceState {
    state_path: PathBuf,
    app_state: Mutex<PersistedAppState>,
}

impl WorkspaceState {
    fn load<R: Runtime>(app: &AppHandle<R>) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
        let state_path = app_data_dir.join(APP_STATE_FILE);
        let app_state = load_app_state(&state_path);

        Ok(Self {
            state_path,
            app_state: Mutex::new(app_state),
        })
    }

    fn save(&self, app_state: &PersistedAppState) -> Result<(), String> {
        save_app_state(&self.state_path, app_state)
    }

    fn current_workspace_root(&self) -> Result<String, String> {
        let app_state = self.app_state.lock().map_err(lock_error)?;
        current_open_workspace(&app_state)
            .map(|workspace| workspace.root.clone())
            .ok_or_else(|| "no workspace is open".to_string())
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedAppState {
    version: u32,
    projects: Vec<RegisteredProject>,
    open_workspaces: Vec<OpenWorkspace>,
    current_workspace_id: Option<String>,
}

impl Default for PersistedAppState {
    fn default() -> Self {
        Self {
            version: APP_STATE_VERSION,
            projects: Vec::new(),
            open_workspaces: Vec::new(),
            current_workspace_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenWorkspace {
    id: String,
    project_id: String,
    name: String,
    root: String,
    git_branch: Option<String>,
    tile_state: WorkspaceTileState,
    last_used_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceTileState {
    tiles: Vec<PersistedTile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedTile {
    id: String,
    kind: String,
    title: String,
    initial_command: Option<String>,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceTileStateSaveRequest {
    workspace_id: String,
    tile_state: WorkspaceTileState,
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
struct CurrentWorkspaceResponse {
    workspace_id: String,
    context: WorkspaceContext,
    tile_state: WorkspaceTileState,
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
    id: String,
    name: String,
    root: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectAddResponse {
    current: Option<CurrentWorkspaceResponse>,
    project: Option<RegisteredProject>,
    duplicate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisteredProject {
    id: String,
    name: String,
    root: String,
    kind: ProjectKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ProjectKind {
    Git,
    Plain,
}

#[tauri::command]
fn workspace_current(
    state: State<'_, WorkspaceState>,
) -> Result<Option<CurrentWorkspaceResponse>, String> {
    let app_state = state.app_state.lock().map_err(lock_error)?;
    Ok(current_workspace_response(&app_state))
}

#[tauri::command]
fn project_add(state: State<'_, WorkspaceState>) -> Result<ProjectAddResponse, String> {
    let Some(selected_root) = rfd::FileDialog::new()
        .set_title("Add Project")
        .pick_folder()
    else {
        return Ok(ProjectAddResponse {
            current: None,
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
    let mut app_state = state.app_state.lock().map_err(lock_error)?;
    let project_index = app_state
        .projects
        .iter()
        .position(|project| project.root == canonical_root);
    let (project, duplicate) = if let Some(index) = project_index {
        let mut project = app_state.projects[index].clone();
        project.name = project_name_for_root(Path::new(&canonical_root));
        project.kind = project_kind_for_root(&canonical_root);
        app_state.projects[index] = project.clone();
        (project, true)
    } else {
        let project = registered_project_for_root(Path::new(&canonical_root));
        app_state.projects.push(project.clone());
        (project, false)
    };

    let workspace_id = select_or_create_initial_workspace(&mut app_state, &project);
    app_state.current_workspace_id = Some(workspace_id);
    state.save(&app_state)?;

    Ok(ProjectAddResponse {
        current: current_workspace_response(&app_state),
        project: Some(project),
        duplicate,
    })
}

#[tauri::command]
fn workspace_tile_state_save(
    state: State<'_, WorkspaceState>,
    request: WorkspaceTileStateSaveRequest,
) -> Result<(), String> {
    let mut app_state = state.app_state.lock().map_err(lock_error)?;
    let Some(workspace) = app_state
        .open_workspaces
        .iter_mut()
        .find(|workspace| workspace.id == request.workspace_id)
    else {
        return Err("workspace not found".to_string());
    };

    workspace.tile_state = sanitize_tile_state(request.tile_state);
    state.save(&app_state)
}

#[tauri::command]
fn application_reset(
    workspace_state: State<'_, WorkspaceState>,
    terminal_state: State<'_, TerminalState>,
) -> Result<(), String> {
    let mut app_state = workspace_state.app_state.lock().map_err(lock_error)?;
    *app_state = PersistedAppState::default();
    workspace_state.save(&app_state)?;

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
        .manage(TerminalState::default())
        .invoke_handler(tauri::generate_handler![
            workspace_current,
            project_add,
            workspace_tile_state_save,
            application_reset,
            terminal_create,
            terminal_write,
            terminal_resize,
            terminal_close,
        ])
        .setup(|app| {
            app.manage(WorkspaceState::load(app.handle())?);

            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                if event.id() == OPEN_SETTINGS_MENU_ID {
                    let _ = app.emit(OPEN_SETTINGS_EVENT, ());
                }
                if event.id() == ADD_PROJECT_MENU_ID {
                    let _ = app.emit(ADD_PROJECT_EVENT, ());
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
    let add_project = IconMenuItem::with_id_and_native_icon(
        app,
        ADD_PROJECT_MENU_ID,
        "Add Project…",
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
                    &add_project,
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
                    &add_project,
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

fn load_app_state(state_path: &Path) -> PersistedAppState {
    let Ok(raw_state) = fs::read_to_string(state_path) else {
        if state_path.exists() {
            backup_corrupt_app_state(state_path);
        }
        return PersistedAppState::default();
    };

    let Ok(mut app_state) = serde_json::from_str::<PersistedAppState>(&raw_state) else {
        backup_corrupt_app_state(state_path);
        return PersistedAppState::default();
    };

    if app_state.version != APP_STATE_VERSION {
        backup_corrupt_app_state(state_path);
        return PersistedAppState::default();
    }

    for workspace in &mut app_state.open_workspaces {
        workspace.tile_state = sanitize_tile_state(workspace.tile_state.clone());
    }

    app_state
}

fn save_app_state(state_path: &Path, app_state: &PersistedAppState) -> Result<(), String> {
    if let Some(parent) = state_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let contents = serde_json::to_string_pretty(app_state).map_err(|error| error.to_string())?;
    let temp_path = state_path.with_extension("json.tmp");
    fs::write(&temp_path, contents).map_err(|error| error.to_string())?;
    fs::rename(&temp_path, state_path).map_err(|error| error.to_string())
}

fn backup_corrupt_app_state(state_path: &Path) {
    if !state_path.exists() {
        return;
    }

    let timestamp = now_unix_seconds();
    let backup_path = state_path.with_file_name(format!("app-state.corrupt-{timestamp}.json"));
    let _ = fs::rename(state_path, backup_path);
}

fn current_workspace_response(app_state: &PersistedAppState) -> Option<CurrentWorkspaceResponse> {
    let workspace = current_open_workspace(app_state)?;
    let project = app_state
        .projects
        .iter()
        .find(|project| project.id == workspace.project_id)?;

    Some(CurrentWorkspaceResponse {
        workspace_id: workspace.id.clone(),
        context: workspace_context_for_project_and_workspace(project, workspace),
        tile_state: workspace.tile_state.clone(),
    })
}

fn current_open_workspace(app_state: &PersistedAppState) -> Option<&OpenWorkspace> {
    app_state
        .current_workspace_id
        .as_ref()
        .and_then(|workspace_id| {
            app_state.open_workspaces.iter().find(|workspace| {
                &workspace.id == workspace_id && workspace_root_available(workspace)
            })
        })
        .or_else(|| {
            app_state
                .open_workspaces
                .iter()
                .filter(|workspace| workspace_root_available(workspace))
                .max_by_key(|workspace| workspace.last_used_at)
        })
}

fn select_or_create_initial_workspace(
    app_state: &mut PersistedAppState,
    project: &RegisteredProject,
) -> String {
    if let Some(workspace) = app_state
        .open_workspaces
        .iter_mut()
        .filter(|workspace| {
            workspace.project_id == project.id && workspace_root_available(workspace)
        })
        .max_by_key(|workspace| workspace.last_used_at)
    {
        workspace.last_used_at = now_unix_seconds();
        workspace.git_branch =
            observed_git_branch(project.kind, &workspace.root).or(workspace.git_branch.clone());
        return workspace.id.clone();
    }

    let workspace = open_workspace_for_project(project);
    let workspace_id = workspace.id.clone();
    app_state.open_workspaces.push(workspace);
    workspace_id
}

fn open_workspace_for_project(project: &RegisteredProject) -> OpenWorkspace {
    let git_branch = observed_git_branch(project.kind, &project.root);
    let name = match project.kind {
        ProjectKind::Git => git_branch.clone().unwrap_or_else(|| "Git".to_string()),
        ProjectKind::Plain => "Home".to_string(),
    };

    OpenWorkspace {
        id: format!("workspace-{}", Uuid::new_v4()),
        project_id: project.id.clone(),
        name,
        root: project.root.clone(),
        git_branch,
        tile_state: default_workspace_tile_state(),
        last_used_at: now_unix_seconds(),
    }
}

fn default_workspace_tile_state() -> WorkspaceTileState {
    WorkspaceTileState {
        tiles: vec![PersistedTile {
            id: format!("tile-{}", Uuid::new_v4()),
            kind: "terminal".to_string(),
            title: "Terminal".to_string(),
            initial_command: None,
            x: 0,
            y: 0,
            w: GRID_COLUMNS,
            h: GRID_ROWS,
        }],
    }
}

fn sanitize_tile_state(tile_state: WorkspaceTileState) -> WorkspaceTileState {
    let mut ids = HashSet::new();
    let mut tiles = Vec::new();

    for mut tile in tile_state.tiles {
        if tile.id.trim().is_empty() || !ids.insert(tile.id.clone()) {
            continue;
        }
        if tile.kind != "terminal" {
            continue;
        }
        if tile.title.trim().is_empty() {
            tile.title = "Terminal".to_string();
        }
        if !is_valid_tile_geometry(&tile) {
            continue;
        }
        if tiles.iter().any(|existing| tiles_overlap(existing, &tile)) {
            continue;
        }
        tiles.push(tile);
    }

    if tiles.is_empty() {
        default_workspace_tile_state()
    } else {
        WorkspaceTileState { tiles }
    }
}

fn is_valid_tile_geometry(tile: &PersistedTile) -> bool {
    tile.x >= 0
        && tile.y >= 0
        && tile.w >= MIN_TILE_WIDTH
        && tile.h >= MIN_TILE_HEIGHT
        && tile.x + tile.w <= GRID_COLUMNS
        && tile.y + tile.h <= GRID_ROWS
}

fn tiles_overlap(a: &PersistedTile, b: &PersistedTile) -> bool {
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

fn workspace_root_available(workspace: &OpenWorkspace) -> bool {
    Path::new(&workspace.root).is_dir()
}

fn registered_project_for_root(root: &Path) -> RegisteredProject {
    let root = path_to_string(root);
    RegisteredProject {
        id: format!("project-{}", Uuid::new_v4()),
        name: project_name_for_root(Path::new(&root)),
        kind: project_kind_for_root(&root),
        root,
    }
}

fn workspace_context_for_project_and_workspace(
    project: &RegisteredProject,
    workspace: &OpenWorkspace,
) -> WorkspaceContext {
    let git_branch =
        observed_git_branch(project.kind, &workspace.root).or(workspace.git_branch.clone());

    WorkspaceContext {
        project: ProjectContext {
            name: project.name.clone(),
            root: project.root.clone(),
            kind: project.kind,
        },
        workspace: WorkspaceContextInfo {
            id: workspace.id.clone(),
            name: workspace.name.clone(),
            root: workspace.root.clone(),
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

fn project_kind_for_root(root: &str) -> ProjectKind {
    if git_output(root, &["rev-parse", "--is-inside-work-tree"]).as_deref() == Some("true") {
        ProjectKind::Git
    } else {
        ProjectKind::Plain
    }
}

fn observed_git_branch(project_kind: ProjectKind, root: &str) -> Option<String> {
    if project_kind == ProjectKind::Git {
        git_branch_for_root(root)
    } else {
        None
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
    let workspace_root = workspace_state.current_workspace_root()?;
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

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn lock_error<T>(error: std::sync::PoisonError<T>) -> String {
    error.to_string()
}
