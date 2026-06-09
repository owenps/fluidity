import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "monaco-editor/min/vs/editor/editor.main.css";
import { VimMode, initVimMode, type VimAdapterInstance } from "monaco-vim";
import { registerCodeEditorThemes, type ThemeId } from "./themeRegistry";
import { readCodeFile, writeCodeFile } from "./codeFileClient";
import { fileIconForPath } from "./fileIcons";
import type { CodeEditorSettings } from "./types";

globalThis.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

const vimWriteEventName = "fluidity://code-editor-write";
let vimWriteCommandRegistered = false;

interface OpenFileState {
  path: string;
  version: string;
}

export interface CodeEditorOpenFileRequest {
  path: string;
  token: number;
}

function registerVimWriteCommand() {
  if (vimWriteCommandRegistered) return;
  const vimApi = (
    VimMode as unknown as {
      Vim?: { defineEx?: (name: string, prefix: string, run: () => void) => void };
    }
  ).Vim;
  vimApi?.defineEx?.("write", "w", () => {
    window.dispatchEvent(new Event(vimWriteEventName));
  });
  vimWriteCommandRegistered = true;
}

function tabTitleForFile(file: OpenFileState | null, mode: CodeEditorSettings["tabTitleMode"]) {
  const path = file?.path ?? "untitled";
  if (mode === "path") return path;
  return path.split(/[\\/]/).pop() ?? path;
}

