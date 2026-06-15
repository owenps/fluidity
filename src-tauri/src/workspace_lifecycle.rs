use super::*;

pub(crate) fn open_project(
    app_data_dir: &Path,
    app_state: &mut PersistedAppState,
    project: &RegisteredProject,
) -> Result<(WorkspaceOverview, Vec<String>), String> {
    let mut warnings = Vec::new();
    let workspace_id =
        select_or_create_initial_workspace(app_data_dir, app_state, project, &mut warnings)?;
    set_current_workspace(app_state, &workspace_id);
    normalize_workspace_stack(app_state);
    let overview = workspace_overview_for_state(app_state);
    Ok((overview, warnings))
}

pub(crate) fn create_workspace(
    app_data_dir: &Path,
    app_state: &mut PersistedAppState,
    project_id: &str,
) -> Result<WorkspaceCreateResponse, String> {
    let project = app_state
        .projects
        .iter()
        .find(|project| project.id == project_id)
        .cloned()
        .ok_or_else(|| "project not found".to_string())?;

    if project.kind != ProjectKind::Git {
        return Err("new workspaces are only available for git-backed projects".to_string());
    }
    if !Path::new(&project.root).is_dir() {
        return Err("project root is missing".to_string());
    }

    let mut warnings = Vec::new();
    let workspace = create_git_workspace(app_data_dir, app_state, &project, &mut warnings)?;
    let workspace_id = workspace.id.clone();
    app_state.open_workspaces.push(workspace);
    set_current_workspace(app_state, &workspace_id);
    normalize_workspace_stack(app_state);

    let overview = workspace_overview_for_state(app_state);
    let current = overview
        .current
        .clone()
        .ok_or_else(|| "created workspace is unavailable".to_string())?;
    Ok(WorkspaceCreateResponse {
        current,
        overview,
        warnings,
    })
}

pub(crate) fn rename_open_workspace(
    app_state: &mut PersistedAppState,
    request: WorkspaceRenameRequest,
) -> Result<WorkspaceRenameResponse, String> {
    let warnings = rename_workspace(app_state, &request.workspace_id, &request.name)?;
    refresh_workspace_branch_observations(app_state);
    normalize_workspace_stack(app_state);
    let overview = workspace_overview_for_state(app_state);
    Ok(WorkspaceRenameResponse {
        current: overview.current.clone(),
        overview,
        warnings,
    })
}

pub(crate) fn capture_first_intent(
    app_state: &mut PersistedAppState,
    request: WorkspaceIntentCaptureRequest,
) -> Result<WorkspaceIntentCaptureResponse, String> {
    let warnings = capture_workspace_first_intent(app_state, request)?;
    refresh_workspace_branch_observations(app_state);
    normalize_workspace_stack(app_state);
    let overview = workspace_overview_for_state(app_state);
    Ok(WorkspaceIntentCaptureResponse {
        current: overview.current.clone(),
        overview,
        warnings,
    })
}

pub(crate) fn switch_workspace(
    app_state: &mut PersistedAppState,
    workspace_id: &str,
) -> Result<WorkspaceSwitchResponse, String> {
    let Some(workspace) = app_state
        .open_workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
    else {
        return Err("workspace not found".to_string());
    };
    if !workspace_root_available(workspace) {
        return Err("workspace root is missing".to_string());
    }

    set_current_workspace(app_state, workspace_id);
    normalize_workspace_stack(app_state);
    Ok(WorkspaceSwitchResponse {
        overview: workspace_overview_for_state(app_state),
    })
}

pub(crate) fn save_tile_state(
    app_state: &mut PersistedAppState,
    request: WorkspaceTileStateSaveRequest,
) -> Result<(), String> {
    let Some(workspace) = app_state
        .open_workspaces
        .iter_mut()
        .find(|workspace| workspace.id == request.workspace_id)
    else {
        return Err("workspace not found".to_string());
    };

    workspace.tile_state = sanitize_tile_state(request.tile_state);
    Ok(())
}

#[derive(Debug, Clone)]
pub(super) struct WorkspaceCleanupTarget {
    pub(super) workspace: OpenWorkspace,
    pub(super) project: RegisteredProject,
}

pub(super) enum ProjectDisconnectResult {
    Dirty {
        project: RegisteredProject,
        dirty_confirmation: DirtyConfirmation,
    },
    Disconnected {
        project: RegisteredProject,
        removed_workspace_count: usize,
        warnings: Vec<String>,
    },
}

pub(super) enum WorkspaceDiscardResult {
    Dirty {
        dirty_confirmation: DirtyConfirmation,
    },
    Discarded {
        warnings: Vec<String>,
    },
}

