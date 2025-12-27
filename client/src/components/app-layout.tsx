import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  ClipboardList,
  FileStack,
  Users,
  Settings,
  LogOut,
  Activity,
  Stethoscope,
  Shield
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { roleDisplayNames, type UserRole } from "@shared/schema";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

const roleIcons: Record<UserRole, typeof Stethoscope> = {
  admin: Shield,
  coordinator: Shield,
  medico: Stethoscope,
  enfermeira: Activity,
  nutricionista: Activity,
};

interface AppLayoutProps {
  children: ReactNode;
  onNavigate?: (section: string) => void;
  activeSection?: string;
  showPatientList?: boolean;
}

export function AppLayout({ children, onNavigate, activeSection = "dashboard", showPatientList = false }: AppLayoutProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const userRole = (user?.role || "medico") as UserRole;
  const RoleIcon = roleIcons[userRole] || Stethoscope;

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  const menuItems = [
    { 
      id: "dashboard", 
      label: "Painel Principal", 
      icon: LayoutDashboard, 
      onClick: () => onNavigate?.("dashboard") 
    },
    { 
      id: "history", 
      label: "Histórico", 
      icon: ClipboardList, 
      onClick: () => onNavigate?.("history") 
    },
    { 
      id: "import", 
      label: "Importar Dados", 
      icon: FileStack, 
      onClick: () => onNavigate?.("import") 
    },
  ];

  if (showPatientList) {
    menuItems.push({ 
      id: "patients", 
      label: "Pacientes", 
      icon: Users, 
      onClick: () => onNavigate?.("patients") 
    });
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <img 
                src={hapvidaLogo} 
                alt="Hapvida" 
                className="h-8 w-auto"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-sidebar-foreground truncate">GluCover</h1>
                <p className="text-xs text-sidebar-foreground/60 truncate">Apoio à Decisão Clínica</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
                Menu Principal
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={item.onClick}
                        isActive={activeSection === item.id}
                        className="w-full"
                        data-testid={`nav-${item.id}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-sidebar-border">
            {user && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
                      {user.firstName?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {user.firstName} {user.lastName || ""}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <RoleIcon className="h-3 w-3 text-sidebar-foreground/60" />
                      <span className="text-xs text-sidebar-foreground/60">
                        {roleDisplayNames[userRole]}
                      </span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-6 py-4 glass border-b border-border/30">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="hidden md:flex items-center gap-3">
                {activeSection === "dashboard" && <LayoutDashboard className="h-5 w-5 text-primary" />}
                {activeSection === "history" && <ClipboardList className="h-5 w-5 text-primary" />}
                {activeSection === "import" && <FileStack className="h-5 w-5 text-primary" />}
                {activeSection === "patients" && <Users className="h-5 w-5 text-primary" />}
                <div>
                  <h2 className="type-title text-foreground">
                    {activeSection === "dashboard" && "Painel Principal"}
                    {activeSection === "history" && "Histórico de Avaliações"}
                    {activeSection === "import" && "Importar Planilhas"}
                    {activeSection === "patients" && "Lista de Pacientes"}
                  </h2>
                  <p className="type-caption">
                    {activeSection === "dashboard" && "Resumo de avaliações e acesso rápido"}
                    {activeSection === "history" && "Consulte avaliações anteriores"}
                    {activeSection === "import" && "Importação de dados em lote"}
                    {activeSection === "patients" && "Gestão de pacientes vinculados"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
