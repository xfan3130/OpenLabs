// The pre-built Plotly bundle has the same API as `plotly.js`.
declare module "plotly.js-dist-min" {
  const Plotly: typeof import("plotly.js");
  export default Plotly;
}
