# OpenLab

**Free, browser-based scientific data analysis for student labs** — physics, chemistry, biology and engineering.

OpenLab sits somewhere between Desmos, Vernier Graphical Analysis, a spreadsheet and a lab notebook: import a table of
measurements, graph it, compute statistics, fit a model, and report the result with its uncertainty. Everything runs in
the browser. There is no account, no server-side storage and no tracking; files never leave the student's computer.

This repository is the first version (MVP): a focused, reliable tool that can be deployed to Vercel and handed to a class.

---

## Features

| Area | What you can do |
| --- | --- |
| **Import** | Upload or drag-and-drop a CSV/TSV/TXT file, or paste cells from a spreadsheet. Headers, delimiters, numeric columns and units (`time (s)`) are detected automatically; malformed rows are repaired and reported. Preview the data and choose X / Y before importing. |
| **Samples** | Four built-in, reproducible experiments: *Constant Acceleration Motion* (quadratic), *Hooke's Law Spring* (linear), *Capacitor Discharge* (exponential), *Pendulum Period vs Length* (power law). |
| **Graph** | Interactive Plotly graph: scatter, connected line, or both; several Y variables; hover values; drag-zoom, pan, wheel zoom, autoscale, reset view; editable title, axis labels and units; optional manual axis ranges. |
| **Statistics** | N, mean ± standard error, median, minimum, maximum, range, sample standard deviation and standard error for every plotted variable. |
| **Regression** | Linear, quadratic, exponential and power-law least-squares fits with the fitted equation, parameters ± standard errors (with units), R², residual standard error and N. Optional fit range. The best-fit curve is overlaid on the graph. |
| **Residuals** | Residual plot (rᵢ = yᵢ − ŷᵢ) below the main graph with a zero reference line. |
| **Uncertainty** | Absolute (± 0.002 m) or percent (± 2 %) uncertainty per variable, drawn as error bars; percent uncertainties; reduced χ² of the fit when y uncertainties are given. |
| **Calculated columns** | New columns from formulas such as `(position2 - position1) / time`, parsed safely with math.js (no `eval`), with live validation and preview. |
| **Derivatives** | Numerical dy/dx (e.g. velocity from position) as a new, plottable column. |
| **Export** | Analysed dataset (CSV, with units, uncertainties, fitted values and residuals), graph (PNG), regression results (CSV and text report), and a copyable experiment summary. |
| **Docs** | In-app documentation at `/docs` explaining every feature and formula. |

Work is autosaved to the browser's `localStorage`, so refreshing the page does not lose anything. **New Experiment**
clears it.

---

## Installation

Requirements: **Node.js 22.12 or newer** (Node 22 LTS or 24 LTS) and npm.

```bash
git clone https://github.com/xfan3130/OpenLabs.git
cd OpenLabs
npm install
```

## Running

```bash
npm run dev        # development server at http://localhost:3000
```

Other scripts:

```bash
npm test           # run the unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript (generates Next.js route types first)
npm run build      # production build
npm start          # serve the production build
```

## Deploying to Vercel

OpenLab is a static Next.js app with no backend, database or environment variables.

1. Push the repository to GitHub.
2. In Vercel, **Add New → Project**, import the repository, and accept the detected Next.js defaults.
3. Deploy. Every page is pre-rendered; all analysis happens in the visitor's browser.

---

## Supported CSV format

One column per variable, one row per measurement:

```csv
time (s),position (m)
0,0
0.1,0.06
0.2,0.21
0.3,0.45
0.4,0.82
```

- **Header row** — optional. It is detected automatically; without one, columns are named *Column 1, Column 2, …*.
- **Units** — written in parentheses or brackets in the header (`time (s)`, `Velocity [m/s]`) become the column unit.
- **Delimiters** — comma, tab, semicolon or pipe, detected automatically. Pasted spreadsheet cells (tab-separated) work.
- **Numbers** — decimal point (`0.25`), optional sign, scientific notation (`6.02e23`); the Unicode minus `−` is accepted.
- **Missing values** — empty cells, `NA`, `N/A`, `NaN`, `null`, `none`, `-`, `?`. Missing values are skipped by every
  calculation and never treated as zero.
