// T-39 — study-aware doc link (the study reader's trigger).
//
// An anchor that keeps the static site's href/class/text exactly (parity:
// same DOM, same ids, same outbound URL if the page ever navigates there),
// but for the five study docs a plain left click opens the in-page excerpt
// dialog instead of navigating away (decision (a)-lite). Modifier clicks
// (Ctrl/Cmd/Shift/Middle) and right-clicks keep browser defaults so the doc
// can still be opened in a new tab; non-study doc links (docs 02/04, the
// data README, …) stay plain outbound anchors — the modal is only for the
// five studies.

import { useState, type MouseEvent, type ReactNode } from "react";
import { DOCS, isStudyDoc } from "../content/docs";
import { StudyModal } from "./StudyModal";

export function StudyDocLink({
  num,
  href,
  className,
  children,
}: {
  num: number | string;
  href?: string;
  className?: string;
  children?: ReactNode;
}) {
  const key = String(num);
  const doc = DOCS[key];
  const study = isStudyDoc(key);
  const [open, setOpen] = useState(false);
  if (!doc) return null;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!study) return;
    // Browser-default navigation wins for anything but a plain left click.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <a
        className={className ?? "doc"}
        href={href ?? doc.path}
        aria-haspopup={study ? "dialog" : undefined}
        onClick={onClick}
      >
        {children ?? doc.title}
      </a>
      {open && study && <StudyModal num={key} href={href ?? doc.path} onClose={() => setOpen(false)} />}
    </>
  );
}
