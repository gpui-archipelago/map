// Minimal URLSearchParams wrappers for hash params — keeps behavior identical
// to app.js (the first value of a repeated key wins; `+` decodes to a space).

export function parse(qs: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!qs) return params;
  for (const [k, v] of new URLSearchParams(qs)) params[k] = v;
  return params;
}

export function stringify(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}
