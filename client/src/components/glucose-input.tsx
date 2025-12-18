import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, AlertTriangle, AlertCircle } from "lucide-react";
import type { GlucoseReading, CriticalAlert } from "@shared/schema";
import { glucoseTargets, checkCriticalGlucose, criticalGlucoseThresholds } from "@shared/schema";
import { ExcelImportButton } from "./excel-import";

interface GlucoseInputProps {
  readings: GlucoseReading[];
  onReadingsChange: (readings: GlucoseReading[]) => void;
  usesInsulin: boolean;
}

// Campos básicos (sem insulina): jejum + 1h pós-refeições
const basicGlucoseFields = [
  { key: "jejum" as const, label: "Jejum", target: glucoseTargets.jejum },
  { key: "posCafe1h" as const, label: "1h pós-café", target: glucoseTargets.posPrandial1h },
  { key: "posAlmoco1h" as const, label: "1h pós-almoço", target: glucoseTargets.posPrandial1h },
  { key: "posJantar1h" as const, label: "1h pós-jantar", target: glucoseTargets.posPrandial1h },
];

// Campos adicionais com insulina: adiciona pré-almoço, pré-jantar e madrugada
const insulinGlucoseFields = [
  { key: "jejum" as const, label: "Jejum", target: glucoseTargets.jejum },
  { key: "posCafe1h" as const, label: "1h pós-café", target: glucoseTargets.posPrandial1h },
  { key: "preAlmoco" as const, label: "Pré-almoço", target: glucoseTargets.jejum },
  { key: "posAlmoco1h" as const, label: "1h pós-almoço", target: glucoseTargets.posPrandial1h },
  { key: "preJantar" as const, label: "Pré-jantar", target: glucoseTargets.jejum },
  { key: "posJantar1h" as const, label: "1h pós-jantar", target: glucoseTargets.posPrandial1h },
  { key: "madrugada" as const, label: "Madrugada (3h)", target: glucoseTargets.jejum },
];

function getValueStatus(value: number | undefined, target: { min: number; max: number }): "normal" | "high" | "low" | "critical_high" | "critical_low" | undefined {
  if (value === undefined) return undefined;
  if (value < criticalGlucoseThresholds.hypo) return "critical_low";
  if (value > criticalGlucoseThresholds.severeHyper) return "critical_high";
  if (value > target.max) return "high";
  if (value < target.min) return "low";
  return "normal";
}

function CriticalAlertsDisplay({ alerts }: { alerts: CriticalAlert[] }) {
  if (alerts.length === 0) return null;

  const hypoAlerts = alerts.filter((a) => a.type === "hypoglycemia");
  const hyperAlerts = alerts.filter((a) => a.type === "severe_hyperglycemia");

  return (
    <div className="space-y-3">
      {hypoAlerts.length > 0 && (
        <Alert variant="destructive" data-testid="alert-hypoglycemia">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hipoglicemia Detectada</AlertTitle>
          <AlertDescription>
            <span className="font-medium">
              {hypoAlerts.length} valor{hypoAlerts.length > 1 ? "es" : ""} abaixo de {criticalGlucoseThresholds.hypo} mg/dL:
            </span>
            <ul className="mt-1 list-disc list-inside text-sm">
              {hypoAlerts.map((alert, i) => (
                <li key={i}>
                  Dia {alert.day} - {alert.timepoint}: <span className="font-mono font-semibold">{alert.value}</span> mg/dL
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {hyperAlerts.length > 0 && (
        <Alert variant="destructive" data-testid="alert-hyperglycemia">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Hiperglicemia Severa Detectada</AlertTitle>
          <AlertDescription>
            <span className="font-medium">
              {hyperAlerts.length} valor{hyperAlerts.length > 1 ? "es" : ""} acima de {criticalGlucoseThresholds.severeHyper} mg/dL:
            </span>
            <ul className="mt-1 list-disc list-inside text-sm">
              {hyperAlerts.map((alert, i) => (
                <li key={i}>
                  Dia {alert.day} - {alert.timepoint}: <span className="font-mono font-semibold">{alert.value}</span> mg/dL
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function GlucoseInput({ readings, onReadingsChange, usesInsulin }: GlucoseInputProps) {
  const criticalAlerts = useMemo(() => checkCriticalGlucose(readings), [readings]);
  
  // Seleciona campos baseado no uso de insulina
  const glucoseFields = usesInsulin ? insulinGlucoseFields : basicGlucoseFields;

  const addDay = () => {
    onReadingsChange([...readings, {}]);
  };

  const removeDay = (index: number) => {
    onReadingsChange(readings.filter((_, i) => i !== index));
  };

  const updateReading = (dayIndex: number, key: keyof GlucoseReading, value: string) => {
    const newReadings = [...readings];
    const numValue = value === "" ? undefined : parseFloat(value);
    newReadings[dayIndex] = {
      ...newReadings[dayIndex],
      [key]: numValue,
    };
    onReadingsChange(newReadings);
  };

  const handleExcelImport = (importedReadings: GlucoseReading[]) => {
    onReadingsChange(importedReadings);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Medidas Glicêmicas</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <ExcelImportButton onImport={handleExcelImport} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addDay}
            data-testid="button-add-day"
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar Dia
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <CriticalAlertsDisplay alerts={criticalAlerts} />
        {readings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma medida adicionada.</p>
            <p className="text-sm mt-1">Clique em "Adicionar Dia" para começar.</p>
          </div>
        ) : (
          readings.map((reading, dayIndex) => (
            <div key={dayIndex} className="relative border border-border rounded-md p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Dia {dayIndex + 1}
                </span>
                {readings.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDay(dayIndex)}
                    className="text-destructive"
                    data-testid={`button-remove-day-${dayIndex}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {glucoseFields.map((field) => {
                  const value = reading[field.key];
                  const status = getValueStatus(value, field.target);
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label
                        htmlFor={`glucose-${dayIndex}-${field.key}`}
                        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                      >
                        {field.label}
                      </Label>
                      <div className="relative">
                        <Input
                          id={`glucose-${dayIndex}-${field.key}`}
                          type="number"
                          placeholder="mg/dL"
                          value={value ?? ""}
                          onChange={(e) => updateReading(dayIndex, field.key, e.target.value)}
                          className={`font-mono text-lg ${
                            status === "critical_high" || status === "critical_low"
                              ? "border-destructive bg-destructive/10 focus-visible:ring-destructive"
                              : status === "high"
                              ? "border-destructive focus-visible:ring-destructive"
                              : status === "normal"
                              ? "border-green-500 dark:border-green-600"
                              : ""
                          }`}
                          data-testid={`input-glucose-${dayIndex}-${field.key}`}
                        />
                        {(status === "critical_high" || status === "critical_low") && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-destructive text-xs font-bold animate-pulse">
                            {status === "critical_low" ? "Hipo" : "Hiper"}
                          </span>
                        )}
                        {status === "high" && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-destructive text-xs font-medium">
                            Alto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Meta: ≤{field.target.max} mg/dL
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
