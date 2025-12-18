import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/landing";
import PatientAuth from "@/pages/patient-auth";
import PatientDashboard from "@/pages/patient-dashboard";
import ProfessionalAuth from "@/pages/professional-auth";
import { FullPageLoading } from "@/components/loading-spinner";

function PatientRoutes() {
  const [location] = useLocation();
  const { data: patientData, isLoading } = useQuery<{ patient: { id: number; name: string } | null }>({
    queryKey: ["/api/patient/me"],
  });

  if (isLoading) {
    return <FullPageLoading text="Verificando autenticação..." />;
  }

  // If on patient login page, show it
  if (location === "/paciente/login") {
    return <PatientAuth />;
  }

  // If patient is logged in, show dashboard
  if (patientData?.patient) {
    return <PatientDashboard />;
  }

  // Not logged in, redirect to login
  return <PatientAuth />;
}

function ProfessionalRoutes() {
  const [location] = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  // If on professional login page, show it
  if (location === "/profissional/login") {
    return <ProfessionalAuth />;
  }

  if (isLoading) {
    return <FullPageLoading text="Verificando autenticação..." />;
  }

  // If authenticated, show dashboard
  if (isAuthenticated) {
    return <Dashboard />;
  }

  // Not logged in, show landing page
  return <Landing />;
}

function AuthenticatedApp() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  // Handle patient routes separately
  if (location.startsWith("/paciente")) {
    return <PatientRoutes />;
  }

  // Handle professional login route
  if (location === "/profissional/login") {
    return <ProfessionalAuth />;
  }

  if (isLoading) {
    return <FullPageLoading text="Verificando autenticação..." />;
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dmg-assist-theme">
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <div className="fixed top-3 right-4 z-50">
              <ThemeToggle />
            </div>
            <Switch>
              <Route path="/paciente/:rest*" component={PatientRoutes} />
              <Route path="/paciente" component={PatientRoutes} />
              <Route component={AuthenticatedApp} />
            </Switch>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
