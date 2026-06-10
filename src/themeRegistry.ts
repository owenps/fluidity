import type * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";

export const systemThemeId = "system";
export const darkThemeId = "fluidity-dark";
export const lightThemeId = "fluidity-light";
export const defaultThemeId = systemThemeId;

type CssVariableName = `--${string}`;

export interface AppTheme {
  id: string;
  title: string;
  cssVariables: Partial<Record<CssVariableName, string>>;
  codeEditor: monaco.editor.IStandaloneThemeData;
}

const darkCssVariables = {
  "--card": "#191919",
  "--ring": "#737373",
  "--input": "#525252",
  "--muted": "#262626",
  "--accent": "#404040",
  "--border": "#383838",
  "--popover": "#262626",
  "--primary": "#9bc6ff",
  "--sidebar": "#171717",
  "--secondary": "#262626",
  "--background": "#0a0a0a",
  "--foreground": "#fafafa",
  "--destructive": "#ff6467",
  "--card-foreground": "#fafafa",
  "--muted-foreground": "#a1a1a1",
  "--accent-foreground": "#fafafa",
  "--popover-foreground": "#fafafa",
  "--primary-foreground": "#171717",
  "--sidebar-foreground": "#fafafa",
  "--secondary-foreground": "#fafafa",
  "--destructive-foreground": "#262626",
  "--sidebar-accent": "#262626",
  "--sidebar-accent-foreground": "#fafafa",
  "--sidebar-border": "#383838",
  "--sidebar-primary": "#fafafa",
  "--sidebar-primary-foreground": "#171717",
  "--top-bar-background": "#191816",
  "--top-bar-foreground": "#a7a7a7",
  "--top-bar-border": "#2b2a29",
  "--top-bar-strong-foreground": "#cfcfcf",
  "--code-editor-chrome-background": "#151515",
  "--code-editor-tab-background": "#202020",
  "--code-editor-tab-active-background": "#0a0a0a",
  "--code-editor-border": "#2b2b2b",
  "--code-editor-foreground": "#fafafa",
  "--code-editor-muted-foreground": "#a1a1a1",
} as const satisfies Partial<Record<CssVariableName, string>>;

const lightCssVariables = {
  "--card": "#ffffff",
  "--ring": "#8c959f",
  "--input": "#d0d7de",
  "--muted": "#f6f8fa",
  "--accent": "#f6f8fa",
  "--border": "#d0d7de",
  "--popover": "#ffffff",
  "--primary": "#0969da",
  "--sidebar": "#f6f8fa",
  "--secondary": "#f6f8fa",
  "--background": "#ffffff",
  "--foreground": "#24292f",
  "--destructive": "#cf222e",
  "--card-foreground": "#24292f",
  "--muted-foreground": "#57606a",
  "--accent-foreground": "#24292f",
  "--popover-foreground": "#24292f",
  "--primary-foreground": "#ffffff",
  "--sidebar-foreground": "#24292f",
  "--secondary-foreground": "#24292f",
  "--destructive-foreground": "#ffffff",
  "--sidebar-accent": "#eaeef2",
  "--sidebar-accent-foreground": "#24292f",
  "--sidebar-border": "#d0d7de",
  "--sidebar-primary": "#24292f",
  "--sidebar-primary-foreground": "#ffffff",
  "--top-bar-background": "#f6f8fa",
  "--top-bar-foreground": "#57606a",
  "--top-bar-border": "#d0d7de",
  "--top-bar-strong-foreground": "#24292f",
  "--code-editor-chrome-background": "#f6f8fa",
  "--code-editor-tab-background": "#ffffff",
  "--code-editor-tab-active-background": "#ffffff",
  "--code-editor-border": "#d0d7de",
  "--code-editor-foreground": "#24292f",
  "--code-editor-muted-foreground": "#57606a",
} as const satisfies Partial<Record<CssVariableName, string>>;

