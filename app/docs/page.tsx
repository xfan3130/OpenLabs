import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ALLOWED_FUNCTIONS } from "@/lib/expressionNames";

export const metadata: Metadata = {
  title: "Documentation",
  description: "How to use OpenLab: importing CSV data, graphing, statistics, curve fitting, uncertainties, calculated columns and derivatives.",
};

const SECTIONS = [
  { id: "start", title: "Getting started" },
  { id: "csv", title: "CSV format" },
  { id: "graph", title: "Graphing" },
  { id: "statistics", title: "Statistics" },
  { id: "fitting", title: "Curve fitting" },
  { id: "uncertainty", title: "Uncertainty" },
  { id: "calculated", title: "Calculated columns" },
  { id: "derivative", title: "Numerical derivatives" },
  { id: "export", title: "Exporting results" },
  { id: "privacy", title: "Where your data lives" },
];

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 border-b border-border pb-2 pt-10 text-xl font-semibold tracking-tight first:pt-0">
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-7 text-foreground/90">{children}</p>;
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border bg-panel px-4 py-3 font-mono text-[13.5px] leading-7">
      {children}
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">{children}</code>;
}

function List({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[15px] leading-7 text-foreground/90">{children}</ul>;
}

export default function DocsPage() {
  return (
    <div className="min-h-dvh bg-card">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-4 border-b border-border bg-card/95 px-4 backdrop-blur">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <Logo />
        </Link>
        <span className="text-sm text-muted-foreground">Documentation</span>
        <Link
          href="/"
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ArrowLeft className="size-4" /> Back to the workspace
        </Link>
      </header>

      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-10 sm:px-6">
        <nav aria-label="On this page" className="sticky top-20 hidden h-fit w-52 shrink-0 lg:block">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">On this page</p>
          <ul className="flex flex-col gap-1 text-[13px]">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-3xl flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">OpenLab documentation</h1>
          <P>
            OpenLab is a free, browser-based tool for analysing lab data: import a table of measurements, graph it, compute
            statistics, fit models, and report results with uncertainties. This page explains how to use it and exactly how
            every number is calculated.
          </P>

          <H2 id="start">Getting started</H2>
          <List>
            <li>
              Click <strong>Import CSV</strong> (or drag a file onto the window) and pick a CSV file, or paste cells copied
              from a spreadsheet. To explore first, open a sample such as <em>Constant Acceleration Motion</em>.
            </li>
            <li>
              In <strong>Variables</strong>, choose the X axis and tick one or more Y variables. The graph updates
              immediately.
            </li>
            <li>
              Under <strong>Curve fit</strong>, choose a model. The fitted equation, parameters with standard errors and R²
              appear on the right, and the best-fit curve is drawn on the graph.
            </li>
            <li>
              Enter <strong>Measurement uncertainty</strong> to draw error bars, then use <strong>Export</strong> to download
              the graph, the data and the results for your report.
            </li>
          </List>

          <H2 id="csv">CSV format</H2>
          <P>One column per variable, one row per measurement. A header row is optional but recommended:</P>
          <Formula>
            <pre>{`time (s),position (m)
0,0
0.1,0.06
0.2,0.21
0.3,0.45
0.4,0.82`}</pre>
          </Formula>
          <List>
            <li>
              <strong>Headers</strong> are detected automatically. Units in parentheses or brackets — <Code>time (s)</Code>,{" "}
              <Code>Velocity [m/s]</Code> — become the column unit. Without a header, columns are named Column 1, Column 2, …
            </li>
            <li>
              <strong>Separators:</strong> comma, tab, semicolon or pipe (detected automatically).
            </li>
            <li>
              <strong>Numbers</strong> must use a decimal point (<Code>0.25</Code>, not <Code>0,25</Code>). Scientific
              notation (<Code>6.02e23</Code>) and the Unicode minus sign are accepted.
            </li>
            <li>
              <strong>Missing values:</strong> empty cells and <Code>NA</Code>, <Code>N/A</Code>, <Code>NaN</Code>,{" "}
              <Code>null</Code>, <Code>-</Code> are treated as missing. Missing values are skipped by every calculation —
              never treated as zero.
            </li>
            <li>
              A column is <strong>numeric</strong> when at least 80 % of its non-empty cells are numbers; the remaining cells
              are reported and treated as missing. Other columns are kept as text and shown in the data table.
            </li>
            <li>
              <strong>Malformed rows</strong> are repaired and reported: rows with too few fields are padded with blanks,
              extra fields are ignored. Blank lines and lines starting with <Code>#</Code> are skipped.
            </li>
            <li>
              Excel files must be saved as CSV first (File → Save As → CSV). Files up to 25 MB are accepted.
            </li>
          </List>

          <H2 id="graph">Graphing</H2>
          <List>
            <li>
              <strong>Plot style:</strong> Points (scatter), Line (connected in row order) or Both, from the toolbar above the
              graph.
            </li>
            <li>
              <strong>Zoom and pan:</strong> choose Zoom or Pan in the toolbar and drag on the graph; the mouse wheel also
              zooms. Hover over a point to read its values.
            </li>
            <li>
              <strong>Autoscale</strong> fits all data into view. <strong>Reset view</strong> (or double-click the graph)
              returns to your configured view: the manual axis ranges if you set any, otherwise automatic.
            </li>
            <li>
              <strong>Title, axis labels and units</strong> are edited under Graph. Blank fields use automatic defaults
              (column names). Units belong to the column and are used everywhere, including fitted-parameter units such as
              m/s².
            </li>
            <li>
              <strong>Data table</strong> (tab above the graph) lists every column, including calculated ones.
            </li>
          </List>

          <H2 id="statistics">Statistics</H2>
          <P>
            For each plotted variable, using only the N non-missing values x₁ … x<sub>N</sub>:
          </P>
          <Formula>
            mean x̄ = (1/N) Σ xᵢ
            <br />
            median = middle value of the sorted data (average of the two middle values when N is even)
            <br />
            range = max − min
            <br />
            sample standard deviation s = √( Σ (xᵢ − x̄)² / (N − 1) )
            <br />
            standard error of the mean SE = s / √N
          </Formula>
          <P>
            The standard deviation uses N − 1 (the sample definition), which is the right choice for repeated
            measurements. It is undefined for a single value and shown as “—”. Sums use compensated (Neumaier) summation and
            the variance uses the two-pass algorithm, so results stay accurate even when the mean is large compared with the
            spread.
          </P>

          <H2 id="fitting">Curve fitting</H2>
          <P>All fits are least-squares fits of y on x. Rows with a missing x or y are skipped.</P>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Equation</th>
                  <th className="py-2 font-medium">Method</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Linear</td>
                  <td className="py-2 pr-4 font-mono">y = mx + b</td>
                  <td className="py-2">Closed-form ordinary least squares</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Quadratic</td>
                  <td className="py-2 pr-4 font-mono">y = ax² + bx + c</td>
                  <td className="py-2">Polynomial least squares via Householder QR on centred, scaled x</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Exponential</td>
                  <td className="py-2 pr-4 font-mono">y = A·e^(Bx)</td>
                  <td className="py-2">Straight-line fit of ln y against x (requires y &gt; 0)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Power law</td>
                  <td className="py-2 pr-4 font-mono">y = A·x^B</td>
                  <td className="py-2">Straight-line fit of ln y against ln x (requires x &gt; 0 and y &gt; 0)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <P>For the linear model, with Sxx = Σ(xᵢ − x̄)² and Sxy = Σ(xᵢ − x̄)(yᵢ − ȳ):</P>
          <Formula>
            m = Sxy / Sxx, b = ȳ − m·x̄
            <br />
            s² = Σ rᵢ² / (N − 2), SE(m) = s / √Sxx, SE(b) = s·√(1/N + x̄²/Sxx)
          </Formula>
          <P>
            Polynomial standard errors come from the covariance matrix s²(XᵀX)⁻¹ with s² = SSE/(N − p), where p is the
            number of parameters. For exponential and power fits, SE(A) ≈ A·SE(ln A) by first-order error propagation.
            Linearised fits minimise errors in ln y, which gives relatively more weight to small y values than a direct
            nonlinear fit would; this is the same method spreadsheet trendlines use.
          </P>
          <Formula>
            R² = 1 − SS<sub>res</sub> / SS<sub>tot</sub>, SS<sub>res</sub> = Σ (yᵢ − ŷᵢ)², SS<sub>tot</sub> = Σ (yᵢ − ȳ)²
            <br />
            residual standard error = √( SS<sub>res</sub> / (N − p) )
          </Formula>
          <P>
            R² is always computed in the original y units, so it describes the curve you see. For exponential and power fits
            the R² of the straight-line fit in log space is also shown. R² is undefined when all y values are equal.
          </P>
          <List>
            <li>
              <strong>Fit range:</strong> enter an x interval to fit only part of the data (for example, the linear region).
              The interval is shaded on the graph.
            </li>
            <li>
              <strong>Residuals</strong> rᵢ = yᵢ − ŷᵢ are plotted below the graph with a reference line at zero. Random
              scatter around zero suggests a good model; a pattern (a curve, a funnel) suggests the wrong model.
            </li>
            <li>
              Invalid fits are explained instead of shown: fewer points than parameters, identical x values, or non-positive
              values for log-based models.
            </li>
          </List>

          <H2 id="uncertainty">Uncertainty</H2>
          <P>
            Each column can have a measurement uncertainty, either absolute (± 0.002 m) or a percentage of each reading
            (± 2 %). When set, error bars are drawn and the Uncertainty panel shows the percent uncertainty:
          </P>
          <Formula>percent uncertainty = δ / |x| × 100 %</Formula>
          <P>
            For an absolute uncertainty this differs from reading to reading, so OpenLab reports it relative to the mean and
            the smallest and largest per-reading values. Fitted parameters show their standard errors and relative
            uncertainties. When the fitted Y variable has an uncertainty, the reduced chi-square is shown:
          </P>
          <Formula>χ²/ν = (1 / (N − p)) Σ (rᵢ / σᵢ)²</Formula>
          <P>
            A value near 1 means the scatter of the data matches the stated uncertainties; much larger suggests the
            uncertainties are underestimated or the model is wrong; much smaller suggests they are overestimated.
          </P>
          <P>
            Rounding: uncertainties are shown to 2 significant figures when they start with 1 or 2 and 1 significant figure
            otherwise, and the value is rounded to the same decimal place (e.g. 9.812 ± 0.015).
          </P>

          <H2 id="calculated">Calculated columns</H2>
          <P>
            <strong>Variables → Calculated</strong> creates a new column from a formula that is applied to every row. Refer to
            columns by the names shown on the buttons in the dialog. Examples:
          </P>
          <Formula>
            position / time
            <br />
            (position2 - position1) / time
            <br />
            0.5 * mass * velocity^2
            <br />
            sqrt(length / 9.81)
            <br />
            sin(rad(angle))
          </Formula>
          <P>
            Operators: <Code>+ - * / ^</Code> and parentheses. Functions: {ALLOWED_FUNCTIONS.join(", ")}. Trigonometric
            functions use radians; <Code>rad(x)</Code> and <Code>deg(x)</Code> convert. <Code>ln</Code> and{" "}
            <Code>log</Code> are the natural logarithm, <Code>log10</Code> is base 10. Constants: <Code>pi</Code>,{" "}
            <Code>e</Code>.
          </P>
          <P>
            Formulas are parsed with math.js and checked against this list before they run — nothing is executed as
            JavaScript. Rows with a missing input give a missing result. Rows whose result is not a real number (division by
            zero, the square root of a negative number…) are left blank and counted in a warning.
          </P>

          <H2 id="derivative">Numerical derivatives</H2>
          <P>
            <strong>Variables → Derivative</strong> creates dy/dx as a new column, e.g. velocity from position and time. With
            spacings h₁ = xᵢ − xᵢ₋₁ and h₂ = xᵢ₊₁ − xᵢ, interior points use the three-point central difference for uneven
            spacing:
          </P>
          <Formula>
            y′ᵢ ≈ −h₂/(h₁(h₁+h₂))·yᵢ₋₁ + (h₂−h₁)/(h₁h₂)·yᵢ + h₁/(h₂(h₁+h₂))·yᵢ₊₁
            <br />
            (equal spacing h: y′ᵢ ≈ (yᵢ₊₁ − yᵢ₋₁) / 2h)
          </Formula>
          <P>The first and last points use second-order one-sided differences:</P>
          <Formula>
            equal spacing: y′₀ ≈ (−3y₀ + 4y₁ − y₂) / 2h, y′ₙ ≈ (3yₙ − 4yₙ₋₁ + yₙ₋₂) / 2h
          </Formula>
          <P>
            These formulas are exact for quadratic data, so the derivative of x = ½at² is exactly v = at. Rows are sorted by
            x first if needed; repeated x values are rejected because the derivative would require division by zero.
            Differentiation amplifies noise, so expect a noisier result than the original data.
          </P>

          <H2 id="export">Exporting results</H2>
          <List>
            <li>
              <strong>Analysed dataset (.csv):</strong> every column with units in the header, absolute-uncertainty columns,
              and the fitted values and residuals of the current fit.
            </li>
            <li>
              <strong>Graph (.png):</strong> a high-resolution image of the graph as shown.
            </li>
            <li>
              <strong>Regression results (.csv)</strong> and <strong>regression report (.txt):</strong> the model, equation,
              parameters with standard errors and units, R², N and the residual standard error.
            </li>
            <li>
              <strong>Experiment summary:</strong> the short card on the right; use Copy to paste it into a lab report.
            </li>
          </List>

          <H2 id="privacy">Where your data lives</H2>
          <P>
            OpenLab runs entirely in your browser. Files are read locally and are never uploaded. Your workspace is saved
            automatically in this browser&apos;s local storage so a refresh does not lose your work; it is not available on
            other devices. <strong>New Experiment</strong> clears it.
          </P>
        </article>
      </div>
    </div>
  );
}
