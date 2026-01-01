import type { PatientEvaluation, GlucoseReading, InsulinRegimen, CriticalAlert } from "@shared/schema";
import { glucoseTargets, criticalGlucoseThresholds, checkCriticalGlucose } from "@shared/schema";

/**
 * Clinical Engine for Diabetes in Pregnancy Management
 * Based on official guidelines:
 * - SBD (Sociedade Brasileira de Diabetes) 2025 - R1 to R17
 * - FEBRASGO (Federação Brasileira das Associações de Ginecologia e Obstetrícia) 2019
 * - WHO (World Health Organization) 2025
 */

export interface GlucoseAnalysisByPeriod {
  period: string;
  total: number;
  aboveTarget: number;
  belowTarget: number;
  inTarget: number;
  percentAbove: number;
  average: number;
  maxValue: number;
  minValue: number;
  targetMax: number;
  values: number[];
}

export interface InsulinDoseCalculation {
  initialTotalDose: number;
  basalDose: number;
  bolusDose: number;
  distribution: {
    nphManha: number;
    nphNoite: number;
    rapidaManha: number;
    rapidaAlmoco: number;
    rapidaJantar: number;
  };
  adjustmentNeeded: boolean;
  adjustmentType: "increase" | "decrease" | "none";
  adjustmentPercent: number;
  specificAdjustments: string[];
}

export interface ClinicalRule {
  id: string;
  title: string;
  classification: string;
  description: string;
  source: string;
  category: "DMG" | "DM1" | "DM2" | "ALL";
}

// =============================================================================
// INSULIN ADJUSTMENT ANALYSIS - EVIDENCE-BASED ALGORITHM
// =============================================================================

/**
 * Tipos de ajuste de insulina
 */
export type InsulinAdjustmentType = "NPH_NOTURNA" | "NPH_MANHA" | "NPH_ALMOCO" | "NPH_JANTAR" | 
                                     "RAPIDA_CAFE" | "RAPIDA_ALMOCO" | "RAPIDA_JANTAR";

export type AdjustmentDirection = "AUMENTAR" | "REDUZIR" | "MANTER" | "SOLICITAR_DADOS" | "AVALIAR";

/**
 * Resultado de análise para um período específico
 */
export interface PeriodAdjustmentResult {
  periodo: string;
  insulinaAfetada: InsulinAdjustmentType;
  direcao: AdjustmentDirection;
  justificativa: string;
  diasComProblema: number;
  totalDiasAnalisados: number;
  valoresObservados: number[];
  valorReferencia?: number; // Para análises que dependem de outro período (ex: madrugada para jejum)
  deltaCalculado?: number;  // Para análises pré/pós
  suspended?: boolean; // True if this adjustment was suspended due to safety conflict (e.g., hypo detected while recommending increase)
  originalDirecao?: AdjustmentDirection; // Original direction before suspension
}

/**
 * Resultado completo da análise de ajustes de insulina
 */
export interface InsulinAdjustmentAnalysis {
  ajustesRecomendados: PeriodAdjustmentResult[];
  resumoGeral: string;
  prioridadeMaxima: AdjustmentDirection;
  temDadosInsuficientes: boolean;
  periodosSemDados: string[];
  chronologyWarning?: string;  // Aviso sobre gaps nos dados
  dateRange?: { start: string; end: string };  // Intervalo de datas analisado
}

/**
 * Constantes do algoritmo
 */
const ADJUSTMENT_THRESHOLDS = {
  DIAS_MINIMOS_PADRAO: 3,        // Mínimo de dias com problema para considerar padrão
  DIAS_MINIMOS_HIPO: 2,         // Mínimo de episódios de hipoglicemia para reduzir
  DIAS_MINIMOS_SOMOGYI: 1,     // Mínimo de pares madrugada-jejum para detectar Somogyi
  DELTA_POS_PRE_LIMITE: 40,     // Delta pós-pré acima do qual indica problema na rápida
  JEJUM_LIMITE: 95,             // Limite superior para jejum
  PRE_PRANDIAL_LIMITE: 100,     // Limite superior para pré-prandial
  POS_PRANDIAL_LIMITE: 140,     // Limite superior para pós-prandial 1h
  MADRUGADA_LIMITE: 100,        // Limite superior para madrugada
  HIPO_LIMITE: 70,              // Limite inferior (hipoglicemia) - SBD/FEBRASGO 2025
  HIPO_NOTURNA_LIMITE: 70,     // Hipoglicemia noturna para detecção de Somogyi
};

/**
 * Mapeamento de períodos para insulinas responsáveis
 */
const PERIOD_TO_INSULIN_MAP: Record<string, { basal: InsulinAdjustmentType; rapida?: InsulinAdjustmentType }> = {
  jejum: { basal: "NPH_NOTURNA" },
  posCafe1h: { basal: "NPH_NOTURNA", rapida: "RAPIDA_CAFE" },
  preAlmoco: { basal: "NPH_MANHA" },
  posAlmoco1h: { basal: "NPH_MANHA", rapida: "RAPIDA_ALMOCO" },
  preJantar: { basal: "NPH_ALMOCO" },
  posJantar1h: { basal: "NPH_ALMOCO", rapida: "RAPIDA_JANTAR" },
  madrugada: { basal: "NPH_JANTAR" },
};

/**
 * Nomes legíveis para os períodos
 */
const PERIOD_LABELS: Record<string, string> = {
  jejum: "Jejum",
  posCafe1h: "1h pós-café",
  preAlmoco: "Pré-almoço",
  posAlmoco1h: "1h pós-almoço",
  preJantar: "Pré-jantar",
  posJantar1h: "1h pós-jantar",
  madrugada: "Madrugada (3h)",
};

/**
 * Nomes legíveis para as insulinas
 */
const INSULIN_LABELS: Record<InsulinAdjustmentType, string> = {
  NPH_NOTURNA: "NPH noturna (ao deitar)",
  NPH_MANHA: "NPH manhã (café)",
  NPH_ALMOCO: "NPH almoço",
  NPH_JANTAR: "NPH jantar",
  RAPIDA_CAFE: "Rápida café da manhã",
  RAPIDA_ALMOCO: "Rápida almoço",
  RAPIDA_JANTAR: "Rápida jantar",
};

// =============================================================================
// CHRONOLOGY UTILITIES - GAP DETECTION AND CONSECUTIVE DAY SELECTION
// =============================================================================

/**
 * Resultado da análise cronológica
 */
export interface ChronologyResult {
  readings: GlucoseReading[];           // Leituras consecutivas para análise
  totalOriginal: number;                // Total de leituras originais
  hasDateInfo: boolean;                 // Se as leituras têm informação de data
  gapsDetected: GapInfo[];              // Gaps detectados nos dados
  warningMessage: string | null;        // Mensagem de alerta sobre gaps
  dateRange: { start: string; end: string } | null;  // Intervalo de datas analisado
}

export interface GapInfo {
  afterDate: string;     // Data após a qual há gap
  beforeDate: string;    // Data antes da qual há gap  
  daysMissing: number;   // Dias sem dados
}

/**
 * Calcula diferença em dias entre duas datas ISO
 */
