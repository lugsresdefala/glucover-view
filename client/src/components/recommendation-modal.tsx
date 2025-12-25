import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, AlertTriangle, FileText, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    label: "Informativo",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    headerBg: "bg-blue-50 dark:bg-blue-950/30",
  },
  warning: {
    icon: AlertTriangle,
    label: "Atenção Necessária",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
  },
  critical: {
    icon: AlertCircle,
    label: "Urgente",
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden" data-testid="modal-recommendation">
        <DialogHeader className={`px-6 py-4 ${urgency.headerBg} border-b`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Conduta Sugerida
            </DialogTitle>
            <Badge variant="outline" className={urgency.badgeClass}>
              <UrgencyIcon className="mr-1 h-3 w-3" />
              {urgency.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Paciente: <span className="font-medium text-foreground">{patientName}</span>
          </p>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 py-4 space-y-6">
            <section>
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Análise Clínica
              </h3>
              <div className="text-base leading-relaxed space-y-3" data-testid="text-modal-analysis">
                {recommendation.analysis.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">{paragraph}</p>
                ))}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Conduta Terapêutica
              </h3>
              <div className="bg-muted/50 rounded-md p-4">
                <div className="text-base font-medium leading-relaxed whitespace-pre-line" data-testid="text-modal-recommendation">
                  {recommendation.mainRecommendation}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Fundamentação
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground" data-testid="text-modal-justification">
                {recommendation.justification}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
                Próximos Passos
              </h3>
              <ul className="space-y-2">
                {recommendation.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2" data-testid={`text-modal-step-${index}`}>
                    <ArrowRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-base">{step}</span>
                  </li>
                ))}
              </ul>
            </section>

            {recommendation.guidelineReferences.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
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
