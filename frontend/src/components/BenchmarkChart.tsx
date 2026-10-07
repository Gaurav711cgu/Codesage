"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const data = [
  {
    name: "Naive Vector RAG",
    recall: 0.0,
    color: "hsl(var(--muted))"
  },
  {
    name: "CodeSageZ Graph-RAG",
    recall: 50.8,
    color: "hsl(var(--primary))"
  }
];

export function BenchmarkChart() {
  return (
    <div className="w-full h-72 bg-surface border border-border p-6 rounded-sm shadow-2xl flex flex-col">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-foreground font-mono text-sm tracking-wider uppercase">Recall@8 Benchmark</h3>
          <p className="text-muted-foreground text-xs font-mono mt-1">Evaluated on FastAPI, HTTPX, Celery</p>
        </div>
        <div className="text-right">
          <div className="text-primary text-2xl font-mono">+50.8%</div>
          <p className="text-muted-foreground text-xs font-mono uppercase">Absolute Improvement</p>
        </div>
      </div>
      
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(tick) => `${tick}%`} />
            <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={150} />
            <Tooltip 
              cursor={{fill: 'transparent'}}
              contentStyle={{ backgroundColor: 'hsl(var(--surface-hi))', borderColor: 'hsl(var(--border))', borderRadius: '3px', fontFamily: '"IBM Plex Mono", monospace' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value) => [`${value}%`, 'Recall@8']}
            />
            <Bar dataKey="recall" radius={[0, 3, 3, 0]} barSize={32}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
