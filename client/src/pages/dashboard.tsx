import { useState, useEffect, useMemo } from "react";
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
  Clock
} from "lucide-react";
import { BatchImport } from "@/components/batch-import";
import { GlucoseInput } from "@/components/glucose-input";
import { InsulinInput } from "@/components/insulin-input";
import { RecommendationPanel } from "@/components/recommendation-panel";
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
} from "@shared/schema";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

interface PatientItem {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([{}]);
  const [insulinRegimens, setInsulinRegimens] = useState<InsulinRegimen[]>([]);
  const [currentRecommendation, setCurrentRecommendation] = useState<StoredEvaluation | null>(null);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);

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
      weight: 70,
      gestationalWeeks: 28,
      gestationalDays: 0,
      usesInsulin: false,
      dietAdherence: "boa",
      glucoseReadings: [{}],
      insulinRegimens: [],
    },
  });

  const { data: evaluations = [], isLoading: isLoadingHistory } = useQuery<StoredEvaluation[]>({
    queryKey: ["/api/evaluations"],
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

  const analyzeMutation = useMutation({
    mutationFn: async (data: PatientEvaluation) => {
      const response = await apiRequest("POST", "/api/analyze", data);
      return await response.json() as AnalyzeResponse;
    },
    onSuccess: (data) => {
      setCurrentRecommendation(data.evaluation);
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
      setShowEvaluationForm(false);
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

  const usesInsulin = form.watch("usesInsulin");
  const weight = form.watch("weight") || 70;
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img 
              src={hapvidaLogo} 
              alt="Hapvida" 
              className="h-10 w-auto"
              data-testid="img-logo"
            />
            <div className="border-l border-border pl-3">
              <h1 className="text-lg font-semibold">DMG Assist</h1>
              <p className="text-xs text-muted-foreground">Suporte à Decisão Clínica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="hidden sm:flex gap-1">
                  {isAdmin ? <Shield className="h-3 w-3" /> : <Stethoscope className="h-3 w-3" />}
                  {roleDisplayNames[userRole] || userRole}
                </Badge>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.firstName || user.email}
                </span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              data-testid="button-logout"
              onClick={async () => {
                await apiRequest("POST", "/api/user/logout");
                await queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
                window.location.href = "/";
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Pacientes
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-patients">
                {isLoadingPatients ? "..." : dashboardMetrics.totalPatients}
              </div>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "em todo o sistema" : "vinculados a você"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avaliações Realizadas
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-evaluations">
                {isLoadingHistory ? "..." : dashboardMetrics.totalEvaluations}
              </div>
              <p className="text-xs text-muted-foreground">
                total de análises
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimos 7 Dias
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-recent-evaluations">
                {isLoadingHistory ? "..." : dashboardMetrics.recentEvaluations}
              </div>
              <p className="text-xs text-muted-foreground">
                novas avaliações
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas Críticos
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-critical-alerts">
                {isLoadingHistory ? "..." : dashboardMetrics.criticalAlerts}
              </div>
              <p className="text-xs text-muted-foreground">
                pacientes com valores extremos
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Dialog open={showEvaluationForm} onOpenChange={setShowEvaluationForm}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-evaluation">
                <Plus className="h-4 w-4 mr-2" />
                Nova Avaliação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Nova Avaliação de Paciente
                </DialogTitle>
              </DialogHeader>
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
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso Atual (kg)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              min="30"
                              max="200"
                              className="font-mono"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
            </DialogContent>
          </Dialog>

          <Button 
            variant={showBatchImport ? "secondary" : "outline"}
            onClick={() => setShowBatchImport(!showBatchImport)}
            data-testid="button-toggle-batch-import"
          >
            <FileStack className="h-4 w-4 mr-2" />
            Importar Lote
          </Button>

          {patients.length > 0 && (
            <Button 
              variant={showPatientList ? "secondary" : "outline"}
              onClick={() => setShowPatientList(!showPatientList)}
              data-testid="button-toggle-patients"
            >
              <Users className="h-4 w-4 mr-2" />
              Ver Pacientes ({patients.length})
            </Button>
          )}
        </div>

        {showBatchImport && (
          <div className="mb-6">
            <BatchImport />
          </div>
        )}

        {showPatientList && patients.length > 0 && (
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowPatientList(false)}
                >
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {patients.map((patient) => (
                  <div 
                    key={patient.id} 
                    className="flex items-center gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                    onClick={() => {
                      form.setValue("patientName", patient.name);
                      setShowPatientList(false);
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
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Avaliações Recentes
                </CardTitle>
                <CardDescription>
                  Últimas análises realizadas
                </CardDescription>
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
                      ).slice(0, 20).map((evaluation) => (
                        <div
                          key={evaluation.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                          onClick={() => handleViewEvaluation(evaluation)}
                          data-testid={`card-evaluation-${evaluation.id}`}
                        >
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
                            <Button size="icon" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {currentRecommendation?.recommendation && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <PDFExportButton evaluation={currentRecommendation} />
                </div>
                <RecommendationPanel
                  recommendation={currentRecommendation.recommendation}
                  patientName={currentRecommendation.patientName}
                />
              </div>
            )}

            {currentRecommendation && glucoseReadings.some((r) => Object.values(r).some((v) => v !== undefined)) && (
              <>
                <PatientStats
                  readings={glucoseReadings}
                  gestationalWeeks={gestationalWeeks}
                  gestationalDays={gestationalDays}
                  weight={weight}
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
                  onClick={() => setShowBatchImport(true)}
                  data-testid="button-quick-batch"
                >
                  <FileStack className="h-4 w-4 mr-2" />
                  Importar Planilhas
                </Button>
                {patients.length > 0 && (
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setShowPatientList(true)}
                    data-testid="button-quick-patients"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Lista de Pacientes
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
      </main>

      <footer className="border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Sistema de suporte à decisão clínica para Diabetes Mellitus Gestacional.
            <br />
            Baseado nas Diretrizes DMG 2024. Decisões finais devem ser tomadas por profissional de saúde.
          </p>
        </div>
      </footer>
    </div>
  );
}
