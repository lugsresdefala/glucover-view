import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Stethoscope, BookOpen, Activity, AlertTriangle, Target, Clock, FileText, Shield, ChevronRight, TrendingUp, Zap } from "lucide-react";
import { Link } from "wouter";
import hapvidaLogo from "@assets/layout_set_logo_1766044185087.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="nav-glass border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={hapvidaLogo} 
              alt="Hapvida" 
              className="h-10 w-auto"
              data-testid="img-logo"
            />
            <div className="hidden sm:block border-l border-border/50 pl-4">
              <h1 className="type-label text-foreground">GluCover</h1>
              <p className="type-caption">Apoio à Decisão Clínica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild data-testid="button-patient-access">
              <Link href="/paciente/login">
                <User className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Paciente</span>
              </Link>
            </Button>
            <Button size="sm" className="gradient-clinical text-white border-0" asChild data-testid="button-login">
              <Link href="/profissional/login">
                <Stethoscope className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Profissional</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="slide-up">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 glass-subtle rounded-full mb-8">
                  <div className="status-dot status-dot-online" />
                  <span className="type-caption">Sistema Clínico Baseado em Evidências</span>
                </div>
                
                <h1 className="type-display mb-6">
                  Apoio à Decisão Clínica para{" "}
                  <span className="gradient-text">Diabetes na Gestação</span>
                </h1>
                
                <p className="type-subtitle max-w-xl mb-10">
                  Análise automatizada de dados glicêmicos e recomendações terapêuticas 
                  baseadas nas diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025.
                </p>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Button size="lg" className="gradient-clinical text-white border-0 shadow-glow" asChild data-testid="button-login-hero">
                    <Link href="/profissional/login">
                      Acessar Sistema
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="ghost" asChild data-testid="button-see-guidelines">
                    <Link href="#diretrizes">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ver Diretrizes
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="hidden lg:block">
                <div className="metric-stack fade-in">
                  <div className="kpi-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="kpi-value gradient-text">17</p>
                        <p className="kpi-label">Recomendações SBD</p>
                      </div>
                      <div className="clinical-module-icon">
                        <FileText />
                      </div>
                    </div>
                    <div className="kpi-change metric-trend-up">
                      <TrendingUp className="h-3 w-3" />
                      Atualizado 2025
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="kpi-value gradient-text">3</p>
                        <p className="kpi-label">Tipos de Diabetes</p>
                      </div>
                      <div className="clinical-module-icon">
                        <Activity />
                      </div>
                    </div>
                    <div className="kpi-change text-muted-foreground">
                      DM1, DM2, DMG
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="kpi-value gradient-text">7</p>
                        <p className="kpi-label">Dias de Análise</p>
                      </div>
                      <div className="clinical-module-icon">
                        <Clock />
                      </div>
                    </div>
                    <div className="kpi-change text-muted-foreground">
                      Duplo horizonte temporal
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="feature-grid">
              <div className="clinical-module">
                <div className="clinical-module-icon mb-4">
                  <FileText />
                </div>
                <h3 className="type-title mb-2">Importação Excel</h3>
                <p className="type-body text-muted-foreground">
                  Upload de dados glicêmicos em lote para análise automatizada.
                </p>
              </div>
              
              <div className="clinical-module">
                <div className="clinical-module-icon mb-4">
                  <Target />
                </div>
                <h3 className="type-title mb-2">Análise Inteligente</h3>
                <p className="type-body text-muted-foreground">
                  Algoritmo clínico validado por diretrizes médicas oficiais.
                </p>
              </div>
              
              <div className="clinical-module">
                <div className="clinical-module-icon mb-4">
                  <Clock />
                </div>
                <h3 className="type-title mb-2">Duplo Horizonte</h3>
                <p className="type-body text-muted-foreground">
                  Análise comparativa do período total vs últimos 7 dias.
                </p>
              </div>
              
              <div className="clinical-module">
                <div className="clinical-module-icon mb-4">
                  <Shield />
                </div>
                <h3 className="type-title mb-2">Diretrizes Oficiais</h3>
                <p className="type-body text-muted-foreground">
                  SBD 2025, FEBRASGO 2019 e OMS 2025 integradas.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        <section id="diretrizes" className="py-20 px-6 gradient-mesh">
          <div className="max-w-7xl mx-auto">
            <div className="section-header">
              <p className="section-eyebrow">Fundamentação Científica</p>
              <h2 className="section-title">Baseado nas Principais Diretrizes</h2>
              <p className="section-description">
                O algoritmo deste sistema segue rigorosamente as recomendações das principais 
                sociedades médicas nacionais e internacionais.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="guideline-card">
                <div className="guideline-card-badge">
                  <Badge className="clinical-badge clinical-badge-info">2025</Badge>
                </div>
                <div className="pt-4">
                  <h3 className="type-title mb-3">SBD</h3>
                  <p className="type-body text-muted-foreground mb-4">
                    Sociedade Brasileira de Diabetes - Diretriz Oficial: Tratamento farmacológico do 
                    diabetes mellitus na gestação.
                  </p>
                  <div className="pt-4 border-t border-border/50">
                    <p className="type-caption">17 recomendações (R1-R17)</p>
                  </div>
                </div>
              </div>

              <div className="guideline-card">
                <div className="guideline-card-badge">
                  <Badge className="clinical-badge clinical-badge-success">2019</Badge>
                </div>
                <div className="pt-4">
                  <h3 className="type-title mb-3">FEBRASGO</h3>
                  <p className="type-body text-muted-foreground mb-4">
                    Federação Brasileira das Associações de Ginecologia e Obstetrícia - 
                    Rastreamento e diagnóstico de DMG.
                  </p>
                  <div className="pt-4 border-t border-border/50">
                    <p className="type-caption">Femina 2019;47(11):786-96</p>
                  </div>
                </div>
              </div>

              <div className="guideline-card">
                <div className="guideline-card-badge">
                  <Badge className="clinical-badge clinical-badge-warning">2025</Badge>
                </div>
                <div className="pt-4">
                  <h3 className="type-title mb-3">OMS</h3>
                  <p className="type-body text-muted-foreground mb-4">
                    Organização Mundial da Saúde - WHO recommendations on care for women 
                    with diabetes during pregnancy.
                  </p>
                  <div className="pt-4 border-t border-border/50">
                    <p className="type-caption">ISBN 9789240117044</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="section-header">
              <p className="section-eyebrow">Metas Terapêuticas</p>
              <h2 className="section-title">Metas Glicêmicas na Gestação</h2>
              <p className="section-description">
                Valores de referência para controle glicêmico adequado em gestantes com diabetes.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="kpi-card text-center">
                <p className="type-caption mb-2">Jejum</p>
                <p className="kpi-value text-emerald-600 dark:text-emerald-400">65-95</p>
                <p className="type-caption mt-1">mg/dL</p>
              </div>

              <div className="kpi-card text-center">
                <p className="type-caption mb-2">1h Pós-prandial</p>
                <p className="kpi-value text-sky-600 dark:text-sky-400">&lt; 140</p>
                <p className="type-caption mt-1">mg/dL</p>
              </div>

              <div className="kpi-card text-center">
                <p className="type-caption mb-2">2h Pós-prandial</p>
                <p className="kpi-value text-indigo-600 dark:text-indigo-400">&lt; 120</p>
                <p className="type-caption mt-1">mg/dL</p>
              </div>

              <div className="kpi-card text-center">
                <p className="type-caption mb-2">Pré-prandial</p>
                <p className="kpi-value text-violet-600 dark:text-violet-400">&lt; 100</p>
                <p className="type-caption mt-1">mg/dL</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="glass-panel rounded-2xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="type-label text-foreground mb-2">
                  Aviso Importante
                </p>
                <p className="type-body text-muted-foreground">
                  Este sistema é uma ferramenta de apoio à decisão clínica. As recomendações geradas 
                  devem ser avaliadas pelo profissional de saúde no contexto clínico individual de 
                  cada paciente. A decisão terapêutica final é de responsabilidade do médico assistente.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/30 py-8 glass-subtle">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={hapvidaLogo} 
                alt="Hapvida" 
                className="h-8 w-auto opacity-60"
              />
              <span className="type-caption">
                GluCover - Sistema de Apoio à Decisão Clínica
              </span>
            </div>
            <p className="type-caption">
              Baseado nas diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