- **Numeric vs text columns** — a column is numeric when ≥ 80 % of its non-empty cells are numbers; the remaining cells
  are reported and treated as missing. Text columns are shown in the data table but cannot be plotted.
- **Malformed rows** — short rows are padded with blanks, extra fields are dropped, and a summary is shown on import.
  Blank lines, `#` comment lines, a UTF-8 byte-order mark and trailing empty columns are handled.
- **Not supported yet** — `.xlsx` files (save as CSV first) and decimal commas (`0,25`).

---

## Project structure

```
app/
  layout.tsx            Root layout, fonts, metadata
  page.tsx              Workspace page (client-rendered)
  docs/page.tsx         In-app documentation
  globals.css           Design tokens (Tailwind v4 theme)
components/
  ui/                   shadcn/ui-style primitives on Radix (button, dialog, tabs, …)
  layout/               Top navigation and logo
  workspace/            Workspace container, empty state, client-only loader
  sidebar/              Left panel: datasets, variables, graph settings, curve fit, uncertainty
  graph/                Plotly wrapper, centre panel, graph actions (autoscale, reset, PNG)
  results/              Right panel: statistics, regression, uncertainty, summary card
  dialogs/              Calculated column, derivative, new experiment
  import/               Import dialog (file / paste) and file reading
  data/                 Data table
  shared/               Section, notices, numeric input
data/
  samples.ts            Seeded sample experiments
hooks/
  useWorkspace.ts       Reducer for all workspace state + localStorage autosave
  useAnalysis.ts        Derived analysis (resolved columns, fit, χ², labels)
lib/                    Framework-free logic (all unit tested)
  statistics.ts         Mean, median, variance, standard deviation, standard error
  linalg.ts             Householder QR least squares
  regression.ts         Linear / polynomial / exponential / power fits, R², predictions
  derivative.ts         Finite-difference derivatives on uneven grids
  expressions.ts        Safe math.js expression validation and evaluation
  csv.ts                CSV parsing, header / type detection, repair of malformed rows
  uncertainty.ts        Error-bar arrays, percent uncertainty, χ²
  plotting.ts           Plotly figure builders (main graph, residuals)
  report.ts             Equations, regression reports, CSV export, summary text
  format.ts, units.ts   Significant figures, value ± uncertainty, unit strings
types/                  Shared TypeScript types
utils/                  Browser helpers (downloads, clipboard) and class-name merging
tests/                  Vitest suites
```

The mathematical code in `lib/` has no React dependencies; the UI only calls it.

---

## Mathematical methods

All routines skip non-finite values (missing data) and return an explicit error or `NaN` — never a silent `0` — when a
quantity is undefined (empty input, a single point, identical x values, division by zero).

### Descriptive statistics

- Mean x̄ = Σxᵢ / N, using Neumaier compensated summation.
- Sample variance s² = Σ(xᵢ − x̄)² / (N − 1), computed with the two-pass algorithm to avoid cancellation when the mean is
  large relative to the spread. Standard deviation s = √s²; undefined for N < 2.
- Standard error of the mean SE = s / √N.
- Median: middle value of the sorted data (mean of the two middle values for even N).

### Linear regression — y = mx + b

Closed-form ordinary least squares with centred sums:
Sxx = Σ(xᵢ − x̄)², Sxy = Σ(xᵢ − x̄)(yᵢ − ȳ), m = Sxy / Sxx, b = ȳ − m x̄.
With s² = SSE / (N − 2): SE(m) = s / √Sxx and SE(b) = s √(1/N + x̄²/Sxx).

### Quadratic (polynomial) regression — y = ax² + bx + c

