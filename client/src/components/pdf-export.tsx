import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileDown, Loader2, Activity, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StoredEvaluation } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PDFExportProps {
  evaluation: StoredEvaluation;
}

function formatGestationalAge(weeks: number, days: number): string {
  return `${weeks} semanas e ${days} dia${days !== 1 ? "s" : ""}`;
}

function getUrgencyLabel(level: string): string {
  switch (level) {
    case "critical":
      return "Urgente";
    case "warning":
      return "Atenção";
    default:
      return "Rotina";
  }
}

function PrintableReport({ evaluation }: { evaluation: StoredEvaluation }) {
  const recommendation = evaluation.recommendation;
  const createdAt = evaluation.createdAt
    ? format(new Date(evaluation.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    : "";

  return (
    <div className="bg-white text-black p-8 font-sans" style={{ width: "210mm", minHeight: "297mm" }}>
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-300">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-blue-100">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">GlucoVer</h1>
            <p className="text-sm text-gray-600">Relatório de Avaliação Clínica</p>
          </div>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Data: {createdAt}</p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-200">
          Dados da Paciente
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">Nome:</span>
            <span className="ml-2 text-gray-900">{evaluation.patientName}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Peso:</span>
            <span className="ml-2 text-gray-900">{evaluation.weight} kg</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Idade Gestacional:</span>
            <span className="ml-2 text-gray-900">
              {formatGestationalAge(evaluation.gestationalWeeks, evaluation.gestationalDays)}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Adesão à Dieta:</span>
            <span className="ml-2 text-gray-900 capitalize">{evaluation.dietAdherence}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Uso de Insulina:</span>
            <span className="ml-2 text-gray-900">{evaluation.usesInsulin ? "Sim" : "Não"}</span>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-200">
          Medidas Glicêmicas (mg/dL)
        </h2>
        {evaluation.glucoseReadings.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Nenhuma medida glicêmica registrada.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left font-medium">Dia</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Jejum</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">1h pós-café</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Pré-almoço</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">2h pós-almoço</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Pré-jantar</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">2h pós-jantar</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Madrugada</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.glucoseReadings.map((reading, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{index + 1}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {reading.jejum ?? "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {reading.posCafe1h ?? "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {reading.preAlmoco ?? "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {typeof reading.posAlmoco2h === "number" ? reading.posAlmoco2h : "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {reading.preJantar ?? "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {typeof reading.posJantar2h === "number" ? reading.posJantar2h : "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {reading.madrugada ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {evaluation.usesInsulin && evaluation.insulinRegimens && evaluation.insulinRegimens.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-200">
            Esquema de Insulina
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left font-medium">Tipo</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Manhã (UI)</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Almoço (UI)</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Jantar (UI)</th>
                <th className="border border-gray-300 px-2 py-1 text-center font-medium">Dormir (UI)</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.insulinRegimens.map((regimen, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{regimen.type}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {regimen.doseManhaUI ?? "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {regimen.doseAlmocoUI ?? "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {regimen.doseJantarUI ?? "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                    {regimen.doseDormirUI ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {recommendation && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-200">
            Recomendação Clínica
          </h2>
          
          <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                recommendation.urgencyLevel === "critical"
                  ? "bg-red-100 text-red-800"
                  : recommendation.urgencyLevel === "warning"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-800"
              }`}>
                {getUrgencyLabel(recommendation.urgencyLevel)}
              </span>
            </div>
            <p className="text-base font-medium text-gray-900">{recommendation.mainRecommendation}</p>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Análise</h3>
            <p className="text-sm text-gray-800 whitespace-pre-line">{recommendation.analysis}</p>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Justificativa</h3>
            <p className="text-sm text-gray-800 whitespace-pre-line">{recommendation.justification}</p>
          </div>

          {recommendation.nextSteps && recommendation.nextSteps.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Próximos Passos</h3>
              <ol className="list-decimal list-inside text-sm text-gray-800 space-y-1">
                {recommendation.nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {recommendation.guidelineReferences && recommendation.guidelineReferences.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Referências</h3>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                {recommendation.guidelineReferences.map((ref, index) => (
                  <li key={index}>{ref}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
        <p>Este relatório foi gerado automaticamente pelo GlucoVer - Sistema de Suporte à Decisão Clínica para Diabetes Mellitus Gestacional.</p>
        <p className="mt-1">As recomendações são baseadas em diretrizes clínicas e devem ser validadas pelo profissional de saúde responsável.</p>
      </footer>
    </div>
  );
}

export function PDFExportButton({ evaluation }: PDFExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const generatePDF = async () => {
    if (!reportRef.current || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = canvas.height;
      
      const contentHeight = imgHeight * (pdfWidth / canvas.width);
      let heightLeft = contentHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `DMG_Assist_${evaluation.patientName.replace(/\s+/g, "_")}_${format(
        new Date(evaluation.createdAt),
        "yyyy-MM-dd"
      )}.pdf`;
      
      pdf.save(fileName);
      
      toast({
        title: "PDF gerado com sucesso",
        description: `Arquivo ${fileName} salvo.`,
      });
    } catch (err) {
      console.error("Error generating PDF:", err);
      const errorMessage = "Não foi possível gerar o PDF. Tente novamente.";
      setError(errorMessage);
      toast({
        title: "Erro ao gerar PDF",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isPreviewOpen} onOpenChange={(open) => {
      setIsPreviewOpen(open);
      if (!open) setError(null);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-export-pdf">
          <FileDown className="mr-1 h-4 w-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pré-visualização do Relatório</DialogTitle>
          <DialogDescription>
            Visualize o relatório antes de baixar. Clique em "Baixar PDF" para salvar o arquivo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button onClick={generatePDF} disabled={isGenerating} data-testid="button-download-pdf">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Baixar PDF
                </>
              )}
            </Button>
          </div>
          <div className="border rounded-md overflow-auto max-h-[70vh]">
            <div ref={reportRef}>
              <PrintableReport evaluation={evaluation} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