pub(super) enum ApplicationResetResult {
    Dirty {
        dirty_confirmation: DirtyConfirmation,
    },
    Reset {
        warnings: Vec<String>,
    },
}

pub(super) fn project_disconnect(
    app_state: &mut PersistedAppState,
    app_data_dir: &Path,
    terminal_state: &TerminalState,
    project_id: &str,
    confirm_dirty: bool,
) -> Result<ProjectDisconnectResult, String> {
    let (project_index, project, workspace_ids, workspaces) =
        select_project_disconnect_targets(app_state, project_id)?;
    let cleanup_workspaces = cleanup_targets_for_managed_workspaces(app_data_dir, &workspaces);

    if let Some(dirty_confirmation) =
        confirm_dirty_then_close_runtime(&cleanup_workspaces, confirm_dirty, || {
            close_terminal_workspaces(terminal_state, &workspaces)
        })?
    {
        return Ok(ProjectDisconnectResult::Dirty {
            project,
            dirty_confirmation,
        });
    }

    let mut warnings = Vec::new();
    remove_workspace_roots(
        app_data_dir,
        &cleanup_workspaces,
        confirm_dirty,
        &mut warnings,
    )?;

    let project = app_state.projects.remove(project_index);
    let removed_workspace_count = remove_workspaces_from_state(app_state, &workspace_ids);
    normalize_workspace_stack(app_state);

    Ok(ProjectDisconnectResult::Disconnected {
        project,
        removed_workspace_count,
        warnings,
    })
}

pub(super) fn workspace_discard(
    app_state: &mut PersistedAppState,
    app_data_dir: &Path,
    terminal_state: &TerminalState,
    workspace_id: &str,
    confirm_dirty: bool,
) -> Result<WorkspaceDiscardResult, String> {
    let target = workspace_discard_target(app_state, workspace_id)?;
    if !workspace_discardable(app_data_dir, &target.project, &target.workspace) {
        return Err("workspace is not discardable".to_string());
    }
    let cleanup_workspaces = vec![target.clone()];

    if let Some(dirty_confirmation) =
        confirm_dirty_then_close_runtime(&cleanup_workspaces, confirm_dirty, || {
            close_terminal_workspaces(terminal_state, &cleanup_workspaces)
        })?
    {
        return Ok(WorkspaceDiscardResult::Dirty { dirty_confirmation });
    }

    let mut warnings = Vec::new();
    remove_workspace_roots(
        app_data_dir,
        &cleanup_workspaces,
        confirm_dirty,
        &mut warnings,
    )?;
    delete_workspace_branch_after_discard(&target, &mut warnings);
    let next_current_workspace_id =
        if app_state.current_workspace_id.as_deref() == Some(workspace_id) {
            next_workspace_id_after_single_removal(app_state, workspace_id)
        } else {
            app_state.current_workspace_id.clone()
        };
    remove_workspaces_from_state(app_state, &[workspace_id.to_string()]);
    app_state.current_workspace_id = next_current_workspace_id;
    normalize_workspace_stack(app_state);

    Ok(WorkspaceDiscardResult::Discarded { warnings })
}

pub(super) fn application_reset(
    app_state: &mut PersistedAppState,
    app_data_dir: &Path,
    terminal_state: &TerminalState,
    confirm_dirty: bool,
) -> Result<ApplicationResetResult, String> {
    let workspaces = all_workspace_targets(app_state);
    let cleanup_workspaces = cleanup_targets_for_managed_workspaces(app_data_dir, &workspaces);

    if let Some(dirty_confirmation) =
        confirm_dirty_then_close_runtime(&cleanup_workspaces, confirm_dirty, || {
            terminal_state.close_all()
        })?
    {
        return Ok(ApplicationResetResult::Dirty { dirty_confirmation });
    }

    let mut warnings = Vec::new();
    remove_workspace_roots(
        app_data_dir,
        &cleanup_workspaces,
        confirm_dirty,
        &mut warnings,
    )?;
    *app_state = PersistedAppState::default();

    Ok(ApplicationResetResult::Reset { warnings })
}

fn select_project_disconnect_targets(
    app_state: &PersistedAppState,
    project_id: &str,
) -> Result<
    (
        usize,
        RegisteredProject,
        Vec<String>,
        Vec<WorkspaceCleanupTarget>,
    ),
    String,
