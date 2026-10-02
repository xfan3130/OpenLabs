"use client";

import { useEffect, useRef, useState } from "react";
import type { Config, PlotlyHTMLElement } from "plotly.js";
import type { Figure } from "@/lib/plotting";
import { cn } from "@/utils/cn";

type PlotlyModule = typeof import("plotly.js");

let plotlyPromise: Promise<PlotlyModule> | null = null;

/** Load Plotly once, on the client only (it needs `window`). */
export function loadPlotly(): Promise<PlotlyModule> {
  if (!plotlyPromise) {
    plotlyPromise = import("plotly.js-dist-min").then((m) => m.default);
  }
  return plotlyPromise;
}

/**
 * Thin React wrapper around Plotly.react: re-renders the figure whenever it
 * changes, resizes with its container, and cleans up on unmount.
 */
export function PlotlyChart({
  figure,
  config,
  className,
  ariaLabel,
  onReady,
}: {
  figure: Figure;
  config: Partial<Config>;
  className?: string;
  ariaLabel: string;
  /** Receives the Plotly graph element once drawn (null on unmount). */
  onReady?: (element: PlotlyHTMLElement | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    loadPlotly()
      .then((Plotly) => {
        if (cancelled) return;
        const fontFamily = getComputedStyle(el).fontFamily;
        const layout = {
          ...figure.layout,
          font: { ...figure.layout.font, family: fontFamily },
        };
        return Plotly.react(el, figure.data, layout, config).then((gd) => {
          if (!cancelled) onReadyRef.current?.(gd);
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "The graph could not be drawn.");
      });
    return () => {
      cancelled = true;
    };
  }, [figure, config]);

  // Keep the plot sized to its container.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        loadPlotly().then((Plotly) => {
          if (el.isConnected && (el as Partial<PlotlyHTMLElement>).layout) Plotly.Plots.resize(el);
        });
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // Release Plotly's resources when the chart goes away.
  useEffect(() => {
    const el = ref.current;
    return () => {
      onReadyRef.current?.(null);
      if (el) loadPlotly().then((Plotly) => Plotly.purge(el));
    };
  }, []);

  if (error) {
    return (
      <div className={cn("flex items-center justify-center p-6 text-sm text-destructive", className)} role="alert">
        {error}
      </div>
    );
  }
  return <div ref={ref} role="figure" aria-label={ariaLabel} className={cn("h-full w-full", className)} />;
}
