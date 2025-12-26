import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Activity } from "lucide-react";
import type { GlucoseReading } from "@shared/schema";
import { calculateGlucosePercentageInTarget, calculateAverageGlucose } from "@shared/schema";

interface PatientStatsProps {
  readings: GlucoseReading[];
  gestationalWeeks: number;
  gestationalDays: number;
  weight?: number | null;
}

export function PatientStats({ readings, gestationalWeeks, gestationalDays, weight }: PatientStatsProps) {
  const percentageInTarget = calculateGlucosePercentageInTarget(readings);
  const averageGlucose = calculateAverageGlucose(readings);
  const totalReadings = readings.reduce((acc, r) => {
    return acc + Object.values(r).filter((v) => typeof v === "number").length;
  }, 0);

  const isTargetGood = percentageInTarget >= 70;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${isTargetGood ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900"}`}>
              <Target className={`h-5 w-5 ${isTargetGood ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Na Meta
              </p>
              <p className="text-2xl font-mono font-semibold" data-testid="text-percentage-target">
                {percentageInTarget}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Média Glicêmica
              </p>
              <p className="text-2xl font-mono font-semibold" data-testid="text-average-glucose">
                {averageGlucose} <span className="text-sm font-normal">mg/dL</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Idade Gestacional
              </p>
              <p className="text-2xl font-mono font-semibold" data-testid="text-gestational-age">
                {gestationalWeeks}<span className="text-sm font-normal">sem</span> {gestationalDays}<span className="text-sm font-normal">d</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-teal-100 dark:bg-teal-900">
              <TrendingDown className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Peso Atual
              </p>
              <p className="text-2xl font-mono font-semibold" data-testid="text-weight">
                {weight ? `${weight}` : "—"} <span className="text-sm font-normal">kg</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
