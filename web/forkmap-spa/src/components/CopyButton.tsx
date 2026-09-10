// T-40 — the shared copy-to-clipboard control (the T-31/T-39 pattern, factored
// out of Configure's CodeShell for the Alignment rule rows): an inline
// copy-flash on the button itself plus a visually-hidden polite aria-live
// region announcing the outcome — a detached toast was rejected (recorded in
// the T-39 task Outcome). Copies the prop `text` (never a DOM node), so the
// payload lives in data and tests pin the exact bytes; the clipboard API is
// tried first, with a select-and-execCommand textarea fallback for
// non-secure hosts (same fallback semantics as CodeShell, minus the visible
// in-place selection — there is no text node to select).

import { useEffect, useRef, useState } from "react";

export function CopyButton({
  text,
  label = "copy",
  announce = "copied",
  className,
}: {
  text: string;
  label?: string;
  /** The polite live-region announcement on success. */
  announce?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const flash = (ok: boolean) => {
    setState(ok ? "ok" : "fail");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1400);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash(true);
      return;
    } catch {
      // fall through to the select + execCommand fallback
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    const sel = window.getSelection();
    const prevRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    if (prevRange && sel) {
      sel.removeAllRanges();
      sel.addRange(prevRange);
    }
    document.body.removeChild(ta);
    flash(ok);
  };

  const btnLabel =
    state === "ok" ? "copied ✓" : state === "fail" ? "press Ctrl/Cmd-C to copy" : label;
  return (
    <>
      <button
        type="button"
        className={`copy-btn${className ? ` ${className}` : ""}${state === "ok" ? " copied" : ""}`}
        title="copy the payload text"
        onClick={onCopy}
      >
        {btnLabel}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {state === "ok" ? announce : state === "fail" ? "copy failed — press Ctrl/Cmd-C to copy" : ""}
      </span>
    </>
  );
}