export function CodeEditorTile({
  active,
  workspaceId,
  themeId,
  settings,
  openFileRequest,
  onFileVisited,
}: {
  active: boolean;
  workspaceId: string;
  themeId: ThemeId;
  settings: CodeEditorSettings;
  openFileRequest?: CodeEditorOpenFileRequest;
  onFileVisited?: (path: string) => void;
}) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const vimModeRef = useRef<VimAdapterInstance | null>(null);
  const activeRef = useRef(active);
  const workspaceIdRef = useRef(workspaceId);
  const settingsRef = useRef(settings);
  const autoSaveTimerRef = useRef<number | null>(null);
  const openFileRef = useRef<OpenFileState | null>(null);
  const ignoreContentChangeRef = useRef(false);
  const handledOpenFileRequestTokenRef = useRef<number | null>(null);
  const [openFile, setOpenFile] = useState<OpenFileState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });

  const setCurrentOpenFile = (file: OpenFileState | null) => {
    openFileRef.current = file;
    setOpenFile(file);
  };

  const saveCurrentFile = async () => {
    const file = openFileRef.current;
    const editor = editorRef.current;
    if (!file || !editor) {
      window.alert("Select a file with Cmd+P before saving.");
      return;
    }

    try {
      const response = await writeCodeFile({
        workspaceId: workspaceIdRef.current,
        path: file.path,
        contents: editor.getValue(),
        expectedVersion: file.version,
      });
      setCurrentOpenFile(response);
      setDirty(false);
    } catch (error) {
      window.alert(`Save failed: ${String(error)}`);
    }
  };

  const scheduleAutoSave = () => {
    if (!openFileRef.current) return;
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void saveCurrentFile();
    }, 1000);
  };

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!editorHostRef.current) return;

    registerCodeEditorThemes(monaco.editor);
    registerVimWriteCommand();

    const saveActiveEditor = () => {
      if (activeRef.current) void saveCurrentFile();
    };
    window.addEventListener(vimWriteEventName, saveActiveEditor);

    const editor = monaco.editor.create(editorHostRef.current, {
      value: "",
      automaticLayout: true,
      cursorBlinking: "smooth",
      fontFamily: "var(--font-mono)",
      fontSize: settings.fontSize,
      folding: settings.lineNumbersVisible,
      glyphMargin: false,
      lineDecorationsWidth: settings.lineNumbersVisible ? 10 : "1ch",
      lineNumbers: settings.lineNumbersVisible ? "on" : "off",
      lineNumbersMinChars: settings.lineNumbersVisible ? 3 : 0,
      minimap: { enabled: settings.minimapVisible },
      padding: { top: 10, bottom: 10 },
      renderWhitespace: "selection",
      scrollBeyondLastLine: false,
      tabSize: settings.tabSize,
      theme: themeId,
      wordWrap: settings.wordWrap ? "on" : "off",
      bracketPairColorization: { enabled: settings.bracketPairColorization },
      stickyScroll: { enabled: settings.stickyScroll },
    });
    editorRef.current = editor;

    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (ignoreContentChangeRef.current) return;
      setDirty(true);
      if (settingsRef.current.autoSave === "afterDelay") scheduleAutoSave();
    });
    const blurDisposable = editor.onDidBlurEditorWidget(() => {
      if (settingsRef.current.autoSave === "onFocusChange" && openFileRef.current) {
        void saveCurrentFile();
      }
    });
    const cursorDisposable = editor.onDidChangeCursorPosition((event) => {
      setCursorPosition(event.position);
    });
    const saveDisposable = editor.addAction({
      id: "fluidity.editorSave",
      label: "Save",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => saveCurrentFile(),
    });

    return () => {
      if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
      contentDisposable.dispose();
      blurDisposable.dispose();
      cursorDisposable.dispose();
      saveDisposable.dispose();
      window.removeEventListener(vimWriteEventName, saveActiveEditor);
      const model = editor.getModel();
      vimModeRef.current?.dispose();
      vimModeRef.current = null;
      editor.dispose();
      model?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (settings.vimMode && !vimModeRef.current) {
      vimModeRef.current = initVimMode(editor, statusRef.current);
      return;
    }
    if (!settings.vimMode && vimModeRef.current) {
      vimModeRef.current.dispose();
      vimModeRef.current = null;
      if (statusRef.current) statusRef.current.textContent = "";
    }
  }, [settings.vimMode]);

  useEffect(() => {
    monaco.editor.setTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      folding: settings.lineNumbersVisible,
      lineDecorationsWidth: settings.lineNumbersVisible ? 10 : "1ch",
      lineNumbers: settings.lineNumbersVisible ? "on" : "off",
      lineNumbersMinChars: settings.lineNumbersVisible ? 3 : 0,
      minimap: { enabled: settings.minimapVisible },
      fontSize: settings.fontSize,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? "on" : "off",
      bracketPairColorization: { enabled: settings.bracketPairColorization },
      stickyScroll: { enabled: settings.stickyScroll },
    });
  }, [settings]);

  useEffect(() => {
    if (active) editorRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!openFileRequest || !workspaceId) return;
    if (handledOpenFileRequestTokenRef.current === openFileRequest.token) return;
    if (dirty && !window.confirm("Discard unsaved editor changes and open another file?")) return;
    handledOpenFileRequestTokenRef.current = openFileRequest.token;

    let cancelled = false;
    const openFile = async () => {
      try {
        const response = await readCodeFile({ workspaceId, path: openFileRequest.path });
        if (cancelled) return;
        const editor = editorRef.current;
        if (!editor) return;
        ignoreContentChangeRef.current = true;
        editor.setValue(response.contents);
        ignoreContentChangeRef.current = false;
        setCurrentOpenFile(response);
        setDirty(false);
        onFileVisited?.(response.path);
        editor.focus();
      } catch (error) {
        if (!cancelled) window.alert(`Open failed: ${String(error)}`);
      }
    };

    void openFile();
    return () => {
      cancelled = true;
    };
  }, [dirty, onFileVisited, openFileRequest, workspaceId]);

  const tabTitle = tabTitleForFile(openFile, settings.tabTitleMode);

  return (
    <div className="code-editor-tile">
      <div className="code-editor-tabstrip" aria-label="Editor tabs">
        <button
          className="code-editor-tab code-editor-tab-active"
          type="button"
          title={openFile?.path}
        >
          <span className="code-editor-tab-icon" aria-hidden="true">
            {fileIconForPath(openFile?.path ?? "untitled")}
          </span>
          <span className="code-editor-tab-title">
            {tabTitle}
            {dirty ? " ●" : ""}
          </span>
        </button>
      </div>
      <div ref={editorHostRef} className="code-editor-host" />
      <div className="code-editor-statusline">
        <div ref={statusRef} className="code-editor-vim-status" />
        <span className="code-editor-cursor-position">
          {cursorPosition.lineNumber}:{cursorPosition.column}
        </span>
      </div>
    </div>
  );
}