function daysDifference(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Analisa cronologia dos dados e retorna os últimos 7 dias.
 * 
 * REGRAS (baseado em SBD 2025, FEBRASGO 2019):
 * 1. Se não há datas disponíveis: usa últimos 7 registros com aviso
 * 2. Se há datas: ordena e seleciona os 7 dias mais recentes
 * 3. Gaps são detectados e informados como CONTEXTO, mas NÃO excluem dados
 * 4. Recomendações são SEMPRE baseadas nos últimos 7 dias disponíveis
 * 
 * @param readings Todas as leituras de glicemia
 * @param maxDays Máximo de dias a analisar (default: 7)
 * @param maxGapDays Máximo de dias de gap para reportar (default: 2)
 */
export function analyzeChronology(
  readings: GlucoseReading[], 
  maxDays: number = 7,
  maxGapDays: number = 2
): ChronologyResult {
  if (readings.length === 0) {
    return {
      readings: [],
      totalOriginal: 0,
      hasDateInfo: false,
      gapsDetected: [],
      warningMessage: "Nenhum dado de glicemia disponível.",
      dateRange: null,
    };
  }
  
  // Verificar se as leituras têm informação de data
  const readingsWithDates = readings.filter(r => r.measurementDate);
  const hasDateInfo = readingsWithDates.length >= readings.length * 0.8; // 80% com datas
  
  if (!hasDateInfo) {
    // Fallback: sem datas, usa últimos N registros com aviso
    const recentReadings = readings.slice(-maxDays);
    return {
      readings: recentReadings,
      totalOriginal: readings.length,
      hasDateInfo: false,
      gapsDetected: [],
      warningMessage: readings.length > maxDays 
        ? `Dados sem informação de data. Usando últimos ${recentReadings.length} registros.`
        : null,
      dateRange: null,
    };
  }
  
  // Ordenar por data NUMÉRICA (mais antigo primeiro)
  // Usar Date.parse para evitar erros de comparação de strings (ex: "2025-1-9" vs "2025-01-10")
  const sortedReadings = [...readingsWithDates].sort((a, b) => {
    const dateA = a.measurementDate ? new Date(a.measurementDate).getTime() : 0;
    const dateB = b.measurementDate ? new Date(b.measurementDate).getTime() : 0;
    // Se parsing falhar (NaN), manter ordem original
    if (isNaN(dateA) && isNaN(dateB)) return 0;
    if (isNaN(dateA)) return 1;  // Datas inválidas vão para o final
    if (isNaN(dateB)) return -1;
    return dateA - dateB;
  });
  
  // Detectar gaps (apenas para informação contextual, NÃO exclui dados)
  const gaps: GapInfo[] = [];
  
  for (let i = 1; i < sortedReadings.length; i++) {
    const prevDate = sortedReadings[i - 1].measurementDate!;
    const currDate = sortedReadings[i].measurementDate!;
    const diff = daysDifference(prevDate, currDate);
    
    if (diff > maxGapDays) {
      gaps.push({
        afterDate: prevDate,
        beforeDate: currDate,
        daysMissing: diff - 1,
      });
    }
  }
  
  // SEMPRE usar os últimos 7 dias disponíveis (não excluir por gaps)
  const recentReadings = sortedReadings.slice(-maxDays);
  
  // Gerar mensagem informativa (não de exclusão)
  let warningMessage: string | null = null;
  
  if (gaps.length > 0) {
    // Informar sobre gaps nos últimos 7 dias como contexto
    const recentGaps = gaps.filter(g => {
      const gapDate = new Date(g.beforeDate);
      const oldestRecent = new Date(recentReadings[0]?.measurementDate || "");
      return gapDate >= oldestRecent;
    });
    
    if (recentGaps.length > 0) {
      const totalGapDays = recentGaps.reduce((sum, g) => sum + g.daysMissing, 0);
      warningMessage = `Período analisado contém ${recentGaps.length} intervalo(s) sem monitoramento (${totalGapDays} dia(s) total). Considerar reforçar adesão ao monitoramento.`;
    }
  }
  
  if (!warningMessage && sortedReadings.length > maxDays) {
    warningMessage = `Analisando os ${maxDays} dias mais recentes de ${sortedReadings.length} disponíveis.`;
  }
  
  return {
    readings: recentReadings,
    totalOriginal: readings.length,
    hasDateInfo: true,
    gapsDetected: gaps,
    warningMessage,
    dateRange: recentReadings.length > 0 ? {
      start: recentReadings[0].measurementDate!,
      end: recentReadings[recentReadings.length - 1].measurementDate!,
    } : null,
  };
}

/**
 * Extrai valores de um período específico de todos os dias de leitura
 */
function extractPeriodValues(readings: GlucoseReading[], period: keyof GlucoseReading): number[] {
  return readings
    .map(r => r[period])
    .filter((v): v is number => typeof v === "number" && v > 0);
}

/**
 * Conta dias com valor acima do limite
 * SBD 2025: meta é "< valor", portanto >= limite = acima da meta
 */
function countDaysAboveLimit(values: number[], limit: number): number {
  return values.filter(v => v >= limit).length;
}

/**
 * Conta dias com valor abaixo do limite (hipoglicemia)
 */
function countDaysBelowLimit(values: number[], limit: number): number {
  return values.filter(v => v < limit).length;
}

/**
 * Analisa jejum elevado considerando madrugada (Efeito Somogyi vs Fenômeno do Alvorecer)
 * 
 * LÓGICA CLÍNICA CORRIGIDA (SBD 2025, FEBRASGO 2019):
 * - Efeito Somogyi: Hipoglicemia noturna (<70 mg/dL) SEGUIDA de hiperglicemia matinal (≥95 mg/dL)
 *   → Detectado por correlação PAR-A-PAR no MESMO DIA
 *   → Conduta: REDUZIR NPH noturna
 * 
 * - Fenômeno do Alvorecer: Madrugada normal/alta com jejum alto
 *   → Conduta: AUMENTAR NPH noturna ou ajustar horário
 */
function analyzeJejumWithMadrugada(readings: GlucoseReading[]): PeriodAdjustmentResult | null {
  const jejumValues = extractPeriodValues(readings, "jejum");
  
  if (jejumValues.length < ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    return null;
  }
  
  // PRIORIDADE 0: Verificar hipoglicemia de jejum PRIMEIRO (segurança)
  const diasJejumBaixo = countDaysBelowLimit(jejumValues, ADJUSTMENT_THRESHOLDS.HIPO_LIMITE);
  if (diasJejumBaixo >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_HIPO) {
    return {
      periodo: PERIOD_LABELS.jejum,
      insulinaAfetada: "NPH_NOTURNA",
      direcao: "REDUZIR",
      justificativa: `Hipoglicemia de jejum (<70 mg/dL) em ${diasJejumBaixo}/${jejumValues.length} dias. Opção: reduzir NPH noturna (ao deitar).`,
      diasComProblema: diasJejumBaixo,
      totalDiasAnalisados: jejumValues.length,
      valoresObservados: jejumValues,
    };
  }
  
  const diasJejumAlto = countDaysAboveLimit(jejumValues, ADJUSTMENT_THRESHOLDS.JEJUM_LIMITE);
  
  if (diasJejumAlto < ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    return null; // Não há padrão de jejum elevado
  }
  
  // Verificar se há dados de madrugada disponíveis
  const madrugadaValues = extractPeriodValues(readings, "madrugada");
  
  if (madrugadaValues.length === 0) {
    // Sem dados de madrugada, mas jejum persistentemente alto
    // Conduta padrão: aumentar NPH noturna (fenômeno do alvorecer é mais comum que Somogyi)
    // NOTA: Apenas sugerir monitorar madrugada se houver sinais de hipoglicemia noturna reportados
    const avgJejum = Math.round(jejumValues.reduce((a, b) => a + b, 0) / jejumValues.length);
    return {
      periodo: PERIOD_LABELS.jejum,
      insulinaAfetada: "NPH_NOTURNA",
      direcao: "AUMENTAR",
      justificativa: `Jejum ≥95 mg/dL em ${diasJejumAlto}/${jejumValues.length} dias (média ${avgJejum} mg/dL). Opção: aumentar NPH noturna (ao deitar). Considerar monitorar madrugada (3h) se suspeita de hipoglicemia noturna.`,
      diasComProblema: diasJejumAlto,
      totalDiasAnalisados: jejumValues.length,
      valoresObservados: jejumValues,
    };
  }
  
  // ANÁLISE PAR-A-PAR: Correlacionar madrugada e jejum do MESMO DIA
  let paresSomogyi = 0;           // Madrugada baixa (<70) + Jejum alto (≥95) = Somogyi
  let paresFenomenoAlvorecer = 0; // Madrugada normal/alta + Jejum alto = Dawn phenomenon
  let diasComAmbos = 0;
  const valoresMadrugadaSomogyi: number[] = [];
  const valoresMadrugadaDawn: number[] = [];
  
  for (const reading of readings) {
    const madrugada = reading.madrugada;
    const jejum = reading.jejum;
    
    // Só analisar dias que têm ambos os valores
    if (typeof madrugada !== "number" || madrugada <= 0 || typeof jejum !== "number" || jejum <= 0) {
      continue;
    }
    
    diasComAmbos++;
    
    // SBD 2025: meta é "< valor", portanto >= limite = acima da meta
    const jejumAlto = jejum >= ADJUSTMENT_THRESHOLDS.JEJUM_LIMITE;
    const madrugadaBaixa = madrugada < ADJUSTMENT_THRESHOLDS.HIPO_NOTURNA_LIMITE; // <70 mg/dL
    const madrugadaAlta = madrugada >= ADJUSTMENT_THRESHOLDS.MADRUGADA_LIMITE;      // >=100 mg/dL
    
    if (jejumAlto && madrugadaBaixa) {
      // EFEITO SOMOGYI: Hipoglicemia noturna causou rebote matinal
      paresSomogyi++;
      valoresMadrugadaSomogyi.push(madrugada);
    } else if (jejumAlto && !madrugadaBaixa) {
      // FENÔMENO DO ALVORECER ou NPH insuficiente
      paresFenomenoAlvorecer++;
      valoresMadrugadaDawn.push(madrugada);
    }
  }
  
  const avgMadrugada = madrugadaValues.reduce((a, b) => a + b, 0) / madrugadaValues.length;
  
  // PRIORIDADE 1: Se há QUALQUER par Somogyi confirmado, NÃO aumentar insulina
  // (aumentar pioraria a hipoglicemia noturna)
  if (paresSomogyi >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_SOMOGYI) {
    const avgSomogyi = valoresMadrugadaSomogyi.reduce((a, b) => a + b, 0) / valoresMadrugadaSomogyi.length;
    return {
      periodo: PERIOD_LABELS.jejum,
      insulinaAfetada: "NPH_NOTURNA",
      direcao: "REDUZIR",
      justificativa: `EFEITO SOMOGYI DETECTADO: Em ${paresSomogyi}/${diasComAmbos} dias com dados completos, houve hipoglicemia noturna (<70 mg/dL, média ${Math.round(avgSomogyi)} mg/dL) seguida de hiperglicemia de rebote no jejum. A conduta é REDUZIR NPH noturna (não aumentar). Referência: SBD 2025 R12.`,
      diasComProblema: paresSomogyi,
      totalDiasAnalisados: diasComAmbos,
      valoresObservados: jejumValues,
      valorReferencia: Math.round(avgSomogyi),
    };
  }
  
  // Se há hipoglicemia noturna isolada (sem correlação com jejum alto), também não aumentar
  const diasMadrugadaBaixa = countDaysBelowLimit(madrugadaValues, ADJUSTMENT_THRESHOLDS.HIPO_NOTURNA_LIMITE);
  if (diasMadrugadaBaixa >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_HIPO) {
    return {
      periodo: PERIOD_LABELS.jejum,
      insulinaAfetada: "NPH_NOTURNA",
      direcao: "REDUZIR",
      justificativa: `Hipoglicemia noturna (<70 mg/dL) em ${diasMadrugadaBaixa}/${madrugadaValues.length} dias. CONTRAINDICADO aumentar NPH. Opção: reduzir NPH noturna ou realocar para mais cedo.`,
      diasComProblema: diasMadrugadaBaixa,
      totalDiasAnalisados: madrugadaValues.length,
      valoresObservados: jejumValues,
      valorReferencia: Math.round(avgMadrugada),
    };
  }
  
  // PRIORIDADE 2: Fenômeno do Alvorecer ou NPH insuficiente (madrugada normal/alta, sem hipoglicemia)
  if (paresFenomenoAlvorecer >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    const diasMadrugadaAlta = countDaysAboveLimit(madrugadaValues, ADJUSTMENT_THRESHOLDS.MADRUGADA_LIMITE);
    
    if (diasMadrugadaAlta >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
      // Madrugada já alta = NPH claramente insuficiente
      return {
        periodo: PERIOD_LABELS.jejum,
        insulinaAfetada: "NPH_NOTURNA",
        direcao: "AUMENTAR",
        justificativa: `Jejum ≥95 mg/dL em ${diasJejumAlto} dias com madrugada elevada (≥100 mg/dL) em ${diasMadrugadaAlta} dias. Madrugada sem hipoglicemia (média ${Math.round(avgMadrugada)} mg/dL). NPH noturna insuficiente. Opção: aumentar NPH ao deitar.`,
        diasComProblema: diasJejumAlto,
        totalDiasAnalisados: jejumValues.length,
        valoresObservados: jejumValues,
        valorReferencia: Math.round(avgMadrugada),
      };
    }
    
    // Madrugada normal mas jejum alto = fenômeno do alvorecer
    return {
      periodo: PERIOD_LABELS.jejum,
      insulinaAfetada: "NPH_NOTURNA",
      direcao: "AUMENTAR",
      justificativa: `Fenômeno do Alvorecer: Jejum ≥95 mg/dL em ${diasJejumAlto} dias com madrugada normal (média ${Math.round(avgMadrugada)} mg/dL, sem hipoglicemia). Opção: aumentar NPH noturna ou ajustar horário de aplicação para mais tarde.`,
      diasComProblema: diasJejumAlto,
      totalDiasAnalisados: jejumValues.length,
      valoresObservados: jejumValues,
      valorReferencia: Math.round(avgMadrugada),
    };
  }
  
  // Fallback: Jejum elevado sem dados suficientes de correlação
  return {
    periodo: PERIOD_LABELS.jejum,
    insulinaAfetada: "NPH_NOTURNA",
    direcao: "AVALIAR",
    justificativa: `Jejum ≥95 mg/dL em ${diasJejumAlto} dias. Dados insuficientes de madrugada para correlação (${diasComAmbos} dias com ambos os valores). Aumentar frequência de monitorização às 3h para definir conduta.`,
    diasComProblema: diasJejumAlto,
    totalDiasAnalisados: jejumValues.length,
    valoresObservados: jejumValues,
    valorReferencia: Math.round(avgMadrugada),
  };
}

/**
 * Analisa pré-prandial elevado (indica problema na NPH anterior)
 */
function analyzePrePrandial(
  readings: GlucoseReading[], 
  prePeriod: "preAlmoco" | "preJantar",
  nphResponsavel: InsulinAdjustmentType
): PeriodAdjustmentResult | null {
  const values = extractPeriodValues(readings, prePeriod);
  
  if (values.length < ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    return null;
  }
  
  const diasAlto = countDaysAboveLimit(values, ADJUSTMENT_THRESHOLDS.PRE_PRANDIAL_LIMITE);
  const diasBaixo = countDaysBelowLimit(values, ADJUSTMENT_THRESHOLDS.HIPO_LIMITE);
  
  // Verificar hipoglicemia primeiro
  if (diasBaixo >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_HIPO) {
    return {
      periodo: PERIOD_LABELS[prePeriod],
      insulinaAfetada: nphResponsavel,
      direcao: "REDUZIR",
      justificativa: `Hipoglicemia (<70 mg/dL) em ${diasBaixo}/${values.length} dias no período ${PERIOD_LABELS[prePeriod]}. Opção: reduzir ${INSULIN_LABELS[nphResponsavel]}.`,
      diasComProblema: diasBaixo,
      totalDiasAnalisados: values.length,
      valoresObservados: values,
    };
  }
  
  if (diasAlto >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return {
      periodo: PERIOD_LABELS[prePeriod],
      insulinaAfetada: nphResponsavel,
      direcao: "AUMENTAR",
      justificativa: `${PERIOD_LABELS[prePeriod]} ≥100 mg/dL em ${diasAlto}/${values.length} dias (média ${avg} mg/dL). Indica ${INSULIN_LABELS[nphResponsavel]} insuficiente. Opção: aumentar dose.`,
      diasComProblema: diasAlto,
      totalDiasAnalisados: values.length,
      valoresObservados: values,
    };
  }
  
  return null;
}

/**
 * Analisa pós-prandial considerando delta com pré-prandial
 * REGRA CRÍTICA: Se delta > 40 repetidamente → problema na rápida
 *                Se delta ≤ 40 mas pós alto → problema na NPH anterior
 */
function analyzePosPrandial(
  readings: GlucoseReading[],
  prePeriod: "jejum" | "preAlmoco" | "preJantar",
  posPeriod: "posCafe1h" | "posAlmoco1h" | "posJantar1h",
  rapidaResponsavel: InsulinAdjustmentType,
  nphAnterior: InsulinAdjustmentType
): PeriodAdjustmentResult | null {
  const preValues = extractPeriodValues(readings, prePeriod);
  const posValues = extractPeriodValues(readings, posPeriod);
  
  if (posValues.length < ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    return null;
  }
  
  // Verificar hipoglicemia pós-prandial primeiro
  const diasHipoPOS = countDaysBelowLimit(posValues, ADJUSTMENT_THRESHOLDS.HIPO_LIMITE);
  if (diasHipoPOS >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_HIPO) {
    return {
      periodo: PERIOD_LABELS[posPeriod],
      insulinaAfetada: rapidaResponsavel,
      direcao: "REDUZIR",
      justificativa: `Hipoglicemia (<70 mg/dL) em ${diasHipoPOS}/${posValues.length} dias no ${PERIOD_LABELS[posPeriod]}. Opção: reduzir ${INSULIN_LABELS[rapidaResponsavel]}.`,
      diasComProblema: diasHipoPOS,
      totalDiasAnalisados: posValues.length,
      valoresObservados: posValues,
    };
  }
  
  // Contar dias com pós elevado
  const diasPosAlto = countDaysAboveLimit(posValues, ADJUSTMENT_THRESHOLDS.POS_PRANDIAL_LIMITE);
  
  if (diasPosAlto < ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    return null; // Pós-prandial OK
  }
  
  // Calcular deltas (pós - pré) para dias que têm ambos valores
  const deltas: { delta: number; pre: number; pos: number }[] = [];
  readings.forEach(r => {
    const pre = r[prePeriod];
    const pos = r[posPeriod];
    if (typeof pre === "number" && typeof pos === "number" && pre > 0 && pos > 0) {
      deltas.push({ delta: pos - pre, pre, pos });
    }
  });
  
  if (deltas.length === 0 && preValues.length === 0) {
    // Sem dados de pré-prandial - não podemos determinar se é rápida ou NPH
    return {
      periodo: PERIOD_LABELS[posPeriod],
      insulinaAfetada: rapidaResponsavel,
      direcao: "SOLICITAR_DADOS",
      justificativa: `${PERIOD_LABELS[posPeriod]} ≥140 mg/dL em ${diasPosAlto} dias, porém sem dados de ${PERIOD_LABELS[prePeriod]} para calcular excursão glicêmica. Necessário monitorizar ${PERIOD_LABELS[prePeriod]} para diferenciar problema na rápida vs NPH.`,
      diasComProblema: diasPosAlto,
      totalDiasAnalisados: posValues.length,
      valoresObservados: posValues,
    };
  }
  
  // Analisar deltas
  // SBD 2025: meta é "< valor", portanto >= limite = acima da meta
  const diasDeltaAlto = deltas.filter(d => d.delta >= ADJUSTMENT_THRESHOLDS.DELTA_POS_PRE_LIMITE).length;
  const diasDeltaNormalMasPosAlto = deltas.filter(d => d.delta < ADJUSTMENT_THRESHOLDS.DELTA_POS_PRE_LIMITE && d.pos >= ADJUSTMENT_THRESHOLDS.POS_PRANDIAL_LIMITE).length;
  const avgDelta = deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b.delta, 0) / deltas.length) : 0;
  const avgPos = Math.round(posValues.reduce((a, b) => a + b, 0) / posValues.length);
  
  if (diasDeltaAlto >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    // Delta > 40 em ≥3 dias → problema na rápida
    return {
      periodo: PERIOD_LABELS[posPeriod],
      insulinaAfetada: rapidaResponsavel,
      direcao: "AUMENTAR",
      justificativa: `Excursão glicêmica ≥40 mg/dL em ${diasDeltaAlto}/${deltas.length} dias (delta médio ${avgDelta} mg/dL). Indica ${INSULIN_LABELS[rapidaResponsavel]} insuficiente. Opção: aumentar dose.`,
      diasComProblema: diasDeltaAlto,
      totalDiasAnalisados: deltas.length,
      valoresObservados: posValues,
      deltaCalculado: avgDelta,
    };
  }
  
  if (diasDeltaNormalMasPosAlto >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    // Delta ≤ 40 mas pós alto → problema na NPH anterior (pré já estava alto)
    const avgPre = deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b.pre, 0) / deltas.length) : 0;
    return {
      periodo: PERIOD_LABELS[posPeriod],
      insulinaAfetada: nphAnterior,
      direcao: "AUMENTAR",
      justificativa: `${PERIOD_LABELS[posPeriod]} elevado (média ${avgPos} mg/dL) com excursão glicêmica adequada (delta médio ${avgDelta} mg/dL ≤40). ${PERIOD_LABELS[prePeriod]} já elevado (média ${avgPre} mg/dL). Problema na ${INSULIN_LABELS[nphAnterior]}, não na rápida. Opção: aumentar NPH.`,
      diasComProblema: diasDeltaNormalMasPosAlto,
      totalDiasAnalisados: deltas.length,
      valoresObservados: posValues,
      deltaCalculado: avgDelta,
      valorReferencia: avgPre,
    };
  }
  
  return null;
}

