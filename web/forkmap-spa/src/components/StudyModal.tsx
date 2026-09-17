// T-39 — the doc reader (design decision (a)-lite, since extended): an in-app
// dialog that keeps a doc's context without leaving the page. It fetches the
// doc's own markdown from the artifact's docs/ mirror
// (`docs/04-user-docs/NN-….md` — see src/study/loader.ts) and renders it in
// place, verbatim, under the rules in src/study/markdown.ts. Nothing is
// summarized and nothing is inlined into a chunk: the doc stays the source of
// truth, and it is fetched only when someone opens it.
//
// The dialog opens on any published doc (hasReader in src/content/docs.ts).
// While the fetch is in flight it shows the doc's diff-checked opening excerpt
// (src/study/study-excerpts.ts) where one exists, so the reader has real
// content immediately instead of a spinner; on failure it says so and leaves
// the raw-markdown link as the escape hatch.
//
// Links inside the doc keep the reader's one rule: a plain click stays in the
// reader (a doc link swaps the doc, a `#anchor` scrolls to the section), while
// a modifier click still opens the markdown source the link names — the same
// contract the study triggers have. The two in-doc anchors doc 08 ships are
// truncated and match no full heading slug, so anchors resolve by prefix and
// land on the section rather than jumping nowhere.
//
// A11y shape (T-38 discipline): role="dialog" + aria-modal, labelled by the
// doc title, Escape closes, focus moves into the dialog on open and returns to
// the trigger on close, Tab is trapped inside it, and the page scroll is
// locked while it is open. The dialog itself takes focus rather than its Close
// button: the body is a whole document now, and focusing the last control
// would open the reader scrolled to its end.

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { DOCS } from "../content/docs";
import { STUDY_EXCERPTS } from "../study/study-excerpts";
import { fetchDocMarkdown } from "../study/loader";
import { renderDocMarkdown } from "../study/markdown";

type Status = "loading" | "ready" | "error";

export function StudyModal({ num, onClose }: { num: number | string; onClose: () => void }) {
  // The doc being read — it starts at the trigger's doc and follows in-doc
  // links from there.
  const [key, setKey] = useState(() => String(num));
  const [status, setStatus] = useState<Status>("loading");
  const [html, setHtml] = useState("");
  const doc = DOCS[key];
  const excerpt = STUDY_EXCERPTS[key];
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Focus in + out, Escape, and the scroll lock — client-side only (the
  // server render of an open dialog is inert markup for the parity tests).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  // Fetch + render the doc, re-running whenever the reader moves to another
  // doc. An aborted run (another doc opened, or the dialog closed) never
  // writes state.
  useEffect(() => {
    const path = DOCS[key]?.path;
    if (!path) return;
    const controller = new AbortController();
    setStatus("loading");
    setHtml("");
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    void (async () => {
      try {
        const markdown = await fetchDocMarkdown(path, controller.signal);
        const rendered = await renderDocMarkdown(markdown, path);
        if (controller.signal.aborted) return;
        setHtml(rendered);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [key]);

  if (!doc) return null;

  // Trap Tab inside the dialog (the mechanical wrap keeps focus from escaping
  // into the page behind the overlay; the by-ear/keyboard pass is the recorded
  // manual step).
  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const d = dialogRef.current;
    if (!d) return;
    const focusables = d.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Follow a doc's own anchor: the heading ids are GFM slugs
  // (src/study/markdown.ts rule 2), and the docs' own anchors are sometimes
  // truncated, so a full-match miss falls back to a prefix match.
  const scrollToAnchor = (slug: string) => {
    const root = bodyRef.current;
    if (!root || !slug) return;
    const target =
      root.querySelector<HTMLElement>(`[id="${slug}"]`) ??
      root.querySelector<HTMLElement>(`[id^="${slug}"]`);
    target?.scrollIntoView({ block: "start" });
  };

  // A plain click on a link inside the doc stays in the reader; anything with
  // a modifier keeps the browser default (the markdown source the link names).
  const onBodyClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest("a");
    if (!link) return;
    const nextDoc = link.getAttribute("data-doc");
    if (nextDoc) {
      e.preventDefault();
      setKey(nextDoc);
      return;
    }
    const slug = link.getAttribute("data-anchor");
    if (slug) {
      e.preventDefault();
      scrollToAnchor(slug);
    }
  };

  // Same modifier-click rule as the triggers: a plain click on the raw link
  // navigates away (and the dialog unmounts with the page); a
  // Ctrl/Cmd/Shift/Middle click keeps browser defaults (new tab / save).
  const onOpenClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    onClose();
  };

  return (
    <div
      className="study-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="study-dialog"
        id="study-modal"
        ref={dialogRef}
        tabIndex={-1}
        data-doc={key}
        data-doc-status={status}
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-modal-title"
        onKeyDown={onDialogKeyDown}
      >
        <p className="study-kicker mono" id="study-modal-kicker">{doc.path}</p>
        <h2 id="study-modal-title">{doc.title}</h2>
        {status === "ready" ? (
          <div
            className="study-doc"
            id="study-modal-body"
            ref={bodyRef}
            onClick={onBodyClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="study-doc" id="study-modal-body" ref={bodyRef}>
            {status === "error" ? (
              <p className="study-failed" id="study-modal-status">
                {"Could not load the doc. The markdown link below still opens the source."}
              </p>
            ) : excerpt ? (
              <p className="study-excerpt" id="study-modal-excerpt">
                {excerpt}
              </p>
            ) : (
              <p className="study-loading">{"Reading the doc…"}</p>
            )}
          </div>
        )}
        {status !== "error" && (
          <p className="subnote" id="study-modal-note">
            {"Rendered verbatim from the repo markdown — nothing here is summarized."}
          </p>
        )}
        <div className="study-actions">
          <a
            className="study-open"
            id="study-modal-open"
            href={doc.path}
            onClick={onOpenClick}
            title="open the markdown source (new tab: Ctrl/Cmd-click)"
          >
            {"Raw markdown ↗"}
          </a>
          <button type="button" className="study-close" id="study-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
