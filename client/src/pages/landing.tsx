import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Stethoscope, BookOpen, Activity, AlertTriangle, Target, Clock, FileText, Shield, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={hapvidaLogo} 
              alt="Hapvida" 
              className="h-10 w-auto"
              data-testid="img-logo"
            />
            <div className="hidden sm:block border-l border-border pl-4">
              <h1 className="text-xl font-semibold tracking-tight">GluCover</h1>
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
        <section className="relative py-16 md:py-24 px-6 gradient-mesh">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 glass-subtle rounded-full mb-8">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Sistema Clínico Baseado em Evidências</span>
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

        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="flex items-start gap-4 p-6 glass-subtle rounded-xl hover-elevate">
                <div className="p-3 bg-blue-500/10 rounded-xl shrink-0">
                  <FileText className="h-5 w-5 text-blue-600/80 dark:text-blue-400/80" />
                </div>
                <div>
                  <p className="font-medium mb-1">Importação Excel</p>
                  <p className="text-sm text-muted-foreground">Dados glicêmicos em lote</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 glass-subtle rounded-xl hover-elevate">
                <div className="p-3 bg-emerald-500/10 rounded-xl shrink-0">
                  <Target className="h-5 w-5 text-emerald-600/80 dark:text-emerald-400/80" />
                </div>
                <div>
                  <p className="font-medium mb-1">Análise Inteligente</p>
                  <p className="text-sm text-muted-foreground">Algoritmo clínico validado</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 glass-subtle rounded-xl hover-elevate">
                <div className="p-3 bg-amber-500/10 rounded-xl shrink-0">
                  <Clock className="h-5 w-5 text-amber-600/80 dark:text-amber-400/80" />
                </div>
                <div>
                  <p className="font-medium mb-1">Duplo Horizonte</p>
                  <p className="text-sm text-muted-foreground">Análise global + 7 dias</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 glass-subtle rounded-xl hover-elevate">
                <div className="p-3 bg-indigo-500/10 rounded-xl shrink-0">
                  <Shield className="h-5 w-5 text-indigo-600/80 dark:text-indigo-400/80" />
                </div>
                <div>
                  <p className="font-medium mb-1">Diretrizes Oficiais</p>
                  <p className="text-sm text-muted-foreground">SBD, FEBRASGO, OMS</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="diretrizes" className="py-16 px-6 bg-muted/20">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 text-muted-foreground mb-4">
                <BookOpen className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Fundamentação Científica</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                Baseado nas Principais Diretrizes
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                O algoritmo deste sistema segue rigorosamente as recomendações das principais 
                sociedades médicas nacionais e internacionais.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="relative overflow-visible glass-subtle border-0 hover-elevate">
                <div className="absolute -top-3 left-6">
                  <Badge variant="secondary" className="shadow-sm bg-blue-500/10 text-blue-700 dark:text-blue-300 border-0">2025</Badge>
                </div>
                <CardContent className="pt-8 pb-6 px-6">
                  <h3 className="text-xl font-semibold mb-2">SBD</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sociedade Brasileira de Diabetes - Diretriz Oficial: Tratamento farmacológico do 
                    diabetes mellitus na gestação (DM1, DM2, DMG)
                  </p>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">17 recomendações catalogadas (R1-R17)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-visible glass-subtle border-0 hover-elevate">
                <div className="absolute -top-3 left-6">
                  <Badge variant="secondary" className="shadow-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-0">2019</Badge>
                </div>
                <CardContent className="pt-8 pb-6 px-6">
                  <h3 className="text-xl font-semibold mb-2">FEBRASGO</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Federação Brasileira das Associações de Ginecologia e Obstetrícia - 
                    Rastreamento e diagnóstico de DMG no Brasil
                  </p>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">Femina 2019;47(11):786-96</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-visible glass-subtle border-0 hover-elevate">
                <div className="absolute -top-3 left-6">
                  <Badge variant="secondary" className="shadow-sm bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-0">2025</Badge>
                </div>
                <CardContent className="pt-8 pb-6 px-6">
                  <h3 className="text-xl font-semibold mb-2">OMS</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Organização Mundial da Saúde - WHO recommendations on care for women 
                    with diabetes during pregnancy
                  </p>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">ISBN 9789240117044</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 text-muted-foreground mb-4">
                <Target className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Metas Terapêuticas</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                Metas Glicêmicas na Gestação
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Valores de referência para controle glicêmico adequado em gestantes com diabetes.
              </p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="text-center glass-subtle border-0 hover-elevate">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">Jejum</p>
                  <p className="text-3xl font-semibold text-emerald-600/90 dark:text-emerald-400/90 mb-1">65-95</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>

              <Card className="text-center glass-subtle border-0 hover-elevate">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">1h Pós-prandial</p>
                  <p className="text-3xl font-semibold text-blue-600/90 dark:text-blue-400/90 mb-1">&lt; 140</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>

              <Card className="text-center glass-subtle border-0 hover-elevate">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">2h Pós-prandial</p>
                  <p className="text-3xl font-semibold text-indigo-600/90 dark:text-indigo-400/90 mb-1">&lt; 120</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>

              <Card className="text-center glass-subtle border-0 hover-elevate">
                <CardContent className="py-8">
                  <p className="text-sm text-muted-foreground mb-2">Pré-prandial</p>
                  <p className="text-3xl font-semibold text-violet-600/90 dark:text-violet-400/90 mb-1">&lt; 100</p>
                  <p className="text-sm text-muted-foreground">mg/dL</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-4 p-6 glass-subtle rounded-xl border-0">
              <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600/80 dark:text-amber-400/80" />
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">
                  Aviso Importante
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Este sistema é uma ferramenta de apoio à decisão clínica. As recomendações geradas 
                  devem ser avaliadas pelo profissional de saúde no contexto clínico individual de 
                  cada paciente. A decisão terapêutica final é de responsabilidade do médico assistente.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 glass-subtle">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={hapvidaLogo} 
                alt="Hapvida" 
                className="h-8 w-auto opacity-70"
              />
              <span className="text-sm text-muted-foreground">
                GluCover - Sistema de Apoio à Decisão Clínica
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
