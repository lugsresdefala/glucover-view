import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { 
  Users, 
  Mail,
  Phone,
  Baby,
  CheckCircle2,
  Clock,
  Search,
  ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { StoredEvaluation } from "@shared/schema";

interface PatientItem {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export default function AppPatients() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: patients = [], isLoading } = useQuery<PatientItem[]>({
    queryKey: ["/api/doctor/patients"],
    enabled: isAuthenticated && !!user,
  });

  const { data: evaluations = [] } = useQuery<StoredEvaluation[]>({
    queryKey: ["/api/evaluations"],
  });

  const getPatientStatus = (patientName: string) => {
    const patientEvals = evaluations.filter(
      e => e.patientName.toLowerCase() === patientName.toLowerCase()
    );
    
    if (patientEvals.length === 0) return null;
    
    const latestEval = patientEvals.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
    
    const isPostpartum = latestEval.gestationalWeeks !== undefined && latestEval.gestationalWeeks >= 40;
    const hasCritical = latestEval.recommendation?.urgencyLevel === "critical";
    const hasWarning = latestEval.recommendation?.urgencyLevel === "warning";
    
    return {
      lastEval: latestEval.createdAt,
      gestationalWeeks: latestEval.gestationalWeeks,
      gestationalDays: latestEval.gestationalDays,
      isPostpartum,
      hasCritical,
      hasWarning,
      evalCount: patientEvals.length,
    };
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimeAgo = (date: string | Date | undefined) => {
    if (!date) return "";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d atrás`;
    if (diffHours > 0) return `${diffHours}h atrás`;
    return "agora";
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Carregando pacientes...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Pacientes Vinculados
              <Badge variant="secondary" className="ml-2">{patients.length}</Badge>
            </CardTitle>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar paciente..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-patients"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {patients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium mb-1">Nenhum paciente vinculado</p>
              <p className="text-sm">Os pacientes aparecerão aqui quando se cadastrarem.</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum resultado para "{searchTerm}"</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredPatients.map((patient) => {
                  const status = getPatientStatus(patient.name);
                  
                  return (
                    <button
                      key={patient.id}
                      onClick={() => setLocation(`/app/history?patient=${encodeURIComponent(patient.name)}`)}
                      className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                      data-testid={`patient-${patient.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-11 w-11 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {patient.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{patient.name}</p>
                            {status?.isPostpartum && (
                              <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20 text-xs">
                                <Baby className="h-3 w-3 mr-1" />
                                Pós-parto
                              </Badge>
                            )}
                            {status?.hasCritical && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 text-xs">
                                Atenção
                              </Badge>
                            )}
                            {status?.hasWarning && !status?.hasCritical && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs">
                                Monitorar
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5 truncate">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{patient.email}</span>
                            </span>
                            {patient.phone && (
                              <span className="flex items-center gap-1.5 shrink-0">
                                <Phone className="h-3.5 w-3.5" />
                                {patient.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-right">
                          {status ? (
                            <>
                              <div className="flex items-center gap-1.5 text-sm">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span>{status.evalCount} avaliações</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{formatTimeAgo(status.lastEval)}</span>
                              </div>
                              {!status.isPostpartum && status.gestationalWeeks !== undefined && (
                                <p className="text-xs text-muted-foreground">
                                  {status.gestationalWeeks}s {status.gestationalDays}d
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem avaliações</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