> {
    let project_index = app_state
        .projects
        .iter()
        .position(|project| project.id == project_id)
        .ok_or_else(|| "project not found".to_string())?;
    let project = app_state.projects[project_index].clone();
    let mut workspace_ids = Vec::new();
    let mut workspaces = Vec::new();

    for workspace in app_state
        .open_workspaces
        .iter()
        .filter(|workspace| workspace.project_id == project.id)
    {
        workspace_ids.push(workspace.id.clone());
        workspaces.push(WorkspaceCleanupTarget {
            workspace: workspace.clone(),
            project: project.clone(),
        });
    }

    Ok((project_index, project, workspace_ids, workspaces))
}

fn all_workspace_targets(app_state: &PersistedAppState) -> Vec<WorkspaceCleanupTarget> {
    app_state
        .open_workspaces
        .iter()
        .filter_map(|workspace| {
            app_state
                .projects
                .iter()
                .find(|project| project.id == workspace.project_id)
                .map(|project| WorkspaceCleanupTarget {
                    workspace: workspace.clone(),
                    project: project.clone(),
                })
        })
        .collect()
}

fn workspace_discard_target(
    app_state: &PersistedAppState,
    workspace_id: &str,
) -> Result<WorkspaceCleanupTarget, String> {
    let mut target = workspace_cleanup_target(app_state, workspace_id)?;
    target.workspace.git_branch = observed_git_branch(target.project.kind, &target.workspace.root)
        .or(target.workspace.git_branch.clone());
    Ok(target)
}

fn workspace_cleanup_target(
    app_state: &PersistedAppState,
    workspace_id: &str,
) -> Result<WorkspaceCleanupTarget, String> {
    let workspace = app_state
        .open_workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .cloned()
        .ok_or_else(|| "workspace not found".to_string())?;
    let project = app_state
        .projects
        .iter()
        .find(|project| project.id == workspace.project_id)
        .cloned()
        .ok_or_else(|| "workspace project not found".to_string())?;
    Ok(WorkspaceCleanupTarget { workspace, project })
}

fn cleanup_targets_for_managed_workspaces(
    app_data_dir: &Path,
    targets: &[WorkspaceCleanupTarget],
) -> Vec<WorkspaceCleanupTarget> {
    targets
        .iter()
        .filter(|target| workspace_discardable(app_data_dir, &target.project, &target.workspace))
        .cloned()
        .collect()
}

fn confirm_dirty_then_close_runtime<F>(
    targets: &[WorkspaceCleanupTarget],
    confirm_dirty: bool,
    close_runtime: F,
) -> Result<Option<DirtyConfirmation>, String>
where
    F: FnOnce() -> Result<(), String>,
{
    if let Some(dirty_confirmation) = dirty_blocker(targets, confirm_dirty)? {
        return Ok(Some(dirty_confirmation));
    }

    close_runtime()?;

    dirty_blocker(targets, confirm_dirty)
}

fn dirty_blocker(
    targets: &[WorkspaceCleanupTarget],
    confirm_dirty: bool,
) -> Result<Option<DirtyConfirmation>, String> {
    let dirty_confirmation = dirty_confirmation_for_workspaces(targets)?;
    if confirm_dirty {
        Ok(None)
    } else {
        Ok(dirty_confirmation)
    }
}

fn close_terminal_workspaces(
    terminal_state: &TerminalState,
    targets: &[WorkspaceCleanupTarget],
) -> Result<(), String> {
    let workspaces = targets
        .iter()
        .map(|target| {
            (
                target.workspace.id.clone(),
                PathBuf::from(&target.workspace.root),
            )
        })
        .collect::<Vec<_>>();
    terminal_state.close_workspaces(&workspaces)
}

fn dirty_confirmation_for_workspaces(
    targets: &[WorkspaceCleanupTarget],
) -> Result<Option<DirtyConfirmation>, String> {
    let summaries = targets
        .iter()
        .filter_map(
            |target| match dirty_workspace_summary(&target.workspace.root) {
                Ok(Some(summary)) => Some(Ok(summary)),
                Ok(None) => None,
                Err(error) => Some(Err(error)),
            },
        )
        .collect::<Result<Vec<_>, _>>()?;

    if summaries.is_empty() {
        return Ok(None);
    }

    let changed_file_count = summaries
        .iter()
        .map(|summary| summary.changed_file_count)
        .sum();
    let sample_paths = summaries
        .iter()
        .flat_map(|summary| summary.sample_paths.clone())
        .take(10)
        .collect::<Vec<_>>();

    Ok(Some(DirtyConfirmation {
        dirty_workspace_count: summaries.len(),
        changed_file_count,
        sample_paths,
        message: "Uncommitted Workspace changes will be deleted.".to_string(),
    }))
}

