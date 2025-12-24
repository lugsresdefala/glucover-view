import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Stethoscope, BookOpen, Activity, FileText, AlertTriangle } from "lucide-react";
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
              <p className="text-xs text-muted-foreground">Sistema de Apoio à Decisão Clínica</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild data-testid="button-patient-access">
              <Link href="/paciente/login">
                <User className="h-4 w-4 mr-2" />
                Paciente
              </Link>
            </Button>
            <Button asChild data-testid="button-login">
              <Link href="/profissional/login">
                <Stethoscope className="h-4 w-4 mr-2" />
                Profissional de Saúde
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-12 px-4 border-b border-border">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Activity className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  Sistema de Apoio à Decisão Clínica para Diabetes Mellitus Gestacional
                </h2>
                <p className="text-muted-foreground">
                  Ferramenta para análise de dados glicêmicos e suporte à conduta terapêutica em DMG, 
                  baseada nas diretrizes nacionais e internacionais vigentes.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button asChild data-testid="button-login-hero">
                <Link href="/profissional/login">Acessar Sistema</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-10 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Fundamentação Científica</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              As recomendações deste sistema são baseadas nas seguintes diretrizes:
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">SBD</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Sociedade Brasileira de Diabetes - Diretrizes para tratamento farmacológico do DMG
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">FEBRASGO</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Federação Brasileira das Associações de Ginecologia e Obstetrícia - Protocolo de manejo do DMG
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">OMS</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Organização Mundial da Saúde - Guideline on Diabetes Management in Pregnancy
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-10 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Algoritmo Clínico</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R1</Badge>
                    <span className="text-sm font-medium">Início de Terapia Farmacológica</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Indicação de insulinoterapia quando duas ou mais medidas de glicemia estiverem 
                    acima da meta após 7 a 14 dias de terapia não farmacológica.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R2</Badge>
                    <span className="text-sm font-medium">Insulina como Primeira Escolha</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Insulina é a terapia farmacológica de primeira linha para controle glicêmico no DMG 
                    (Classe I, Nível A).
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R3</Badge>
                    <span className="text-sm font-medium">Critério de Crescimento Fetal</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Insulinoterapia indicada quando circunferência abdominal fetal ≥ percentil 75 
                    em USG entre 29ª e 33ª semana.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R4</Badge>
                    <span className="text-sm font-medium">Dose Inicial de Insulina</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dose inicial de 0,5 UI/kg/dia com ajustes individualizados baseados no 
                    monitoramento diário a cada 1-2 semanas.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R5</Badge>
                    <span className="text-sm font-medium">Tipos de Insulina</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Uso de insulinas humanas (NPH/Regular) e análogos aprovados para gestação 
                    conforme classificação ANVISA.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R6</Badge>
                    <span className="text-sm font-medium">Análogos de Ação Rápida</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Indicação de análogos rápidos/ultrarrápidos para controle de excursões 
                    glicêmicas pós-prandiais.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R7</Badge>
                    <span className="text-sm font-medium">Metformina como Alternativa</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Metformina indicada quando insulina não é viável. Contraindicada em fetos 
                    abaixo do percentil 50 ou CIUR.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>R8</Badge>
                    <span className="text-sm font-medium">Associação Metformina + Insulina</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Associação indicada em doses elevadas de insulina (&gt;2 UI/kg/dia) ou ganho 
                    excessivo de peso materno/fetal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Metas Glicêmicas</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Glicemia de Jejum</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">≤ 95 mg/dL</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">1 hora pós-prandial</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">≤ 140 mg/dL</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">2 horas pós-prandial</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">≤ 120 mg/dL</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Separator />

        <section className="py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Aviso Importante
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Este sistema é uma ferramenta de apoio à decisão clínica. As recomendações geradas 
                  devem ser avaliadas pelo profissional de saúde no contexto clínico individual de 
                  cada paciente. A decisão terapêutica final é de responsabilidade do médico assistente.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground text-center md:text-left">
              Sistema de Apoio à Decisão Clínica para Diabetes Mellitus Gestacional
            </p>
            <p className="text-xs text-muted-foreground">
              Baseado nas diretrizes SBD, FEBRASGO e OMS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
