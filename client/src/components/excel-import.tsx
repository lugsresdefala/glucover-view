import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { GlucoseReading } from "@shared/schema";

interface ExcelImportProps {
  onImport: (readings: GlucoseReading[]) => void;
  disabled?: boolean;
}

interface ParsedRow {
  dia: number;
  jejum?: number;
  posCafe1h?: number;
  preAlmoco?: number;
  posAlmoco1h?: number;
  preJantar?: number;
  posJantar1h?: number;
  madrugada?: number;
}

const COLUMN_MAPPINGS: Record<string, keyof GlucoseReading> = {
  dia: "jejum",
  jejum: "jejum",
  "pos-cafe": "posCafe1h",
  "pós-café": "posCafe1h",
  "pos cafe": "posCafe1h",
  "1h café": "posCafe1h",
  "1h cafe": "posCafe1h",
  "1h pos cafe": "posCafe1h",
  "1h pós café": "posCafe1h",
  "1h pós-café": "posCafe1h",
  "pre-almoco": "preAlmoco",
  "pré-almoço": "preAlmoco",
  "pre almoco": "preAlmoco",
  "pré almoço": "preAlmoco",
  "antes do almoco": "preAlmoco",
  "antes do almoço": "preAlmoco",
  "pos-almoco": "posAlmoco1h",
  "pós-almoço": "posAlmoco1h",
  "pos almoco": "posAlmoco1h",
  "1h almoco": "posAlmoco1h",
  "1h almoço": "posAlmoco1h",
  "1h pos almoco": "posAlmoco1h",
  "1h pós almoço": "posAlmoco1h",
  "1h pós-almoço": "posAlmoco1h",
  "pre-jantar": "preJantar",
  "pré-jantar": "preJantar",
  "pre jantar": "preJantar",
  "pré jantar": "preJantar",
  "antes do jantar": "preJantar",
  "pos-jantar": "posJantar1h",
  "pós-jantar": "posJantar1h",
  "pos jantar": "posJantar1h",
  "1h jantar": "posJantar1h",
  "1h pos jantar": "posJantar1h",
  "1h pós jantar": "posJantar1h",
  "1h pós-jantar": "posJantar1h",
  madrugada: "madrugada",
  "3h da manha": "madrugada",
  "3h da manhã": "madrugada",
  "3h manha": "madrugada",
  "3h manhã": "madrugada",
  noite: "madrugada",
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseGlucoseValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "" || value === "-") {
    return undefined;
  }
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (isNaN(num) || num < 0 || num > 600) {
    return undefined;
  }
  return Math.round(num);
}

function mapColumn(header: string): keyof GlucoseReading | null {
  const normalized = normalizeHeader(header);
  
  for (const [pattern, field] of Object.entries(COLUMN_MAPPINGS)) {
    if (normalized.includes(pattern)) {
      return field;
    }
  }
  
  return null;
}

