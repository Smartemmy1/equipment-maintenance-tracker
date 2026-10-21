import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORY_LABELS, fmtHours } from "../format";
import type { Dashboard } from "../types";

/** Downtime hours by equipment type: one series, so one color and no legend. */
export function DowntimeChart({ data }: { data: Dashboard["downtime_by_category"] }) {
  const rows = data.map((d) => ({ label: CATEGORY_LABELS[d.category], hours: d.hours }));
  if (rows.length === 0) return <p className="empty">No failures recorded in the last 12 months.</p>;

  return (
    <figure className="chart">
      <ResponsiveContainer width="100%" height={rows.length * 36 + 30}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--rule)" />
          <XAxis
            type="number"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fill: "var(--ink)", fontSize: 13 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--hover)" }}
            formatter={(value) => [fmtHours(Number(value)), "Downtime"]}
            contentStyle={{
              borderRadius: 6,
              border: "1px solid var(--rule)",
              fontFamily: "inherit",
            }}
          />
          <Bar dataKey="hours" fill="var(--steel)" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <details className="chart-table">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th className="num">Downtime</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{fmtHours(r.hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