/**
 * Analisa madrugada elevada isoladamente
 */
function analyzeMadrugada(readings: GlucoseReading[]): PeriodAdjustmentResult | null {
  const values = extractPeriodValues(readings, "madrugada");
  
  if (values.length < ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_PADRAO) {
    return null;
  }
  
  const diasBaixo = countDaysBelowLimit(values, ADJUSTMENT_THRESHOLDS.HIPO_LIMITE);
  
  if (diasBaixo >= ADJUSTMENT_THRESHOLDS.DIAS_MINIMOS_HIPO) {
    return {
      periodo: PERIOD_LABELS.madrugada,
      insulinaAfetada: "NPH_JANTAR",
      direcao: "REDUZIR",
      justificativa: `Hipoglicemia na madrugada (<70 mg/dL) em ${diasBaixo}/${values.length} dias. Opção: reduzir NPH do jantar ou realocar para ao deitar.`,
      diasComProblema: diasBaixo,
      totalDiasAnalisados: values.length,
      valoresObservados: values,
    };
  }
  
  // Madrugada alta é tratada junto com jejum (via analyzeJejumWithMadrugada)
  return null;
}

/**
 * Função principal: Analisa todos os períodos e retorna recomendações de ajuste
 * IMPORTANTE: Recebe APENAS os últimos 7 dias de dados (já filtrados por generateClinicalAnalysis)
 * 
 * @param last7DaysReadings - Leituras dos últimos 7 dias (já filtradas externamente)
 */
