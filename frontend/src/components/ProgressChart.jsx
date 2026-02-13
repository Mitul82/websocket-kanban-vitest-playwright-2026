import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function ProgressChart({ tasks }) {
  const counts = { todo: 0, inprogress: 0, done: 0 };
  tasks.forEach((t) => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });
  const total = tasks.length;
  const done = counts.done || 0;
  const completedPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const data = [
    { name: "To Do", count: counts.todo },
    { name: "In Progress", count: counts.inprogress },
    { name: "Done", count: counts.done },
  ];

  return (
    <div data-testid="progress-chart" style={{ width: "100%", height: 160, padding: 8, background: "#fafafa", borderRadius: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong>Progress</strong>
        <span data-testid="completed-pct">{completedPct}% completed</span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProgressChart;
