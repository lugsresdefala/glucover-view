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
    const aboveTarget = values.filter(v => v > targetMax).length;
    const belowTarget = values.filter(v => v < criticalGlucoseThresholds.hypo).length;
    const inTarget = values.filter(v => v <= targetMax && v >= criticalGlucoseThresholds.hypo).length;
    
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
  if (allReadings.length < 7) {
    return null;
  }
  
  const last7Days = allReadings.slice(-7);
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
        if (val <= targetMax && val >= criticalGlucoseThresholds.hypo) {
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
  const totalDaysAnalyzed = glucoseReadings.length;
  
  const analysisByPeriod = analyzeByPeriod(glucoseReadings);
  const criticalAlerts = checkCriticalGlucose(glucoseReadings);
  
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
  
  const rulesTriggered = determineTriggeredRules(
    percentAboveTarget,
    usesInsulin,
    gestationalWeeks,
    hasCAFPercentile75,
    criticalAlerts,
    currentTotalInsulinDose,
    weight ?? null,
    diabetesType
  );
  
  let urgencyLevel: "info" | "warning" | "critical" = "info";
  if (criticalAlerts.length > 0) {
    urgencyLevel = "critical";
  } else if (percentInTarget < 50) {
    urgencyLevel = "critical";
  } else if (percentInTarget < 70) {
    urgencyLevel = "warning";
  }
  
  const insulinCalculation = calculateInsulinDose(weight ?? null, glucoseReadings, insulinRegimens || []);
  
  const diabetesTypeLabel = diabetesType === "DMG" ? "Diabetes Mellitus Gestacional" : 
                            diabetesType === "DM1" ? "Diabetes Mellitus tipo 1" : "Diabetes Mellitus tipo 2";
  
  let technicalSummary = `Paciente ${patientName}, ${gestationalAge} de idade gestacional`;
  if (weight && weight > 0) {
    technicalSummary += `, peso ${weight} kg`;
  }
  technicalSummary += `. Diagnóstico: ${diabetesTypeLabel}. `;
  technicalSummary += `Análise de ${totalDaysAnalyzed} dias com ${totalReadings} medidas glicêmicas. `;
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
