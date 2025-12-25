import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
  Trash2,
  Sparkles,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GlucoseReading, StoredEvaluation } from "@shared/schema";

interface ParsedPatientData {
  fileName: string;
  patientName: string;
  gestationalWeeks: number;
  gestationalDays: number;
  glucoseReadings: GlucoseReading[];
  usesInsulin: boolean;
  birthDate?: string;
  dum?: string;
  previousEvaluation?: StoredEvaluation | null;
  status: "pending" | "processing" | "success" | "error";
  errorMessage?: string;
  newEvaluation?: StoredEvaluation;
}

const COLUMN_MAPPINGS: Record<string, keyof GlucoseReading> = {
  jejum: "jejum",
  "glicemia jejum": "jejum",
  "em jejum": "jejum",
  "cafe manha": "posCafe1h",
  "cafe da manha": "posCafe1h",
  "pos cafe": "posCafe1h",
  "pos-cafe": "posCafe1h",
  "poscafe": "posCafe1h",
  "1h cafe": "posCafe1h",
  "1h pos cafe": "posCafe1h",
  "1h pós cafe": "posCafe1h",
  "apos cafe": "posCafe1h",
  "depois cafe": "posCafe1h",
  "antes do almoco": "preAlmoco",
  "antes do almoço": "preAlmoco",
  "pre almoco": "preAlmoco",
  "pre-almoco": "preAlmoco",
  "prealmoco": "preAlmoco",
  "pos almoco": "posAlmoco1h",
  "pos-almoco": "posAlmoco1h",
  "posalmoco": "posAlmoco1h",
  "1h almoco": "posAlmoco1h",
  "1h pos almoco": "posAlmoco1h",
  "1h pós almoco": "posAlmoco1h",
  "apos almoco": "posAlmoco1h",
  "depois almoco": "posAlmoco1h",
  almoco: "posAlmoco1h",
  "antes do jantar": "preJantar",
  "pre jantar": "preJantar",
  "pre-jantar": "preJantar",
  "prejantar": "preJantar",
  "pos jantar": "posJantar1h",
  "pos-jantar": "posJantar1h",
  "posjantar": "posJantar1h",
  "1h jantar": "posJantar1h",
  "1h pos jantar": "posJantar1h",
  "1h pós jantar": "posJantar1h",
  "apos jantar": "posJantar1h",
  "depois jantar": "posJantar1h",
  jantar: "posJantar1h",
  madrugada: "madrugada",
  "3h da manha": "madrugada",
  "3h da manhã": "madrugada",
  "3h manha": "madrugada",
  "3h": "madrugada",
  "3 horas": "madrugada",
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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

function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  
  // Excel serial date number (days since 1900-01-01)
  if (typeof value === "number" && value > 1000 && value < 100000) {
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch is Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  const strValue = String(value).trim();
  
  // Try DD/MM/YYYY format (Brazilian)
  const brMatch = strValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const day = parseInt(brMatch[1]);
    const month = parseInt(brMatch[2]) - 1;
    const year = parseInt(brMatch[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getFullYear() === year) {
      return date;
    }
  }
  
  // Try YYYY-MM-DD format (ISO)
  const isoMatch = strValue.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]) - 1;
    const day = parseInt(isoMatch[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getFullYear() === year) {
      return date;
    }
  }
  
  return null;
}

function calculateGestationalAgeFromDUM(measurementDate: Date, dumDate: Date): number {
  const diffMs = measurementDate.getTime() - dumDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0 || diffDays > 315) { // Max ~45 weeks
    return 0;
  }
  return diffDays / 7; // Return weeks as decimal
}

function parseGestationalAge(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  
  if (typeof value === "number" && value > 0 && value < 45) {
    return value;
  }
  
  const strValue = String(value).trim();
  
  const weeksDaysMatch = strValue.match(/(\d+)\s*[+\/]\s*(\d+)/);
  if (weeksDaysMatch) {
    const weeks = parseInt(weeksDaysMatch[1]);
    const days = parseInt(weeksDaysMatch[2]);
    if (weeks >= 1 && weeks < 45 && days >= 0 && days <= 6) {
      return weeks + (days / 7);
    }
  }
  
  const weeksOnlyMatch = strValue.match(/^(\d+)\s*(?:semanas?|sem|s)?$/i);
  if (weeksOnlyMatch) {
    const weeks = parseInt(weeksOnlyMatch[1]);
    if (weeks >= 1 && weeks < 45) {
      return weeks;
    }
  }
  
  const numMatch = strValue.match(/(\d+[,.]?\d*)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1].replace(",", "."));
    if (!isNaN(parsed) && parsed > 0 && parsed < 45) {
      return parsed;
    }
  }
  
  return 0;
}

