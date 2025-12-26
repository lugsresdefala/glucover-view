import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Stethoscope, BookOpen, Activity, AlertTriangle, Target, Clock, FileText, Shield, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={hapvidaLogo} 
              alt="Hapvida" 
              className="h-10 w-auto"
              data-testid="img-logo"
            />
            <div className="hidden sm:block border-l border-border pl-4">
              <h1 className="text-xl font-semibold tracking-tight">GlucoVer</h1>
              <p className="text-sm text-muted-foreground">Apoio à Decisão Clínica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild data-testid="button-patient-access">
              <Link href="/paciente/login">
                <User className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Paciente</span>
              </Link>
            </Button>
            <Button asChild data-testid="button-login">
              <Link href="/profissional/login">
                <Stethoscope className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Profissional</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative py-16 md:py-24 px-6 bg-gradient-to-b from-primary/5 to-background">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-8">
              <Activity className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-medium text-accent-foreground">Sistema Clínico Baseado em Evidências</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6 text-foreground">
              Apoio à Decisão Clínica para{" "}
              <span className="text-primary">Diabetes na Gestação</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              Análise automatizada de dados glicêmicos e recomendações terapêuticas baseadas nas diretrizes 
              SBD 2025, FEBRASGO 2019 e OMS 2025 para manejo de DM1, DM2 e DMG.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-login-hero" className="px-8">
                <Link href="/profissional/login">
                  Acessar Sistema
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="px-8" data-testid="button-see-guidelines">
                <Link href="#diretrizes">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Ver Diretrizes
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-6 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="flex items-start gap-4 p-6 bg-background rounded-lg shadow-sm">
                <div className="p-3 bg-status-info-bg rounded-lg shrink-0">
                  <FileText className="h-5 w-5 text-status-info" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Importação Excel</p>
                  <p className="text-sm text-muted-foreground">Dados glicêmicos em lote</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-background rounded-lg shadow-sm">
                <div className="p-3 bg-status-success-bg rounded-lg shrink-0">
                  <Target className="h-5 w-5 text-status-success" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Análise Inteligente</p>
                  <p className="text-sm text-muted-foreground">Algoritmo clínico validado</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-background rounded-lg shadow-sm">
                <div className="p-3 bg-status-warning-bg rounded-lg shrink-0">
                  <Clock className="h-5 w-5 text-status-warning" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Duplo Horizonte</p>
                  <p className="text-sm text-muted-foreground">Análise global + 7 dias</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-background rounded-lg shadow-sm">
                <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Diretrizes Oficiais</p>
                  <p className="text-sm text-muted-foreground">SBD, FEBRASGO, OMS</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="diretrizes" className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 text-primary mb-4">
                <BookOpen className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Fundamentação Científica</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                Baseado nas Principais Diretrizes
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                O algoritmo deste sistema segue rigorosamente as recomendações das principais 
                sociedades médicas nacionais e internacionais.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="relative overflow-visible shadow-md">
                <div className="absolute -top-3 left-6">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">2025</Badge>
                </div>
                <CardContent className="pt-8 pb-6 px-6">
                  <h3 className="text-xl font-bold mb-2">SBD</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sociedade Brasileira de Diabetes - Diretriz Oficial: Tratamento farmacológico do 
                    diabetes mellitus na gestação (DM1, DM2, DMG)
                  </p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">17 recomendações catalogadas (R1-R17)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-visible shadow-md">
                <div className="absolute -top-3 left-6">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">2019</Badge>
                </div>
                <CardContent className="pt-8 pb-6 px-6">
                  <h3 className="text-xl font-bold mb-2">FEBRASGO</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Federação Brasileira das Associações de Ginecologia e Obstetrícia - 
                    Rastreamento e diagnóstico de DMG no Brasil
                  </p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">Femina 2019;47(11):786-96</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-visible shadow-md">
                <div className="absolute -top-3 left-6">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">2025</Badge>
                </div>
                <CardContent className="pt-8 pb-6 px-6">
                  <h3 className="text-xl font-bold mb-2">OMS</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Organização Mundial da Saúde - WHO recommendations on care for women 
                    with diabetes during pregnancy
                  </p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">ISBN 9789240117044</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-6 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 text-primary mb-4">
                <Target className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Metas Terapêuticas</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                Metas Glicêmicas na Gestação
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Valores de referência para controle glicêmico adequado em gestantes com diabetes.
              </p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="text-center shadow-md">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">Jejum</p>
                  <p className="text-3xl font-bold text-primary mb-1">65-95</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>

              <Card className="text-center shadow-md">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">1h Pós-prandial</p>
                  <p className="text-3xl font-bold text-primary mb-1">&lt; 140</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>

              <Card className="text-center shadow-md">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">2h Pós-prandial</p>
                  <p className="text-3xl font-bold text-primary mb-1">&lt; 120</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>

              <Card className="text-center shadow-md">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">Pré-prandial</p>
                  <p className="text-3xl font-bold text-primary mb-1">&lt; 100</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-4 p-6 bg-status-warning-bg border border-status-warning/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-status-warning mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-status-warning-foreground mb-2">
                  Aviso Importante
                </p>
                <p className="text-sm text-status-warning-foreground/80 leading-relaxed">
                  Este sistema é uma ferramenta de apoio à decisão clínica. As recomendações geradas 
                  devem ser avaliadas pelo profissional de saúde no contexto clínico individual de 
                  cada paciente. A decisão terapêutica final é de responsabilidade do médico assistente.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={hapvidaLogo} 
                alt="Hapvida" 
                className="h-8 w-auto opacity-70"
              />
              <span className="text-sm text-muted-foreground">
                GlucoVer - Sistema de Apoio à Decisão Clínica
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Baseado nas diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
