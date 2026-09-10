// T-39 — the study reader (design decision (a)-lite, recorded in the T-39
// task file): an in-app dialog that keeps a study's context without leaving
// the page. It shows the doc's opening excerpt — verbatim from the repo
// markdown, never a site-written summary (see src/study/excerpt.ts) — plus
// the outbound "read the full doc" link the static site always had, so
// nothing is duplicated and nothing drifts silently: the excerpt is a
// diff-checked snapshot (bun test regenerates + compares), and the full doc
// stays the source of truth.
//
// A11y shape (T-38 discipline): role="dialog" + aria-modal, labelled by the
// doc title, Escape closes, focus moves to the close button on open and
// returns to the trigger on close, Tab is trapped inside the dialog, and the
// page scroll is locked while it is open. The by-ear pass for the reader
// (announcement/verbosity with a real screen reader) is part of the
// increment-5/6 manual verification recorded in the task Outcome.

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { DOCS } from "../content/docs";
import { STUDY_EXCERPTS } from "../study/study-excerpts";

export function StudyModal({ num, href, onClose }: { num: number | string; href: string; onClose: () => void }) {
  const key = String(num);
  const doc = DOCS[key];
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const excerpt = STUDY_EXCERPTS[key];

  // Focus in + out, Escape, and the scroll lock — client-side only (the
  // server render of an open modal is inert markup for the parity tests).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
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

  if (!doc || !excerpt) return null;

  // Trap Tab inside the dialog (a real screen reader + keyboard pass is the
  // recorded manual step; the mechanical wrap keeps focus from escaping into
  // the page behind the overlay meanwhile).
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

  // Same modifier-click rule as the triggers: a plain click on the full-doc
  // link navigates away (and the modal unmounts with the page); a
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-modal-title"
        onKeyDown={onDialogKeyDown}
      >
        <p className="study-kicker mono" id="study-modal-kicker">{`doc ${key} · study excerpt`}</p>
        <h2 id="study-modal-title">{doc.title}</h2>
        <p className="study-excerpt" id="study-modal-excerpt">
          {excerpt}
        </p>
        <p className="subnote" id="study-modal-note">
          {"Excerpt snapshot of the doc's opening (diff-checked against the repo doc at build/test). The full doc is the source of truth — it holds the tables, evidence paths and links this excerpt leaves out."}
        </p>
        <div className="study-actions">
          <a
            className="study-open"
            id="study-modal-open"
            href={href}
            onClick={onOpenClick}
            title="open the markdown study doc (new tab: Ctrl/Cmd-click)"
          >
            {"Read the full doc"}
          </a>
          <button type="button" className="study-close" id="study-modal-close" ref={closeRef} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