function extractPatientNameFromFileName(fileName: string): string {
  let name = fileName
    .replace(/\.xlsx?$/i, "")
    .replace(/^_+/, "")
    .replace(/_\d+$/, "")
    .replace(/_/g, " ")
    .trim();
  
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseExcelFile(file: File): Promise<ParsedPatientData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        
        const sheetName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes("controle") || n.toLowerCase().includes("glicemi")
        ) || workbook.SheetNames[0];
        
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];

        let patientName = extractPatientNameFromFileName(file.name);
        let gestationalWeeks = 0;
        let gestationalDays = 0;
        let birthDate: string | undefined;
        let dum: string | undefined;
        
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const row = rawData[i];
          if (!row) continue;
          
          const rowText = row.map(c => String(c || "")).join(" ").toLowerCase();
          
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (typeof cell === "string") {
              const cellLower = cell.toLowerCase();
              if (cellLower.includes("nome") || cellLower.includes("paciente")) {
                const nextCell = row[j + 1];
                if (typeof nextCell === "string" && nextCell.trim() && nextCell.trim().length > 2) {
                  patientName = nextCell.trim();
                }
              }
              if (cellLower.includes("dum") && j + 1 < row.length) {
                const dumCell = row[j + 1];
                if (dumCell) {
                  dum = String(dumCell);
                }
              }
            }
          }
        }
        
        let headerRowIndex = -1;
        let columnMap: Record<number, keyof GlucoseReading> = {};
        let gestationalAgeColIndex = -1;
        let dateColIndex = -1;
        let bestHeaderScore = 0;
        
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
          const row = rawData[i];
          if (!row) continue;
          
          const tempColumnMap: Record<number, keyof GlucoseReading> = {};
          let tempGestationalAgeCol = -1;
          let tempDateCol = -1;
          
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (cell === null || cell === undefined || cell === "") continue;
            
            const cellStr = String(cell);
            const normalized = normalizeHeader(cellStr);
            
            if (normalized.includes("idade gestacional") || 
                (normalized === "ig" || normalized.startsWith("ig ") || normalized.endsWith(" ig")) ||
                normalized.includes("semana gestacional") ||
                normalized.includes("semanas") ||
                normalized === "ig semanas" ||
                normalized === "idade gest") {
              tempGestationalAgeCol = j;
            }
            
            // Detect date column
            if (normalized === "data" || normalized === "dia" || normalized === "date" ||
                normalized.includes("data da") || normalized.includes("data do")) {
              tempDateCol = j;
            }
            
            const mapped = mapColumn(cellStr);
            if (mapped && !Object.values(tempColumnMap).includes(mapped)) {
              tempColumnMap[j] = mapped;
            }
          }
          
          const score = Object.keys(tempColumnMap).length;
          
          if (score > bestHeaderScore && score >= 1) {
            bestHeaderScore = score;
            headerRowIndex = i;
            columnMap = tempColumnMap;
            gestationalAgeColIndex = tempGestationalAgeCol;
            // Date column is either explicitly found, or one column to the left of gestational age
            dateColIndex = tempDateCol >= 0 ? tempDateCol : (tempGestationalAgeCol > 0 ? tempGestationalAgeCol - 1 : 0);
          }
        }
        
        
        if (headerRowIndex === -1 || Object.keys(columnMap).length === 0) {
          throw new Error("Cabeçalho da planilha não encontrado. Verifique se a planilha contém colunas como 'Jejum', 'Pós Café', 'Pós Almoço', etc.");
        }
        
        const glucoseReadings: GlucoseReading[] = [];
        let lastGestationalAge = 0;
        
        // Parse DUM date for calculating gestational age
        let dumDate: Date | null = null;
        if (dum) {
          dumDate = parseExcelDate(dum);
        }
        
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          const reading: GlucoseReading = {};
          let hasAnyValue = false;
          
          // Try to calculate gestational age from date column + DUM
          if (dumDate && dateColIndex >= 0) {
            const dateValue = row[dateColIndex];
            const measurementDate = parseExcelDate(dateValue);
            if (measurementDate) {
              const calculatedAge = calculateGestationalAgeFromDUM(measurementDate, dumDate);
              if (calculatedAge > 0) {
                lastGestationalAge = calculatedAge;
              }
            }
          }
          
          // Fallback: read gestational age directly from column if available
          if (lastGestationalAge === 0 && gestationalAgeColIndex >= 0) {
            const ageValue = row[gestationalAgeColIndex];
            const parsed = parseGestationalAge(ageValue);
            if (parsed > 0) {
              lastGestationalAge = parsed;
            }
          }
          
          for (const [colIndexStr, field] of Object.entries(columnMap)) {
            const colIndex = parseInt(colIndexStr);
            const rawValue = row[colIndex];
            const value = parseGlucoseValue(rawValue);
            if (value !== undefined) {
              reading[field] = value;
              hasAnyValue = true;
            }
          }
          
          if (hasAnyValue) {
            glucoseReadings.push(reading);
          }
        }
        
        
        if (lastGestationalAge > 0) {
          gestationalWeeks = Math.floor(lastGestationalAge);
          gestationalDays = Math.round((lastGestationalAge - gestationalWeeks) * 7);
        }
        
        if (glucoseReadings.length === 0) {
          throw new Error("Nenhum dado de glicemia encontrado na planilha. Verifique se os valores numéricos estão nas colunas corretas.");
        }
        
        const insulinFieldsCount = glucoseReadings.filter(r => 
          r.preAlmoco !== undefined || r.preJantar !== undefined || r.madrugada !== undefined
        ).length;
        const usesInsulin = insulinFieldsCount >= 3 || insulinFieldsCount >= glucoseReadings.length * 0.3;
        
        
        resolve({
          fileName: file.name,
          patientName,
          gestationalWeeks,
          gestationalDays,
          glucoseReadings,
          usesInsulin,
          birthDate,
          dum,
          status: "pending",
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

export function BatchImport() {
  const [patients, setPatients] = useState<ParsedPatientData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    const newPatients: ParsedPatientData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const patientData = await parseExcelFile(file);
        newPatients.push(patientData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        errors.push(`${file.name}: ${message}`);
      }
    }

    setPatients(prev => [...prev, ...newPatients]);
    
    if (errors.length > 0) {
      setError(`Erros em ${errors.length} arquivo(s):\n${errors.join("\n")}`);
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (newPatients.length > 0) {
      toast({
        title: "Arquivos carregados",
        description: `${newPatients.length} planilha(s) processada(s) com sucesso.`,
      });
    }
  };

  const removePatient = (index: number) => {
    setPatients(prev => prev.filter((_, i) => i !== index));
  };

  const generateRecommendations = async () => {
    if (patients.length === 0) return;

    setIsGenerating(true);
    setProgress(0);

    const updatedPatients = [...patients];

    for (let i = 0; i < updatedPatients.length; i++) {
      const patient = updatedPatients[i];
      if (patient.status === "success") continue;

      updatedPatients[i] = { ...patient, status: "processing" };
      setPatients([...updatedPatients]);

      try {
        const evaluationData = {
          patientName: patient.patientName,
          weight: 70,
          gestationalWeeks: patient.gestationalWeeks || 30,
          gestationalDays: patient.gestationalDays || 0,
          usesInsulin: patient.usesInsulin,
          insulinRegimens: [],
          dietAdherence: "regular" as const,
          glucoseReadings: patient.glucoseReadings.filter(r => 
            Object.values(r).some(v => typeof v === "number" && v > 0)
          ),
        };
        

        const response = await apiRequest("POST", "/api/analyze", evaluationData);
        const result = await response.json();

        updatedPatients[i] = {
          ...patient,
          status: "success",
          newEvaluation: result.evaluation,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao gerar recomendação";
        updatedPatients[i] = {
          ...patient,
          status: "error",
          errorMessage: message,
        };
      }

      setPatients([...updatedPatients]);
      setProgress(Math.round(((i + 1) / updatedPatients.length) * 100));
    }

    setIsGenerating(false);
    queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
    
    const successCount = updatedPatients.filter(p => p.status === "success").length;
    toast({
      title: "Processamento concluído",
      description: `${successCount} de ${updatedPatients.length} pacientes processados com sucesso.`,
    });
  };

  const clearAll = () => {
    setPatients([]);
    setError(null);
    setProgress(0);
  };

  const getStatusBadge = (status: ParsedPatientData["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "processing":
        return <Badge variant="outline" className="animate-pulse">Processando...</Badge>;
      case "success":
        return <Badge className="bg-green-600 dark:bg-green-700">Concluído</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importação em Lote
        </CardTitle>
        <CardDescription>
          Importe múltiplas planilhas de pacientes simultaneamente para gerar recomendações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-batch-files"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || isGenerating}
            data-testid="button-select-batch-files"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Selecionar Planilhas
              </>
            )}
          </Button>

          {patients.length > 0 && (
            <>
              <Button
                onClick={generateRecommendations}
                disabled={isGenerating || patients.every(p => p.status === "success")}
                data-testid="button-generate-batch"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Recomendações
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={clearAll}
                disabled={isGenerating}
                data-testid="button-clear-batch"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar Lista
              </Button>
            </>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        )}

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Processando pacientes...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {patients.length > 0 && (
          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="text-center">IG</TableHead>
                  <TableHead className="text-center">Insulina</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Recomendação</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient, index) => (
                  <TableRow key={`${patient.fileName}-${index}`}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{patient.patientName}</div>
                          <div className="text-xs text-muted-foreground">
                            {patient.glucoseReadings.length} dias de dados
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {patient.gestationalWeeks > 0 ? `${patient.gestationalWeeks}s${patient.gestationalDays > 0 ? `+${patient.gestationalDays}d` : ''}` : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {patient.usesInsulin ? (
                        <Badge className="bg-blue-600 dark:bg-blue-700 text-xs">Sim</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(patient.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      {patient.newEvaluation?.recommendation ? (
                        <Badge variant="outline" className="text-xs">
                          {(patient.newEvaluation.recommendation as any)?.ruleApplied || "OK"}
                        </Badge>
                      ) : patient.errorMessage ? (
                        <span className="text-xs text-destructive">{patient.errorMessage}</span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePatient(index)}
                        disabled={isGenerating}
                        data-testid={`button-remove-patient-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {patients.length === 0 && !isProcessing && (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma planilha carregada</p>
            <p className="text-sm mt-1">
              Selecione arquivos Excel (.xlsx) com dados de glicemia
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
