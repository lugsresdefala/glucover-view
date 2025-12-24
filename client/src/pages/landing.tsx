import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Stethoscope, BookOpen, Activity, FileText, AlertTriangle, XCircle } from "lucide-react";
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">SBD</CardTitle>
                    <Badge variant="secondary">2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Sociedade Brasileira de Diabetes - Diretriz Oficial: Tratamento farmacológico do DM2 e DMG na gestação
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">FEBRASGO</CardTitle>
                    <Badge variant="secondary">2019</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Federação Brasileira das Associações de Ginecologia e Obstetrícia - Rastreamento e diagnóstico de DMG no Brasil (Femina 2019;47(11):786-96)
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">OMS</CardTitle>
                    <Badge variant="secondary">2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Organização Mundial da Saúde - WHO recommendations on care for women with diabetes during pregnancy (ISBN 9789240117044)
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
              <h3 className="text-lg font-semibold">Recomendações Clínicas (SBD 2025)</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R1</Badge>
                    <span className="text-sm font-medium">Início de Terapia Farmacológica</span>
                    <Badge variant="secondary" className="text-xs">Classe IIb, Nível C</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pode ser considerado o início da terapia farmacológica na mulher com DMG quando duas ou mais medidas de glicemia, avaliadas após 7 a 14 dias de terapia não farmacológica, estiverem acima da meta.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R2</Badge>
                    <span className="text-sm font-medium">Insulina como Primeira Escolha</span>
                    <Badge variant="secondary" className="text-xs">Classe I, Nível A</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    É recomendada a insulina como terapia farmacológica de primeira escolha para controle glicêmico na mulher com DMG.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R3</Badge>
                    <span className="text-sm font-medium">Critério de Crescimento Fetal</span>
                    <Badge variant="secondary" className="text-xs">Classe IIb, Nível B</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O critério de crescimento fetal para início da insulinoterapia pode ser considerado quando a medida da circunferência abdominal fetal for ≥ percentil 75 em USG realizada entre a 29ª e a 33ª semana.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R4</Badge>
                    <span className="text-sm font-medium">Dose Inicial de Insulina</span>
                    <Badge variant="secondary" className="text-xs">Classe IIb, Nível C</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A terapia com insulina para gestantes com DMG pode ser considerada na dose total inicial de 0,5 UI/kg/dia, com ajustes individualizados baseados no monitoramento diário da glicose a cada 1-2 semanas.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R5</Badge>
                    <span className="text-sm font-medium">Tipos de Insulina</span>
                    <Badge variant="secondary" className="text-xs">Classe IIa, Nível C</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deve ser considerado o uso de insulinas humanas NPH/Regular, e de análogos de insulina aprovados para uso na gestação, como opções para o tratamento farmacológico do DMG.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R6</Badge>
                    <span className="text-sm font-medium">Análogos de Ação Rápida</span>
                    <Badge variant="secondary" className="text-xs">Classe IIa, Nível B</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deve ser considerada a indicação de análogos de insulina de ação rápida ou ultrarrápida, aprovados para uso na gestação, em casos de DMG que apresentem difícil controle das excursões glicêmicas pós-prandiais.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R7</Badge>
                    <span className="text-sm font-medium">Metformina como Alternativa</span>
                    <Badge variant="secondary" className="text-xs">Classe I, Nível B</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    É recomendado o uso da metformina em mulheres com DMG sem controle glicêmico adequado com medidas não farmacológicas, como alternativa terapêutica, na inviabilidade do uso de insulina. Contraindicada em fetos abaixo do percentil 50 ou CIUR.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R8</Badge>
                    <span className="text-sm font-medium">Associação Metformina + Insulina</span>
                    <Badge variant="secondary" className="text-xs">Classe IIa, Nível B</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deve ser considerada a associação de metformina com insulina em gestantes com DMG que necessitem altas doses de insulina (&gt;2 UI/kg/dia) sem controle glicêmico adequado ou com ganho excessivo de peso materno ou fetal.
                  </p>
                </div>

                <div className="p-4 border rounded-lg border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">R9</Badge>
                    <span className="text-sm font-medium">Glibenclamida NÃO Recomendada</span>
                    <Badge variant="secondary" className="text-xs">Classe III, Nível A</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O uso de glibenclamida NÃO é recomendado para gestante com DMG, devido ao aumento de risco de macrossomia e hipoglicemia neonatal.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R10</Badge>
                    <span className="text-sm font-medium">DM2 Pré-gestacional</span>
                    <Badge variant="secondary" className="text-xs">Classe I, Nível C</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    É recomendado que gestantes com DM2 interrompam o tratamento não insulínico antes ou logo após o início da gestação, quando estiver garantida a imediata substituição pela insulinoterapia.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">R11</Badge>
                    <span className="text-sm font-medium">Esquemas Intensivos</span>
                    <Badge variant="secondary" className="text-xs">Classe I, Nível B</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    É recomendado o uso de esquemas intensivos de insulinização com múltiplas doses de insulina (MDI) ou com infusão contínua (SICI) para se obter um controle glicêmico adequado em gestantes com DM1 e DM2.
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
              <h3 className="text-lg font-semibold">Metas Glicêmicas (SBD 2025)</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Glicemia de Jejum</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">65-95 mg/dL</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">1 hora pós-prandial</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">&lt; 140 mg/dL</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">2 horas pós-prandial</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">&lt; 120 mg/dL</p>
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
              Baseado nas diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
