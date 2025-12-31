import { useState } from "react";
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
import { AlertCircle, CheckCircle, AlertTriangle, FileText, ArrowRight, Calendar, Info, ChevronDown, Syringe, Calculator } from "lucide-react";
import type { ClinicalRecommendation } from "@shared/schema";

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

interface InsulinDoses {
  tipo: string;
  manha: string;
  almoco: string;
  jantar: string;
}

interface AdjustedDoses {
  manha: number;
  almoco: number;
  jantar: number;
  changes: string[];
}

function calculateAdjustedDoses(
  currentDoses: InsulinDoses,
  recommendation: ClinicalRecommendation
): AdjustedDoses | null {
  const manha = parseFloat(currentDoses.manha) || 0;
  const almoco = parseFloat(currentDoses.almoco) || 0;
  const jantar = parseFloat(currentDoses.jantar) || 0;
  
  if (manha === 0 && almoco === 0 && jantar === 0) return null;
  
  const changes: string[] = [];
  let adjustedManha = manha;
  let adjustedAlmoco = almoco;
  let adjustedJantar = jantar;
  
  const text = (recommendation.analysis + " " + recommendation.mainRecommendation).toLowerCase();
  
  // SEGURANÇA PRIMEIRO: Detectar hipoglicemia por período
  // Madrugada/Jejum baixo → Reduzir NPH Jantar (10-20%)
  const hypoMadrugada = text.includes("madrugada") && (text.includes("hipoglicemia") || text.includes("<70") || text.includes("< 70"));
  const hypoJejum = text.includes("jejum") && (text.includes("hipoglicemia") || text.includes("<70") || text.includes("reduzir"));
  
  // Pré-almoço baixo → Reduzir NPH Manhã
  const hypoPreAlmoco = text.includes("pré-almoço") && (text.includes("hipoglicemia") || text.includes("<70"));
  
  // Pré-jantar baixo → Reduzir NPH Almoço  
  const hypoPreJantar = text.includes("pré-jantar") && (text.includes("hipoglicemia") || text.includes("<70"));
  
  // Aplicar reduções (SEGURANÇA - sempre primeiro)
  if (hypoMadrugada || hypoJejum) {
    if (jantar > 0) {
      adjustedJantar = Math.max(1, Math.round(jantar * 0.85));
      changes.push(`Jantar: ${jantar} → ${adjustedJantar} UI (-15%) - hipoglicemia madrugada/jejum detectada`);
    }
  }
  if (hypoPreAlmoco) {
    if (manha > 0) {
      adjustedManha = Math.max(1, Math.round(manha * 0.85));
      changes.push(`Manhã: ${manha} → ${adjustedManha} UI (-15%) - hipoglicemia pré-almoço detectada`);
    }
  }
  if (hypoPreJantar) {
    if (almoco > 0) {
      adjustedAlmoco = Math.max(1, Math.round(almoco * 0.85));
      changes.push(`Almoço: ${almoco} → ${adjustedAlmoco} UI (-15%) - hipoglicemia pré-jantar detectada`);
    }
  }
  
  // Se não há hipoglicemia, verificar hiperglicemia
  const hasAnyHypo = hypoMadrugada || hypoJejum || hypoPreAlmoco || hypoPreJantar;
  
  if (!hasAnyHypo) {
    // Jejum alto (≥95 mg/dL persistente) → Aumentar NPH Jantar
    const hyperJejum = text.includes("jejum") && (text.includes("acima") || text.includes("≥95") || text.includes(">95") || text.includes("aumentar"));
    
    // Pós-café alto (≥140 mg/dL) → Aumentar Rápida Manhã
    const hyperPosCafe = (text.includes("pós-café") || text.includes("pos-cafe")) && (text.includes("acima") || text.includes("≥140") || text.includes(">140"));
    
    // Pós-almoço alto → Aumentar Rápida Almoço
    const hyperPosAlmoco = text.includes("pós-almoço") && (text.includes("acima") || text.includes("≥140") || text.includes(">140"));
    
    // Pós-jantar alto → Aumentar Rápida Jantar
    const hyperPosJantar = text.includes("pós-jantar") && (text.includes("acima") || text.includes("≥140") || text.includes(">140"));
    
    if (hyperJejum && jantar > 0) {
      adjustedJantar = Math.round(jantar * 1.15);
      changes.push(`Jantar: ${jantar} → ${adjustedJantar} UI (+15%) - jejum persistentemente ≥95 mg/dL`);
    }
    if (hyperPosCafe && manha > 0) {
      adjustedManha = Math.round(manha * 1.15);
      changes.push(`Manhã: ${manha} → ${adjustedManha} UI (+15%) - pós-café ≥140 mg/dL`);
    }
    if (hyperPosAlmoco && almoco > 0) {
      adjustedAlmoco = Math.round(almoco * 1.15);
      changes.push(`Almoço: ${almoco} → ${adjustedAlmoco} UI (+15%) - pós-almoço ≥140 mg/dL`);
    }
    if (hyperPosJantar && jantar > 0 && !hyperJejum) {
      adjustedJantar = Math.round(jantar * 1.15);
      changes.push(`Jantar: ${jantar} → ${adjustedJantar} UI (+15%) - pós-jantar ≥140 mg/dL`);
    }
  }
  
  if (changes.length === 0) {
    changes.push("Manter doses atuais - perfil glicêmico sem padrão claro para ajuste");
  }
  
  return {
    manha: adjustedManha,
    almoco: adjustedAlmoco,
    jantar: adjustedJantar,
    changes,
  };
}

