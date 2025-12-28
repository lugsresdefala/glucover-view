import { ReactNode, useEffect, useState, useLayoutEffect } from "react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  LayoutDashboard, 
  ClipboardList,
  FileStack,
  Users,
  LogOut,
  Activity,
  Stethoscope,
  Shield,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { roleDisplayNames, type UserRole } from "@shared/schema";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

function useMediaQuery(query: string) {
  const getMatches = () => {
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  };
  
  const [matches, setMatches] = useState(getMatches);
  
  useLayoutEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  
  return matches;
}

const roleIcons: Record<UserRole, typeof Stethoscope> = {
  admin: Shield,
  coordinator: Shield,
  medico: Stethoscope,
  enfermeira: Activity,
  nutricionista: Activity,
};

interface AppLayoutProps {
  children: ReactNode;
  showPatientList?: boolean;
}

function SidebarAutoCollapse({ isMobile }: { isMobile: boolean }) {
  const { setOpen } = useSidebar();
  
  useEffect(() => {
    if (isMobile) {
      setOpen(false);
    }
  }, [isMobile, setOpen]);
  
  return null;
}

function SidebarHeaderContent() {
  const { open, openMobile, isMobile, setOpenMobile } = useSidebar();
  const isOpen = isMobile ? openMobile : open;
  
  if (!isOpen) {
    return (
      <div className="flex justify-center">
        <div className="h-8 w-8 bg-sidebar-accent text-sidebar-accent-foreground flex items-center justify-center text-sm font-bold">
          G
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-3">
      {isMobile && (
        <Button 
          variant="ghost" 
          size="icon"
          className="shrink-0 text-sidebar-foreground"
          onClick={() => setOpenMobile(false)}
          data-testid="button-close-sidebar"
        >
          <X className="h-5 w-5" />
        </Button>
      )}
      <img 
        src={hapvidaLogo} 
        alt="Hapvida" 
        className="h-8 w-auto shrink-0 max-w-[100px]"
      />
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-sidebar-foreground truncate">GluCover</h1>
        <p className="text-xs text-sidebar-foreground/60 truncate">Apoio à Decisão Clínica</p>
      </div>
    </div>
  );
}

function SidebarFooterContent({ user, userRole, RoleIcon, onLogout }: { 
  user: any; 
  userRole: UserRole; 
  RoleIcon: typeof Stethoscope;
  onLogout: () => void;
}) {
  const { open, openMobile, isMobile } = useSidebar();
  const isOpen = isMobile ? openMobile : open;
  
  if (!user) return null;
  
  if (!isOpen) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
            {user.firstName?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-sidebar-foreground/70"
          onClick={onLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
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
        className="w-full justify-start text-sidebar-foreground/70"
        onClick={onLogout}
        data-testid="button-logout"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sair
      </Button>
    </div>
  );
}

export function AppLayout({ children, showPatientList = false }: AppLayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const userRole = (user?.role || "medico") as UserRole;
  const RoleIcon = roleIcons[userRole] || Stethoscope;
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const getActiveSection = () => {
    if (location.includes("/history")) return "history";
    if (location.includes("/import")) return "import";
    if (location.includes("/patients")) return "patients";
    return "dashboard";
  };

  const activeSection = getActiveSection();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/user/logout");
      await queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/";
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  const menuItems = [
    { 
      id: "dashboard", 
      label: "Painel", 
      icon: LayoutDashboard, 
      href: "/app" 
    },
    { 
      id: "history", 
      label: "Avaliações", 
      icon: ClipboardList, 
      href: "/app/history" 
    },
    { 
      id: "import", 
      label: "Importar", 
      icon: FileStack, 
      href: "/app/import" 
    },
  ];

  if (showPatientList) {
    menuItems.push({ 
      id: "patients", 
      label: "Pacientes", 
      icon: Users, 
      href: "/app/patients" 
    });
  }

  return (
    <SidebarProvider 
      style={sidebarStyle as React.CSSProperties}
      defaultOpen={!isMobile}
    >
      <SidebarAutoCollapse isMobile={isMobile} />
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarHeader className="px-4 py-3 border-b border-sidebar-border group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
            <SidebarHeaderContent />
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
                        asChild
                        isActive={activeSection === item.id}
                        data-testid={`nav-${item.id}`}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="px-4 py-3 border-t border-sidebar-border group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
            <SidebarFooterContent 
              user={user} 
              userRole={userRole} 
              RoleIcon={RoleIcon} 
              onLogout={handleLogout} 
            />
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-6 py-4 glass border-b border-border/30">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="md:hidden flex items-center gap-2">
                <img 
                  src={hapvidaLogo} 
                  alt="Hapvida" 
                  className="h-6 w-auto"
                />
                <span className="font-semibold text-foreground">GluCover</span>
              </div>
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

          <main className="flex-1 overflow-auto bg-gradient-to-br from-blue-100 via-indigo-100 to-slate-200 dark:from-blue-950 dark:via-indigo-900 dark:to-slate-900">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