export const builtInThemes = [
  {
    id: darkThemeId,
    title: "Dark",
    cssVariables: darkCssVariables,
    codeEditor: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8b949e", fontStyle: "italic" },
        { token: "identifier", foreground: "c9d1d9" },
        { token: "identifier.variable", foreground: "c9d1d9" },
        { token: "identifier.property", foreground: "79c0ff" },
        { token: "identifier.type", foreground: "ffa657" },
        { token: "identifier.type.builtin", foreground: "ffa657" },
        { token: "constant", foreground: "79c0ff" },
        { token: "constant.language", foreground: "79c0ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "number.float", foreground: "79c0ff" },
        { token: "number.hex", foreground: "79c0ff" },
        { token: "string", foreground: "a5d6ff" },
        { token: "string.escape", foreground: "d2a8ff" },
        { token: "keyword", foreground: "ff7b72" },
        { token: "keyword.function", foreground: "ff7b72" },
        { token: "operator", foreground: "ff7b72" },
        { token: "delimiter", foreground: "c9d1d9" },
        { token: "delimiter.member", foreground: "6e7681" },
        { token: "delimiter.punctuation", foreground: "8b949e" },
        { token: "delimiter.parenthesis", foreground: "79c0ff" },
        { token: "delimiter.square", foreground: "d2a8ff" },
        { token: "delimiter.curly", foreground: "ff7b72" },
        { token: "namespace", foreground: "d2a8ff" },
        { token: "type", foreground: "ffa657" },
        { token: "struct", foreground: "ffa657" },
        { token: "class", foreground: "ffa657" },
        { token: "function", foreground: "d2a8ff" },
        { token: "function.call", foreground: "d2a8ff" },
        { token: "function.declaration", foreground: "d2a8ff" },
        { token: "function.builtin", foreground: "79c0ff" },
        { token: "method", foreground: "d2a8ff" },
        { token: "variable", foreground: "c9d1d9" },
        { token: "parameter", foreground: "ffa657" },
        { token: "regexp", foreground: "7ee787" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#c9d1d9",
        "editorGutter.background": "#0a0a0a",
        "minimap.background": "#0a0a0a",
        "editorLineNumber.foreground": "#6e7681",
        "editorLineNumber.activeForeground": "#c9d1d9",
        "editorCursor.foreground": "#c9d1d9",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#264f7855",
        "editor.lineHighlightBackground": "#161b22",
        "editorIndentGuide.background1": "#21262d",
        "editorIndentGuide.activeBackground1": "#30363d",
        "editorWhitespace.foreground": "#30363d",
        "editor.findMatchBackground": "#9e6a0366",
        "editor.findMatchHighlightBackground": "#9e6a0333",
        "editorBracketMatch.background": "#3fb95033",
        "editorBracketMatch.border": "#3fb950",
        "editorWidget.background": "#161b22",
        "editorWidget.border": "#30363d",
        "input.background": "#0a0a0a",
        "input.foreground": "#c9d1d9",
        "input.border": "#30363d",
      },
    },
  },
  {
    id: lightThemeId,
    title: "Light",
    cssVariables: lightCssVariables,
    codeEditor: {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6e7781", fontStyle: "italic" },
        { token: "identifier", foreground: "24292f" },
        { token: "identifier.variable", foreground: "24292f" },
        { token: "identifier.property", foreground: "0550ae" },
        { token: "identifier.type", foreground: "953800" },
        { token: "identifier.type.builtin", foreground: "953800" },
        { token: "constant", foreground: "0550ae" },
        { token: "constant.language", foreground: "0550ae" },
        { token: "number", foreground: "0550ae" },
        { token: "number.float", foreground: "0550ae" },
        { token: "number.hex", foreground: "0550ae" },
        { token: "string", foreground: "0a3069" },
        { token: "string.escape", foreground: "8250df" },
        { token: "keyword", foreground: "cf222e" },
        { token: "keyword.function", foreground: "cf222e" },
        { token: "operator", foreground: "cf222e" },
        { token: "delimiter", foreground: "24292f" },
        { token: "delimiter.member", foreground: "8c959f" },
        { token: "delimiter.punctuation", foreground: "57606a" },
        { token: "delimiter.parenthesis", foreground: "0550ae" },
        { token: "delimiter.square", foreground: "8250df" },
        { token: "delimiter.curly", foreground: "cf222e" },
        { token: "namespace", foreground: "8250df" },
        { token: "type", foreground: "953800" },
        { token: "struct", foreground: "953800" },
        { token: "class", foreground: "953800" },
        { token: "function", foreground: "8250df" },
        { token: "function.call", foreground: "8250df" },
        { token: "function.declaration", foreground: "8250df" },
        { token: "function.builtin", foreground: "0550ae" },
        { token: "method", foreground: "8250df" },
        { token: "variable", foreground: "24292f" },
        { token: "parameter", foreground: "953800" },
        { token: "regexp", foreground: "116329" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#24292f",
        "editorGutter.background": "#ffffff",
        "minimap.background": "#ffffff",
        "editorLineNumber.foreground": "#8c959f",
        "editorLineNumber.activeForeground": "#24292f",
        "editorCursor.foreground": "#24292f",
        "editor.selectionBackground": "#0969da33",
        "editor.inactiveSelectionBackground": "#0969da1f",
        "editor.lineHighlightBackground": "#f6f8fa",
        "editorIndentGuide.background1": "#d0d7de",
        "editorIndentGuide.activeBackground1": "#8c959f",
        "editorWhitespace.foreground": "#d0d7de",
        "editor.findMatchBackground": "#bf870066",
        "editor.findMatchHighlightBackground": "#bf870033",
        "editorBracketMatch.background": "#1a7f3733",
        "editorBracketMatch.border": "#1a7f37",
        "editorWidget.background": "#ffffff",
        "editorWidget.border": "#d0d7de",
        "input.background": "#ffffff",
        "input.foreground": "#24292f",
        "input.border": "#d0d7de",
      },
    },
  },
] as const satisfies readonly AppTheme[];