export function analyzeInsulinAdjustments(last7DaysReadings: GlucoseReading[]): InsulinAdjustmentAnalysis {
  // Use directly - data is already filtered to last 7 days by caller (generateClinicalAnalysis)
  // No redundant filtering needed
  const readings = last7DaysReadings;
  
  const ajustes: PeriodAdjustmentResult[] = [];
  const periodosSemDados: string[] = [];
  
  // 1. Analisar jejum (considerando madrugada para Efeito Somogyi)
  const jejumResult = analyzeJejumWithMadrugada(readings);
  if (jejumResult) {
    ajustes.push(jejumResult);
  }
  
  // 2. Analisar pré-almoço → NPH manhã
  const preAlmocoResult = analyzePrePrandial(readings, "preAlmoco", "NPH_MANHA");
  if (preAlmocoResult) {
    ajustes.push(preAlmocoResult);
  } else if (extractPeriodValues(readings, "preAlmoco").length === 0) {
    periodosSemDados.push(PERIOD_LABELS.preAlmoco);
  }
  
  // 3. Analisar pré-jantar → NPH almoço
  const preJantarResult = analyzePrePrandial(readings, "preJantar", "NPH_ALMOCO");
  if (preJantarResult) {
    ajustes.push(preJantarResult);
  } else if (extractPeriodValues(readings, "preJantar").length === 0) {
    periodosSemDados.push(PERIOD_LABELS.preJantar);
  }
  
  // 4. Analisar pós-café (delta jejum → pós-café)
  const posCafeResult = analyzePosPrandial(readings, "jejum", "posCafe1h", "RAPIDA_CAFE", "NPH_NOTURNA");
  if (posCafeResult) {
    ajustes.push(posCafeResult);
  }
  
  // 5. Analisar pós-almoço (delta pré-almoço → pós-almoço)
  const posAlmocoResult = analyzePosPrandial(readings, "preAlmoco", "posAlmoco1h", "RAPIDA_ALMOCO", "NPH_MANHA");
  if (posAlmocoResult) {
    ajustes.push(posAlmocoResult);
  }
  
  // 6. Analisar pós-jantar (delta pré-jantar → pós-jantar)
  const posJantarResult = analyzePosPrandial(readings, "preJantar", "posJantar1h", "RAPIDA_JANTAR", "NPH_ALMOCO");
  if (posJantarResult) {
    ajustes.push(posJantarResult);
  }
  
  // 7. Analisar madrugada isoladamente (hipoglicemia noturna)
  const madrugadaResult = analyzeMadrugada(readings);
  if (madrugadaResult) {
    ajustes.push(madrugadaResult);
  } else if (extractPeriodValues(readings, "madrugada").length === 0) {
    periodosSemDados.push(PERIOD_LABELS.madrugada);
  }
  
  // HIERARCHICAL PRIORITY ANALYSIS (Safety First)
  // Priority 0: Critical hypoglycemia (<60 mg/dL) - IMMEDIATE action
  // Priority 1: Any hypoglycemia (<70 mg/dL) - REDUCE insulin first
  // Priority 2: Severe hyperglycemia (>200 mg/dL) - Urgent increase
  // Priority 3: Persistent hyperglycemia with NO hypo - Increase insulin
  // Priority 4: Stable - Maintain regimen
  
  // Detect conflicting patterns (hypo + hyper at same period)
  const conflictingPeriods: string[] = [];
  const periodStats: Record<string, { hypoCount: number; hyperCount: number; values: number[] }> = {};
  
  const periodKeys = ["jejum", "posCafe1h", "preAlmoco", "posAlmoco1h", "preJantar", "posJantar1h", "madrugada"] as const;
  const periodTargets: Record<string, { min: number; max: number }> = {
    jejum: { min: 70, max: 95 },
    posCafe1h: { min: 70, max: 140 },
    preAlmoco: { min: 70, max: 100 },
    posAlmoco1h: { min: 70, max: 140 },
    preJantar: { min: 70, max: 100 },
    posJantar1h: { min: 70, max: 140 },
    madrugada: { min: 70, max: 100 },
  };
  
  for (const period of periodKeys) {
    const values = extractPeriodValues(readings, period);
    if (values.length === 0) continue;
    
    const target = periodTargets[period];
    const hypoCount = values.filter(v => v < target.min).length;
    // SBD 2025: meta é "< valor" não "<= valor", então >= target.max = acima da meta
    const hyperCount = values.filter(v => v >= target.max).length;
    
    periodStats[period] = { hypoCount, hyperCount, values };
    
    // Detect conflict: both hypo AND hyper at same period
    if (hypoCount >= 2 && hyperCount >= 2) {
      conflictingPeriods.push(PERIOD_LABELS[period]);
    }
  }
  
  // Determinar prioridade máxima com hierarquia clara
  let prioridadeMaxima: AdjustmentDirection = "MANTER";
  
  // SAFETY FIRST: Any hypoglycemia takes precedence
  if (ajustes.some(a => a.direcao === "REDUZIR")) {
    prioridadeMaxima = "REDUZIR"; // Segurança primeiro - hipoglicemia
  } else if (ajustes.some(a => a.direcao === "SOLICITAR_DADOS")) {
    prioridadeMaxima = "SOLICITAR_DADOS";
  } else if (ajustes.some(a => a.direcao === "AUMENTAR")) {
    prioridadeMaxima = "AUMENTAR";
  }
  
  // Filter adjustments by type (for conflict resolution and summary)
  const aumentar = ajustes.filter(a => a.direcao === "AUMENTAR");
  const reduzir = ajustes.filter(a => a.direcao === "REDUZIR");
  const solicitar = ajustes.filter(a => a.direcao === "SOLICITAR_DADOS");
  
  // Gerar resumo DETALHADO com justificativas específicas
  let resumoGeral = "";
  if (ajustes.length === 0) {
    resumoGeral = "Perfil glicêmico sem padrões que indiquem necessidade de ajuste de doses no momento. Manter esquema atual e continuar monitorização.";
  } else {
    const partes: string[] = [];
    
    // Handle conflicting patterns explicitly
    if (conflictingPeriods.length > 0) {
      partes.push(`PADRÃO CONFLITANTE em ${conflictingPeriods.join(", ")}: hipoglicemia E hiperglicemia alternadas. SEGURANÇA PRIMEIRO - reduzir dose; investigar variabilidade alimentar`);
    }
    
    // REDUÇÃO - incluir justificativas detalhadas
    if (reduzir.length > 0) {
      const detalhesReducao = reduzir.map(a => {
        const avgValue = a.valoresObservados.length > 0 
          ? Math.round(a.valoresObservados.reduce((s,v) => s+v, 0) / a.valoresObservados.length)
          : null;
        const valores = avgValue ? ` (média ${avgValue} mg/dL)` : "";
        return `${INSULIN_LABELS[a.insulinaAfetada]}: reduzir 10-20%${valores} - ${a.diasComProblema}/${a.totalDiasAnalisados} dias com hipoglicemia em ${a.periodo}`;
      });
      partes.push(`REDUZIR (PRIORIDADE): ${detalhesReducao.join("; ")}`);
    }
    
    // AUMENTO - incluir justificativas detalhadas (só se não há hipoglicemia)
    if (aumentar.length > 0 && reduzir.length === 0) {
      const detalhesAumento = aumentar.map(a => {
        const avgValue = a.valoresObservados.length > 0 
          ? Math.round(a.valoresObservados.reduce((s,v) => s+v, 0) / a.valoresObservados.length)
          : null;
        const valores = avgValue ? ` (média ${avgValue} mg/dL)` : "";
        return `${INSULIN_LABELS[a.insulinaAfetada]}: aumentar 10-20%${valores} - ${a.diasComProblema}/${a.totalDiasAnalisados} dias acima da meta em ${a.periodo}`;
      });
      partes.push(`AUMENTAR: ${detalhesAumento.join("; ")}`);
    } else if (aumentar.length > 0 && reduzir.length > 0) {
      partes.push(`Hiperglicemia em ${aumentar.map(a => a.periodo).join(", ")} - NÃO aumentar enquanto houver hipoglicemia`);
    }
    
    if (solicitar.length > 0) {
      partes.push(`DADOS INSUFICIENTES: necessário monitorar ${solicitar.map(a => a.periodo).join(", ")}`);
    }
    
    resumoGeral = partes.join(". ") + ".";
  }
  
  // HARMONIZE CONFLICT RESOLUTION: If hypoglycemia is present, suppress increase recommendations
  // to prevent contradictory guidance to downstream consumers
  let filteredAjustes = ajustes;
  if (reduzir.length > 0 && aumentar.length > 0) {
    // Mark increases as "MANTER" with explicit suspension flags
    filteredAjustes = ajustes.map(a => {
      if (a.direcao === "AUMENTAR") {
        return {
          ...a,
          direcao: "MANTER" as AdjustmentDirection,
          originalDirecao: "AUMENTAR" as AdjustmentDirection, // Structured field for original direction
          suspended: true, // Explicit flag for downstream consumers
          justificativa: `[SUSPENSO - HIPOGLICEMIA DETECTADA] ${a.justificativa}. Não aumentar dose enquanto houver hipoglicemia em outro período.`
        };
      }
      return a;
    });
  }
  
  return {
    ajustesRecomendados: filteredAjustes,
    resumoGeral,
    prioridadeMaxima,
    temDadosInsuficientes: periodosSemDados.length > 0 || ajustes.some(a => a.direcao === "SOLICITAR_DADOS"),
    periodosSemDados,
    // chronologyWarning and dateRange are now provided by the caller (generateClinicalAnalysis)
    // since data is pre-filtered before being passed to this function
  };
}

// =============================================================================
// SBD 2025 - TODAS AS 17 RECOMENDAÇÕES
// =============================================================================
export const SBD_2025_RULES: Record<string, ClinicalRule> = {
  R1: {
    id: "SBD-R1",
    title: "Início de Terapia Farmacológica no DMG",
    classification: "Classe IIb, Nível C",
    description: "PODE SER CONSIDERADO o início da terapia farmacológica na mulher com DMG quando duas ou mais medidas de glicemia, avaliadas após 7 a 14 dias de terapia não farmacológica, estiverem acima da meta. Alternativa: 30% a 50% das medidas alteradas em uma semana.",
    source: "SBD 2025",
    category: "DMG"
  },
  R2: {
    id: "SBD-R2",
    title: "Insulina como Primeira Escolha no DMG",
    classification: "Classe I, Nível A",
    description: "É RECOMENDADA a insulina como terapia farmacológica de primeira escolha para controle glicêmico na mulher com DMG.",
    source: "SBD 2025",
    category: "DMG"
  },
  R3: {
    id: "SBD-R3",
    title: "Critério de Crescimento Fetal para Insulina",
    classification: "Classe IIb, Nível B",
    description: "O critério de crescimento fetal para início da insulinoterapia, independentemente dos valores da glicose, PODE SER CONSIDERADO quando a medida da circunferência abdominal fetal for ≥ percentil 75 em USG realizada entre a 29ª e a 33ª semana de gestação.",
    source: "SBD 2025",
    category: "DMG"
  },
  R4: {
    id: "SBD-R4",
    title: "Dose Inicial de Insulina no DMG",
    classification: "Classe IIb, Nível C",
    description: "A terapia com insulina para gestantes com DMG PODE SER CONSIDERADA na dose total inicial de 0,5 UI/kg/dia, com ajustes individualizados baseados no monitoramento diário da glicose a cada 1-2 semanas.",
    source: "SBD 2025",
    category: "DMG"
  },
  R5: {
    id: "SBD-R5",
    title: "Tipos de Insulina Aprovados",
    classification: "Classe IIa, Nível C",
    description: "DEVE SER CONSIDERADO o uso de insulinas humanas NPH/Regular, e de análogos de insulina aprovados para uso na gestação. Categoria A (ANVISA): Asparte, Fast-Asparte, Detemir, Degludeca. Categoria B: Regular, NPH, Lispro. Categoria C: Glargina, Glulisina (usar com cautela).",
    source: "SBD 2025",
    category: "ALL"
  },
  R6: {
    id: "SBD-R6",
    title: "Análogos de Ação Rápida para Pós-prandial",
    classification: "Classe IIa, Nível B",
    description: "DEVE SER CONSIDERADA a indicação de análogos de insulina de ação rápida ou ultrarrápida, aprovados para uso na gestação, em casos de DMG que apresentem difícil controle das excursões glicêmicas pós-prandiais.",
    source: "SBD 2025",
    category: "DMG"
  },
  R7: {
    id: "SBD-R7",
    title: "Metformina como Alternativa no DMG",
    classification: "Classe I, Nível B",
    description: "É RECOMENDADO o uso da metformina em mulheres com DMG sem controle glicêmico adequado com medidas não farmacológicas, como alternativa terapêutica, na inviabilidade do uso de insulina. Contraindicada em fetos abaixo do percentil 50 ou CIUR.",
    source: "SBD 2025",
    category: "DMG"
  },
  R8: {
    id: "SBD-R8",
    title: "Associação Metformina + Insulina no DMG",
    classification: "Classe IIa, Nível B",
    description: "DEVE SER CONSIDERADA a associação de metformina com insulina em gestantes com DMG que necessitem altas doses de insulina (>2 UI/kg/dia) sem controle glicêmico adequado ou com ganho excessivo de peso materno ou fetal.",
    source: "SBD 2025",
    category: "DMG"
  },
  R9: {
    id: "SBD-R9",
    title: "Glibenclamida CONTRAINDICADA",
    classification: "Classe III, Nível A",
    description: "O uso de glibenclamida NÃO É RECOMENDADO para gestante com DMG, devido ao aumento de risco de macrossomia e hipoglicemia neonatal. CONTRAINDICAÇÃO ABSOLUTA.",
    source: "SBD 2025",
    category: "DMG"
  },
  R10: {
    id: "SBD-R10",
    title: "DM2: Suspender Antidiabéticos Orais",
    classification: "Classe I, Nível C",
    description: "É RECOMENDADO que gestantes com DM2 interrompam o tratamento não insulínico antes ou logo após o início da gestação, quando estiver garantida a imediata substituição pela insulinoterapia.",
    source: "SBD 2025",
    category: "DM2"
  },
  R11: {
    id: "SBD-R11",
    title: "Esquemas Intensivos em DM1/DM2",
    classification: "Classe I, Nível B",
    description: "É RECOMENDADO o uso de esquemas intensivos de insulinização com múltiplas doses de insulina (MDI) ou com infusão contínua (SICI) para controle glicêmico adequado em gestantes com DM1 e DM2.",
    source: "SBD 2025",
    category: "ALL"
  },
  R12: {
    id: "SBD-R12",
    title: "DM1: Redução de Insulina Pós-parto",
    classification: "Classe I, Nível C",
    description: "Nas primeiras horas após o parto, em mulheres com DM1, É RECOMENDADO reduzir em 50% a dose de insulina utilizada antes da gestação ou no primeiro trimestre, ou em 70% da dose utilizada no final da gravidez. Ajustes adicionais são necessários ao longo do puerpério.",
    source: "SBD 2025",
    category: "DM1"
  },
  R13: {
    id: "SBD-R13",
    title: "Ajuste de Insulina com Corticóide",
    classification: "Classe I, Nível C",
    description: "É RECOMENDADO o aumento da dose da insulina e a intensificação do monitoramento da glicose por até 72 horas após a última dose do corticóide para a gestante que tenha indicação de uso de corticosteróide para promover amadurecimento pulmonar fetal.",
    source: "SBD 2025",
    category: "ALL"
  },
  R14: {
    id: "SBD-R14",
    title: "DM1: Análogos Rápidos para Pós-prandial",
    classification: "Classe I, Nível B",
    description: "O uso dos análogos de insulina rápida (Lispro, Asparte) ou ultrarrápida (Fast-Asparte) pela gestante com DM1 É RECOMENDADO para controle da glicemia pós-prandial, por estarem associados a menor risco de hipoglicemia.",
    source: "SBD 2025",
    category: "DM1"
  },
  R15: {
    id: "SBD-R15",
    title: "Manter Análogos de Ação Prolongada",
    classification: "Classe IIa, Nível A",
    description: "DEVE SER CONSIDERADO manter os análogos de insulina de ação prolongada em mulheres com DM1 e DM2 que estavam em uso destes fármacos antes da gestação. Detemir e Degludeca são Categoria A. Glargina é Categoria C (usar com cautela).",
    source: "SBD 2025",
    category: "ALL"
  },
  R16: {
    id: "SBD-R16",
    title: "DM2: Metformina + Insulina",
    classification: "Classe IIa, Nível B",
    description: "DEVE SER CONSIDERADO o uso de metformina associado à insulina em gestantes com DM2, principalmente nas que apresentem ganho de peso gestacional excessivo ou fetos grandes para a idade gestacional.",
    source: "SBD 2025",
    category: "DM2"
  },
  R17: {
    id: "SBD-R17",
    title: "AAS para Prevenção de Pré-eclâmpsia",
    classification: "Classe I, Nível A",
    description: "É RECOMENDADO indicar o ácido acetilsalicílico (AAS) em doses de 75 a 100 mg/dia para gestantes com DM1 ou DM2 pré-gestacional. O uso deve ser iniciado entre 12 e 28 semanas de gestação, preferencialmente antes da 16ª semana, e mantido até o parto.",
    source: "SBD 2025",
    category: "ALL"
  }
};