export function ExcelImportButton({ onImport, disabled }: ExcelImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setPreview([]);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

      if (jsonData.length === 0) {
        throw new Error("A planilha está vazia. Verifique o arquivo e tente novamente.");
      }

      const headers = Object.keys(jsonData[0]);
      const columnMap: Record<string, keyof GlucoseReading> = {};
      
      headers.forEach((header) => {
        const mapped = mapColumn(header);
        if (mapped) {
          columnMap[header] = mapped;
        }
      });

      if (Object.keys(columnMap).length === 0) {
        throw new Error(
          "Nenhuma coluna de glicemia reconhecida. Use cabeçalhos como: Jejum, 1h pós café, antes do almoço, 1h pós almoço, antes do jantar, 1h pós jantar, 3h da manhã."
        );
      }

      const parsedRows: ParsedRow[] = jsonData.map((row, index) => {
        const reading: ParsedRow = { dia: index + 1 };
        
        for (const [header, field] of Object.entries(columnMap)) {
          const value = parseGlucoseValue(row[header]);
          if (value !== undefined) {
            if (field === "jejum") reading.jejum = value;
            else if (field === "posCafe1h") reading.posCafe1h = value;
            else if (field === "preAlmoco") reading.preAlmoco = value;
            else if (field === "posAlmoco1h") reading.posAlmoco1h = value;
            else if (field === "preJantar") reading.preJantar = value;
            else if (field === "posJantar1h") reading.posJantar1h = value;
            else if (field === "madrugada") reading.madrugada = value;
          }
        }
        
        return reading;
      });

      const validRows = parsedRows.filter((row) => {
        return row.jejum !== undefined || row.posCafe1h !== undefined || row.preAlmoco !== undefined ||
               row.posAlmoco1h !== undefined || row.preJantar !== undefined || row.posJantar1h !== undefined ||
               row.madrugada !== undefined;
      });

      if (validRows.length === 0) {
        throw new Error("Nenhum valor de glicemia válido encontrado na planilha.");
      }

      setPreview(validRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao processar o arquivo. Verifique o formato e tente novamente.";
      setError(message);
      setPreview([]);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImport = () => {
    if (preview.length === 0) return;

    const readings: GlucoseReading[] = preview.map((row) => ({
      jejum: row.jejum,
      posCafe1h: row.posCafe1h,
      preAlmoco: row.preAlmoco,
      posAlmoco1h: row.posAlmoco1h,
      preJantar: row.preJantar,
      posJantar1h: row.posJantar1h,
      madrugada: row.madrugada,
    }));

    onImport(readings);
    
    toast({
      title: "Dados importados com sucesso",
      description: `${readings.length} dia(s) de medições glicêmicas importados.`,
    });

    setIsOpen(false);
    setPreview([]);
    setFileName(null);
    setError(null);
  };

  const handleClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setPreview([]);
      setFileName(null);
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} data-testid="button-import-excel">
          <FileSpreadsheet className="mr-1 h-4 w-4" />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Dados de Glicemia</DialogTitle>
          <DialogDescription>
            Selecione um arquivo Excel (.xlsx, .xls) com medições de glicemia. O arquivo deve conter colunas com os horários das medições.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file-excel"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              data-testid="button-select-file"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar Arquivo
                </>
              )}
            </Button>
            {fileName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
              </span>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{preview.length} dia(s) de medições encontrados</span>
              </div>
              
              <ScrollArea className="h-64 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Dia</TableHead>
                      <TableHead className="text-center">Jejum</TableHead>
                      <TableHead className="text-center">1h pós-café</TableHead>
                      <TableHead className="text-center">Pré-almoço</TableHead>
                      <TableHead className="text-center">1h pós-almoço</TableHead>
                      <TableHead className="text-center">Pré-jantar</TableHead>
                      <TableHead className="text-center">1h pós-jantar</TableHead>
                      <TableHead className="text-center">Madrugada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row) => (
                      <TableRow key={row.dia}>
                        <TableCell className="font-medium">{row.dia}</TableCell>
                        <TableCell className="text-center font-mono">{row.jejum ?? "-"}</TableCell>
                        <TableCell className="text-center font-mono">{row.posCafe1h ?? "-"}</TableCell>
                        <TableCell className="text-center font-mono">{row.preAlmoco ?? "-"}</TableCell>
                        <TableCell className="text-center font-mono">{row.posAlmoco1h ?? "-"}</TableCell>
                        <TableCell className="text-center font-mono">{row.preJantar ?? "-"}</TableCell>
                        <TableCell className="text-center font-mono">{row.posJantar1h ?? "-"}</TableCell>
                        <TableCell className="text-center font-mono">{row.madrugada ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                Verifique os dados acima antes de importar. Os valores serão preenchidos nos campos de glicemia.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} data-testid="button-cancel-import">
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={preview.length === 0}
            data-testid="button-confirm-import"
          >
            Importar {preview.length > 0 && `(${preview.length} dias)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