export type ThemeId = string;

const themeById = new Map<string, AppTheme>(builtInThemes.map((theme) => [theme.id, theme]));

export function normalizeThemeId(value: unknown): ThemeId {
  if (value === systemThemeId) return systemThemeId;
  return typeof value === "string" && themeById.has(value) ? value : defaultThemeId;
}

export function themeOptions() {
  return [
    { id: systemThemeId, title: "System" },
    ...builtInThemes.map((theme) => ({ id: theme.id, title: theme.title })),
  ];
}

export function resolvedThemeId(themeId: ThemeId): ThemeId {
  const normalizedThemeId = normalizeThemeId(themeId);
  if (normalizedThemeId !== systemThemeId) return normalizedThemeId;
  return systemPrefersDark() ? darkThemeId : lightThemeId;
}

export function applyThemeToDocument(themeId: ThemeId, root = document.documentElement) {
  const resolved = resolvedThemeId(themeId);
  const theme = themeById.get(resolved) ?? themeById.get(darkThemeId)!;
  root.dataset.theme = normalizeThemeId(themeId);
  root.dataset.resolvedTheme = resolved;
  root.classList.toggle("dark", resolved === darkThemeId);
  document.body.classList.toggle("dark", resolved === darkThemeId);
  for (const [name, value] of Object.entries(theme.cssVariables)) {
    if (value) root.style.setProperty(name, value);
  }
}

export function onSystemThemeChange(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

let codeEditorThemesRegistered = false;

export function registerCodeEditorThemes(monacoEditor: typeof monaco.editor) {
  if (codeEditorThemesRegistered) return;
  for (const theme of builtInThemes) {
    monacoEditor.defineTheme(theme.id, theme.codeEditor);
  }
  codeEditorThemesRegistered = true;
}