// =============================================================================
// FEBRASGO 2019 - RASTREAMENTO E DIAGNÓSTICO (Femina 47(11):786-96)
// =============================================================================
export const FEBRASGO_2019_RULES: Record<string, ClinicalRule> = {
  F1: {
    id: "FEBRASGO-F1",
    title: "Rastreamento Universal de DMG",
    classification: "Recomendação A",
    description: "É RECOMENDADO o rastreamento universal de DMG em todas as gestantes. A glicemia de jejum deve ser solicitada na primeira consulta de pré-natal, preferencialmente antes de 20 semanas.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F2: {
    id: "FEBRASGO-F2",
    title: "Diagnóstico de Diabetes Prévio",
    classification: "Recomendação A",
    description: "Glicemia de jejum ≥126 mg/dL ou HbA1c ≥6,5% na primeira consulta indica diabetes prévio (DM1 ou DM2), não DMG. Confirmar com segunda dosagem se assintomática.",
    source: "FEBRASGO 2019",
    category: "ALL"
  },
  F3: {
    id: "FEBRASGO-F3",
    title: "Critério Diagnóstico de DMG - Jejum",
    classification: "Recomendação A",
    description: "Glicemia de jejum entre 92-125 mg/dL na primeira consulta de pré-natal é diagnóstica de DMG. Não é necessário TOTG para confirmar.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F4: {
    id: "FEBRASGO-F4",
    title: "TOTG 75g entre 24-28 semanas",
    classification: "Recomendação A",
    description: "Gestantes com glicemia de jejum <92 mg/dL devem realizar TOTG 75g entre 24-28 semanas. Critérios diagnósticos de DMG: jejum ≥92, 1h ≥180, 2h ≥153 mg/dL. Um valor alterado é suficiente para diagnóstico.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F5: {
    id: "FEBRASGO-F5",
    title: "Metas Glicêmicas no DMG",
    classification: "Recomendação B",
    description: "Metas glicêmicas no DMG: Jejum 65-95 mg/dL, 1h pós-prandial <140 mg/dL, 2h pós-prandial <120 mg/dL. Monitorização com glicemia capilar 4-7 vezes/dia.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F6: {
    id: "FEBRASGO-F6",
    title: "Terapia Nutricional Inicial",
    classification: "Recomendação A",
    description: "A terapia nutricional é a primeira linha de tratamento no DMG. Deve ser individualizada, com 30-35 kcal/kg de peso ideal, distribuição de carboidratos em 40-45% do VCT, priorizando baixo índice glicêmico.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F7: {
    id: "FEBRASGO-F7",
    title: "Atividade Física na Gestação",
    classification: "Recomendação B",
    description: "É RECOMENDADA atividade física regular (30 min/dia, 5 dias/semana) para gestantes com DMG sem contraindicações obstétricas. Caminhada e exercícios de baixo impacto são preferíveis.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F8: {
    id: "FEBRASGO-F8",
    title: "Vigilância Fetal no DMG",
    classification: "Recomendação B",
    description: "A vigilância fetal deve incluir: USG mensal para crescimento fetal, perfil biofísico fetal a partir de 32 semanas se DMG com insulina, e cardiotocografia semanal a partir de 36 semanas.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F9: {
    id: "FEBRASGO-F9",
    title: "Momento do Parto no DMG",
    classification: "Recomendação B",
    description: "DMG bem controlado sem complicações: aguardar parto espontâneo até 40 semanas. DMG com insulina ou mal controlado: indução entre 38-39 semanas. Macrossomia >4500g: discutir cesariana.",
    source: "FEBRASGO 2019",
    category: "DMG"
  },
  F10: {
    id: "FEBRASGO-F10",
    title: "Reclassificação Pós-parto",
    classification: "Recomendação A",
    description: "Todas as mulheres com DMG devem realizar TOTG 75g entre 6-12 semanas após o parto para reclassificação. Realizar rastreamento anual de DM2 posteriormente.",
    source: "FEBRASGO 2019",
    category: "DMG"
  }
};

// =============================================================================
// OMS/WHO 2025 - CUIDADOS COM DIABETES NA GESTAÇÃO (ISBN 9789240117044)
// =============================================================================
export const WHO_2025_RULES: Record<string, ClinicalRule> = {
  W1: {
    id: "WHO-W1",
    title: "Rastreamento de Hiperglicemia",
    classification: "Forte recomendação",
    description: "É RECOMENDADO rastrear hiperglicemia em todas as gestantes. Em contextos de alta prevalência, rastrear na primeira consulta pré-natal e repetir entre 24-28 semanas se normal.",
    source: "OMS 2025",
    category: "ALL"
  },
  W2: {
    id: "WHO-W2",
    title: "Critérios Diagnósticos WHO",
    classification: "Forte recomendação",
    description: "Critérios diagnósticos de DMG (TOTG 75g): Jejum ≥92 mg/dL, 1h ≥180 mg/dL, 2h ≥153 mg/dL. Diabetes na gestação: Jejum ≥126 mg/dL ou 2h ≥200 mg/dL.",
    source: "OMS 2025",
    category: "ALL"
  },
  W3: {
    id: "WHO-W3",
    title: "Manejo Nutricional",
    classification: "Forte recomendação",
    description: "Aconselhamento nutricional individualizado É RECOMENDADO para todas as gestantes com hiperglicemia. Dieta deve ser culturalmente apropriada e focar em carboidratos de baixo índice glicêmico.",
    source: "OMS 2025",
    category: "ALL"
  },
  W4: {
    id: "WHO-W4",
    title: "Atividade Física",
    classification: "Recomendação condicional",
    description: "Atividade física regular DEVE SER CONSIDERADA para gestantes com hiperglicemia sem contraindicações. Exercícios de intensidade moderada por pelo menos 150 min/semana.",
    source: "OMS 2025",
    category: "ALL"
  },
  W5: {
    id: "WHO-W5",
    title: "Automonitorização Glicêmica",
    classification: "Forte recomendação",
    description: "É RECOMENDADO automonitorização da glicemia capilar para gestantes com diabetes em uso de insulina. Frequência mínima: jejum e 1-2h pós-prandial nas principais refeições.",
    source: "OMS 2025",
    category: "ALL"
  },
  W6: {
    id: "WHO-W6",
    title: "Insulina como Tratamento Preferencial",
    classification: "Forte recomendação",
    description: "É RECOMENDADA a insulina como tratamento farmacológico de primeira linha para hiperglicemia na gestação quando metas glicêmicas não são atingidas com medidas não farmacológicas.",
    source: "OMS 2025",
    category: "ALL"
  },
  W7: {
    id: "WHO-W7",
    title: "Metformina como Alternativa",
    classification: "Recomendação condicional",
    description: "Metformina PODE SER CONSIDERADA como alternativa à insulina no DMG quando insulina não estiver disponível, for recusada pela paciente, ou houver dificuldade de acesso/administração.",
    source: "OMS 2025",
    category: "DMG"
  },
  W8: {
    id: "WHO-W8",
    title: "Vigilância Fetal",
    classification: "Recomendação condicional",
    description: "Vigilância fetal intensificada DEVE SER CONSIDERADA para gestantes com diabetes mal controlado ou complicações. Inclui USG para crescimento fetal e avaliação de bem-estar fetal.",
    source: "OMS 2025",
    category: "ALL"
  },
  W9: {
    id: "WHO-W9",
    title: "Momento do Parto",
    classification: "Recomendação condicional",
    description: "Indução do parto entre 38-40 semanas DEVE SER CONSIDERADA para gestantes com diabetes em uso de insulina. Cesariana eletiva não é indicada apenas por diabetes.",
    source: "OMS 2025",
    category: "ALL"
  },
  W10: {
    id: "WHO-W10",
    title: "Cuidados Pós-parto",
    classification: "Forte recomendação",
    description: "É RECOMENDADO rastreamento pós-parto (TOTG 75g em 6-12 semanas) para mulheres que tiveram DMG. Aconselhamento sobre risco futuro de DM2 e medidas preventivas.",
    source: "OMS 2025",
    category: "DMG"
  },
  W11: {
    id: "WHO-W11",
    title: "Amamentação",
    classification: "Forte recomendação",
    description: "É RECOMENDADO amamentação exclusiva para bebês de mães com diabetes. Pode ajudar no controle glicêmico materno e reduzir risco de obesidade infantil.",
    source: "OMS 2025",
    category: "ALL"
  },
  W12: {
    id: "WHO-W12",
    title: "Cuidados Neonatais",
    classification: "Forte recomendação",
    description: "Recém-nascidos de mães com diabetes devem ser monitorados para hipoglicemia neonatal nas primeiras 24-48h de vida. Alimentação precoce é recomendada.",
    source: "OMS 2025",
    category: "ALL"
  }
};

// Combine all rules for easy access
export const CLINICAL_RULES: Record<string, ClinicalRule> = {
  ...SBD_2025_RULES,
  ...FEBRASGO_2019_RULES,
  ...WHO_2025_RULES
};

export interface SevenDayAnalysis {
  totalReadings: number;
  percentInTarget: number;
  percentAboveTarget: number;
  averageGlucose: number;
  analysisByPeriod: GlucoseAnalysisByPeriod[];
  criticalAlerts: CriticalAlert[];
  trend: "improving" | "worsening" | "stable";
  trendDescription: string;
  dailyAverages: { day: number; average: number; inTarget: number; total: number }[];
  periodComparison: { period: string; overall: number; last7Days: number; change: "better" | "worse" | "same" }[];
}

export interface ClinicalAnalysis {
  patientName: string;
  gestationalAge: string;
  weight: number | null;
  diabetesType: "DMG" | "DM1" | "DM2";
  totalReadings: number;
  totalDaysAnalyzed: number;
  percentInTarget: number;
  percentAboveTarget: number;
  averageGlucose: number;
  usesInsulin: boolean;
  currentInsulinRegimens: InsulinRegimen[];
  
