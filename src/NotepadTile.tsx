import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import { useEffect, useMemo, useRef } from "react";
import { markdownTaskListPlugin } from "./markdownTaskLists";
import { CustomScrollbars } from "./ScrollArea";

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
markdown.use(markdownTaskListPlugin);

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

interface NotepadTileProps {
  active: boolean;
  focusToken: number;
  markdownEnabled: boolean;
  value: string;
  onChange: (value: string) => void;
}

function normalizeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return "plaintext";
  return languageAliases[normalized] ?? normalized;
}

export function NotepadTile({
  active,
  focusToken,
  markdownEnabled,
  value,
  onChange,
}: NotepadTileProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewVisible = markdownEnabled && !active;
  const previewHtml = useMemo(() => DOMPurify.sanitize(markdown.render(value)), [value]);

  useEffect(() => {
    if (active) textareaRef.current?.focus();
  }, [active, focusToken]);

  useEffect(() => {
    if (!previewVisible || !previewRef.current) return;

    let canceled = false;
    const codeBlocks = [...previewRef.current.querySelectorAll("pre code")];

    codeBlocks.forEach((codeBlock) => {
      const languageClass = [...codeBlock.classList].find((className) =>
        className.startsWith("language-"),
      );
      const language = normalizeLanguage(languageClass?.slice("language-".length) ?? "");
      const code = codeBlock.textContent ?? "";

      void monaco.editor
        .colorize(code, language, {})
        .then((html) => {
          if (canceled) return;
          codeBlock.innerHTML = html;
          codeBlock.classList.add("notepad-code-highlighted");
        })
        .catch(() => undefined);
    });

    return () => {
      canceled = true;
    };
  }, [previewHtml, previewVisible]);

  return (
    <div className="notepad-tile" data-active={active ? "true" : "false"}>
      {previewVisible ? (
        <>
          {value.trim() ? (
            <div
              ref={previewRef}
              className="notepad-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div ref={previewRef} className="notepad-preview notepad-preview-empty">
              Think here...
            </div>
          )}
          <CustomScrollbars viewportRef={previewRef} refreshKey={previewHtml} />
        </>
      ) : (
        <>
          <textarea
            ref={textareaRef}
            className="notepad-textarea"
            value={value}
            placeholder="Think here..."
            spellCheck
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <CustomScrollbars viewportRef={textareaRef} refreshKey={value} />
        </>
      )}
    </div>
  );
}
