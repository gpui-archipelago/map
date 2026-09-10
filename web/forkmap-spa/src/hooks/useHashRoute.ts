// T-39 — hash-route state hook. The hash is the single source of view state
// (the v1 deep-link + T-38 back-param compatibility contract): changing the
// hash re-renders, and every rendered state stays linkable/bookmarkable.

import { useEffect, useState } from "react";
import { parseHash, type Route } from "../routing";

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash.replace(/^#/, "")));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash.replace(/^#/, "")));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}
