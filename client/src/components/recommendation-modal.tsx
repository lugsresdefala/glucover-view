import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, AlertTriangle, X } from "lucide-react";
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
    className: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    icon: AlertTriangle,
    label: "Vigilância",
    className: "text-amber-600 dark:text-amber-400",
  },
  critical: {
    icon: AlertCircle,
    label: "Alerta",
    className: "text-red-600 dark:text-red-400",
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
      <DialogContent 
        hideCloseButton 
        className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden" 
        data-testid="modal-recommendation"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div>
            <DialogTitle className="text-base font-semibold">
              Conduta Clínica
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{patientName}</span>
              {gestationalAge && <span> · {gestationalAge}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-sm font-medium ${urgency.className}`}>
              <UrgencyIcon className="h-4 w-4" />
              <span>{urgency.label}</span>
            </div>
            <DialogClose className="p-1.5 rounded border border-border bg-background hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-5">
            <section>
              <h3 className="font-semibold text-foreground mb-2">Conduta Terapêutica</h3>
              <p className="leading-relaxed whitespace-pre-line" data-testid="text-modal-recommendation">
                {recommendation.mainRecommendation}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-foreground mb-2">Próximos Passos</h3>
              <ul className="space-y-2">
                {recommendation.nextSteps.map((step, index) => (
                  <li key={index} className="flex gap-2 leading-relaxed" data-testid={`text-modal-step-${index}`}>
                    <span className="text-muted-foreground shrink-0">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold text-foreground mb-2">Análise</h3>
              <div className="text-muted-foreground leading-relaxed space-y-2" data-testid="text-modal-analysis">
                {recommendation.analysis.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">{paragraph}</p>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">Fundamentação</h3>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-modal-justification">
                {recommendation.justification}
              </p>
            </section>

            {recommendation.guidelineReferences.length > 0 && (
              <section>
                <h3 className="font-semibold text-foreground mb-2">Referências</h3>
                <p className="text-sm text-muted-foreground">
                  {recommendation.guidelineReferences.join(" · ")}
                </p>
              </section>
            )}

            <Separator />

            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Sistema de suporte à decisão clínica. Decisões finais devem ser tomadas pelo profissional de saúde considerando o contexto individual. Baseado em SBD 2025, FEBRASGO 2019, OMS 2025.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