  analysisByPeriod: GlucoseAnalysisByPeriod[];
  criticalAlerts: CriticalAlert[];
  
  // NEW: 7-day specific analysis
  sevenDayAnalysis: SevenDayAnalysis | null;
  
  insulinCalculation: InsulinDoseCalculation | null;
  
  rulesTriggered: ClinicalRule[];
  urgencyLevel: "info" | "warning" | "critical";
  
  technicalSummary: string;
  recommendedActions: string[];
  insulinRecommendation: string;
  guidelineSources: string[];
  
  // Structured insulin adjustment analysis
  insulinAdjustments: InsulinAdjustmentAnalysis | null;
  
  // Data quality indicators (always populated)
  chronologyWarning?: string;
  dateRange?: { start: string; end: string };
}

function analyzeByPeriod(readings: GlucoseReading[]): GlucoseAnalysisByPeriod[] {
  const periods: { key: keyof GlucoseReading; name: string; targetType: "jejum" | "prePrandial" | "madrugada" | "posPrandial1h" }[] = [
    { key: "jejum", name: "Jejum", targetType: "jejum" },
    { key: "posCafe1h", name: "1h pós-café da manhã", targetType: "posPrandial1h" },
    { key: "preAlmoco", name: "Pré-almoço", targetType: "prePrandial" },
    { key: "posAlmoco1h", name: "1h pós-almoço", targetType: "posPrandial1h" },
    { key: "preJantar", name: "Pré-jantar", targetType: "prePrandial" },
    { key: "posJantar1h", name: "1h pós-jantar", targetType: "posPrandial1h" },
    { key: "madrugada", name: "Madrugada (3h)", targetType: "madrugada" },
  ];
  
  const results: GlucoseAnalysisByPeriod[] = [];
  
  for (const period of periods) {
    const values: number[] = [];
    readings.forEach(r => {
      const val = r[period.key];
      if (typeof val === "number" && val > 0) {
        values.push(val);
      }
    });
    
    if (values.length === 0) continue;
    
    const targetMax = glucoseTargets[period.targetType].max;
    // SBD 2025: meta é "< valor" não "<= valor" (ex: jejum < 95, não <= 95)
    const aboveTarget = values.filter(v => v >= targetMax).length;
    const belowTarget = values.filter(v => v < criticalGlucoseThresholds.hypo).length;
    const inTarget = values.filter(v => v < targetMax && v >= criticalGlucoseThresholds.hypo).length;
    
    results.push({
      period: period.name,
      total: values.length,
      aboveTarget,
      belowTarget,
      inTarget,
      percentAbove: Math.round((aboveTarget / values.length) * 100),
      average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      maxValue: Math.max(...values),
      minValue: Math.min(...values),
      targetMax,
      values,
    });
  }
  
  return results;
}

