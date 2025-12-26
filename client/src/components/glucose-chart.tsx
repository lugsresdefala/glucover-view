import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type { GlucoseReading } from "@shared/schema";

interface GlucoseChartProps {
  readings: GlucoseReading[];
}

const glucoseFieldLabels: Record<string, string> = {
  jejum: "Jejum",
  posCafe1h: "1h pós-café",
  preAlmoco: "Pré-almoço",
  posAlmoco1h: "1h pós-almoço",
  preJantar: "Pré-jantar",
  posJantar1h: "1h pós-jantar",
  madrugada: "Madrugada",
};

const colors = {
  jejum: "hsl(210, 85%, 50%)",
  posCafe1h: "hsl(25, 80%, 50%)",
  preAlmoco: "hsl(170, 65%, 45%)",
  posAlmoco1h: "hsl(280, 70%, 50%)",
  preJantar: "hsl(195, 75%, 50%)",
  posJantar1h: "hsl(358, 75%, 50%)",
  madrugada: "hsl(45, 80%, 50%)",
};

export function GlucoseChart({ readings }: GlucoseChartProps) {
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

  const chartData = readings.map((reading, index) => ({
    name: `Dia ${index + 1}`,
    ...reading,
  }));

  const activeFields = Object.keys(glucoseFieldLabels).filter((key) =>
    readings.some((r) => r[key as keyof GlucoseReading] !== undefined)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Evolução Glicêmica</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full" data-testid="chart-glucose">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={[60, 200]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "mg/dL",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.375rem",
                  color: "hsl(var(--popover-foreground))",
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value) => glucoseFieldLabels[value] || value}
              />
              <ReferenceArea
                y1={0}
                y2={95}
                fill="hsl(170, 65%, 45%)"
                fillOpacity={0.1}
                label={{
                  value: "Meta jejum",
                  position: "insideBottomRight",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                y={95}
                stroke="hsl(170, 65%, 45%)"
                strokeDasharray="5 5"
                strokeOpacity={0.6}
              />
              <ReferenceLine
                y={140}
                stroke="hsl(25, 80%, 50%)"
                strokeDasharray="5 5"
                strokeOpacity={0.6}
              />
              {activeFields.map((field) => (
                <Line
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={colors[field as keyof typeof colors]}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500" style={{ borderStyle: "dashed" }} />
            <span>Meta jejum: ≤95 mg/dL</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-orange-500" style={{ borderStyle: "dashed" }} />
            <span>Meta 1h pós-prandial: ≤140 mg/dL</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
