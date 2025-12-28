import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { 
  Send, 
  RotateCcw, 
  User, 
  LogOut, 
  Users, 
  Shield, 
  Stethoscope, 
  FileStack,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Plus,
  Eye,
  Clock,
  Trash2,
  CheckSquare,
  Square,
  X,
  FileText
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BatchImport } from "@/components/batch-import";
import { GlucoseInput } from "@/components/glucose-input";
import { InsulinInput } from "@/components/insulin-input";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { RecommendationModal } from "@/components/recommendation-modal";
import { GlucoseChart } from "@/components/glucose-chart";
import { PatientStats } from "@/components/patient-stats";
import { AnalyzingLoading } from "@/components/loading-spinner";
import { PDFExportButton } from "@/components/pdf-export";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  patientEvaluationSchema,
  type PatientEvaluation,
  type GlucoseReading,
  type InsulinRegimen,
  type StoredEvaluation,
  type AnalyzeResponse,
  roleDisplayNames,
  type UserRole,
  diabetesTypes,
  type DiabetesType,
} from "@shared/schema";

const diabetesTypeLabels: Record<DiabetesType, string> = {
  DMG: "Diabetes Mellitus Gestacional",
  DM1: "Diabetes Mellitus tipo 1",
  DM2: "Diabetes Mellitus tipo 2",
};

