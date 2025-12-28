import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Check, X, UserPlus, Clock, AlertCircle } from "lucide-react";
import { roleDisplayNames } from "@shared/models/auth";

interface PendingUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
  createdAt: string;
}

export default function UserApprovals() {
  const { toast } = useToast();

  const { data: pendingUsers = [], isLoading, error } = useQuery<PendingUser[]>({
    queryKey: ["/api/admin/pending-users"],
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/approve-user/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      toast({
        title: "Usuário aprovado",
        description: "O usuário agora pode acessar o sistema.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível aprovar o usuário.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/reject-user/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      toast({
        title: "Usuário rejeitado",
        description: "O cadastro foi removido do sistema.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível rejeitar o usuário.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleDisplayName = (role: string) => {
    return roleDisplayNames[role as keyof typeof roleDisplayNames] || role;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Erro ao carregar usuários pendentes</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Aprovação de Usuários</h1>
          <p className="text-muted-foreground">Gerencie os cadastros pendentes de aprovação</p>
        </div>
      </div>

      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">Nenhum cadastro pendente</p>
              <p className="text-sm">Todos os usuários estão aprovados.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {pendingUsers.length} cadastro(s) aguardando aprovação
          </p>
          
          {pendingUsers.map((user) => (
            <Card key={user.id} data-testid={`card-pending-user-${user.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <div className="flex-1">
                  <CardTitle className="text-lg" data-testid={`text-user-name-${user.id}`}>
                    {user.firstName} {user.lastName || ""}
                  </CardTitle>
                  <CardDescription data-testid={`text-user-email-${user.id}`}>
                    {user.email}
                  </CardDescription>
                </div>
                <Badge variant="secondary" data-testid={`badge-role-${user.id}`}>
                  {getRoleDisplayName(user.role)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Cadastrado em: {formatDate(user.createdAt)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejectMutation.mutate(user.id)}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      data-testid={`button-reject-${user.id}`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(user.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      data-testid={`button-approve-${user.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
