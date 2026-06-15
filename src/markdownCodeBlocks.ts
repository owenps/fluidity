import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import { useEffect, type RefObject } from "react";

const languageAliases: Record<string, string> = {
  bash: "shell",
  cjs: "javascript",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "shell",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
};

function normalizeMarkdownCodeBlockLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return "plaintext";
  return languageAliases[normalized] ?? normalized;
}

export function useMarkdownCodeBlockHighlighting<T extends HTMLElement>(
  previewRef: RefObject<T | null>,
  refreshKey: unknown,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || !previewRef.current) return;

    let canceled = false;
    const codeBlocks = [...previewRef.current.querySelectorAll("pre code")];

    codeBlocks.forEach((codeBlock) => {
      const languageClass = [...codeBlock.classList].find((className) =>
        className.startsWith("language-"),
      );
      const language = normalizeMarkdownCodeBlockLanguage(
        languageClass?.slice("language-".length) ?? "",
      );
      const code = codeBlock.textContent ?? "";

      void monaco.editor
        .colorize(code, language, {})
        .then((html) => {
          if (canceled) return;
          codeBlock.innerHTML = html;
          codeBlock.classList.add("markdown-code-highlighted");
        })
        .catch(() => undefined);
    });

    return () => {
      canceled = true;
    };
  }, [enabled, previewRef, refreshKey]);
}
