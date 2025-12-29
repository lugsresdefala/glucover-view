import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { 
  Users, 
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Plus,
  Eye,
  Clock,
  FileStack,
  Activity
} from "lucide-react";
import { RecommendationModal } from "@/components/recommendation-modal";
import type { StoredEvaluation } from "@shared/schema";

interface PatientItem {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export default function AppHome() {
  const { user, isAuthenticated } = useAuth();
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<StoredEvaluation | null>(null);

  const { data: patients = [] } = useQuery<PatientItem[]>({
    queryKey: ["/api/doctor/patients"],
    enabled: isAuthenticated && !!user,
  });

  const { data: evaluations = [] } = useQuery<StoredEvaluation[]>({
    queryKey: ["/api/doctor/evaluations"],
  });

  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentEvaluations = evaluations.filter(e => 
      new Date(e.createdAt || 0) > sevenDaysAgo
    );

    const criticalAlerts = evaluations.filter(e => {
      if (!e.glucoseReadings) return false;
      return e.glucoseReadings.some(r => {
        const values = Object.values(r).filter(v => typeof v === "number") as number[];
        return values.some(v => v < 60 || v > 200);
      });
    });

    const uniquePatients = new Set(evaluations.map(e => e.patientName.toLowerCase()));

    return {
      totalPatients: patients.length || uniquePatients.size,
      totalEvaluations: evaluations.length,
      recentEvaluations: recentEvaluations.length,
      criticalAlerts: criticalAlerts.length,
    };
  }, [evaluations, patients]);

  const clinicalTasks = useMemo(() => {
    const urgencyWeight = { critical: 3, warning: 2, info: 1 } as Record<string, number>;
    return evaluations
      .filter(e => e.recommendation?.nextSteps?.length)
      .map(e => ({
        id: e.id,
        patientName: e.patientName,
        urgency: (e.recommendation?.urgencyLevel || "info") as "critical" | "warning" | "info",
        summary: e.recommendation?.nextSteps?.[0] || "",
        gestationalWeeks: e.gestationalWeeks,
        gestationalDays: e.gestationalDays,
        issuedAt: e.createdAt,
        evaluation: e,
      }))
      .sort((a, b) =>
        (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0) ||
        new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime()
      )
      .slice(0, 8);
  }, [evaluations]);

  const formatTimeAgo = (date: string | Date | undefined) => {
    if (!date) return "";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return "agora";
  };

  const handleViewRecommendation = (evaluation: StoredEvaluation) => {
    setSelectedEvaluation(evaluation);
    setShowRecommendationModal(true);
  };

  const urgencyStyles = {
    critical: {
      container: "bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-300",
      dot: "bg-red-500",
    },
    warning: {
      container: "bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
    },
    info: {
      container: "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
  };

  const urgencyLabels = {
    critical: "Alerta",
    warning: "Vigilância", 
    info: "Adequado",
  };

  return (
    <div className="p-6 w-full space-y-6 min-h-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80" data-testid="metric-patients">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums">{dashboardMetrics.totalPatients}</p>
                <p className="text-sm text-muted-foreground truncate">Pacientes</p>
              </div>
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80" data-testid="metric-evaluations">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums">{dashboardMetrics.totalEvaluations}</p>
                <p className="text-sm text-muted-foreground truncate">Avaliações</p>
              </div>
              <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80" data-testid="metric-recent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums">{dashboardMetrics.recentEvaluations}</p>
                <p className="text-sm text-muted-foreground truncate">Últimos 7 dias</p>
              </div>
              <div className="w-10 h-10 bg-sky-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80 ${dashboardMetrics.criticalAlerts > 0 ? "border-red-500/30" : ""}`} data-testid="metric-alerts">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums">{dashboardMetrics.criticalAlerts}</p>
                <p className="text-sm text-muted-foreground truncate">Alertas</p>
              </div>
              <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${dashboardMetrics.criticalAlerts > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                <AlertTriangle className={`h-5 w-5 ${dashboardMetrics.criticalAlerts > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Tarefas Clínicas Pendentes
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/history">
                  Ver todas
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {clinicalTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma tarefa pendente</p>
              </div>
            ) : (
              <ScrollArea className="h-[320px] pr-3">
                <div className="space-y-2">
                  {clinicalTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleViewRecommendation(task.evaluation)}
                      className="w-full text-left p-3 border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                      data-testid={`task-${task.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div 
                          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${urgencyStyles[task.urgency].container} ${urgencyStyles[task.urgency].text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${urgencyStyles[task.urgency].dot}`} />
                          {urgencyLabels[task.urgency]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.patientName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.summary}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(task.issuedAt)}</span>
                          <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Acesso Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                asChild
                data-testid="button-new-evaluation"
              >
                <Link href="/app/history">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Avaliação
                </Link>
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                asChild
                data-testid="button-quick-import"
              >
                <Link href="/app/import">
                  <FileStack className="h-4 w-4 mr-2" />
                  Importar Planilhas
                </Link>
              </Button>
              {patients.length > 0 && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  asChild
                  data-testid="button-quick-patients"
                >
                  <Link href="/app/patients">
                    <Users className="h-4 w-4 mr-2" />
                    Lista de Pacientes
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {dashboardMetrics.criticalAlerts > 0 && (
            <Card className="bg-red-100/90 backdrop-blur-sm border-red-300/50 dark:bg-red-900/80 dark:border-red-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção Necessária
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>{dashboardMetrics.criticalAlerts}</strong> avaliações com valores glicêmicos críticos.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Última atualização</p>
                  <p className="text-xs text-muted-foreground">
                    {evaluations.length > 0 
                      ? formatTimeAgo(evaluations[0]?.createdAt)
                      : "Sem avaliações"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <RecommendationModal
        recommendation={selectedEvaluation?.recommendation || null}
        patientName={selectedEvaluation?.patientName || ""}
        open={showRecommendationModal}
        onOpenChange={setShowRecommendationModal}
      />
    </div>
  );
}