export function RecommendationModal({ recommendation, patientName, open, onOpenChange }: RecommendationModalProps) {
  const [insulinOpen, setInsulinOpen] = useState(false);
  const [insulinDoses, setInsulinDoses] = useState<InsulinDoses>({
    tipo: "",
    manha: "",
    almoco: "",
    jantar: "",
  });
  const [adjustedDoses, setAdjustedDoses] = useState<AdjustedDoses | null>(null);
  
  if (!recommendation) return null;
  
  const urgency = urgencyConfig[recommendation.urgencyLevel];
  const UrgencyIcon = urgency.icon;
  
  const handleCalculateAdjustment = () => {
    const result = calculateAdjustedDoses(insulinDoses, recommendation);
    setAdjustedDoses(result);
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
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${insulinOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="bg-muted/30 rounded-lg p-4 border space-y-4">
                  <div>
                    <Label htmlFor="insulin-type" className="text-sm font-medium">Tipo de Insulina</Label>
                    <Input
                      id="insulin-type"
                      placeholder="Ex: NPH, Regular, Lispro..."
                      value={insulinDoses.tipo}
                      onChange={(e) => setInsulinDoses(prev => ({ ...prev, tipo: e.target.value }))}
                      className="mt-1"
                      data-testid="input-insulin-type"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="dose-manha" className="text-sm font-medium">Manhã (UI)</Label>
                      <Input
                        id="dose-manha"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={insulinDoses.manha}
                        onChange={(e) => setInsulinDoses(prev => ({ ...prev, manha: e.target.value }))}
                        className="mt-1"
                        data-testid="input-dose-manha"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dose-almoco" className="text-sm font-medium">Almoço (UI)</Label>
                      <Input
                        id="dose-almoco"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={insulinDoses.almoco}
                        onChange={(e) => setInsulinDoses(prev => ({ ...prev, almoco: e.target.value }))}
                        className="mt-1"
                        data-testid="input-dose-almoco"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dose-jantar" className="text-sm font-medium">Jantar (UI)</Label>
                      <Input
                        id="dose-jantar"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={insulinDoses.jantar}
                        onChange={(e) => setInsulinDoses(prev => ({ ...prev, jantar: e.target.value }))}
                        className="mt-1"
                        data-testid="input-dose-jantar"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleCalculateAdjustment} 
                    className="w-full"
                    data-testid="button-calculate-adjustment"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular Ajuste Sugerido
                  </Button>
                  
                  {adjustedDoses && (
                    <div className="bg-background rounded-lg p-3 border border-primary/20 space-y-2">
                      <h4 className="text-sm font-semibold text-primary">Doses Ajustadas Sugeridas</h4>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-muted/50 rounded p-2">
                          <div className="text-xs text-muted-foreground">Manhã</div>
                          <div className="text-lg font-bold">{adjustedDoses.manha} UI</div>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <div className="text-xs text-muted-foreground">Almoço</div>
                          <div className="text-lg font-bold">{adjustedDoses.almoco} UI</div>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <div className="text-xs text-muted-foreground">Jantar</div>
                          <div className="text-lg font-bold">{adjustedDoses.jantar} UI</div>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {adjustedDoses.changes.map((change, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            {change}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-2 border-t pt-2">
                        Sugestão baseada nos resultados glicêmicos. Ajuste final deve ser validado pelo profissional de saúde.
                      </p>
                    </div>
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
