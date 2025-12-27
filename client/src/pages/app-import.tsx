import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileStack, AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { BatchImport } from "@/components/batch-import";

export default function AppImport() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-primary" />
            Importar Planilhas de Glicemia
          </CardTitle>
          <CardDescription>
            Faça upload de arquivos Excel (.xlsx, .xls) com dados glicêmicos para análise em lote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchImport />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Formato Esperado
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>Colunas: Data, Jejum, Pós-café, Pré-almoço, Pós-almoço, Pré-jantar, Pós-jantar, Madrugada</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>Valores em mg/dL</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>Uma linha por dia de monitoramento</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
                <span>Células vazias serão ignoradas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
                <span>Mínimo de 3 dias de leitura recomendado</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
                <span>Preencha os dados do paciente após upload</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
