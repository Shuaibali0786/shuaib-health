import type { ReactNode } from "react";

export type DataTable = { caption: string; head: string[]; rows: (string | number)[][] };

/**
 * One chart as a figure: a title, a one-sentence summary (the text alternative: it is what a screen
 * reader reads in place of the picture and it is on screen for everyone), the drawing, and a table with
 * the same numbers behind "Show data table". The drawing's own marks are labelled one by one.
 */
export function ChartFigure({ id, title, summary, table, legend, children }: { id: string; title: string; summary: string; table: DataTable; legend?: ReactNode; children: ReactNode }) {
  return (
    <figure className="card chart" data-chart={id} aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>
      <figcaption>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-summary`} className="chart-summary">
          {summary}
        </p>
      </figcaption>
      {children}
      {legend ? <div className="chart-legend">{legend}</div> : null}
      <details className="chart-data">
        <summary>Show data table</summary>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={`${table.caption} (scrollable)`}>
          <table className="table">
            <caption className="sr-only">{table.caption}</caption>
            <thead>
              <tr>
                {table.head.map((cell, index) => (
                  <th key={cell} scope="col" className={index > 0 ? "num-col" : undefined}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    c === 0 ? (
                      <th key={c} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={c} className="num num-col">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
