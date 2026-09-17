// T-39 — doc link with the reader attached (study reader, since extended to
// every published doc).
//
// An anchor that keeps the static site's href/class/text exactly (parity:
// same DOM, same ids, same outbound URL if the page ever navigates there),
// but for a published doc a plain left click opens the in-page reader instead
// of navigating away. Modifier clicks (Ctrl/Cmd/Shift/Middle) and right-clicks
// keep browser defaults so the markdown source can still be opened in a new
// tab; a doc outside the published set stays a plain outbound anchor.

import { useState, type MouseEvent, type ReactNode } from "react";
import { DOCS, hasReader } from "../content/docs";
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
  const reader = hasReader(key);
  const [open, setOpen] = useState(false);
  if (!doc) return null;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!reader) return;
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
        aria-haspopup={reader ? "dialog" : undefined}
        onClick={onClick}
      >
        {children ?? doc.title}
      </a>
      {open && reader && <StudyModal num={key} onClose={() => setOpen(false)} />}
    </>
  );
}
