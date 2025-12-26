import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar, ChevronRight, FileText, Eye, AlertTriangle, TrendingDown, Syringe, CheckCircle, Download } from "lucide-react";
import { PDFExportButton } from "@/components/pdf-export";
import type { StoredEvaluation, GlucoseReading } from "@shared/schema";
import { criticalGlucoseThresholds } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";

interface EvaluationHistoryProps {
  evaluations: StoredEvaluation[];
  onViewEvaluation: (evaluation: StoredEvaluation) => void;
}

const urgencyBadgeConfig = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// Detect critical alerts from glucose readings
function detectCriticalAlerts(readings: GlucoseReading[]) {
  let hypoCount = 0;
  let severeHyperCount = 0;
  
  readings.forEach(day => {
    const values = [
      day.jejum, day.posCafe1h, day.posAlmoco1h, day.posJantar1h,
      day.preAlmoco, day.preJantar, day.madrugada
    ].filter((v): v is number => v !== null && v !== undefined);
    
    values.forEach(val => {
      if (val < criticalGlucoseThresholds.hypo) hypoCount++;
      if (val > criticalGlucoseThresholds.severeHyper) severeHyperCount++;
    });
  });
  
  return { hypoCount, severeHyperCount };
}

// Get urgency priority for sorting (lower = higher priority)
function getUrgencyPriority(urgency: string | undefined): number {
  if (urgency === "critical") return 0;
  if (urgency === "warning") return 1;
  return 2;
}

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

  const exportActivePatients = () => {
    const activePatients = evaluations
      .filter(e => e.gestationalWeeks < 40 && e.gestationalAgeSource !== "propagated")
      .sort((a, b) => a.patientName.localeCompare(b.patientName, "pt-BR"));

    if (activePatients.length === 0) {
      return;
    }

    const exportData = activePatients.map(e => ({
      "Nome": e.patientName,
      "IG (semanas)": e.gestationalWeeks,
      "IG (dias)": e.gestationalDays,
      "Tipo DM": e.diabetesType || "DMG",
      "Usa Insulina": e.usesInsulin ? "Sim" : "Não",
      "Dieta": e.dietAdherence,
      "Dias Registrados": e.glucoseReadings.length,
      "Urgência": e.recommendation?.urgencyLevel === "critical" ? "Urgente" : 
                  e.recommendation?.urgencyLevel === "warning" ? "Atenção" : "Ok",
      "Data Avaliação": formatDate(e.createdAt),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pacientes Ativas");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `pacientes_ativas_${today}.xlsx`);
  };

  const activeCount = evaluations.filter(
    e => e.gestationalWeeks < 40 && e.gestationalAgeSource !== "propagated"
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Histórico de Avaliações
        </CardTitle>
        {activeCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportActivePatients}
                data-testid="button-export-active-patients"
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar ({activeCount})
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Exportar lista alfabética de pacientes ativas (IG &lt; 40s)</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {evaluations
            .sort((a, b) => {
              // Primary: urgency (critical first)
              const urgencyDiff = getUrgencyPriority(a.recommendation?.urgencyLevel) - getUrgencyPriority(b.recommendation?.urgencyLevel);
              if (urgencyDiff !== 0) return urgencyDiff;
              // Secondary: date (most recent first)
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .map((evaluation) => {
              const alerts = detectCriticalAlerts(evaluation.glucoseReadings);
              const daysRecorded = evaluation.glucoseReadings.length;
              const hasAlerts = alerts.hypoCount > 0 || alerts.severeHyperCount > 0;
              const isCritical = evaluation.recommendation?.urgencyLevel === "critical";
              const isCompleted = evaluation.gestationalWeeks >= 40 || evaluation.gestationalAgeSource === "propagated";
              
              return (
              <AccordionItem 
                key={evaluation.id} 
                value={String(evaluation.id)} 
                data-testid={`accordion-evaluation-${evaluation.id}`}
                className={isCompleted ? "opacity-50" : ""}
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left w-full">
                    {/* Alert indicator - discrete marker */}
                    <div className="flex-shrink-0 w-5">
                      {isCritical && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Caso prioritário</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    
                    {/* Date */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Calendar className="h-3 w-3" />
                      {formatShortDate(evaluation.createdAt)}
                    </div>
                    
                    {/* Patient name and info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{evaluation.patientName}</span>
                        {/* Gestational age badge */}
                        {evaluation.gestationalAgeSource === "propagated" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs font-normal border-amber-500 text-amber-600 dark:text-amber-400">
                                {evaluation.gestationalWeeks}s{evaluation.gestationalDays}d*
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>IG adaptada do último registro</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {evaluation.gestationalWeeks}s{evaluation.gestationalDays}d
                          </Badge>
                        )}
                        {/* Completed indicator */}
                        {isCompleted && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CheckCircle className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{evaluation.gestationalWeeks >= 40 ? "Gestação a termo" : "Acompanhamento encerrado"}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* Days recorded */}
                        <span className="text-xs text-muted-foreground">
                          {daysRecorded}d
                        </span>
                        {/* Insulin indicator */}
                        {evaluation.usesInsulin && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Syringe className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Em uso de insulina</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {/* Critical alerts mini-indicators */}
                      {hasAlerts && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {alerts.hypoCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                                  <TrendingDown className="h-3 w-3" />
                                  {alerts.hypoCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{alerts.hypoCount} episódio(s) de hipoglicemia</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {alerts.severeHyperCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {alerts.severeHyperCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{alerts.severeHyperCount} episódio(s) de hiperglicemia severa</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Urgency badge */}
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
              );
            })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
