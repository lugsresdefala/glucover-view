import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogOut, Plus, FileText, AlertTriangle, Info, AlertCircle, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { StoredEvaluation, ClinicalRecommendation } from "@shared/schema";
import { PatientEvaluationForm } from "@/components/patient-evaluation-form";

interface PatientInfo {
  id: number;
  email: string;
  name: string;
  phone?: string;
}

export default function PatientDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showNewEntry, setShowNewEntry] = useState(false);

  const { data: patientData, isLoading: isLoadingPatient } = useQuery<{ patient: PatientInfo | null }>({
    queryKey: ["/api/patient/me"],
  });

  const { data: evaluations, isLoading: isLoadingEvaluations } = useQuery<StoredEvaluation[]>({
    queryKey: ["/api/patient/evaluations"],
    enabled: !!patientData?.patient,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/patient/logout", {});
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
  });

  if (isLoadingPatient) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!patientData?.patient) {
    setLocation("/paciente/login");
    return null;
  }

  const patient = patientData.patient;

  const getUrgencyBadge = (urgencyLevel: ClinicalRecommendation["urgencyLevel"]) => {
    switch (urgencyLevel) {
      case "critical":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Urgente</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertCircle className="h-3 w-3 mr-1" />Atenção</Badge>;
      default:
        return <Badge variant="outline"><Info className="h-3 w-3 mr-1" />Informativo</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">GlucoVer</h1>
              <p className="text-xs text-muted-foreground">Portal da Paciente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span data-testid="text-patient-name">{patient.name}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => logoutMutation.mutate()}
              data-testid="button-patient-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!showNewEntry ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Minhas Glicemias</h2>
                <p className="text-muted-foreground">Registre suas glicemias e acompanhe as orientações</p>
              </div>
              <Button onClick={() => setShowNewEntry(true)} data-testid="button-new-entry">
                <Plus className="h-4 w-4 mr-2" />
                Nova Avaliação
              </Button>
            </div>

            {isLoadingEvaluations ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : evaluations && evaluations.length > 0 ? (
              <div className="space-y-4">
                {evaluations.map((evaluation) => (
                  <Card key={evaluation.id} data-testid={`card-evaluation-${evaluation.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg">
                            {format(new Date(evaluation.createdAt), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                          </CardTitle>
                          <CardDescription>
                            {evaluation.gestationalWeeks} semanas e {evaluation.gestationalDays} dias
                          </CardDescription>
                        </div>
                        {evaluation.recommendation && getUrgencyBadge(evaluation.recommendation.urgencyLevel)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {evaluation.recommendation ? (
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium text-sm mb-1">Orientação Principal</h4>
                            <p className="text-sm text-muted-foreground">{evaluation.recommendation.mainRecommendation}</p>
                          </div>
                          {evaluation.recommendation.nextSteps.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm mb-1">Próximos Passos</h4>
                              <ul className="text-sm text-muted-foreground space-y-1">
                                {evaluation.recommendation.nextSteps.map((step, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-primary">-</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Avaliação sem recomendação disponível</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum registro ainda</h3>
                  <p className="text-muted-foreground mb-4">
                    Clique no botão acima para registrar suas glicemias
                  </p>
                  <Button onClick={() => setShowNewEntry(true)} data-testid="button-first-entry">
                    <Plus className="h-4 w-4 mr-2" />
                    Fazer Primeiro Registro
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <PatientEvaluationForm 
            patientName={patient.name}
            onCancel={() => setShowNewEntry(false)}
            onSuccess={() => {
              setShowNewEntry(false);
              queryClient.invalidateQueries({ queryKey: ["/api/patient/evaluations"] });
            }}
          />
        )}
      </main>
    </div>
  );
}
