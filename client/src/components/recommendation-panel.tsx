import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import type { ClinicalRecommendation } from "@shared/schema";

interface RecommendationPanelProps {
  recommendation: ClinicalRecommendation;
  patientName: string;
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

export function RecommendationPanel({ recommendation, patientName }: RecommendationPanelProps) {
  const urgency = urgencyConfig[recommendation.urgencyLevel];
  const UrgencyIcon = urgency.icon;

  return (
    <Card data-testid="card-recommendation">
      <CardHeader className={`pb-4 ${urgency.headerBg} rounded-t-md`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Conduta Sugerida
          </CardTitle>
          <Badge variant="outline" className={urgency.badgeClass}>
            <UrgencyIcon className="mr-1 h-3 w-3" />
            {urgency.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Paciente: <span className="font-medium text-foreground">{patientName}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Análise dos Dados
          </h3>
          <p className="text-base leading-relaxed" data-testid="text-analysis">
            {recommendation.analysis}
          </p>
        </section>

        <Separator />

        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Recomendação Principal
          </h3>
          <div className="bg-muted/50 rounded-md p-4">
            <p className="text-base font-medium leading-relaxed" data-testid="text-main-recommendation">
              {recommendation.mainRecommendation}
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Justificativa
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground" data-testid="text-justification">
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
              <li key={index} className="flex items-start gap-2" data-testid={`text-next-step-${index}`}>
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
            Sistema de suporte à decisão. Decisões finais devem ser tomadas por profissional de saúde qualificado. Baseado nas Diretrizes DMG 2024.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
