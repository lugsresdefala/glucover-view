import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Stethoscope, Activity, AlertTriangle, Target, Clock, FileText, Shield, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-slate-200 dark:from-blue-950 dark:via-indigo-900 dark:to-slate-900">
      <header className="border-b border-border/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={hapvidaLogo} 
              alt="Hapvida" 
              className="h-10 w-auto"
              data-testid="img-logo"
            />
            <div className="hidden sm:block border-l border-border/50 pl-4">
              <h1 className="text-lg font-semibold text-foreground">GluCover</h1>
              <p className="text-xs text-muted-foreground">Sistema de Apoio à Decisão Clínica</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild data-testid="button-patient-access">
              <Link href="/paciente/login">
                <User className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Paciente</span>
              </Link>
            </Button>
            <Button size="sm" asChild data-testid="button-login">
              <Link href="/profissional/login">
                <Stethoscope className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Profissional</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        <section className="text-center space-y-4">
          <Badge variant="outline" className="text-xs">
            Sistema Clínico Baseado em Evidências
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Apoio à Decisão Clínica para<br />
            <span className="text-primary">Diabetes Mellitus na Gestação</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Análise automatizada de dados glicêmicos e recomendações terapêuticas 
            baseadas nas diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025.
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <Button asChild data-testid="button-login-hero">
              <Link href="/profissional/login">
                Acessar Sistema
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Importação Excel</p>
                  <p className="text-xs text-muted-foreground">Upload em lote</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Análise Clínica</p>
                  <p className="text-xs text-muted-foreground">Algoritmo validado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Duplo Horizonte</p>
                  <p className="text-xs text-muted-foreground">Total vs 7 dias</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Diretrizes Oficiais</p>
                  <p className="text-xs text-muted-foreground">SBD, FEBRASGO, OMS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">Fundamentação Científica</h2>
            <p className="text-sm text-muted-foreground">Baseado nas principais diretrizes médicas</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">SBD</CardTitle>
                  <Badge variant="secondary" className="text-xs">2025</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Sociedade Brasileira de Diabetes - Tratamento farmacológico do 
                  diabetes mellitus na gestação.
                </p>
                <p className="text-xs text-muted-foreground border-t pt-2">17 recomendações (R1-R17)</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">FEBRASGO</CardTitle>
                  <Badge variant="secondary" className="text-xs">2019</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Federação Brasileira das Associações de Ginecologia e Obstetrícia - 
                  Rastreamento e diagnóstico de DMG.
                </p>
                <p className="text-xs text-muted-foreground border-t pt-2">Femina 2019;47(11):786-96</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">OMS</CardTitle>
                  <Badge variant="secondary" className="text-xs">2025</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Organização Mundial da Saúde - Recommendations on care for women 
                  with diabetes during pregnancy.
                </p>
                <p className="text-xs text-muted-foreground border-t pt-2">ISBN 9789240117044</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">Metas Glicêmicas na Gestação</h2>
            <p className="text-sm text-muted-foreground">Valores de referência para controle adequado</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Jejum</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">65-95</p>
                <p className="text-xs text-muted-foreground">mg/dL</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">1h Pós-prandial</p>
                <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">&lt; 140</p>
                <p className="text-xs text-muted-foreground">mg/dL</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">2h Pós-prandial</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">&lt; 120</p>
                <p className="text-xs text-muted-foreground">mg/dL</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20 dark:bg-slate-800/80">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Pré-prandial</p>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">&lt; 100</p>
                <p className="text-xs text-muted-foreground">mg/dL</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <Card className="bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="h-10 w-10 flex items-center justify-center bg-amber-500/10 shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Aviso Importante
                </p>
                <p className="text-sm text-muted-foreground">
                  Este sistema é uma ferramenta de apoio à decisão clínica. As recomendações geradas 
                  devem ser avaliadas pelo profissional de saúde no contexto clínico individual de 
                  cada paciente. A decisão terapêutica final é de responsabilidade do médico assistente.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/50 py-6 bg-white/40 dark:bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={hapvidaLogo} 
                alt="Hapvida" 
                className="h-6 w-auto opacity-60"
              />
              <span className="text-xs text-muted-foreground">
                GluCover - Sistema de Apoio à Decisão Clínica
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Baseado nas diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