fn remove_workspace_roots(
    app_data_dir: &Path,
    targets: &[WorkspaceCleanupTarget],
    force: bool,
    warnings: &mut Vec<String>,
) -> Result<(), String> {
    for target in targets {
        remove_workspace_root(app_data_dir, target, force, warnings)?;
    }
    Ok(())
}

fn remove_workspace_root(
    app_data_dir: &Path,
    target: &WorkspaceCleanupTarget,
    force: bool,
    warnings: &mut Vec<String>,
) -> Result<(), String> {
    let root = Path::new(&target.workspace.root);
    if !root.is_dir() {
        let _ = git_command_succeeds(&target.project.root, &["worktree", "prune"]);
        warnings.push(format!(
            "Workspace {} was already missing from disk.",
            target.workspace.name
        ));
        return Ok(());
    }

    if !workspace_discardable(app_data_dir, &target.project, &target.workspace) {
        return Err("workspace root is not managed by Fluidity".to_string());
    }

    run_workspace_discard_script(target, warnings);

    if Path::new(&target.project.root).is_dir() {
        let mut args = vec!["worktree", "remove"];
        if force {
            args.push("--force");
        }
        args.push(&target.workspace.root);
        run_git_command(&target.project.root, &args).map(|_| ())
    } else {
        fs::remove_dir_all(root).map_err(|error| error.to_string())
    }
}

pub(super) fn delete_workspace_branch_after_discard(
    target: &WorkspaceCleanupTarget,
    warnings: &mut Vec<String>,
) {
    if !target.project.settings.delete_workspace_branch_on_discard {
        return;
    }
    if target.project.kind != ProjectKind::Git {
        return;
    }

    let Some(branch) = target.workspace.git_branch.as_deref() else {
        return;
    };
    if branch.trim().is_empty() {
        return;
    }

    if !Path::new(&target.project.root).is_dir() {
        warnings.push(format!(
            "Local branch {branch} was kept because the Project root is unavailable."
        ));
        return;
    }

    if !local_git_branch_exists(&target.project.root, branch) {
        return;
    }

    if observed_git_branch(ProjectKind::Git, &target.project.root).as_deref() == Some(branch) {
        warnings.push(format!(
            "Local branch {branch} was kept because it is checked out in the Project root."
        ));
        return;
    }

    if let Err(error) = run_git_command(&target.project.root, &["branch", "-d", "--", branch]) {
        warnings.push(format!(
                "Local branch {branch} was kept because git did not consider it safe to delete: {error}"
            ));
    }
}

fn next_workspace_id_after_single_removal(
    app_state: &PersistedAppState,
    workspace_id: &str,
) -> Option<String> {
    let removed_index = app_state
        .workspace_stack
        .iter()
        .position(|id| id == workspace_id)?;
    let remaining = app_state
        .workspace_stack
        .iter()
        .filter(|id| id.as_str() != workspace_id)
        .collect::<Vec<_>>();

    remaining
        .get(removed_index)
        .or_else(|| remaining.last())
        .map(|workspace_id| (*workspace_id).clone())
}

pub(super) fn remove_workspaces_from_state(
    app_state: &mut PersistedAppState,
    workspace_ids: &[String],
) -> usize {
    let ids = workspace_ids.iter().cloned().collect::<HashSet<_>>();
    let original_workspace_count = app_state.open_workspaces.len();
    app_state
        .open_workspaces
        .retain(|workspace| !ids.contains(&workspace.id));
    app_state
        .workspace_stack
        .retain(|workspace_id| !ids.contains(workspace_id));
    original_workspace_count - app_state.open_workspaces.len()
}

fn local_git_branch_exists(root: &str, branch: &str) -> bool {
    local_git_branch_names(root)
        .map(|branches| branches.contains(branch))
        .unwrap_or(false)
}

fn workspace_discardable(
    app_data_dir: &Path,
    project: &RegisteredProject,
    workspace: &OpenWorkspace,
) -> bool {
    project.kind == ProjectKind::Git
        && managed_workspace_root(app_data_dir, Path::new(&workspace.root))
}

fn managed_workspace_root(app_data_dir: &Path, root: &Path) -> bool {
    let managed_root = app_data_dir.join("workspaces");
    if root.is_dir() {
        let Ok(root) = root.canonicalize() else {
            return false;
        };
        let Ok(managed_root) = managed_root.canonicalize() else {
            return false;
        };
        root.starts_with(managed_root)
    } else {
        root.starts_with(managed_root)
    }
}
