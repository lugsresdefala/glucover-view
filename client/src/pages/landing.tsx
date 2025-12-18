import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, FileText, Users, CheckCircle, User, Stethoscope, Shield } from "lucide-react";
import { Link } from "wouter";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild data-testid="button-patient-access">
              <Link href="/paciente/login">
                <User className="h-4 w-4 mr-2" />
                Sou Paciente
              </Link>
            </Button>
            <Button asChild data-testid="button-login">
              <Link href="/profissional/login">
                <Stethoscope className="h-4 w-4 mr-2" />
                Profissional
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Sistema de Suporte à Decisão Clínica para{" "}
              <span className="text-primary">Diabetes Gestacional</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Analise dados glicêmicos, gere recomendações baseadas em evidências e
              acompanhe o tratamento de suas pacientes com DMG.
            </p>
            <Button size="lg" asChild data-testid="button-login-hero">
              <Link href="/profissional/login">Começar Agora</Link>
            </Button>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-12">Recursos Principais</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <TrendingUp className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Análise de Glicemia</CardTitle>
                  <CardDescription>
                    Visualize padrões glicêmicos e identifique valores fora da meta automaticamente.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <FileText className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Recomendações Baseadas em Evidências</CardTitle>
                  <CardDescription>
                    Condutas sugeridas seguem as diretrizes brasileiras para DMG (R1-R7).
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Users className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Histórico de Pacientes</CardTitle>
                  <CardDescription>
                    Acompanhe a evolução do tratamento com histórico completo de avaliações.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-12">Baseado nas Diretrizes DMG</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "R1: Início de terapia farmacológica após 7-14 dias de dieta",
                "R2: Insulina como primeira escolha farmacológica",
                "R3: Critério de crescimento fetal para início de insulina",
                "R4: Dose inicial de 0,5 UI/kg/dia com ajustes individualizados",
                "R5: Uso de insulinas NPH/Regular e análogos aprovados",
                "R6: Análogos de ação rápida para controle pós-prandial",
                "R7: Metformina como alternativa quando insulina não é viável",
              ].map((guideline, index) => (
                <div key={index} className="flex items-start gap-3 p-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">{guideline}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-4xl mx-auto text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">Seguro e Confiável</h3>
            <p className="text-muted-foreground mb-8">
              Sistema desenvolvido para profissionais de saúde com autenticação segura.
              Suas avaliações são armazenadas de forma segura e acessíveis apenas para você.
            </p>
            <Button size="lg" asChild>
              <Link href="/profissional/login" data-testid="button-login-cta">
                Acessar Sistema
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Sistema de suporte à decisão clínica para Diabetes Mellitus Gestacional.
            <br />
            Baseado nas Diretrizes DMG 2024. Decisões finais devem ser tomadas por profissional de saúde.
          </p>
        </div>
      </footer>
    </div>
  );
}
