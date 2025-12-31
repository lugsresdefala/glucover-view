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
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// IMPORTANTE: Mapeamentos mais específicos (2h) devem vir ANTES dos genéricos
// A função mapColumn usa o PRIMEIRO match encontrado
const COLUMN_MAPPINGS: Array<[string, keyof GlucoseReading]> = [
  // === 2 HORAS - PRIORIDADE MÁXIMA (verificar antes de 1h) ===
  ["2h almoco", "posAlmoco2h"],
  ["2h pos almoco", "posAlmoco2h"],
  ["2h pós almoco", "posAlmoco2h"],
  ["almoco 2h", "posAlmoco2h"],
  ["almoco 2 h", "posAlmoco2h"],
  ["pos almoco 2h", "posAlmoco2h"],
  ["pos-almoco 2h", "posAlmoco2h"],
  ["posalmoco 2h", "posAlmoco2h"],
  ["2h jantar", "posJantar2h"],
  ["2h pos jantar", "posJantar2h"],
  ["2h pós jantar", "posJantar2h"],
  ["jantar 2h", "posJantar2h"],
  ["jantar 2 h", "posJantar2h"],
  ["pos jantar 2h", "posJantar2h"],
  ["pos-jantar 2h", "posJantar2h"],
  ["posjantar 2h", "posJantar2h"],
  ["2h cafe", "posCafe2h"],
  ["2h pos cafe", "posCafe2h"],
  ["cafe 2h", "posCafe2h"],
  ["pos cafe 2h", "posCafe2h"],
  
  // === JEJUM ===
  ["jejum", "jejum"],
  ["glicemia jejum", "jejum"],
  ["em jejum", "jejum"],
  
  // === CAFÉ DA MANHÃ (1h ou genérico) ===
  ["cafe manha", "posCafe1h"],
  ["cafe da manha", "posCafe1h"],
  ["pos cafe", "posCafe1h"],
  ["pos-cafe", "posCafe1h"],
  ["poscafe", "posCafe1h"],
  ["1h cafe", "posCafe1h"],
  ["1h pos cafe", "posCafe1h"],
  ["1h pós cafe", "posCafe1h"],
  ["apos cafe", "posCafe1h"],
  ["depois cafe", "posCafe1h"],
  
  // === PRÉ-ALMOÇO ===
  ["antes do almoco", "preAlmoco"],
  ["antes do almoço", "preAlmoco"],
  ["pre almoco", "preAlmoco"],
  ["pre-almoco", "preAlmoco"],
  ["prealmoco", "preAlmoco"],
  
  // === PÓS-ALMOÇO 1h (verificar DEPOIS de 2h) ===
  ["pos almoco", "posAlmoco1h"],
  ["pos-almoco", "posAlmoco1h"],
  ["posalmoco", "posAlmoco1h"],
  ["1h almoco", "posAlmoco1h"],
  ["1h pos almoco", "posAlmoco1h"],
  ["1h pós almoco", "posAlmoco1h"],
  ["apos almoco", "posAlmoco1h"],
  ["depois almoco", "posAlmoco1h"],
  ["almoco", "posAlmoco1h"],  // Genérico por último
  
  // === PRÉ-JANTAR ===
  ["antes do jantar", "preJantar"],
  ["pre jantar", "preJantar"],
  ["pre-jantar", "preJantar"],
  ["prejantar", "preJantar"],
  
  // === PÓS-JANTAR 1h (verificar DEPOIS de 2h) ===
  ["pos jantar", "posJantar1h"],
  ["pos-jantar", "posJantar1h"],
  ["posjantar", "posJantar1h"],
  ["1h jantar", "posJantar1h"],
  ["1h pos jantar", "posJantar1h"],
  ["1h pós jantar", "posJantar1h"],
  ["apos jantar", "posJantar1h"],
  ["depois jantar", "posJantar1h"],
  ["jantar", "posJantar1h"],  // Genérico por último
  
  // === MADRUGADA ===
  ["madrugada", "madrugada"],
  ["3h da manha", "madrugada"],
  ["3h da manhã", "madrugada"],
  ["3h manha", "madrugada"],
  ["3h", "madrugada"],
  ["3 horas", "madrugada"],
];

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
  // Usar array ordenado para garantir que padrões mais específicos (2h) sejam verificados primeiro
  for (const [pattern, field] of COLUMN_MAPPINGS) {
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
    .replace(/^[_#@]+/, "")  // Remove _, #, @ do início
    .replace(/_\d+$/, "")
    .replace(/_/g, " ")
    .trim();
  
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseExcelFile(file: File, retryCount = 0): Promise<ParsedPatientData> {
  const MAX_RETRIES = 2;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  
  return new Promise((resolve, reject) => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.`));
      return;
    }
    
    // Check file extension
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx' && ext !== 'xls') {
      reject(new Error(`Formato de arquivo inválido (.${ext}). Use arquivos .xlsx ou .xls`));
      return;
    }
    
    const reader = new FileReader();
    
    // Add timeout for slow reads
    const timeout = setTimeout(() => {
      reader.abort();
      if (retryCount < MAX_RETRIES) {
        parseExcelFile(file, retryCount + 1).then(resolve).catch(reject);
      } else {
        reject(new Error(`Timeout ao ler arquivo após ${MAX_RETRIES + 1} tentativas.`));
      }
    }, 30000); // 30 second timeout
    
    reader.onload = (e) => {
      clearTimeout(timeout);
      try {
        const result = e.target?.result;
        if (!result || !(result instanceof ArrayBuffer)) {
          throw new Error("Falha ao carregar conteúdo do arquivo.");
        }
        const data = new Uint8Array(result);
        if (data.length === 0) {
          throw new Error("Arquivo vazio ou corrompido.");
        }
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
        let hasInsulinColumn = false;
        let insulinMentionedInSheet = false;
        
        // Scan entire sheet for insulin mentions
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row) continue;
          const rowText = row.map(c => String(c || "")).join(" ").toLowerCase();
          if (rowText.includes("insulina") || rowText.includes("nph") || 
              rowText.includes("regular") || rowText.includes("asparte") ||
              rowText.includes("lispro") || rowText.includes("glargina") ||
              rowText.includes("lantus") || rowText.includes("novorapid") ||
              rowText.includes("humalog") || rowText.includes("ui") ||
              rowText.match(/\d+\s*u\b/) || rowText.match(/\d+\s*unidades/)) {
            insulinMentionedInSheet = true;
            console.log(`[DEBUG ${patientName}] Insulin detected in row ${i}: "${rowText.substring(0, 100)}..."`);
            break;
          }
        }
        
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
            
            // Detect insulin column
            if (normalized.includes("insulina") || normalized.includes("nph") ||
                normalized.includes("regular") || normalized.includes("doses")) {
              hasInsulinColumn = true;
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
        
        
        // DEBUG: Mostrar TODOS os headers encontrados e como foram mapeados
        const headerRow = rawData[headerRowIndex] || [];
        console.log(`[DEBUG ${patientName}] ========== ANALISE DE COLUNAS ==========`);
        console.log(`[DEBUG ${patientName}] Header row index: ${headerRowIndex}`);
        console.log(`[DEBUG ${patientName}] Headers encontrados:`);
        for (let j = 0; j < headerRow.length; j++) {
          const cell = headerRow[j];
          if (cell !== null && cell !== undefined && cell !== "") {
            const mapped = mapColumn(String(cell));
            console.log(`[DEBUG ${patientName}]   Coluna ${j}: "${String(cell)}" -> ${mapped || "NÃO MAPEADO"}`);
          }
        }
        console.log(`[DEBUG ${patientName}] Colunas mapeadas: ${JSON.stringify(columnMap)}`);
        console.log(`[DEBUG ${patientName}] ===========================================`);
        
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
        let firstReadingFound = false; // Only start counting empty rows after finding first data
        const MAX_EMPTY_ROWS = 10; // Stop after 10 consecutive rows without glucose data (to handle gaps in data)
        const MAX_ROWS_WITHOUT_DATA = 200; // Maximum rows to scan before giving up if no data found
        let rowsScannedWithoutData = 0;
        
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) {
            // Only count empty rows if we've already found some glucose data
            if (firstReadingFound) {
              consecutiveEmptyRows++;
              if (consecutiveEmptyRows >= MAX_EMPTY_ROWS) {
                console.log(`[DEBUG ${patientName}] Stopping at row ${i}: ${MAX_EMPTY_ROWS} consecutive empty rows after data`);
                break;
              }
            }
            continue;
          }
          
          const reading: GlucoseReading = {};
          let hasAnyValue = false;
          let currentRowAge = 0;
          let currentSource: "explicit" | "calculated" | "propagated" = "propagated";
          let currentMeasurementDate: string | undefined = undefined;
          
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
          if (dateColIndex >= 0) {
            const dateValue = row[dateColIndex];
            const parsedDate = parseExcelDate(dateValue);
            if (parsedDate) {
              // Salvar a data da medição em formato ISO (YYYY-MM-DD) para detecção de gaps
              currentMeasurementDate = parsedDate.toISOString().split('T')[0];
              
              if (currentRowAge === 0 && dumDate) {
                const calculatedAge = calculateGestationalAgeFromDUM(parsedDate, dumDate);
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
            // Store gestational age in reading for ordering detection
            if (currentRowAge > 0) {
              (reading as Record<string, unknown>).gestationalAge = currentRowAge;
            }
            // Store measurement date for chronological gap detection
            if (currentMeasurementDate) {
              (reading as Record<string, unknown>).measurementDate = currentMeasurementDate;
            }
            glucoseReadings.push(reading);
            debugRowCount++;
            consecutiveEmptyRows = 0; // Reset counter when we find valid data
            firstReadingFound = true; // Mark that we've found at least one reading
            // Track the gestational age of the last row with actual glucose data
            if (currentRowAge > 0) {
              lastGestationalAgeWithGlucose = currentRowAge;
              lastSourceWithGlucose = currentSource;
            }
          } else {
            // Row exists but has no valid glucose data
            if (firstReadingFound) {
              // After finding data, count consecutive empty rows to stop at trailing blanks
              consecutiveEmptyRows++;
              if (consecutiveEmptyRows >= MAX_EMPTY_ROWS) {
                console.log(`[DEBUG ${patientName}] Stopping at row ${i}: ${MAX_EMPTY_ROWS} consecutive rows without glucose data after finding data`);
                break;
              }
            } else {
              // Before finding any data, limit how far we scan
              rowsScannedWithoutData++;
              if (rowsScannedWithoutData >= MAX_ROWS_WITHOUT_DATA) {
                console.log(`[DEBUG ${patientName}] Stopping at row ${i}: scanned ${MAX_ROWS_WITHOUT_DATA} rows without finding glucose data`);
                break;
              }
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
        
        // Data is already in chronological order (oldest first, newest last)
        // slice(-7) in clinical-engine.ts will correctly get the most recent 7 days
        
        // Determine insulin usage - prioritize explicit detection from sheet content
        const insulinFieldsCount = glucoseReadings.filter(r => 
          r.preAlmoco !== undefined || r.preJantar !== undefined || r.madrugada !== undefined
        ).length;
        const inferredFromFields = insulinFieldsCount >= 3 || insulinFieldsCount >= glucoseReadings.length * 0.3;
        
        // Use insulin if: mentioned anywhere in sheet, or has insulin column, or inferred from pre-meal fields
        const usesInsulin = insulinMentionedInSheet || hasInsulinColumn || inferredFromFields;
        console.log(`[DEBUG ${patientName}] Insulin detection: mentioned=${insulinMentionedInSheet}, column=${hasInsulinColumn}, inferred=${inferredFromFields}, final=${usesInsulin}`);
        
        
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
        clearTimeout(timeout);
        reject(error);
      }
    };
    reader.onerror = (event) => {
      clearTimeout(timeout);
      const error = event.target?.error;
      let errorMessage = "Erro ao ler o arquivo.";
      
      if (error) {
        if (error.name === "NotReadableError") {
          errorMessage = "Arquivo corrompido ou protegido. Verifique se o arquivo não está aberto em outro programa.";
        } else if (error.name === "NotFoundError") {
          errorMessage = "Arquivo não encontrado. Tente selecionar novamente.";
        } else if (error.name === "SecurityError") {
          errorMessage = "Acesso ao arquivo negado por restrições de segurança.";
        } else if (error.name === "AbortError") {
          if (retryCount < MAX_RETRIES) {
            parseExcelFile(file, retryCount + 1).then(resolve).catch(reject);
            return;
          }
          errorMessage = "Leitura do arquivo cancelada após múltiplas tentativas.";
        } else {
          errorMessage = `Erro ao ler: ${error.name || "desconhecido"} - ${error.message || ""}`;
        }
      }
      
      reject(new Error(errorMessage));
    };
    
    reader.onabort = () => {
      clearTimeout(timeout);
      if (retryCount < MAX_RETRIES) {
        parseExcelFile(file, retryCount + 1).then(resolve).catch(reject);
      } else {
        reject(new Error("Leitura do arquivo abortada após múltiplas tentativas."));
      }
    };
    
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
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    totalProcessed: number;
    totalSuccess: number;
    totalErrors: number;
    updates: Array<{
      patientName: string;
      isUpdate: boolean;
      previousDays: number;
      newDays: number;
      addedDays: number;
      urgencyLevel?: string;
    }>;
  } | null>(null);
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
    
    // Process files in batches to avoid overwhelming the browser
    const BATCH_SIZE = 10;
    const filesArray = Array.from(files);
    
    for (let batchStart = 0; batchStart < filesArray.length; batchStart += BATCH_SIZE) {
      const batch = filesArray.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(file => parseExcelFile(file))
      );
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const file = batch[j];
        
        if (result.status === "fulfilled") {
          newPatients.push(result.value);
        } else {
          const message = result.reason instanceof Error 
            ? result.reason.message 
            : "Erro desconhecido";
          errors.push({
            fileName: file.name,
            message,
            type: categorizeError(message),
          });
        }
      }
      
      // Small delay between batches to let browser breathe
      if (batchStart + BATCH_SIZE < filesArray.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
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
        description: `${newPatients.length} planilha(s) processada(s) com sucesso.${errors.length > 0 ? ` ${errors.length} com erros.` : ""}`,
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
    const summaryUpdates: typeof summaryData extends null ? never : NonNullable<typeof summaryData>["updates"] = [];

    // Fetch existing evaluations to compare
    let existingEvaluations: StoredEvaluation[] = [];
    try {
      const existingResponse = await fetch("/api/doctor/evaluations", { credentials: "include" });
      if (existingResponse.ok) {
        existingEvaluations = await existingResponse.json();
      }
    } catch {
      // Continue without previous data
    }

    for (let i = 0; i < updatedPatients.length; i++) {
      const patient = updatedPatients[i];
      if (patient.status === "success") continue;

      updatedPatients[i] = { ...patient, status: "processing" };
      setPatients([...updatedPatients]);

      // Find previous evaluation for this patient
      const previousEval = existingEvaluations.find(
        e => e.patientName.toLowerCase().trim() === patient.patientName.toLowerCase().trim()
      );
      const previousDays = previousEval?.glucoseReadings?.length || 0;

      try {
        const validReadings = patient.glucoseReadings.filter(r => 
          Object.values(r).some(v => typeof v === "number" && v > 0)
        );

        const evaluationData = {
          patientName: patient.patientName,
          weight: null,
          gestationalWeeks: patient.gestationalWeeks || 0,
          gestationalDays: patient.gestationalDays || 0,
          gestationalAgeSource: patient.gestationalAgeSource || "explicit",
          usesInsulin: patient.usesInsulin,
          insulinRegimens: [],
          dietAdherence: "regular" as const,
          glucoseReadings: validReadings,
        };

        // Retry logic for rate limiting (429 errors)
        let response: Response | null = null;
        let retryCount = 0;
        const MAX_RETRIES = 3;
        
        while (retryCount <= MAX_RETRIES) {
          try {
            response = await apiRequest("POST", "/api/analyze", evaluationData);
            break; // Success, exit retry loop
          } catch (retryErr) {
            const errMessage = retryErr instanceof Error ? retryErr.message : "";
            if (errMessage.includes("429") || errMessage.includes("Limite")) {
              retryCount++;
              if (retryCount <= MAX_RETRIES) {
                // Wait with exponential backoff: 1s, 2s, 4s
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount - 1)));
                continue;
              }
            }
            throw retryErr; // Re-throw non-429 errors
          }
        }
        
        if (!response) {
          throw new Error("Falha ao processar após múltiplas tentativas");
        }
        
        const result = await response.json();

        updatedPatients[i] = {
          ...patient,
          status: "success",
          newEvaluation: result.evaluation,
          previousEvaluation: previousEval,
        };

        // Track summary data
        const newDays = validReadings.length;
        summaryUpdates.push({
          patientName: patient.patientName,
          isUpdate: !!previousEval,
          previousDays,
          newDays,
          addedDays: Math.max(0, newDays - previousDays),
          urgencyLevel: result.evaluation?.recommendation?.urgencyLevel,
        });
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
    queryClient.invalidateQueries({ queryKey: ["/api/doctor/evaluations"] });
    
    const successCount = updatedPatients.filter(p => p.status === "success").length;
    const errorCount = updatedPatients.filter(p => p.status === "error").length;

    // Show summary modal
    setSummaryData({
      totalProcessed: updatedPatients.length,
      totalSuccess: successCount,
      totalErrors: errorCount,
      updates: summaryUpdates.sort((a, b) => a.patientName.localeCompare(b.patientName, 'pt-BR')),
    });
    setShowSummary(true);
  };

  const clearAll = () => {
    setPatients([]);
    setImportErrors([]);
    setProgress(0);
  };

  const exportToExcel = () => {
    // Filtrar apenas pacientes com recomendações geradas
    const successfulPatients = patients.filter(p => p.status === "success" && p.newEvaluation?.recommendation);
    
    if (successfulPatients.length === 0) {
      toast({
        title: "Nenhuma recomendação para exportar",
        description: "Gere as recomendações primeiro antes de exportar.",
        variant: "destructive",
      });
      return;
    }

    // Ordenar alfabeticamente por nome
    const sortedPatients = [...successfulPatients].sort((a, b) => 
      a.patientName.localeCompare(b.patientName, 'pt-BR')
    );

    // Criar dados para a planilha
    const exportData = sortedPatients.map(patient => {
      const rec = patient.newEvaluation?.recommendation;
      
      // Construir texto da recomendação usando a estrutura ClinicalRecommendation
      let recomendacao = "";
      
      if (rec?.mainRecommendation) {
        recomendacao = rec.mainRecommendation;
      }
      
      // Adicionar justificativa se disponível
      if (rec?.justification) {
        recomendacao += `\n\nJUSTIFICATIVA: ${rec.justification}`;
      }
      
      // Adicionar próximos passos se disponíveis
      if (rec?.nextSteps && rec.nextSteps.length > 0) {
        recomendacao += `\n\nPRÓXIMOS PASSOS:\n${rec.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
      }
      
      return {
        "Nome": patient.patientName,
        "Recomendação": recomendacao.trim() || "Sem recomendação"
      };
    });

    // Criar workbook e worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 40 },  // Nome
      { wch: 100 }, // Recomendação
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recomendações");

    // Gerar nome do arquivo com data
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const fileName = `recomendacoes_${dateStr}.xlsx`;

    // Download
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Exportação concluída",
      description: `${sortedPatients.length} recomendações exportadas para ${fileName}`,
    });
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

              {patients.some(p => p.status === "success") && (
                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  disabled={isGenerating}
                  data-testid="button-export-excel"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
              )}

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
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1" title="Planilha sem DUM e sem coluna IG preenchida">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs">Sem DUM</span>
                          </span>
                        )}
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

        {/* Summary Modal */}
        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <DialogContent className="sm:max-w-3xl p-0">
            <div className="p-6 pb-4 border-b bg-muted/30">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-md">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  Resumo do Processamento
                </DialogTitle>
              </DialogHeader>
            </div>
            
            {summaryData && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Total</p>
                    <p className="text-2xl font-bold font-mono">{summaryData.totalProcessed}</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Sucesso</p>
                    <p className="text-2xl font-bold font-mono text-green-600">{summaryData.totalSuccess}</p>
                  </div>
                  {summaryData.totalErrors > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Erros</p>
                      <p className="text-2xl font-bold font-mono text-red-600">{summaryData.totalErrors}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                    <TrendingUp className="h-4 w-4" />
                    Detalhes por Paciente
                  </h4>
                  <div className="border rounded-md overflow-hidden">
                    <ScrollArea className="h-[260px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted">
                          <TableRow>
                            <TableHead className="font-semibold text-xs">Paciente</TableHead>
                            <TableHead className="text-center font-semibold text-xs w-24">Status</TableHead>
                            <TableHead className="text-center font-semibold text-xs w-20">Anterior</TableHead>
                            <TableHead className="text-center font-semibold text-xs w-20">Atual</TableHead>
                            <TableHead className="text-center font-semibold text-xs w-20">Novos</TableHead>
                            <TableHead className="text-center font-semibold text-xs w-24">Urgência</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaryData.updates.map((update, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-sm">{update.patientName}</TableCell>
                              <TableCell className="text-center">
                                {update.isUpdate ? (
                                  <Badge variant="outline" className="text-xs">
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Atualizado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-600 text-xs">Novo</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-mono text-sm">
                                {update.previousDays || "-"}
                              </TableCell>
                              <TableCell className="text-center font-mono text-sm">
                                {update.newDays}
                              </TableCell>
                              <TableCell className="text-center">
                                {update.addedDays > 0 ? (
                                  <Badge className="bg-blue-600 text-xs">+{update.addedDays}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {update.urgencyLevel === "critical" ? (
                                  <Badge variant="destructive" className="text-xs">Alerta</Badge>
                                ) : update.urgencyLevel === "warning" ? (
                                  <Badge className="bg-amber-500 text-xs">Vigilância</Badge>
                                ) : (
                                  <Badge className="bg-green-400 dark:bg-green-600 text-green-900 dark:text-green-100 text-xs">Adequado</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowSummary(false)}>
                    Fechar
                  </Button>
                  <Button onClick={() => { setShowSummary(false); exportToExcel(); }}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
