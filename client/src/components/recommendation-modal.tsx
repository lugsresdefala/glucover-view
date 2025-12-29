import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle, AlertTriangle, User, Calendar, ArrowRight, BookOpen } from "lucide-react";
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
    containerClass: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    textClass: "text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  warning: {
    icon: AlertTriangle,
    label: "Vigilância",
    containerClass: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    textClass: "text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  critical: {
    icon: AlertCircle,
    label: "Alerta",
    containerClass: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
    textClass: "text-red-700 dark:text-red-300",
    dotClass: "bg-red-500",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden" data-testid="modal-recommendation">
        <DialogHeader className="px-6 py-5 border-b bg-muted/30 shrink-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                Conduta Clínica Sugerida
              </DialogTitle>
              <div 
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${urgency.containerClass} ${urgency.textClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${urgency.dotClass}`} />
                {urgency.label}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span className="font-medium text-foreground">{patientName}</span>
              </div>
              {gestationalAge && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>{gestationalAge}</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">
            
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                  Conduta Terapeutica
                </h3>
                <p className="text-base font-medium leading-relaxed whitespace-pre-line" data-testid="text-modal-recommendation">
                  {recommendation.mainRecommendation}
                </p>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Proximos Passos
              </h3>
              <div className="space-y-2">
                {recommendation.nextSteps.map((step, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    data-testid={`text-modal-step-${index}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">{index + 1}</span>
                    </div>
                    <span className="text-sm leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Analise Clinica
              </h3>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2" data-testid="text-modal-analysis">
                {recommendation.analysis.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">{paragraph}</p>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Fundamentacao
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-modal-justification">
                {recommendation.justification}
              </p>
            </div>

            {recommendation.guidelineReferences.length > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Referencias
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendation.guidelineReferences.map((ref, index) => (
                    <Badge key={index} variant="secondary" className="text-xs font-normal">
                      {ref}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Sistema de suporte a decisao clinica. As decisoes finais devem ser tomadas por profissional de saude qualificado, considerando o contexto individual de cada paciente. Baseado nas Diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
