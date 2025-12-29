import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, AlertTriangle, FileText, ArrowRight } from "lucide-react";
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

export function RecommendationModal({ recommendation, patientName, open, onOpenChange }: RecommendationModalProps) {
  if (!recommendation) return null;
  
  const urgency = urgencyConfig[recommendation.urgencyLevel];
  const UrgencyIcon = urgency.icon;

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