function generateSevenDayAnalysis(
  allReadings: GlucoseReading[],
  overallAnalysisByPeriod: GlucoseAnalysisByPeriod[]
): SevenDayAnalysis | null {
  // Use chronology utility to get consecutive recent days
  const chronologyResult = analyzeChronology(allReadings, 7, 2);
  
  if (chronologyResult.readings.length < 7 && allReadings.length < 7) {
    return null;
  }
  
  const last7Days = chronologyResult.readings;
  const last7DaysByPeriod = analyzeByPeriod(last7Days);
  const last7DaysAlerts = checkCriticalGlucose(last7Days);
  
  let totalReadings = 0;
  let totalInTarget = 0;
  let totalAbove = 0;
  let sumGlucose = 0;
  
  last7DaysByPeriod.forEach(p => {
    totalReadings += p.total;
    totalInTarget += p.inTarget;
    totalAbove += p.aboveTarget;
    sumGlucose += p.average * p.total;
  });
  
  const percentInTarget = totalReadings > 0 ? Math.round((totalInTarget / totalReadings) * 100) : 0;
  const percentAboveTarget = totalReadings > 0 ? Math.round((totalAbove / totalReadings) * 100) : 0;
  const averageGlucose = totalReadings > 0 ? Math.round(sumGlucose / totalReadings) : 0;
  
  const dailyAverages: { day: number; average: number; inTarget: number; total: number }[] = [];
  last7Days.forEach((reading, idx) => {
    const dayNum = idx + 1;
    const periods: (keyof GlucoseReading)[] = ["jejum", "posCafe1h", "preAlmoco", "posAlmoco1h", "preJantar", "posJantar1h", "madrugada"];
    const dayValues: number[] = [];
    let dayInTarget = 0;
    
    periods.forEach(p => {
      const val = reading[p];
      if (typeof val === "number" && val > 0) {
        dayValues.push(val);
        const pStr = String(p);
        const targetMax = p === "jejum" ? glucoseTargets.jejum.max : 
                         (pStr.includes("pos") ? glucoseTargets.posPrandial1h.max : glucoseTargets.prePrandial.max);
        // SBD 2025: meta é "< valor" não "<= valor"
        if (val < targetMax && val >= criticalGlucoseThresholds.hypo) {
          dayInTarget++;
        }
      }
    });
    
    if (dayValues.length > 0) {
      dailyAverages.push({
        day: dayNum,
        average: Math.round(dayValues.reduce((a, b) => a + b, 0) / dayValues.length),
        inTarget: dayInTarget,
        total: dayValues.length,
      });
    }
  });
  
  const periodComparison: { period: string; overall: number; last7Days: number; change: "better" | "worse" | "same" }[] = [];
  last7DaysByPeriod.forEach(recent => {
    const overall = overallAnalysisByPeriod.find(o => o.period === recent.period);
    if (overall) {
      const diff = recent.average - overall.average;
      let change: "better" | "worse" | "same" = "same";
      if (diff < -5) change = "better";
      else if (diff > 5) change = "worse";
      periodComparison.push({
        period: recent.period,
        overall: overall.average,
        last7Days: recent.average,
        change,
      });
    }
  });
  
  let trend: "improving" | "worsening" | "stable" = "stable";
  let trendDescription = "";
  
  if (dailyAverages.length >= 3) {
    const firstHalf = dailyAverages.slice(0, Math.floor(dailyAverages.length / 2));
    const secondHalf = dailyAverages.slice(Math.floor(dailyAverages.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.average, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.average, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    
    if (diff < -8) {
      trend = "improving";
      trendDescription = `Tendência de melhora: média glicêmica reduzindo progressivamente ao longo dos últimos dias (de ${Math.round(firstAvg)} para ${Math.round(secondAvg)} mg/dL).`;
    } else if (diff > 8) {
      trend = "worsening";
      trendDescription = `Tendência de piora: média glicêmica aumentando progressivamente ao longo dos últimos dias (de ${Math.round(firstAvg)} para ${Math.round(secondAvg)} mg/dL). Requer atenção.`;
    } else {
      trend = "stable";
      trendDescription = `Padrão estável: média glicêmica mantendo-se relativamente constante nos últimos 7 dias (variação de ${Math.abs(Math.round(diff))} mg/dL).`;
    }
  } else {
    trendDescription = "Dados insuficientes para análise de tendência detalhada.";
  }
  
  const worsePeriods = periodComparison.filter(p => p.change === "worse");
  const betterPeriods = periodComparison.filter(p => p.change === "better");
  
  if (worsePeriods.length > betterPeriods.length) {
    trendDescription += ` Períodos com piora recente: ${worsePeriods.map(p => p.period).join(", ")}.`;
  } else if (betterPeriods.length > worsePeriods.length) {
    trendDescription += ` Períodos com melhora recente: ${betterPeriods.map(p => p.period).join(", ")}.`;
  }
  
  return {
    totalReadings,
    percentInTarget,
    percentAboveTarget,
    averageGlucose,
    analysisByPeriod: last7DaysByPeriod,
    criticalAlerts: last7DaysAlerts,
    trend,
    trendDescription,
    dailyAverages,
    periodComparison,
  };
}

function calculateInsulinDose(weight: number | null, readings: GlucoseReading[], currentRegimens: InsulinRegimen[]): InsulinDoseCalculation | null {
  // Se peso não disponível, não podemos calcular dose de insulina
  if (weight === null || weight <= 0) {
    return null;
  }
  // SBD-R4: 0.5 UI/kg/dia
  const initialTotalDose = Math.round(weight * 0.5);
  const basalDose = Math.round(initialTotalDose * 0.5);
  const bolusDose = initialTotalDose - basalDose;
  
  const distribution = {
    nphManha: Math.round(basalDose * 0.67),
    nphNoite: Math.round(basalDose * 0.33),
    rapidaManha: Math.round(bolusDose * 0.33),
    rapidaAlmoco: Math.round(bolusDose * 0.33),
    rapidaJantar: Math.round(bolusDose * 0.34),
  };
  
  const analysis = analyzeByPeriod(readings);
  const specificAdjustments: string[] = [];
  let adjustmentNeeded = false;
  let adjustmentType: "increase" | "decrease" | "none" = "none";
  let adjustmentPercent = 0;
  
  const jejumAnalysis = analysis.find(a => a.period === "Jejum");
  if (jejumAnalysis && jejumAnalysis.percentAbove >= 50) {
    specificAdjustments.push(
      `Glicemia de jejum elevada (${jejumAnalysis.percentAbove}% acima da meta, média ${jejumAnalysis.average} mg/dL): ` +
      `Aumentar NPH noturna em 10-20% (atual sugerido: ${distribution.nphNoite} UI → ${Math.round(distribution.nphNoite * 1.15)} UI)`
    );
    adjustmentNeeded = true;
    adjustmentType = "increase";
    adjustmentPercent = 15;
  }
  
  const posCafeAnalysis = analysis.find(a => a.period === "1h pós-café da manhã");
  if (posCafeAnalysis && posCafeAnalysis.percentAbove >= 50) {
    specificAdjustments.push(
      `Glicemia pós-café elevada (${posCafeAnalysis.percentAbove}% acima da meta, média ${posCafeAnalysis.average} mg/dL): ` +
      `Aumentar insulina rápida do café em 10-20% (sugerido: ${distribution.rapidaManha} UI → ${Math.round(distribution.rapidaManha * 1.15)} UI)`
    );
    adjustmentNeeded = true;
    adjustmentType = "increase";
    adjustmentPercent = Math.max(adjustmentPercent, 15);
  }
  
  const posAlmocoAnalysis = analysis.find(a => a.period === "1h pós-almoço");
  if (posAlmocoAnalysis && posAlmocoAnalysis.percentAbove >= 50) {
    specificAdjustments.push(
      `Glicemia pós-almoço elevada (${posAlmocoAnalysis.percentAbove}% acima da meta, média ${posAlmocoAnalysis.average} mg/dL): ` +
      `Aumentar insulina rápida do almoço em 10-20% (sugerido: ${distribution.rapidaAlmoco} UI → ${Math.round(distribution.rapidaAlmoco * 1.15)} UI)`
    );
    adjustmentNeeded = true;
    adjustmentType = "increase";
    adjustmentPercent = Math.max(adjustmentPercent, 15);
  }
  
  const posJantarAnalysis = analysis.find(a => a.period === "1h pós-jantar");
  if (posJantarAnalysis && posJantarAnalysis.percentAbove >= 50) {
    specificAdjustments.push(
      `Glicemia pós-jantar elevada (${posJantarAnalysis.percentAbove}% acima da meta, média ${posJantarAnalysis.average} mg/dL): ` +
      `Aumentar insulina rápida do jantar em 10-20% (sugerido: ${distribution.rapidaJantar} UI → ${Math.round(distribution.rapidaJantar * 1.15)} UI)`
    );
    adjustmentNeeded = true;
    adjustmentType = "increase";
    adjustmentPercent = Math.max(adjustmentPercent, 15);
  }
  
  const hasHypo = analysis.some(a => a.belowTarget > 0);
  if (hasHypo) {
    const hypoperiods = analysis.filter(a => a.belowTarget > 0).map(a => a.period);
    specificAdjustments.push(
      `ATENÇÃO: Hipoglicemia detectada em ${hypoperiods.join(", ")}. ` +
      `Reduzir dose relacionada em 10-20% e investigar causa.`
    );
    adjustmentNeeded = true;
    adjustmentType = "decrease";
    adjustmentPercent = 15;
  }
  
  return {
    initialTotalDose,
    basalDose,
    bolusDose,
    distribution,
    adjustmentNeeded,
    adjustmentType,
    adjustmentPercent,
    specificAdjustments,
  };
}

function determineTriggeredRules(
  percentAbove: number,
  usesInsulin: boolean,
  gestationalWeeks: number,
  hasCAFPercentile75: boolean,
  criticalAlerts: CriticalAlert[],
  currentTotalInsulinDose: number,
  weight: number | null,
  diabetesType: "DMG" | "DM1" | "DM2"
): ClinicalRule[] {
  const rules: ClinicalRule[] = [];
  
  // SBD 2025 Rules
  if (diabetesType === "DMG") {
    if (!usesInsulin && percentAbove >= 30) {
      rules.push(SBD_2025_RULES.R1);
      rules.push(SBD_2025_RULES.R2);
      rules.push(FEBRASGO_2019_RULES.F6); // Terapia nutricional
      rules.push(WHO_2025_RULES.W6); // Insulina preferencial
    }
    
    if (hasCAFPercentile75 && gestationalWeeks >= 29 && gestationalWeeks <= 33 && !usesInsulin) {
      rules.push(SBD_2025_RULES.R3);
    }
    
    if (!usesInsulin && percentAbove >= 30) {
      rules.push(SBD_2025_RULES.R7); // Metformina alternativa
      rules.push(WHO_2025_RULES.W7);
    }
    
    const insulinDosePerKg = weight && weight > 0 ? currentTotalInsulinDose / weight : 0;
    if (usesInsulin && insulinDosePerKg > 2 && percentAbove >= 30) {
      rules.push(SBD_2025_RULES.R8);
    }
    
    // Always add R9 as reminder (glibenclamida contraindicada)
    if (!usesInsulin && percentAbove >= 30) {
      rules.push(SBD_2025_RULES.R9);
    }
  }
  
  if (diabetesType === "DM2") {
    rules.push(SBD_2025_RULES.R10);
    rules.push(SBD_2025_RULES.R11);
    rules.push(SBD_2025_RULES.R16);
    rules.push(SBD_2025_RULES.R17); // AAS
  }
  
  if (diabetesType === "DM1") {
    rules.push(SBD_2025_RULES.R11);
    rules.push(SBD_2025_RULES.R14);
    rules.push(SBD_2025_RULES.R15);
    rules.push(SBD_2025_RULES.R17); // AAS
  }
  
  // Common rules
  if (usesInsulin || percentAbove >= 30) {
    rules.push(SBD_2025_RULES.R4);
    rules.push(SBD_2025_RULES.R5);
  }
  
  const hasHighPostprandial = percentAbove >= 50;
  if (usesInsulin && hasHighPostprandial) {
    rules.push(SBD_2025_RULES.R6);
  }
  
  // FEBRASGO rules
  rules.push(FEBRASGO_2019_RULES.F5); // Metas glicêmicas
  
  if (gestationalWeeks >= 32) {
    rules.push(FEBRASGO_2019_RULES.F8); // Vigilância fetal
    rules.push(WHO_2025_RULES.W8);
  }
  
  if (gestationalWeeks >= 36) {
    rules.push(FEBRASGO_2019_RULES.F9); // Momento do parto
    rules.push(WHO_2025_RULES.W9);
  }
  
  // WHO rules
  rules.push(WHO_2025_RULES.W5); // Automonitorização
  
  return rules;
}

function calculateCurrentTotalInsulinDose(regimens: InsulinRegimen[]): number {
  let total = 0;
  regimens.forEach(r => {
    total += (r.doseManhaUI || 0) + (r.doseAlmocoUI || 0) + (r.doseJantarUI || 0) + (r.doseDormirUI || 0);
  });
  return total;
}

export function generateClinicalAnalysis(evaluation: PatientEvaluation): ClinicalAnalysis {
  const { glucoseReadings, weight, gestationalWeeks, gestationalDays, usesInsulin, insulinRegimens, patientName } = evaluation;
  const diabetesType = (evaluation.diabetesType as "DMG" | "DM1" | "DM2") || "DMG";
  
  const gestationalAge = `${gestationalWeeks} semanas e ${gestationalDays} dias`;
  
  // CRITICAL: Use chronology utility to get only consecutive recent days
  // This prevents mixing old data with recent data when there are gaps
  const totalDays = glucoseReadings.length;
  const chronologyResult = analyzeChronology(glucoseReadings, 7, 2);
  const last7DaysReadings = chronologyResult.readings;
  const totalDaysAnalyzed = last7DaysReadings.length;
  
  // Minimum 3 days of data required for reliable pattern detection
  const hasMinimumData = totalDaysAnalyzed >= 3;
  
  // Analysis based on last 7 days only (for recommendation)
  const analysisByPeriod = analyzeByPeriod(last7DaysReadings);
  const criticalAlerts = checkCriticalGlucose(last7DaysReadings);
  
  let totalReadings = 0;
  let totalInTarget = 0;
  let totalAbove = 0;
  let sumGlucose = 0;
  
  analysisByPeriod.forEach(p => {
    totalReadings += p.total;
    totalInTarget += p.inTarget;
    totalAbove += p.aboveTarget;
    sumGlucose += p.average * p.total;
  });
  
  const percentInTarget = totalReadings > 0 ? Math.round((totalInTarget / totalReadings) * 100) : 0;
  const percentAboveTarget = totalReadings > 0 ? Math.round((totalAbove / totalReadings) * 100) : 0;
  const averageGlucose = totalReadings > 0 ? Math.round(sumGlucose / totalReadings) : 0;
  
  const hasCAFPercentile75 = (evaluation.abdominalCircumferencePercentile || 0) >= 75;
  const currentTotalInsulinDose = calculateCurrentTotalInsulinDose(insulinRegimens || []);
  
  // Only trigger clinical rules if we have minimum 3 days of data
  const rulesTriggered = hasMinimumData ? determineTriggeredRules(
    percentAboveTarget,
    usesInsulin,
    gestationalWeeks,
    hasCAFPercentile75,
    criticalAlerts,
    currentTotalInsulinDose,
    weight ?? null,
    diabetesType
  ) : [];
  
  let urgencyLevel: "info" | "warning" | "critical" = "info";
  if (criticalAlerts.length > 0) {
    urgencyLevel = "critical";
  } else if (percentInTarget < 50) {
    urgencyLevel = "critical";
  } else if (percentInTarget < 70) {
    urgencyLevel = "warning";
  }
  
  // Use last 7 days for insulin adjustment recommendations
  const insulinCalculation = calculateInsulinDose(weight ?? null, last7DaysReadings, insulinRegimens || []);
  
  const diabetesTypeLabel = diabetesType === "DMG" ? "Diabetes Mellitus Gestacional" : 
                            diabetesType === "DM1" ? "Diabetes Mellitus tipo 1" : "Diabetes Mellitus tipo 2";
  
  let technicalSummary = `Paciente ${patientName}, ${gestationalAge} de idade gestacional`;
  if (weight && weight > 0) {
    technicalSummary += `, peso ${weight} kg`;
  }
  technicalSummary += `. Diagnóstico: ${diabetesTypeLabel}. `;
  technicalSummary += `ANÁLISE BASEADA NOS ÚLTIMOS 7 DIAS: ${totalDaysAnalyzed} dias analisados com ${totalReadings} medidas glicêmicas. `;
  if (!hasMinimumData) {
    technicalSummary += `ATENÇÃO: Dados insuficientes (mínimo 3 dias requeridos para recomendações confiáveis). `;
  }
  technicalSummary += `Percentual dentro da meta: ${percentInTarget}%. `;
  technicalSummary += `Percentual acima da meta: ${percentAboveTarget}%. `;
  technicalSummary += `Média glicêmica: ${averageGlucose} mg/dL. `;
  
  if (usesInsulin) {
    if (weight && weight > 0) {
      technicalSummary += `Em uso de insulinoterapia (dose total: ${currentTotalInsulinDose} UI/dia, ${(currentTotalInsulinDose/weight).toFixed(2)} UI/kg/dia). `;
    } else {
      technicalSummary += `Em uso de insulinoterapia (dose total: ${currentTotalInsulinDose} UI/dia). `;
    }
  } else {
    technicalSummary += `Sem insulinoterapia atual. `;
  }
  
  analysisByPeriod.forEach(p => {
    if (p.percentAbove > 30) {
      technicalSummary += `${p.period}: ${p.percentAbove}% acima da meta (média ${p.average} mg/dL, alvo ≤${p.targetMax} mg/dL). `;
    }
  });
  
  const recommendedActions: string[] = [];
  let insulinRecommendation = "";
  
  if (criticalAlerts.some(a => a.type === "hypoglycemia")) {
    recommendedActions.push("URGENTE: Hipoglicemia detectada - revisar doses de insulina e padrão alimentar imediatamente (SBD-R4)");
    recommendedActions.push("Considerar redução de 10-20% na dose de insulina do período relacionado");
    recommendedActions.push("Orientar paciente sobre sintomas e tratamento de hipoglicemia");
  }
  
  if (criticalAlerts.some(a => a.type === "severe_hyperglycemia")) {
    recommendedActions.push("URGENTE: Hiperglicemia severa (>200 mg/dL) - ação imediata necessária");
    recommendedActions.push("Aumentar doses de insulina em 20-30%");
    recommendedActions.push("Avaliar internação hospitalar se persistência");
  }
  
  if (!usesInsulin && percentAboveTarget >= 30) {
    insulinRecommendation = `INDICAÇÃO DE INSULINOTERAPIA (SBD-R1, SBD-R2): `;
    insulinRecommendation += `${percentAboveTarget}% das medidas acima da meta após terapia não-farmacológica. `;
    
    if (insulinCalculation && weight && weight > 0) {
      insulinRecommendation += `Dose inicial sugerida: ${insulinCalculation.initialTotalDose} UI/dia (0,5 UI/kg × ${weight} kg) conforme SBD-R4. `;
      insulinRecommendation += `Distribuição: NPH ${insulinCalculation.distribution.nphManha} UI manhã + ${insulinCalculation.distribution.nphNoite} UI ao deitar (SBD-R5). `;
      
      if (analysisByPeriod.some(p => p.period.includes("pós") && p.percentAbove >= 50)) {
        insulinRecommendation += `Adicionar insulina rápida antes das refeições (SBD-R6): `;
        insulinRecommendation += `Café ${insulinCalculation.distribution.rapidaManha} UI, Almoço ${insulinCalculation.distribution.rapidaAlmoco} UI, Jantar ${insulinCalculation.distribution.rapidaJantar} UI. `;
      }
    } else {
      insulinRecommendation += `Dose inicial: 0,5 UI/kg/dia (SBD-R4) - peso não informado para cálculo. `;
    }
    
    insulinRecommendation += `Metformina como alternativa se insulina inviável (SBD-R7, WHO-W7). `;
    insulinRecommendation += `ATENÇÃO: Glibenclamida CONTRAINDICADA (SBD-R9 - Classe III, Nível A).`;
    
    recommendedActions.push("Iniciar insulinoterapia conforme dose calculada (SBD-R2, SBD-R4)");
    recommendedActions.push("Orientar técnica de aplicação e automonitorização (WHO-W5)");
    recommendedActions.push("Reavaliar em 7-14 dias para ajuste de dose");
  } else if (usesInsulin) {
    const insulinDosePerKg = weight && weight > 0 ? currentTotalInsulinDose / weight : 0;
    
    if (insulinCalculation && insulinCalculation.adjustmentNeeded) {
      insulinRecommendation = `AJUSTE DE INSULINOTERAPIA (SBD-R4): `;
      insulinCalculation.specificAdjustments.forEach(adj => {
        insulinRecommendation += adj + " ";
      });
      
      if (insulinDosePerKg > 2 && percentAboveTarget >= 30) {
        insulinRecommendation += `Dose atual >2 UI/kg/dia sem controle adequado - considerar associação com metformina (SBD-R8). `;
      }
      
      if (gestationalWeeks >= 30) {
        recommendedActions.push("Reavaliar em 7 dias (ajustes semanais após 30 semanas - SBD)");
      } else {
        recommendedActions.push("Reavaliar em 14 dias (ajustes quinzenais até 30 semanas - SBD)");
      }
    } else {
      insulinRecommendation = "Manter esquema de insulinoterapia atual. Controle glicêmico adequado.";
      recommendedActions.push("Manter monitoramento glicêmico e conduta atual");
    }
  } else {
    insulinRecommendation = "Manter terapia não-farmacológica (dieta + atividade física). Controle glicêmico adequado (FEBRASGO-F6, FEBRASGO-F7).";
    recommendedActions.push("Manter orientação nutricional (FEBRASGO-F6)");
    recommendedActions.push("Manter atividade física regular (FEBRASGO-F7, WHO-W4)");
    recommendedActions.push("Continuar automonitorização glicêmica (WHO-W5)");
  }
  
  if (gestationalWeeks >= 30) {
    recommendedActions.push("Intensificar vigilância fetal (FEBRASGO-F8, WHO-W8)");
  }
  
  if (diabetesType === "DM1" || diabetesType === "DM2") {
    if (gestationalWeeks >= 12 && gestationalWeeks <= 28) {
      recommendedActions.push("Iniciar AAS 75-100 mg/dia para prevenção de pré-eclâmpsia (SBD-R17)");
    }
  }
  
  const guidelineSources = ["SBD 2025 (R1-R17)", "FEBRASGO 2019 (F1-F10)", "OMS 2025 (W1-W12)"];
  
  const sevenDayAnalysis = generateSevenDayAnalysis(glucoseReadings, analysisByPeriod);
  
  // Generate structured insulin adjustment analysis for patients using insulin
  const insulinAdjustments = usesInsulin && hasMinimumData ? analyzeInsulinAdjustments(last7DaysReadings) : null;
  
  return {
    patientName,
    gestationalAge,
    weight: weight ?? null,
    diabetesType,
    totalReadings,
    totalDaysAnalyzed,
    percentInTarget,
    percentAboveTarget,
    averageGlucose,
    usesInsulin,
    currentInsulinRegimens: insulinRegimens || [],
    analysisByPeriod,
    criticalAlerts,
    sevenDayAnalysis,
    insulinCalculation,
    rulesTriggered,
    urgencyLevel,
    technicalSummary,
    recommendedActions,
    insulinRecommendation,
    guidelineSources,
    insulinAdjustments,
    // Data quality indicators (always populated)
    chronologyWarning: chronologyResult.warningMessage || undefined,
    dateRange: chronologyResult.dateRange || undefined,
  };
}

export function formatAnalysisForAI(analysis: ClinicalAnalysis): string {
  let prompt = `## ANÁLISE CLÍNICA COMPUTADA (DADOS REAIS DA PACIENTE)\n`;
  prompt += `### Baseado nas diretrizes: ${analysis.guidelineSources.join(", ")}\n\n`;
  
  prompt += `### IDENTIFICAÇÃO\n`;
  prompt += `- **Paciente:** ${analysis.patientName}\n`;
  prompt += `- **Diagnóstico:** ${analysis.diabetesType === "DMG" ? "Diabetes Mellitus Gestacional" : analysis.diabetesType === "DM1" ? "DM tipo 1" : "DM tipo 2"}\n`;
  prompt += `- **Idade Gestacional:** ${analysis.gestationalAge}\n`;
  if (analysis.weight && analysis.weight > 0) {
    prompt += `- **Peso:** ${analysis.weight} kg\n`;
  } else {
    prompt += `- **Peso:** Não informado\n`;
  }
  prompt += `- **Usa Insulina:** ${analysis.usesInsulin ? "SIM" : "NÃO"}\n\n`;
  
  prompt += `### MÉTRICAS CALCULADAS\n`;
  prompt += `- **Dias analisados:** ${analysis.totalDaysAnalyzed}\n`;
  prompt += `- **Total de medidas:** ${analysis.totalReadings}\n`;
  prompt += `- **Percentual na meta:** ${analysis.percentInTarget}%\n`;
  prompt += `- **Percentual acima da meta:** ${analysis.percentAboveTarget}%\n`;
  prompt += `- **Média glicêmica:** ${analysis.averageGlucose} mg/dL\n\n`;
  
  prompt += `### ANÁLISE POR PERÍODO (VALORES REAIS)\n`;
  analysis.analysisByPeriod.forEach(p => {
    prompt += `\n**${p.period}** (meta ≤${p.targetMax} mg/dL):\n`;
    prompt += `- Medidas: ${p.total} | Média: ${p.average} mg/dL | Mín: ${p.minValue} | Máx: ${p.maxValue}\n`;
    prompt += `- Na meta: ${p.inTarget} (${100 - p.percentAbove}%) | Acima: ${p.aboveTarget} (${p.percentAbove}%)\n`;
    prompt += `- Valores: [${p.values.join(", ")}]\n`;
  });
  
  if (analysis.criticalAlerts.length > 0) {
    prompt += `\n### ALERTAS CRÍTICOS (PERÍODO TOTAL)\n`;
    analysis.criticalAlerts.forEach(alert => {
      const typeLabel = alert.type === "hypoglycemia" ? "HIPOGLICEMIA" : "HIPERGLICEMIA SEVERA";
      prompt += `- **${typeLabel}**: ${alert.value} mg/dL (${alert.timepoint}, Dia ${alert.day})\n`;
    });
  }
  
  // 7-DAY ANALYSIS SECTION
  if (analysis.sevenDayAnalysis) {
    const s7 = analysis.sevenDayAnalysis;
    prompt += `\n### ANÁLISE DOS ÚLTIMOS 7 DIAS (FOCO ESPECIAL)\n`;
    prompt += `- **Medidas nos últimos 7 dias:** ${s7.totalReadings}\n`;
    prompt += `- **Percentual na meta (7 dias):** ${s7.percentInTarget}%\n`;
    prompt += `- **Percentual acima da meta (7 dias):** ${s7.percentAboveTarget}%\n`;
    prompt += `- **Média glicêmica (7 dias):** ${s7.averageGlucose} mg/dL\n`;
    prompt += `- **TENDÊNCIA:** ${s7.trend === "improving" ? "MELHORA" : s7.trend === "worsening" ? "PIORA" : "ESTÁVEL"}\n`;
    prompt += `- **Descrição da tendência:** ${s7.trendDescription}\n\n`;
    
    prompt += `**Médias diárias (últimos 7 dias):**\n`;
    s7.dailyAverages.forEach(d => {
      prompt += `- Dia ${d.day}: média ${d.average} mg/dL (${d.inTarget}/${d.total} na meta)\n`;
    });
    
    if (s7.periodComparison.length > 0) {
      prompt += `\n**Comparativo por período (Geral vs Últimos 7 dias):**\n`;
      s7.periodComparison.forEach(pc => {
        const arrow = pc.change === "better" ? "↓ MELHOR" : pc.change === "worse" ? "↑ PIOR" : "= IGUAL";
        prompt += `- ${pc.period}: ${pc.overall} → ${pc.last7Days} mg/dL (${arrow})\n`;
      });
    }
    
    if (s7.criticalAlerts.length > 0) {
      prompt += `\n**Alertas críticos nos últimos 7 dias:**\n`;
      s7.criticalAlerts.forEach(alert => {
        const typeLabel = alert.type === "hypoglycemia" ? "HIPOGLICEMIA" : "HIPERGLICEMIA SEVERA";
        prompt += `- **${typeLabel}**: ${alert.value} mg/dL (${alert.timepoint}, Dia ${alert.day})\n`;
      });
    } else {
      prompt += `\n**Nenhum alerta crítico nos últimos 7 dias.**\n`;
    }
  }
  
  if (analysis.insulinCalculation) {
    const ic = analysis.insulinCalculation;
    prompt += `\n### CÁLCULO DE DOSE DE INSULINA (0,5 UI/kg/dia - SBD-R4)\n`;
    prompt += `- **Dose total inicial:** ${ic.initialTotalDose} UI/dia\n`;
    prompt += `- **Basal (50%):** ${ic.basalDose} UI (NPH manhã ${ic.distribution.nphManha} UI + noite ${ic.distribution.nphNoite} UI)\n`;
    prompt += `- **Bolus (50%):** ${ic.bolusDose} UI (café ${ic.distribution.rapidaManha} UI + almoço ${ic.distribution.rapidaAlmoco} UI + jantar ${ic.distribution.rapidaJantar} UI)\n`;
    
    if (ic.specificAdjustments.length > 0) {
      prompt += `\n**Ajustes específicos recomendados:**\n`;
      ic.specificAdjustments.forEach(adj => {
        prompt += `- ${adj}\n`;
      });
    }
  }
  
  prompt += `\n### REGRAS CLÍNICAS ACIONADAS\n`;
  if (analysis.rulesTriggered.length > 0) {
    // Group by source
    const sbdRules = analysis.rulesTriggered.filter(r => r.source === "SBD 2025");
    const febrasgoRules = analysis.rulesTriggered.filter(r => r.source === "FEBRASGO 2019");
    const whoRules = analysis.rulesTriggered.filter(r => r.source === "OMS 2025");
    
    if (sbdRules.length > 0) {
      prompt += `\n**SBD 2025:**\n`;
      sbdRules.forEach(rule => {
        prompt += `- **${rule.id}** (${rule.classification}): ${rule.title}\n`;
      });
    }
    if (febrasgoRules.length > 0) {
      prompt += `\n**FEBRASGO 2019:**\n`;
      febrasgoRules.forEach(rule => {
        prompt += `- **${rule.id}** (${rule.classification}): ${rule.title}\n`;
      });
    }
    if (whoRules.length > 0) {
      prompt += `\n**OMS 2025:**\n`;
      whoRules.forEach(rule => {
        prompt += `- **${rule.id}** (${rule.classification}): ${rule.title}\n`;
      });
    }
  } else {
    prompt += `Nenhuma regra de intervenção acionada. Controle adequado.\n`;
  }
  
  prompt += `\n### NÍVEL DE URGÊNCIA PRÉ-CALCULADO: ${analysis.urgencyLevel.toUpperCase()}\n`;
  
  prompt += `\n### RECOMENDAÇÃO DE INSULINA PRÉ-CALCULADA\n`;
  prompt += analysis.insulinRecommendation + "\n";
  
  prompt += `\n### AÇÕES RECOMENDADAS PRÉ-CALCULADAS\n`;
  analysis.recommendedActions.forEach((action, i) => {
    prompt += `${i + 1}. ${action}\n`;
  });
  
  return prompt;
}
