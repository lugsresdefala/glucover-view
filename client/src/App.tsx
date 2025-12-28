import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppLayout } from "@/components/app-layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/landing";
import PatientAuth from "@/pages/patient-auth";
import PatientDashboard from "@/pages/patient-dashboard";
import ProfessionalAuth from "@/pages/professional-auth";
import AppHome from "@/pages/app-home";
import AppPatients from "@/pages/app-patients";
import AppImport from "@/pages/app-import";
import { FullPageLoading } from "@/components/loading-spinner";

function PatientRoutes() {
  const [location] = useLocation();
  
  const { data: patientData, isLoading } = useQuery<{ patient: { id: number; name: string } | null }>({
    queryKey: ["/api/patient/me"],
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: location !== "/paciente/login",
  });

  if (location === "/paciente/login") {
    return <PatientAuth />;
  }

  if (isLoading) {
    return <FullPageLoading text="Verificando autenticação..." />;
  }

  if (patientData?.patient) {
    return <PatientDashboard />;
  }

  return <PatientAuth />;
}

function AuthenticatedApp() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (location.startsWith("/paciente")) {
    return <PatientRoutes />;
  }

  if (location === "/profissional/login") {
    return <ProfessionalAuth />;
  }

  if (isLoading) {
    return <FullPageLoading text="Verificando autenticação..." />;
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  const renderContent = () => {
    if (location === "/app" || location === "/app/") {
      return <AppHome />;
    }
    if (location.includes("/app/patients")) {
      return <AppPatients />;
    }
    if (location.includes("/app/import")) {
      return <AppImport />;
    }
    if (location.includes("/app/history")) {
      return <Dashboard section="history" />;
    }
    return <AppHome />;
  };

  return (
    <AppLayout showPatientList={true}>
      {renderContent()}
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dmg-assist-theme">
        <TooltipProvider>
          <ErrorBoundary>
            <div className="min-h-screen bg-background">
              <Switch>
                <Route path="/paciente/:rest*" component={PatientRoutes} />
                <Route path="/paciente" component={PatientRoutes} />
                <Route component={AuthenticatedApp} />
              </Switch>
            </div>
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
