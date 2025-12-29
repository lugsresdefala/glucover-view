import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, AlertTriangle, FileText, ArrowRight, User } from "lucide-react";
import type { ClinicalRecommendation } from "@shared/schema";

interface RecommendationModalProps {
  recommendation: ClinicalRecommendation | null;
  patientName: string;
  gestationalAge?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const urgencyConfig = {
  info: {
    icon: CheckCircle,
    label: "Adequado",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
  },
  warning: {
    icon: AlertTriangle,
    label: "Vigilância",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  },
  critical: {
    icon: AlertCircle,
    label: "Alerta",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-800",
  },
};

export function RecommendationModal({ 
  recommendation, 
  patientName, 
  gestationalAge,
  open, 
  onOpenChange 
}: RecommendationModalProps) {
  if (!recommendation) return null;
  
  const urgency = urgencyConfig[recommendation.urgencyLevel];
  const UrgencyIcon = urgency.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="modal-recommendation">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Conduta Clínica Sugerida
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="font-medium text-foreground">{patientName}</span>
                {gestationalAge && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{gestationalAge}</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="outline" className={`shrink-0 ${urgency.badgeClass}`}>
              <UrgencyIcon className="mr-1.5 h-3.5 w-3.5" />
              {urgency.label}
            </Badge>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="py-5 space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Conduta Terapêutica
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <p className="text-base leading-relaxed whitespace-pre-line" data-testid="text-modal-recommendation">
                  {recommendation.mainRecommendation}
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Próximos Passos
              </h3>
              <ul className="space-y-2">
                {recommendation.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3" data-testid={`text-modal-step-${index}`}>
                    <ArrowRight className="h-4 w-4 mt-1 text-primary shrink-0" />
                    <span className="text-sm leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Análise Clínica
              </h3>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2" data-testid="text-modal-analysis">
                {recommendation.analysis.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">{paragraph}</p>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Fundamentação
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-modal-justification">
                {recommendation.justification}
              </p>
            </section>

            {recommendation.guidelineReferences.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Referências
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recommendation.guidelineReferences.map((ref, index) => (
                      <Badge key={index} variant="secondary" className="text-xs font-normal">
                        {ref}
                      </Badge>
                    ))}
                  </div>
                </section>
              </>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                Sistema de suporte à decisão clínica. As decisões finais devem ser tomadas por profissional de saúde qualificado, considerando o contexto individual de cada paciente. Baseado nas Diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
