import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "monaco-editor/min/vs/editor/editor.main.css";
import { VimMode, initVimMode, type VimAdapterInstance } from "monaco-vim";
import { readCodeFile, writeCodeFile } from "./codeFileClient";

globalThis.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

const scratchPath = "code-editor-scratch.ts";
const scratchContents = `// Fluidity Code Editor
// Open a Workspace-relative file, edit, then save.
// Try Vim: h/j/k/l, w/b/e, gg/G, i/a/o, v, y, d, c, u, <C-r>, /, n/N.

interface EditorTile {
  engine: "monaco";
  vimMode: boolean;
  fileReadWrite: boolean;
}

const editorTile: EditorTile = {
  engine: "monaco",
  vimMode: true,
  fileReadWrite: true,
};

console.log(editorTile);
`;

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

export function CodeEditorTile({
  active,
  workspaceId,
  openFileRequest,
}: {
  active: boolean;
  workspaceId: string;
  openFileRequest?: CodeEditorOpenFileRequest;
}) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const activeRef = useRef(active);
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
      window.alert("Open a file before saving.");
      return;
    }

    try {
      const response = await writeCodeFile({
        workspaceId,
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

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!editorHostRef.current) return;

    monaco.editor.defineTheme("fluidity-code-editor", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#fafafa",
        "editorLineNumber.foreground": "#737373",
        "editorCursor.foreground": "#9bc6ff",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#1f3b57",
      },
    });

    registerVimWriteCommand();

    const saveActiveEditor = () => {
      if (activeRef.current) void saveCurrentFile();
    };
    window.addEventListener(vimWriteEventName, saveActiveEditor);

    const model = monaco.editor.createModel(
      scratchContents,
      "typescript",
      monaco.Uri.parse(`inmemory://fluidity/${scratchPath}`),
    );
    const editor = monaco.editor.create(editorHostRef.current, {
      model,
      automaticLayout: true,
      cursorBlinking: "smooth",
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      lineNumbersMinChars: 3,
      minimap: { enabled: false },
      padding: { top: 10, bottom: 10 },
      renderWhitespace: "selection",
      scrollBeyondLastLine: false,
      tabSize: 2,
      theme: "fluidity-code-editor",
      wordWrap: "on",
    });
    editorRef.current = editor;

    const vimMode: VimAdapterInstance = initVimMode(editor, statusRef.current);
    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (ignoreContentChangeRef.current) return;
      setDirty(true);
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
      contentDisposable.dispose();
      cursorDisposable.dispose();
      saveDisposable.dispose();
      window.removeEventListener(vimWriteEventName, saveActiveEditor);
      vimMode.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, []);

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
        editor.focus();
      } catch (error) {
        if (!cancelled) window.alert(`Open failed: ${String(error)}`);
      }
    };

    void openFile();
    return () => {
      cancelled = true;
    };
  }, [dirty, openFileRequest, workspaceId]);

  return (
    <div className="code-editor-tile">
      <div className="code-editor-tabstrip" aria-label="Editor tabs">
        <button className="code-editor-tab code-editor-tab-active" type="button">
          {openFile?.path ?? scratchPath}
          {dirty ? " ●" : ""}
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
