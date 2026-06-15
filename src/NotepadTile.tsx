import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { useEffect, useMemo, useRef } from "react";
import { useMarkdownCodeBlockHighlighting } from "./markdownCodeBlocks";
import { markdownTaskListPlugin } from "./markdownTaskLists";
import { CustomScrollbars } from "./ScrollArea";

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
markdown.use(markdownTaskListPlugin);

interface NotepadTileProps {
  active: boolean;
  focusToken: number;
  markdownEnabled: boolean;
  value: string;
  onChange: (value: string) => void;
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

  useMarkdownCodeBlockHighlighting(previewRef, previewHtml, previewVisible);

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
