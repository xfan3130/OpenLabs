"use client";

import dynamic from "next/dynamic";

/**
 * The workspace runs entirely in the browser (it reads localStorage and
 * draws with Plotly), so it is rendered on the client only.
 */
const Workspace = dynamic(() => import("./Workspace"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground" role="status">
      Loading OpenLab…
    </div>
  ),
});

export function WorkspaceLoader() {
  return <Workspace />;
}
