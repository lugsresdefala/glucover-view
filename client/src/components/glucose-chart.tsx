import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { GlucoseReading } from "@shared/schema";

interface GlucoseChartProps {
  readings: GlucoseReading[];
}

const glucoseSeries = [
  { key: "jejum", label: "Jejum", color: "hsl(210, 80%, 55%)", target: 95, dashed: false },
  { key: "posCafe1h", label: "Pós-café 1h", color: "hsl(25, 85%, 42%)", target: 140, dashed: true },
  { key: "preAlmoco", label: "Pré-almoço", color: "hsl(145, 70%, 50%)", target: 100, dashed: false },
  { key: "posAlmoco1h", label: "Pós-almoço 1h", color: "hsl(145, 70%, 32%)", target: 140, dashed: true },
  { key: "preJantar", label: "Pré-jantar", color: "hsl(280, 65%, 60%)", target: 100, dashed: false },
  { key: "posJantar1h", label: "Pós-jantar 1h", color: "hsl(280, 65%, 40%)", target: 140, dashed: true },
  { key: "madrugada", label: "Madrugada", color: "hsl(340, 70%, 55%)", target: 95, dashed: false },
] as const;

export function GlucoseChart({ readings }: GlucoseChartProps) {
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    new Set(glucoseSeries.map((s) => s.key))
  );

  if (readings.length === 0) {
    return (
      <Card className="glass-panel border-white/20 dark:border-white/10 bg-transparent">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Evolução Glicêmica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>Adicione medidas glicêmicas para visualizar o gráfico</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = readings.map((reading, index) => ({
    day: `D${index + 1}`,
    jejum: reading.jejum ?? null,
    posCafe1h: reading.posCafe1h ?? null,
    preAlmoco: reading.preAlmoco ?? null,
    posAlmoco1h: reading.posAlmoco1h ?? null,
    preJantar: reading.preJantar ?? null,
    posJantar1h: reading.posJantar1h ?? null,
    madrugada: reading.madrugada ?? null,
  }));

  const toggleSeries = (key: string) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Card className="glass-panel border-white/20 dark:border-white/10 bg-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Evolução Glicêmica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {glucoseSeries.map((series) => (
            <div key={series.key} className="flex items-center gap-2">
              <Checkbox
                id={`series-${series.key}`}
                checked={visibleSeries.has(series.key)}
                onCheckedChange={() => toggleSeries(series.key)}
                data-testid={`checkbox-series-${series.key}`}
              />
              <Label
                htmlFor={`series-${series.key}`}
                className="text-sm cursor-pointer flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: series.color }}
                />
                {series.label}
              </Label>
            </div>
          ))}
        </div>

        <div className="h-72 w-full" data-testid="chart-glucose">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="day"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[50, 200]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.375rem",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => {
                  const series = glucoseSeries.find((s) => s.key === name);
                  return [`${value} mg/dL`, series?.label || name];
                }}
              />
              <ReferenceLine
                y={95}
                stroke="hsl(210, 70%, 50%)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={140}
                stroke="hsl(25, 70%, 50%)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              {glucoseSeries.map((series) =>
                visibleSeries.has(series.key) ? (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    stroke={series.color}
                    strokeWidth={2}
                    strokeDasharray={series.dashed ? "5 3" : undefined}
                    dot={{ r: 3, strokeWidth: 1, fill: series.color }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-dashed" style={{ borderColor: "hsl(210, 70%, 50%)" }} />
            <span>Meta jejum: 95 mg/dL</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-dashed" style={{ borderColor: "hsl(25, 70%, 50%)" }} />
            <span>Meta pós-prandial: 140 mg/dL</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
