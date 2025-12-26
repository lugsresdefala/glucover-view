import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar, ChevronRight, FileText, Eye } from "lucide-react";
import { PDFExportButton } from "@/components/pdf-export";
import type { StoredEvaluation } from "@shared/schema";

interface EvaluationHistoryProps {
  evaluations: StoredEvaluation[];
  onViewEvaluation: (evaluation: StoredEvaluation) => void;
}

const urgencyBadgeConfig = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function EvaluationHistory({ evaluations, onViewEvaluation }: EvaluationHistoryProps) {
  if (evaluations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma avaliação realizada ainda.</p>
            <p className="text-sm mt-1">As avaliações serão listadas aqui.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Histórico de Avaliações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {evaluations
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((evaluation) => (
              <AccordionItem key={evaluation.id} value={String(evaluation.id)} data-testid={`accordion-evaluation-${evaluation.id}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-4 text-left">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {formatShortDate(evaluation.createdAt)}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{evaluation.patientName}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        IG: {evaluation.gestationalWeeks}sem {evaluation.gestationalDays}d
                      </span>
                    </div>
                    {evaluation.recommendation && (
                      <Badge
                        variant="outline"
                        className={urgencyBadgeConfig[evaluation.recommendation.urgencyLevel]}
                      >
                        {evaluation.recommendation.urgencyLevel === "info"
                          ? "Ok"
                          : evaluation.recommendation.urgencyLevel === "warning"
                          ? "Atenção"
                          : "Urgente"}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Data:</span>
                        <p className="font-medium">{formatDate(evaluation.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Peso:</span>
                        <p className="font-mono font-medium">{evaluation.weight ? `${evaluation.weight} kg` : "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Usa Insulina:</span>
                        <p className="font-medium">{evaluation.usesInsulin ? "Sim" : "Não"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dieta:</span>
                        <p className="font-medium capitalize">{evaluation.dietAdherence}</p>
                      </div>
                    </div>
                    {evaluation.recommendation && (
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-sm font-medium mb-1">Conduta:</p>
                        <p className="text-sm text-muted-foreground">
                          {evaluation.recommendation.mainRecommendation}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewEvaluation(evaluation)}
                        data-testid={`button-view-evaluation-${evaluation.id}`}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Ver Detalhes
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                      {evaluation.recommendation && (
                        <PDFExportButton evaluation={evaluation} />
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