interface PatientItem {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface DashboardProps {
  section?: "dashboard" | "history" | "import" | "patients";
}

export default function Dashboard({ section = "dashboard" }: DashboardProps) {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [location] = useLocation();
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([{}]);
  const [insulinRegimens, setInsulinRegimens] = useState<InsulinRegimen[]>([]);
  const [currentRecommendation, setCurrentRecommendation] = useState<StoredEvaluation | null>(null);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [patientFromUrl, setPatientFromUrl] = useState<string | null>(null);
  
  const showBatchImport = section === "import";
  const showPatientList = section === "patients";
  const showHistory = section === "history" || section === "dashboard";

  const { data: patients = [], isLoading: isLoadingPatients } = useQuery<PatientItem[]>({
    queryKey: ["/api/doctor/patients"],
    enabled: isAuthenticated && !!user,
  });

  const userRole = (user?.role || "medico") as UserRole;
  const isAdmin = userRole === "admin" || userRole === "coordinator";

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = "/profissional/login";
    }
  }, [isAuthenticated, isAuthLoading]);

  const form = useForm<PatientEvaluation>({
    resolver: zodResolver(patientEvaluationSchema),
    defaultValues: {
      patientName: "",
      diabetesType: "DMG",
      weight: undefined,
      gestationalWeeks: 28,
      gestationalDays: 0,
      usesInsulin: false,
      dietAdherence: "boa",
      glucoseReadings: [{}],
      insulinRegimens: [],
    },
  });

  const hasProcessedPatientRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const patientParam = params.get("patient");
      if (patientParam && hasProcessedPatientRef.current !== patientParam) {
        const decodedName = decodeURIComponent(patientParam);
        hasProcessedPatientRef.current = patientParam;
        setPatientFromUrl(decodedName);
        form.setValue("patientName", decodedName);
        setShowEvaluationForm(true);
      }
    }
  }, [location, form]);

  const { data: rawEvaluations = [], isLoading: isLoadingHistory } = useQuery<StoredEvaluation[]>({
    queryKey: ["/api/doctor/evaluations"],
  });

  // Deduplicate evaluations by ID to prevent cache duplication issues
  const evaluations = useMemo(() => {
    const uniqueMap = new Map(rawEvaluations.map(e => [e.id, e]));
    return Array.from(uniqueMap.values());
  }, [rawEvaluations]);

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
      .slice(0, 10);
  }, [evaluations]);

  const formatTimeAgo = (date: string | Date | undefined) => {
    if (!date) return "";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `há ${diffDays}d`;
    if (diffHours > 0) return `há ${diffHours}h`;
    return "agora";
  };

  const analyzeMutation = useMutation({
    mutationFn: async (data: PatientEvaluation) => {
      const response = await apiRequest("POST", "/api/analyze", data);
      return await response.json() as AnalyzeResponse;
    },
    onSuccess: (data) => {
      setCurrentRecommendation(data.evaluation);
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/evaluations"] });
      setShowEvaluationForm(false);
      setShowRecommendationModal(true);
      toast({
        title: "Análise concluída",
        description: "A recomendação clínica foi gerada com sucesso.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sessão expirada",
          description: "Redirecionando para login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/profissional/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro na análise",
        description: error.message || "Não foi possível gerar a recomendação.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (params: { id?: number; ids?: number[]; deleteAll?: boolean }) => {
      if (params.id) {
        await apiRequest("DELETE", `/api/evaluations/${params.id}`);
      } else {
        await apiRequest("DELETE", "/api/evaluations", params);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor/evaluations"] });
      setSelectedIds(new Set());
      setSelectionMode(false);
      setCurrentRecommendation(null);
      toast({
        title: "Removido com sucesso",
        description: "As avaliações foram removidas do histórico.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover",
        description: error.message || "Não foi possível remover as avaliações.",
        variant: "destructive",
      });
    },
  });

  const toggleSelection = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === evaluations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(evaluations.map(e => e.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size > 0) {
      deleteMutation.mutate({ ids: Array.from(selectedIds) });
    }
  };

  const handleDeleteAll = () => {
    deleteMutation.mutate({ deleteAll: true });
  };

  const handleDeleteSingle = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate({ id });
  };

  const usesInsulin = form.watch("usesInsulin");
  const weight = form.watch("weight"); // Peso real da paciente - sem fallback
  const gestationalWeeks = form.watch("gestationalWeeks") || 28;
  const gestationalDays = form.watch("gestationalDays") || 0;

  const onSubmit = (data: PatientEvaluation) => {
    const evaluationData: PatientEvaluation = {
      ...data,
      glucoseReadings,
      insulinRegimens: usesInsulin ? insulinRegimens : [],
    };
    analyzeMutation.mutate(evaluationData);
  };

  const handleReset = () => {
    form.reset();
    setGlucoseReadings([{}]);
    setInsulinRegimens([]);
    setCurrentRecommendation(null);
  };

  const handleViewEvaluation = (evaluation: StoredEvaluation) => {
    setCurrentRecommendation(evaluation);
    form.setValue("patientName", evaluation.patientName);
    form.setValue("weight", evaluation.weight);
    form.setValue("gestationalWeeks", evaluation.gestationalWeeks);
    form.setValue("gestationalDays", evaluation.gestationalDays);
    form.setValue("usesInsulin", evaluation.usesInsulin);
    form.setValue("dietAdherence", evaluation.dietAdherence);
    setGlucoseReadings(evaluation.glucoseReadings);
    setInsulinRegimens(evaluation.insulinRegimens || []);
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-full">
      {/* Header contextual - diferente para cada seção */}
      {section === "dashboard" && (
        <div className="glass-panel mx-4 mt-4 p-4 border border-white/20 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Pacientes</span>
                <span className="text-2xl font-semibold tabular-nums" data-testid="text-total-patients">
                  {isLoadingPatients ? "..." : dashboardMetrics.totalPatients}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Avaliações</span>
                <span className="text-2xl font-semibold tabular-nums" data-testid="text-total-evaluations">
                  {isLoadingHistory ? "..." : dashboardMetrics.totalEvaluations}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Últimos 7 dias</span>
                <span className="text-2xl font-semibold tabular-nums" data-testid="text-recent-evaluations">
                  {isLoadingHistory ? "..." : dashboardMetrics.recentEvaluations}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {dashboardMetrics.criticalAlerts > 0 && (
                <Badge variant="destructive" data-testid="text-critical-alerts">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {dashboardMetrics.criticalAlerts} alertas
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {section === "history" && (
        <div className="glass-panel mx-4 mt-4 p-5 border border-white/20 dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">Histórico de Avaliações</h2>
              <p className="text-sm text-muted-foreground">
                {isLoadingHistory ? "Carregando..." : `${dashboardMetrics.totalEvaluations} avaliações realizadas`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {dashboardMetrics.criticalAlerts > 0 && (
                <Badge variant="destructive" data-testid="text-critical-alerts-history">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {dashboardMetrics.criticalAlerts} alertas críticos
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
            <div className="glass-subtle p-3 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
              <span className="text-xl font-semibold tabular-nums">
                {isLoadingHistory ? "..." : dashboardMetrics.totalEvaluations}
              </span>
            </div>
            <div className="glass-subtle p-3 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Pacientes</span>
              <span className="text-xl font-semibold tabular-nums">
                {isLoadingPatients ? "..." : dashboardMetrics.totalPatients}
              </span>
            </div>
            <div className="glass-subtle p-3 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Últimos 7 dias</span>
              <span className="text-xl font-semibold tabular-nums">
                {isLoadingHistory ? "..." : dashboardMetrics.recentEvaluations}
              </span>
            </div>
          </div>
        </div>
      )}

      <main className="p-4">
        <div className="flex flex-wrap gap-3 mb-6">
          <Dialog open={showEvaluationForm} onOpenChange={setShowEvaluationForm}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-evaluation">
                <Plus className="h-4 w-4 mr-2" />
                Nova Avaliação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0" hideCloseButton>
              <DialogHeader className="flex flex-row items-center justify-between gap-4 p-4 border-b bg-muted/30">
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Nova Avaliação de Paciente
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEvaluationForm(false)}
                  className="shrink-0"
                  data-testid="button-close-evaluation-form"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogHeader>
              <div className="p-6">
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="patientName"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome da Paciente</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Digite o nome completo"
                              {...field}
                              data-testid="input-patient-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="diabetesType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Diabetes</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-diabetes-type">
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {diabetesTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {diabetesTypeLabels[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso Atual (kg) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              min="30"
                              max="200"
                              placeholder="Ex: 65.5"
                              className="font-mono"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              data-testid="input-weight"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="gestationalWeeks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Semanas</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="42"
                                className="font-mono"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                data-testid="input-gestational-weeks"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gestationalDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dias</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="6"
                                className="font-mono"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                data-testid="input-gestational-days"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="dietAdherence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adesão à Dieta</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-diet-adherence">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="boa">Boa</SelectItem>
                              <SelectItem value="regular">Regular</SelectItem>
                              <SelectItem value="ruim">Ruim</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="usesInsulin"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Usa Insulina</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Paciente está em uso de insulina?
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-uses-insulin"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="abdominalCircumference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Circunferência Abdominal Fetal (mm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Opcional"
                              className="font-mono"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === "" ? undefined : parseFloat(e.target.value)
                                )
                              }
                              data-testid="input-abdominal-circumference"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="abdominalCircumferencePercentile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentil da CA</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="Opcional"
                              className="font-mono"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === "" ? undefined : parseFloat(e.target.value)
                                )
                              }
                              data-testid="input-ca-percentile"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {usesInsulin && (
                    <InsulinInput
                      regimens={insulinRegimens}
                      onRegimensChange={setInsulinRegimens}
                    />
                  )}

                  <GlucoseInput
                    readings={glucoseReadings}
                    onReadingsChange={setGlucoseReadings}
                    usesInsulin={usesInsulin}
                  />

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      disabled={analyzeMutation.isPending}
                      data-testid="button-analyze"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Analisar e Gerar Recomendação
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      data-testid="button-reset"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Limpar
                    </Button>
                  </div>

                  {analyzeMutation.isPending && (
                    <div className="py-4">
                      <AnalyzingLoading />
                    </div>
                  )}
                </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>

        </div>

        {showBatchImport && (
          <div className="mb-6">
            <BatchImport />
          </div>
        )}

        {showPatientList && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {isAdmin ? "Todas as Pacientes" : "Minhas Pacientes"}
                  </CardTitle>
                  <CardDescription>
                    {isAdmin 
                      ? "Você tem acesso a todas as pacientes do sistema" 
                      : "Pacientes vinculadas ao seu perfil"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPatients ? (
                <p className="text-muted-foreground text-center py-8">Carregando pacientes...</p>
              ) : patients.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma paciente vinculada.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {patients.map((patient) => (
                    <div 
                      key={patient.id} 
                      className="flex items-center gap-3 p-3 border hover-elevate cursor-pointer"
                      onClick={() => {
                        form.setValue("patientName", patient.name);
                        setShowEvaluationForm(true);
                      }}
                      data-testid={`card-patient-${patient.id}`}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{patient.name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{patient.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{patient.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showHistory && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Avaliações Recentes
                    </CardTitle>
                    <CardDescription>
                      Últimas análises realizadas
                    </CardDescription>
                  </div>
                  {evaluations.length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectionMode ? (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={toggleSelectAll}
                            data-testid="button-select-all"
                          >
                            {selectedIds.size === evaluations.length ? (
                              <><CheckSquare className="h-4 w-4 mr-1" /> Desmarcar</>
                            ) : (
                              <><Square className="h-4 w-4 mr-1" /> Selec. Todos</>
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                disabled={selectedIds.size === 0 || deleteMutation.isPending}
                                data-testid="button-delete-selected"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remover ({selectedIds.size})
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover {selectedIds.size} avaliação(ões)? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelected}>
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                            data-testid="button-cancel-selection"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectionMode(true)}
                            data-testid="button-enable-selection"
                          >
                            <CheckSquare className="h-4 w-4 mr-1" />
                            Selecionar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                disabled={deleteMutation.isPending}
                                data-testid="button-delete-all"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Limpar Tudo
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Limpar todo o histórico</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover TODAS as {evaluations.length} avaliações? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Limpar Tudo
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : evaluations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma avaliação realizada ainda.</p>
                    <p className="text-sm">Clique em "Nova Avaliação" para começar.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {[...evaluations].sort((a, b) => 
                        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                      ).map((evaluation) => {
                        const urgency = evaluation.recommendation?.urgencyLevel || "info";
                        const triageClass = urgency === "critical" 
                          ? "triage-item-critical" 
                          : urgency === "warning" 
                            ? "triage-item-warning" 
                            : "triage-item-info";
                        return (
                        <div
                          key={evaluation.id}
                          className={`triage-item ${triageClass} ${
                            selectedIds.has(evaluation.id) ? "bg-muted/50 border-primary" : ""
                          }`}
                          onClick={() => selectionMode ? toggleSelection(evaluation.id, { stopPropagation: () => {} } as React.MouseEvent) : handleViewEvaluation(evaluation)}
                          data-testid={`card-evaluation-${evaluation.id}`}
                        >
                          {selectionMode && (
                            <div 
                              className="flex-shrink-0"
                              onClick={(e) => toggleSelection(evaluation.id, e)}
                            >
                              {selectedIds.has(evaluation.id) ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>
                                {evaluation.patientName[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {evaluation.patientName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {evaluation.gestationalWeeks}sem {evaluation.gestationalDays}d
                                {evaluation.usesInsulin && " • Insulina"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground hidden sm:block">
                              {formatDate(evaluation.createdAt)}
                            </span>
                            {!selectionMode && (
                              <>
                                <Button size="icon" variant="ghost">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`button-delete-${evaluation.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remover avaliação</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Deseja remover a avaliação de {evaluation.patientName}?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={(e) => handleDeleteSingle(evaluation.id, e)}>
                                        Remover
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      );})}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {currentRecommendation?.recommendation && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Recomendação Gerada</p>
                        <p className="text-sm text-muted-foreground">
                          Paciente: {currentRecommendation.patientName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PDFExportButton evaluation={currentRecommendation} />
                      <Button 
                        onClick={() => setShowRecommendationModal(true)}
                        data-testid="button-view-recommendation"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Análise
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentRecommendation && glucoseReadings.some((r) => Object.values(r).some((v) => v !== undefined)) && (
              <>
                <PatientStats
                  readings={glucoseReadings}
                  gestationalWeeks={gestationalWeeks}
                  gestationalDays={gestationalDays}
                  weight={weight ?? currentRecommendation.weight}
                />
                <GlucoseChart readings={glucoseReadings} />
              </>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Ações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setShowEvaluationForm(true)}
                  data-testid="button-quick-evaluation"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Avaliação
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  asChild
                  data-testid="button-quick-batch"
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
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Atenção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Existem <strong>{dashboardMetrics.criticalAlerts}</strong> avaliações 
                    com valores glicêmicos críticos que podem necessitar de atenção.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        )}
      </main>

      <footer className="border-t border-border mt-12">
        <div className="w-full px-4 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Sistema de suporte à decisão clínica para Diabetes Mellitus Gestacional.
            <br />
            Baseado nas Diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025. Decisões finais devem ser tomadas por profissional de saúde.
          </p>
        </div>
      </footer>

      <RecommendationModal
        recommendation={currentRecommendation?.recommendation || null}
        patientName={currentRecommendation?.patientName || ""}
        open={showRecommendationModal}
        onOpenChange={setShowRecommendationModal}
      />
    </div>
  );
}