Least squares solved with a **Householder QR decomposition** rather than the normal equations (which square the
condition number). x is first centred and scaled, z = (x − μ)/σ with σ = max|xᵢ − μ|, so the design matrix stays well
conditioned even for data such as calendar years. Coefficients are converted back to powers of x exactly with the
binomial expansion, a = T c, and the covariance is transformed the same way, Cov(a) = T Cov(c) Tᵀ with
Cov(c) = s² (ZᵀZ)⁻¹ and s² = SSE / (N − 3).

### Exponential and power-law regression

- Exponential y = A e^(Bx): straight-line fit of ln y against x (requires y > 0).
- Power law y = A x^B: straight-line fit of ln y against ln x (requires x > 0 and y > 0).

This is the log-linearisation used by spreadsheet trendlines; it minimises squared error in ln y. SE(A) ≈ A·SE(ln A) by
first-order error propagation.

### Goodness of fit

- R² = 1 − SS_res / SS_tot, computed in the original y units for every model (the R² of the log-space line is also shown
  for linearised fits). Undefined when all y are equal.
- Residual standard error √(SS_res / (N − p)), with p the number of parameters.
- Reduced chi-square χ²/ν = Σ(rᵢ/σᵢ)² / (N − p) when y uncertainties σᵢ are given.

### Numerical derivative

Three-point finite differences for **uneven spacing** (h₁ = xᵢ − xᵢ₋₁, h₂ = xᵢ₊₁ − xᵢ):

- interior: y′ᵢ ≈ −h₂/(h₁(h₁+h₂))·yᵢ₋₁ + (h₂−h₁)/(h₁h₂)·yᵢ + h₁/(h₂(h₁+h₂))·yᵢ₊₁ — the central difference
  (yᵢ₊₁ − yᵢ₋₁)/2h for equal spacing;
- endpoints: second-order one-sided differences, (−3y₀ + 4y₁ − y₂)/2h for equal spacing, and the mirror image at the end.

All three are exact for quadratics, so differentiating x = ½at² gives exactly v = at. Unsorted rows are sorted by x
first; duplicate x values are rejected because they would divide by zero.

### Calculated columns

Expressions are parsed by math.js and checked against an allow-list (arithmetic operators, numeric literals, the
dataset's column names, a curated set of functions and the constants `pi`, `e`, `tau`, `phi`) before evaluation.
Assignments, units, strings, matrices and every other math.js feature are rejected. Results that are not finite real
numbers are left blank and counted.

### Rounding

Computed values are shown to 4 significant figures, switching to "× 10ⁿ" notation below 10⁻³ and above 10⁶; measured
values (minimum, maximum, median, range) are shown as recorded, without padding zeros. A value with an
uncertainty is written with the uncertainty rounded to 2 significant figures when it starts with 1 or 2 (otherwise 1),
and the value rounded to the same decimal place: `9.812 ± 0.015`. Exported CSV files keep full precision.

---

## Testing

`npm test` runs the Vitest suites in `tests/`:

- statistics: mean, median, variance / standard deviation, standard error, compensated summation;
- regression: linear (hand-computed reference), polynomial (exact recovery, badly scaled x, comparison with the normal
  equations), R², exponential and power fits, fit ranges, residuals;
- numerical derivative: exactness for quadratics on uniform and non-uniform grids, second-order convergence, unsorted
  and missing data, duplicate x;
- CSV parsing, expressions (including rejected syntax), number formatting, units, uncertainty and χ²;
- workspace state and persistence, CSV export, plot builders, and that every sample's suggested fit recovers the
  parameters it was generated from.

Edge cases covered throughout: empty arrays, one-point datasets, identical x values, division by zero and NaN values.

---

## Roadmap

### Phase 2

- Web Serial Arduino connection
- Live sensor graphing
- Automatic units
- Uncertainty propagation
- Nonlinear model fitting

### Phase 3

- Experiment notebooks
- Saved projects
- Collaboration
- Classroom sharing
- More scientific models

---

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style components on Radix UI ·
Plotly.js · Papa Parse · math.js · Vitest.
