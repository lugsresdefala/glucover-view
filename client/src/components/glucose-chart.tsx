import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { GlucoseReading } from "@shared/schema";

interface GlucoseChartProps {
  readings: GlucoseReading[];
}

type ViewMode = "jejum" | "posPrandial" | "resumo";

const viewLabels: Record<ViewMode, string> = {
  jejum: "Jejum",
  posPrandial: "Pós-prandial",
  resumo: "Resumo",
};

function getBarColor(value: number, isJejum: boolean): string {
  const target = isJejum ? 95 : 140;
  if (value <= target) return "hsl(160, 60%, 45%)";
  if (value <= target + 20) return "hsl(45, 80%, 50%)";
  return "hsl(0, 70%, 50%)";
}

export function GlucoseChart({ readings }: GlucoseChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("resumo");

  if (readings.length === 0) {
    return (
      <Card>
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

  // Build chart data based on view mode
  let chartData: { name: string; value: number; isJejum: boolean }[] = [];
  let yAxisLabel = "mg/dL";
  let referenceValue = 140;

  if (viewMode === "jejum") {
    chartData = readings
      .map((r, i) => ({ name: `D${i + 1}`, value: r.jejum ?? 0, isJejum: true }))
      .filter(d => d.value > 0);
    referenceValue = 95;
  } else if (viewMode === "posPrandial") {
    chartData = readings.map((r, i) => {
      const postMeals = [r.posCafe1h, r.posAlmoco1h, r.posJantar1h].filter(v => v !== undefined && v !== null) as number[];
      const avg = postMeals.length > 0 ? Math.round(postMeals.reduce((a, b) => a + b, 0) / postMeals.length) : 0;
      return { name: `D${i + 1}`, value: avg, isJejum: false };
    }).filter(d => d.value > 0);
    referenceValue = 140;
  } else {
    // Resumo: média por período
    const periods = [
      { key: "jejum", label: "Jejum", isJejum: true },
      { key: "posCafe1h", label: "Pós-café", isJejum: false },
      { key: "posAlmoco1h", label: "Pós-almoço", isJejum: false },
      { key: "posJantar1h", label: "Pós-jantar", isJejum: false },
    ];
    chartData = periods.map(p => {
      const values = readings
        .map(r => r[p.key as keyof GlucoseReading] as number | undefined)
        .filter(v => v !== undefined && v !== null && v > 0) as number[];
      const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      return { name: p.label, value: avg, isJejum: p.isJejum };
    }).filter(d => d.value > 0);
    referenceValue = 0; // Don't show reference in summary
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg font-semibold">Evolução Glicêmica</CardTitle>
          <div className="flex gap-1">
            {(Object.keys(viewLabels) as ViewMode[]).map(mode => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(mode)}
                data-testid={`button-chart-${mode}`}
              >
                {viewLabels[mode]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" data-testid="chart-glucose">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 200]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.375rem",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value} mg/dL`, "Glicemia"]}
              />
              {referenceValue > 0 && (
                <ReferenceLine
                  y={referenceValue}
                  stroke="hsl(0, 70%, 50%)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: `Meta: ${referenceValue}`, position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
              )}
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.value, entry.isJejum)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(160, 60%, 45%)" }} />
            <span>Na meta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(45, 80%, 50%)" }} />
            <span>Atenção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0, 70%, 50%)" }} />
            <span>Acima da meta</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
