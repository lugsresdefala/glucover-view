import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  gestationalAgeSource: "explicit" | "calculated" | "propagated";
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
  
  // If it's already a number, use it directly
  if (typeof value === "number") {
    if (isNaN(value) || value < 20 || value > 600) {
      return undefined;
    }
    return Math.round(value);
  }
  
  // Convert to string and normalize ALL whitespace (including NBSP \u00A0)
  let strValue = String(value)
    .replace(/[\u00A0\u2007\u202F\u2060]/g, " ")  // Replace non-breaking spaces
    .replace(/\s+/g, " ")  // Normalize whitespace
    .trim();
  
  // Extract only the numeric part (handles "110 mg/dL", "95,5", etc.)
  const match = strValue.match(/^[\d]+[,.]?[\d]*/);
  if (!match) {
    return undefined;
  }
  
  const numStr = match[0].replace(",", ".");
  const num = parseFloat(numStr);
  
  // Validate: glucose values below 20 or above 600 are clinically impossible
  if (isNaN(num) || num < 20 || num > 600) {
    return undefined;
  }
  
  return Math.round(num);
}

function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  
  // Handle Date objects directly (XLSX may return Date objects for date cells)
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  
  // Handle various date string formats
  if (typeof value === "string") {
    // Match ISO format: 2025-07-18T00:00:00.000Z
    const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (isoDateMatch) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    // Match JavaScript Date.toString() format: "Fri Apr 25 2025 00:00:28 GMT-0300 (Horário Padrão de Brasília)"
    // This format is produced when XLSX converts dates and they get stringified
    const jsDateMatch = value.match(/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/);
    if (jsDateMatch) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  
  // Convert string serials to number
  let numValue: number | null = null;
  if (typeof value === "number") {
    numValue = value;
  } else if (typeof value === "string") {
    const parsed = parseFloat(value.trim());
    if (!isNaN(parsed) && parsed > 1000 && parsed < 100000) {
      numValue = parsed;
    }
  }
  
  // Excel serial date number (days since 1899-12-30, using UTC to avoid timezone issues)
  if (numValue !== null && numValue > 1000 && numValue < 100000) {
    // Excel epoch: December 30, 1899 (accounting for Excel's leap year bug)
    // Using UTC to avoid timezone/DST issues
    const msPerDay = 24 * 60 * 60 * 1000;
    const excelEpochMs = Date.UTC(1899, 11, 30); // Dec 30, 1899 in UTC
    const dateMs = excelEpochMs + numValue * msPerDay;
    const date = new Date(dateMs);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  const strValue = String(value).trim();
  
  // Try DD/MM/YYYY format (Brazilian with 4-digit year)
  const brMatch4 = strValue.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch4) {
    const day = parseInt(brMatch4[1]);
    const month = parseInt(brMatch4[2]) - 1;
    const year = parseInt(brMatch4[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getFullYear() === year && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      return date;
    }
  }
  
  // Try DD/MM/YY format (Brazilian with 2-digit year)
  const brMatch2 = strValue.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (brMatch2) {
    const day = parseInt(brMatch2[1]);
    const month = parseInt(brMatch2[2]) - 1;
    let year = parseInt(brMatch2[3]);
    // Convert 2-digit year: 00-50 = 2000-2050, 51-99 = 1951-1999
    year = year <= 50 ? 2000 + year : 1900 + year;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getFullYear() === year && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
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
  
  // Handle number format where decimal represents days (21.2 = 21 weeks + 2 days)
  if (typeof value === "number" && value > 0 && value < 45) {
    const weeks = Math.floor(value);
    const decimalPart = value - weeks;
    // If decimal part looks like days (0.1-0.6), interpret as days
    // Excel/Brazilian format: 21.2 = 21 weeks + 2 days
    if (decimalPart > 0 && decimalPart < 1) {
      const days = Math.round(decimalPart * 10); // 0.2 -> 2 days
      if (days >= 0 && days <= 6) {
        return weeks + (days / 7);
      }
    }
    return value;
  }
  
  const strValue = String(value).trim();
  
  // Format: "21+2" or "21/2" (weeks+days)
  const weeksDaysMatch = strValue.match(/(\d+)\s*[+\/]\s*(\d+)/);
  if (weeksDaysMatch) {
    const weeks = parseInt(weeksDaysMatch[1]);
    const days = parseInt(weeksDaysMatch[2]);
    if (weeks >= 1 && weeks < 45 && days >= 0 && days <= 6) {
      return weeks + (days / 7);
    }
  }
  
  // Format: "21,2" or "21.2" (Brazilian format: weeks,days)
  const decimalMatch = strValue.match(/^(\d+)[,.](\d)$/);
  if (decimalMatch) {
    const weeks = parseInt(decimalMatch[1]);
    const days = parseInt(decimalMatch[2]);
    if (weeks >= 1 && weeks < 45 && days >= 0 && days <= 6) {
      return weeks + (days / 7);
    }
  }
  
  // Format: just weeks like "21" or "21 semanas"
  const weeksOnlyMatch = strValue.match(/^(\d+)\s*(?:semanas?|sem|s)?$/i);
  if (weeksOnlyMatch) {
    const weeks = parseInt(weeksOnlyMatch[1]);
    if (weeks >= 1 && weeks < 45) {
      return weeks;
    }
  }
  
  // Fallback: try to parse any number
  const numMatch = strValue.match(/(\d+[,.]?\d*)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1].replace(",", "."));
    if (!isNaN(parsed) && parsed > 0 && parsed < 45) {
      // Interpret as weeks.days format
      const weeks = Math.floor(parsed);
      const decimalPart = parsed - weeks;
      if (decimalPart > 0 && decimalPart < 1) {
        const days = Math.round(decimalPart * 10);
        if (days >= 0 && days <= 6) {
          return weeks + (days / 7);
        }
      }
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
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        
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
              if ((cellLower === "dum" || cellLower.includes("dum:")) && j + 1 < row.length) {
                const dumCell = row[j + 1];
                if (dumCell !== null && dumCell !== undefined && dumCell !== "") {
                  // Keep as-is - could be string or number (Excel serial)
                  dum = typeof dumCell === "number" ? String(dumCell) : String(dumCell);
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
        let lastGestationalAgeWithGlucose = 0; // IG da última linha com medidas de glicemia
        let gestationalAgeSource: "explicit" | "calculated" | "propagated" = "explicit";
        let lastSourceWithGlucose: "explicit" | "calculated" | "propagated" = "explicit";
        
        // Parse DUM date for calculating gestational age
        let dumDate: Date | null = null;
        if (dum) {
          dumDate = parseExcelDate(dum);
          console.log(`[DEBUG ${patientName}] DUM raw: "${dum}" (type: ${typeof dum}), parsed: ${dumDate?.toISOString() || 'null'}`);
        } else {
          console.log(`[DEBUG ${patientName}] DUM not found in spreadsheet`);
        }
        
        let debugRowCount = 0;
        let consecutiveEmptyRows = 0;
        const MAX_EMPTY_ROWS = 3; // Stop after 3 consecutive rows without glucose data
        
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) {
            consecutiveEmptyRows++;
            if (consecutiveEmptyRows >= MAX_EMPTY_ROWS) {
              console.log(`[DEBUG ${patientName}] Stopping at row ${i}: ${MAX_EMPTY_ROWS} consecutive empty rows`);
              break;
            }
            continue;
          }
          
          const reading: GlucoseReading = {};
          let hasAnyValue = false;
          let currentRowAge = 0;
          let currentSource: "explicit" | "calculated" | "propagated" = "propagated";
          
          // PRIORIDADE 1: Usar IG explícita da coluna da planilha (mais confiável)
          if (gestationalAgeColIndex >= 0) {
            const ageValue = row[gestationalAgeColIndex];
            const parsed = parseGestationalAge(ageValue);
            if (parsed > 0) {
              currentRowAge = parsed;
              lastGestationalAge = parsed;
              currentSource = "explicit";
              gestationalAgeSource = "explicit";
              if (debugRowCount < 3) {
                console.log(`[DEBUG ${patientName}] Row ${i}: IG da planilha="${ageValue}" -> ${parsed.toFixed(2)} semanas`);
              }
            }
          }
          
          // PRIORIDADE 2 (fallback): Calcular IG a partir da DUM + data da medição
          if (currentRowAge === 0 && dumDate && dateColIndex >= 0) {
            const dateValue = row[dateColIndex];
            const measurementDate = parseExcelDate(dateValue);
            if (measurementDate) {
              const calculatedAge = calculateGestationalAgeFromDUM(measurementDate, dumDate);
              if (debugRowCount < 3) {
                console.log(`[DEBUG ${patientName}] Row ${i}: IG calculada da DUM: dateValue="${dateValue}", calculatedAge=${calculatedAge.toFixed(2)} semanas`);
              }
              if (calculatedAge > 0) {
                currentRowAge = calculatedAge;
                lastGestationalAge = calculatedAge;
                currentSource = "calculated";
                gestationalAgeSource = "calculated";
              }
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
            debugRowCount++;
            consecutiveEmptyRows = 0; // Reset counter when we find valid data
            // Track the gestational age of the last row with actual glucose data
            if (currentRowAge > 0) {
              lastGestationalAgeWithGlucose = currentRowAge;
              lastSourceWithGlucose = currentSource;
            }
          } else {
            // Row exists but has no valid glucose data - count as "empty" for stopping purposes
            consecutiveEmptyRows++;
            if (consecutiveEmptyRows >= MAX_EMPTY_ROWS) {
              console.log(`[DEBUG ${patientName}] Stopping at row ${i}: ${MAX_EMPTY_ROWS} consecutive rows without glucose data`);
              break;
            }
          }
        }
        
        console.log(`[DEBUG ${patientName}] Final: lastGestationalAge=${lastGestationalAge.toFixed(2)}, lastGestationalAgeWithGlucose=${lastGestationalAgeWithGlucose.toFixed(2)}, dateColIndex=${dateColIndex}, gestationalAgeColIndex=${gestationalAgeColIndex}, dumDate=${dumDate?.toISOString() || 'null'}`);
        
        // Use the gestational age from the last row that had glucose readings
        // This avoids issues with empty rows at the end of spreadsheets
        let finalGestationalAge = lastGestationalAgeWithGlucose > 0 
          ? lastGestationalAgeWithGlucose 
          : lastGestationalAge;
        
        // Track the source of final gestational age
        let finalAgeSource = lastGestationalAgeWithGlucose > 0 
          ? lastSourceWithGlucose 
          : gestationalAgeSource;
        
        // If we're using a propagated value (last known IG, not from this row's data), mark it
        if (finalGestationalAge > 0 && lastGestationalAgeWithGlucose === 0) {
          finalAgeSource = "propagated";
        }
        
        // Cap at 42 weeks maximum (as per schema validation)
        if (finalGestationalAge > 42) {
          console.warn(`[WARN ${patientName}] Idade gestacional acima de 42 semanas (${finalGestationalAge.toFixed(2)}), resetando para 0`);
          finalGestationalAge = 0; // Invalid - will be flagged as error
        }
        
        // VALIDAÇÃO: Idade gestacional muito baixa é clinicamente implausível para DMG
        // DMG é tipicamente diagnosticado após 24 semanas. Se a IG < 12 semanas, provavelmente há erro na DUM
        if (finalGestationalAge > 0 && finalGestationalAge < 12) {
          console.warn(`[WARN ${patientName}] IDADE GESTACIONAL SUSPEITA: ${finalGestationalAge.toFixed(2)} semanas. Verifique se a DUM está correta na planilha.`);
          // Não zera automaticamente, mas registra o alerta
        }
        
        if (finalGestationalAge > 0) {
          gestationalWeeks = Math.floor(finalGestationalAge);
          gestationalDays = Math.round((finalGestationalAge - gestationalWeeks) * 7);
          // Ensure days don't exceed 6
          if (gestationalDays > 6) {
            gestationalDays = 6;
          }
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
          gestationalAgeSource: finalAgeSource,
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

interface ImportError {
  fileName: string;
  message: string;
  type: string;
}

function categorizeError(message: string): string {
  if (message.includes("Cabeçalho") || message.includes("colunas")) return "Estrutura da Planilha";
  if (message.includes("glicemia") || message.includes("dados")) return "Dados de Glicemia";
  if (message.includes("ler o arquivo") || message.includes("formato")) return "Formato do Arquivo";
  if (message.includes("nome") || message.includes("paciente")) return "Dados do Paciente";
  return "Outros Erros";
}

export function BatchImport() {
  const [patients, setPatients] = useState<ParsedPatientData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const groupedErrors = useMemo(() => {
    const groups: Record<string, ImportError[]> = {};
    for (const err of importErrors) {
      if (!groups[err.type]) groups[err.type] = [];
      groups[err.type].push(err);
    }
    return groups;
  }, [importErrors]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setImportErrors([]);
    const newPatients: ParsedPatientData[] = [];
    const errors: ImportError[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const patientData = await parseExcelFile(file);
        newPatients.push(patientData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        errors.push({
          fileName: file.name,
          message,
          type: categorizeError(message),
        });
      }
    }

    setPatients(prev => [...prev, ...newPatients]);
    
    if (errors.length > 0) {
      setImportErrors(errors);
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
          weight: null, // Peso não disponível na planilha
          gestationalWeeks: patient.gestationalWeeks || 0,
          gestationalDays: patient.gestationalDays || 0,
          gestationalAgeSource: patient.gestationalAgeSource || "explicit",
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
    setImportErrors([]);
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

        {importErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="mb-2 font-medium">
                {importErrors.length} erro(s) na importação
              </div>
              <Accordion type="multiple" className="w-full">
                {Object.entries(groupedErrors).map(([type, errors]) => (
                  <AccordionItem key={type} value={type} className="border-destructive/30">
                    <AccordionTrigger className="text-sm py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-destructive border-destructive/50">
                          {errors.length}
                        </Badge>
                        {type}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 text-sm">
                        {errors.map((err, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="font-medium">{err.fileName}:</span>
                            <span className="text-muted-foreground">{err.message}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AlertDescription>
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
                      <div className="flex items-center justify-center gap-1">
                        {patient.gestationalWeeks > 0 ? (
                          <>
                            {patient.gestationalWeeks < 12 && (
                              <span title="IG suspeita - verifique DUM">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              </span>
                            )}
                            <span className={patient.gestationalWeeks < 12 ? "text-amber-600 dark:text-amber-400" : ""}>
                              {`${patient.gestationalWeeks}s${patient.gestationalDays > 0 ? `+${patient.gestationalDays}d` : ''}`}
                            </span>
                          </>
                        ) : "-"}
                      </div>
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
