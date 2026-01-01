import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertCircle, CheckCircle, AlertTriangle, FileText, ArrowRight, Calendar, Info, ChevronDown, Syringe, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ClinicalRecommendation, InsulinAdjustment, InsulinAdjustmentType } from "@shared/schema";

interface RecommendationModalProps {
  recommendation: ClinicalRecommendation | null;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const urgencyConfig = {
  info: {
    icon: CheckCircle,
    label: "Adequado",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    headerBg: "bg-green-50 dark:bg-green-950/30",
  },
  warning: {
    icon: AlertTriangle,
    label: "Vigilância",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
  },
  critical: {
    icon: AlertCircle,
    label: "Alerta",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    headerBg: "bg-red-50 dark:bg-red-950/30",
  },
};

// Labels para os tipos de insulina
const INSULIN_LABELS: Record<InsulinAdjustmentType, string> = {
  "NPH_NOTURNA": "NPH Noturna (22h)",
  "NPH_MANHA": "NPH Manha (7-8h)",
  "NPH_ALMOCO": "NPH Almoco (12h)",
  "NPH_JANTAR": "NPH Jantar (19h)",
  "RAPIDA_CAFE": "Rapida Cafe",
  "RAPIDA_ALMOCO": "Rapida Almoco",
  "RAPIDA_JANTAR": "Rapida Jantar",
};


export function RecommendationModal({ recommendation, patientName, open, onOpenChange }: RecommendationModalProps) {
  const [insulinOpen, setInsulinOpen] = useState(false);
  // Estado: dose atual para cada insulina que precisa de ajuste
  const [doseInputs, setDoseInputs] = useState<Record<string, string>>({});
  
  // Filtrar apenas ajustes que tem acao (AUMENTAR ou REDUZIR)
  const ajustesAcionaveis = recommendation?.ajustesRecomendados?.filter(
    a => a.direcao === "AUMENTAR" || a.direcao === "REDUZIR"
  ) || [];
  
  // Abrir calculadora automaticamente quando ha ajuste de insulina recomendado
  useEffect(() => {
    if (open && recommendation) {
      const hasAdjustment = ajustesAcionaveis.length > 0;
      setInsulinOpen(hasAdjustment);
      setDoseInputs({});
    } else if (!open) {
      setInsulinOpen(false);
      setDoseInputs({});
    }
  }, [open, recommendation]);
  
  if (!recommendation) return null;
  
  const urgency = urgencyConfig[recommendation.urgencyLevel];
  const UrgencyIcon = urgency.icon;
  
  // Calcular dose ajustada
  const calcularNovaDose = (doseAtual: number, direcao: "AUMENTAR" | "REDUZIR", percentual: number): number => {
    if (direcao === "AUMENTAR") {
      return Math.round(doseAtual * (1 + percentual / 100));
    } else {
      return Math.max(1, Math.round(doseAtual * (1 - percentual / 100)));
    }
  };
  
  const handleDoseChange = (insulinaKey: string, value: string) => {
    setDoseInputs(prev => ({ ...prev, [insulinaKey]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="modal-recommendation">
        <DialogHeader className={`-mx-6 -mt-6 px-6 py-4 ${urgency.headerBg} border-b`}>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Conduta Sugerida
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Paciente: <span className="font-medium text-foreground">{patientName}</span>
              </p>
            </div>
            <Badge variant="outline" className={`shrink-0 ${urgency.badgeClass}`}>
              <UrgencyIcon className="mr-1 h-3 w-3" />
              {urgency.label}
            </Badge>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-180px)] -mx-6 px-6">
          <div className="py-4 space-y-6">
            {/* Data Quality Indicator */}
            {(recommendation.chronologyWarning || recommendation.dateRange) && (
              <section className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    {recommendation.dateRange && (
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-3 w-3" />
                        <span className="font-medium">
                          Período analisado: {recommendation.dateRange.start} a {recommendation.dateRange.end}
                          {recommendation.totalDaysAnalyzed && ` (${recommendation.totalDaysAnalyzed} dias)`}
                        </span>
                      </div>
                    )}
                    {recommendation.chronologyWarning && (
                      <p className="text-xs mt-1" data-testid="text-chronology-warning">
                        {recommendation.chronologyWarning}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Análise Clínica
              </h3>
              <div className="text-sm leading-relaxed space-y-3" data-testid="text-modal-analysis">
                {recommendation.analysis.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">{paragraph}</p>
                ))}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Conduta Terapêutica
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="text-base font-medium leading-relaxed whitespace-pre-line" data-testid="text-modal-recommendation">
                  {recommendation.mainRecommendation}
                </div>
              </div>
            </section>

            <Collapsible open={insulinOpen} onOpenChange={setInsulinOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between" data-testid="button-insulin-toggle">
                  <span className="flex items-center gap-2">
                    <Syringe className="h-4 w-4" />
                    Calculadora de Ajuste de Insulina
                    {ajustesAcionaveis.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {ajustesAcionaveis.length} ajuste{ajustesAcionaveis.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${insulinOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="bg-muted/30 rounded-lg p-4 border space-y-4">
                  {ajustesAcionaveis.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <Minus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum ajuste de insulina recomendado no momento.</p>
                      <p className="text-xs mt-1">Manter esquema atual e continuar monitoramento.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Informe a dose atual para calcular o ajuste recomendado (10-20%):
                      </p>
                      
                      <div className="space-y-4">
                        {ajustesAcionaveis.map((ajuste, idx) => {
                          const key = ajuste.insulinaAfetada;
                          const doseAtual = parseFloat(doseInputs[key] || "") || 0;
                          const isAumentar = ajuste.direcao === "AUMENTAR";
                          
                          return (
                            <div key={idx} className="bg-background rounded-lg p-3 border space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {isAumentar ? (
                                    <TrendingUp className="h-4 w-4 text-amber-600" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="font-medium">{INSULIN_LABELS[key]}</span>
                                </div>
                                <Badge variant={isAumentar ? "outline" : "destructive"} className="text-xs">
                                  {isAumentar ? "Aumentar" : "Reduzir"} 10-20%
                                </Badge>
                              </div>
                              
                              <p className="text-xs text-muted-foreground">
                                {ajuste.justificativa}
                              </p>
                              
                              <div className="flex items-end gap-3">
                                <div className="flex-1">
                                  <Label htmlFor={`dose-${key}`} className="text-xs">Dose atual (UI)</Label>
                                  <Input
                                    id={`dose-${key}`}
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={doseInputs[key] || ""}
                                    onChange={(e) => handleDoseChange(key, e.target.value)}
                                    className="mt-1"
                                    data-testid={`input-dose-${key}`}
                                  />
                                </div>
                                
                                {doseAtual > 0 && (
                                  <div className="flex gap-2">
                                    <div className="text-center px-3 py-1 bg-muted rounded">
                                      <div className="text-xs text-muted-foreground">-10%</div>
                                      <div className="font-bold">{calcularNovaDose(doseAtual, ajuste.direcao as "AUMENTAR" | "REDUZIR", 10)} UI</div>
                                    </div>
                                    <div className="text-center px-3 py-1 bg-primary/10 rounded border border-primary/20">
                                      <div className="text-xs text-muted-foreground">-15%</div>
                                      <div className="font-bold text-primary">{calcularNovaDose(doseAtual, ajuste.direcao as "AUMENTAR" | "REDUZIR", 15)} UI</div>
                                    </div>
                                    <div className="text-center px-3 py-1 bg-muted rounded">
                                      <div className="text-xs text-muted-foreground">-20%</div>
                                      <div className="font-bold">{calcularNovaDose(doseAtual, ajuste.direcao as "AUMENTAR" | "REDUZIR", 20)} UI</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <p className="text-xs text-muted-foreground italic border-t pt-3">
                        Sugestao baseada nos resultados glicemicos. Ajuste final deve ser validado pelo profissional de saude.
                      </p>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Fundamentação
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-modal-justification">
                {recommendation.justification}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Próximos Passos
              </h3>
              <ul className="space-y-2">
                {recommendation.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3" data-testid={`text-modal-step-${index}`}>
                    <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </section>

            {recommendation.guidelineReferences.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Referências das Diretrizes
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recommendation.guidelineReferences.map((ref, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {ref}
                      </Badge>
                    ))}
                  </div>
                </section>
              </>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground italic">
                Sistema de suporte à decisão. Decisões finais devem ser tomadas por profissional de saúde qualificado. Baseado nas Diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
