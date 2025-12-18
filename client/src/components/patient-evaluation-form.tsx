import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GlucoseReading, InsulinRegimen, ClinicalRecommendation, AnalyzeResponse } from "@shared/schema";
import { checkCriticalGlucose, insulinTypes } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { GlucoseInput } from "@/components/glucose-input";

interface PatientEvaluationFormProps {
  patientName: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export function PatientEvaluationForm({ patientName, onCancel, onSuccess }: PatientEvaluationFormProps) {
  const { toast } = useToast();
  const [weight, setWeight] = useState<number>(70);
  const [gestationalWeeks, setGestationalWeeks] = useState<number>(28);
  const [gestationalDays, setGestationalDays] = useState<number>(0);
  const [usesInsulin, setUsesInsulin] = useState(false);
  const [insulinRegimens, setInsulinRegimens] = useState<InsulinRegimen[]>([]);
  const [dietAdherence, setDietAdherence] = useState<"boa" | "regular" | "ruim">("boa");
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([{}]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const criticalAlerts = checkCriticalGlucose(glucoseReadings);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const data = {
        patientName,
        weight,
        gestationalWeeks,
        gestationalDays,
        usesInsulin,
        insulinRegimens: usesInsulin ? insulinRegimens : undefined,
        dietAdherence,
        glucoseReadings,
      };
      const res = await apiRequest("POST", "/api/patient/evaluate", data);
      return res.json() as Promise<AnalyzeResponse>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Avaliação realizada com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const addInsulinRegimen = () => {
    setInsulinRegimens([...insulinRegimens, { type: "NPH" }]);
  };

  const removeInsulinRegimen = (index: number) => {
    setInsulinRegimens(insulinRegimens.filter((_, i) => i !== index));
  };

  const updateInsulinRegimen = (index: number, regimen: InsulinRegimen) => {
    const updated = [...insulinRegimens];
    updated[index] = regimen;
    setInsulinRegimens(updated);
  };

  const getUrgencyBadge = (urgencyLevel: ClinicalRecommendation["urgencyLevel"]) => {
    switch (urgencyLevel) {
      case "critical":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Urgente</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertCircle className="h-3 w-3 mr-1" />Atenção</Badge>;
      default:
        return <Badge variant="outline"><Info className="h-3 w-3 mr-1" />Informativo</Badge>;
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onSuccess} data-testid="button-back-to-list">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar às Avaliações
          </Button>
        </div>

        <Card data-testid="card-result">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Resultado da Avaliação</CardTitle>
                <CardDescription>Orientações geradas com base nos seus dados</CardDescription>
              </div>
              {getUrgencyBadge(result.recommendation.urgencyLevel)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Análise</h4>
              <p className="text-sm text-muted-foreground">{result.recommendation.analysis}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Orientação Principal</h4>
              <p className="text-sm">{result.recommendation.mainRecommendation}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Justificativa</h4>
              <p className="text-sm text-muted-foreground">{result.recommendation.justification}</p>
            </div>
            {result.recommendation.nextSteps.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Próximos Passos</h4>
                <ul className="space-y-1">
                  {result.recommendation.nextSteps.map((step, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-primary font-bold">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel} data-testid="button-cancel-entry">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <div>
          <h2 className="text-xl font-bold">Nova Avaliação</h2>
          <p className="text-sm text-muted-foreground">Registre suas glicemias e dados clínicos</p>
        </div>
      </div>

      {criticalAlerts.length > 0 && (
        <Card className="border-destructive bg-destructive/10" data-testid="alert-critical">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-destructive">Valores Críticos Detectados</p>
                <ul className="text-sm text-destructive/80 mt-1">
                  {criticalAlerts.map((alert, idx) => (
                    <li key={idx}>
                      Dia {alert.day} - {alert.timepoint}: {alert.value} mg/dL 
                      ({alert.type === "hypoglycemia" ? "Hipoglicemia" : "Hiperglicemia Grave"})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                data-testid="input-weight"
              />
            </div>
            <div className="space-y-2">
              <Label>Idade Gestacional</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Semanas"
                  value={gestationalWeeks}
                  onChange={(e) => setGestationalWeeks(parseInt(e.target.value) || 0)}
                  data-testid="input-gestational-weeks"
                />
                <Input
                  type="number"
                  placeholder="Dias"
                  value={gestationalDays}
                  onChange={(e) => setGestationalDays(parseInt(e.target.value) || 0)}
                  max={6}
                  data-testid="input-gestational-days"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adesão à Dieta</Label>
            <Select value={dietAdherence} onValueChange={(v) => setDietAdherence(v as any)}>
              <SelectTrigger data-testid="select-diet-adherence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boa">Boa</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="ruim">Ruim</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={usesInsulin}
              onCheckedChange={setUsesInsulin}
              data-testid="switch-uses-insulin"
            />
            <Label>Uso de Insulina</Label>
          </div>

          {usesInsulin && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between gap-2">
                <Label>Esquema de Insulina</Label>
                <Button size="sm" variant="outline" onClick={addInsulinRegimen} data-testid="button-add-insulin">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              {insulinRegimens.map((regimen, index) => (
                <div key={index} className="flex items-end gap-2 p-3 bg-background rounded border">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={regimen.type}
                      onValueChange={(v) => updateInsulinRegimen(index, { ...regimen, type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {insulinTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Manhã</Label>
                    <Input
                      type="number"
                      className="w-16"
                      value={regimen.doseManhaUI || ""}
                      onChange={(e) => updateInsulinRegimen(index, { ...regimen, doseManhaUI: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Almoço</Label>
                    <Input
                      type="number"
                      className="w-16"
                      value={regimen.doseAlmocoUI || ""}
                      onChange={(e) => updateInsulinRegimen(index, { ...regimen, doseAlmocoUI: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Jantar</Label>
                    <Input
                      type="number"
                      className="w-16"
                      value={regimen.doseJantarUI || ""}
                      onChange={(e) => updateInsulinRegimen(index, { ...regimen, doseJantarUI: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Dormir</Label>
                    <Input
                      type="number"
                      className="w-16"
                      value={regimen.doseDormirUI || ""}
                      onChange={(e) => updateInsulinRegimen(index, { ...regimen, doseDormirUI: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeInsulinRegimen(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <GlucoseInput
        readings={glucoseReadings}
        onReadingsChange={setGlucoseReadings}
        usesInsulin={usesInsulin}
      />

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={() => analyzeMutation.mutate()} 
          disabled={analyzeMutation.isPending}
          data-testid="button-submit-evaluation"
        >
          {analyzeMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            "Enviar para Análise"
          )}
        </Button>
      </div>
    </div>
  );
}
