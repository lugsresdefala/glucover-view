import type { PatientEvaluation, GlucoseReading, InsulinRegimen, CriticalAlert } from "@shared/schema";
import { glucoseTargets, criticalGlucoseThresholds, checkCriticalGlucose } from "@shared/schema";

/**
 * Clinical Engine for Gestational Diabetes Management
 * Based on official guidelines:
 * - SBD (Sociedade Brasileira de Diabetes) 2025
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
}

export const CLINICAL_RULES: Record<string, ClinicalRule> = {
  R1: {
    id: "R1",
    title: "Início de Terapia Farmacológica",
    classification: "Classe IIb, Nível C",
    description: "Pode ser considerado o início da terapia farmacológica na mulher com DMG quando duas ou mais medidas de glicemia, avaliadas após 7 a 14 dias de terapia não farmacológica, estiverem acima da meta.",
    source: "SBD 2025"
  },
  R2: {
    id: "R2",
    title: "Insulina como Primeira Escolha",
    classification: "Classe I, Nível A",
    description: "É recomendada a insulina como terapia farmacológica de primeira escolha para controle glicêmico na mulher com DMG.",
    source: "SBD 2025"
  },
  R3: {
    id: "R3",
    title: "Critério de Crescimento Fetal",
    classification: "Classe IIb, Nível B",
    description: "O critério de crescimento fetal para início da insulinoterapia pode ser considerado quando a medida da circunferência abdominal fetal for ≥ percentil 75 em USG realizada entre a 29ª e a 33ª semana de gestação.",
    source: "SBD 2025"
  },
  R4: {
    id: "R4",
    title: "Dose Inicial de Insulina",
    classification: "Classe IIb, Nível C",
    description: "A terapia com insulina para gestantes com DMG pode ser considerada na dose total inicial de 0,5 UI/kg/dia, com ajustes individualizados baseados no monitoramento diário da glicose a cada 1-2 semanas.",
    source: "SBD 2025"
  },
  R5: {
    id: "R5",
    title: "Tipos de Insulina",
    classification: "Classe IIa, Nível C",
    description: "Deve ser considerado o uso de insulinas humanas NPH/Regular, e de análogos de insulina aprovados para uso na gestação, como opções para o tratamento farmacológico do DMG.",
    source: "SBD 2025"
  },
  R6: {
    id: "R6",
    title: "Análogos de Ação Rápida",
    classification: "Classe IIa, Nível B",
    description: "Deve ser considerada a indicação de análogos de insulina de ação rápida ou ultrarrápida, aprovados para uso na gestação, em casos de DMG que apresentem difícil controle das excursões glicêmicas pós-prandiais.",
    source: "SBD 2025"
  },
  R7: {
    id: "R7",
    title: "Metformina como Alternativa",
    classification: "Classe I, Nível B",
    description: "É recomendado o uso da metformina em mulheres com DMG sem controle glicêmico adequado com medidas não farmacológicas, como alternativa terapêutica, na inviabilidade do uso de insulina.",
    source: "SBD 2025"
  },
  R8: {
    id: "R8",
    title: "Associação Metformina + Insulina",
    classification: "Classe IIa, Nível B",
    description: "Deve ser considerada a associação de metformina com insulina em gestantes com DMG que necessitem altas doses de insulina (>2 UI/kg/dia) sem controle glicêmico adequado ou com ganho excessivo de peso materno ou fetal.",
    source: "SBD 2025"
  },
  R9: {
    id: "R9",
    title: "Glibenclamida NÃO Recomendada",
    classification: "Classe III, Nível A",
    description: "O uso de glibenclamida NÃO é recomendado para gestante com DMG, devido ao aumento de risco de macrossomia e hipoglicemia neonatal.",
    source: "SBD 2025"
  },
  R10: {
    id: "R10",
    title: "DM2 Pré-gestacional",
    classification: "Classe I, Nível C",
    description: "É recomendado que gestantes com DM2 interrompam o tratamento não insulínico antes ou logo após o início da gestação, quando estiver garantida a imediata substituição pela insulinoterapia.",
    source: "SBD 2025"
  },
  R11: {
    id: "R11",
    title: "Esquemas Intensivos de Insulinização",
    classification: "Classe I, Nível B",
    description: "É recomendado o uso de esquemas intensivos de insulinização com múltiplas doses de insulina (MDI) ou com infusão contínua (SICI) para se obter um controle glicêmico adequado em gestantes com DM1 e DM2.",
    source: "SBD 2025"
  }
};

export interface ClinicalAnalysis {
  patientName: string;
  gestationalAge: string;
  weight: number;
  totalReadings: number;
  totalDaysAnalyzed: number;
  percentInTarget: number;
  percentAboveTarget: number;
  averageGlucose: number;
  usesInsulin: boolean;
  currentInsulinRegimens: InsulinRegimen[];
  
  analysisByPeriod: GlucoseAnalysisByPeriod[];
  criticalAlerts: CriticalAlert[];
  
  insulinCalculation: InsulinDoseCalculation | null;
  
  rulesTriggered: ClinicalRule[];
  urgencyLevel: "info" | "warning" | "critical";
  
  technicalSummary: string;
  recommendedActions: string[];
  insulinRecommendation: string;
  guidelineSources: string[];
}

function analyzeByPeriod(readings: GlucoseReading[]): GlucoseAnalysisByPeriod[] {
  const periods: { key: keyof GlucoseReading; name: string; targetType: "jejum" | "posPrandial1h" }[] = [
    { key: "jejum", name: "Jejum", targetType: "jejum" },
    { key: "posCafe1h", name: "1h pós-café da manhã", targetType: "posPrandial1h" },
    { key: "preAlmoco", name: "Pré-almoço", targetType: "jejum" },
    { key: "posAlmoco1h", name: "1h pós-almoço", targetType: "posPrandial1h" },
    { key: "preJantar", name: "Pré-jantar", targetType: "jejum" },
    { key: "posJantar1h", name: "1h pós-jantar", targetType: "posPrandial1h" },
    { key: "madrugada", name: "Madrugada (3h)", targetType: "jejum" },
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

function calculateInsulinDose(weight: number, readings: GlucoseReading[], currentRegimens: InsulinRegimen[]): InsulinDoseCalculation {
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
  weight: number
): ClinicalRule[] {
  const rules: ClinicalRule[] = [];
  
  if (!usesInsulin && percentAbove >= 30) {
    rules.push(CLINICAL_RULES.R1);
    rules.push(CLINICAL_RULES.R2);
  }
  
  if (hasCAFPercentile75 && gestationalWeeks >= 29 && gestationalWeeks <= 33 && !usesInsulin) {
    rules.push(CLINICAL_RULES.R3);
  }
  
  if (usesInsulin || percentAbove >= 30) {
    rules.push(CLINICAL_RULES.R4);
  }
  
  if (usesInsulin) {
    rules.push(CLINICAL_RULES.R5);
  }
  
  const hasHighPostprandial = percentAbove >= 50;
  if (usesInsulin && hasHighPostprandial) {
    rules.push(CLINICAL_RULES.R6);
  }
  
  if (!usesInsulin && percentAbove >= 30) {
    rules.push(CLINICAL_RULES.R7);
  }
  
  const insulinDosePerKg = currentTotalInsulinDose / weight;
  if (usesInsulin && insulinDosePerKg > 2 && percentAbove >= 30) {
    rules.push(CLINICAL_RULES.R8);
  }
  
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
    weight
  );
  
  let urgencyLevel: "info" | "warning" | "critical" = "info";
  if (criticalAlerts.length > 0) {
    urgencyLevel = "critical";
  } else if (percentInTarget < 50) {
    urgencyLevel = "critical";
  } else if (percentInTarget < 70) {
    urgencyLevel = "warning";
  }
  
  const insulinCalculation = calculateInsulinDose(weight, glucoseReadings, insulinRegimens || []);
  
  let technicalSummary = `Paciente ${patientName}, ${gestationalAge} de idade gestacional, peso ${weight} kg. `;
  technicalSummary += `Análise de ${totalDaysAnalyzed} dias com ${totalReadings} medidas glicêmicas. `;
  technicalSummary += `Percentual dentro da meta: ${percentInTarget}%. `;
  technicalSummary += `Percentual acima da meta: ${percentAboveTarget}%. `;
  technicalSummary += `Média glicêmica: ${averageGlucose} mg/dL. `;
  
  if (usesInsulin) {
    technicalSummary += `Em uso de insulinoterapia (dose total: ${currentTotalInsulinDose} UI/dia, ${(currentTotalInsulinDose/weight).toFixed(2)} UI/kg/dia). `;
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
    recommendedActions.push("URGENTE: Hipoglicemia detectada - revisar doses de insulina e padrão alimentar imediatamente");
    recommendedActions.push("Considerar redução de 10-20% na dose de insulina do período relacionado");
    recommendedActions.push("Orientar paciente sobre sintomas e tratamento de hipoglicemia");
  }
  
  if (criticalAlerts.some(a => a.type === "severe_hyperglycemia")) {
    recommendedActions.push("URGENTE: Hiperglicemia severa (>200 mg/dL) - ação imediata necessária");
    recommendedActions.push("Aumentar doses de insulina em 20-30%");
    recommendedActions.push("Avaliar internação hospitalar se persistência");
  }
  
  if (!usesInsulin && percentAboveTarget >= 30) {
    insulinRecommendation = `INDICAÇÃO DE INSULINOTERAPIA (${CLINICAL_RULES.R1.id}, ${CLINICAL_RULES.R2.id} - ${CLINICAL_RULES.R1.classification}): `;
    insulinRecommendation += `${percentAboveTarget}% das medidas acima da meta após terapia não-farmacológica. `;
    insulinRecommendation += `Dose inicial sugerida: ${insulinCalculation.initialTotalDose} UI/dia (0,5 UI/kg × ${weight} kg) conforme ${CLINICAL_RULES.R4.id}. `;
    insulinRecommendation += `Distribuição sugerida: NPH ${insulinCalculation.distribution.nphManha} UI manhã + ${insulinCalculation.distribution.nphNoite} UI ao deitar (${CLINICAL_RULES.R5.id}). `;
    
    if (analysisByPeriod.some(p => p.period.includes("pós") && p.percentAbove >= 50)) {
      insulinRecommendation += `Adicionar insulina rápida/ultrarrápida antes das refeições com excursões pós-prandiais (${CLINICAL_RULES.R6.id}): `;
      insulinRecommendation += `Café ${insulinCalculation.distribution.rapidaManha} UI, Almoço ${insulinCalculation.distribution.rapidaAlmoco} UI, Jantar ${insulinCalculation.distribution.rapidaJantar} UI. `;
    }
    
    insulinRecommendation += `Metformina pode ser considerada como alternativa se insulina inviável (${CLINICAL_RULES.R7.id} - ${CLINICAL_RULES.R7.classification}). `;
    insulinRecommendation += `ATENÇÃO: Glibenclamida é CONTRAINDICADA (${CLINICAL_RULES.R9.id} - ${CLINICAL_RULES.R9.classification}).`;
    
    recommendedActions.push("Iniciar insulinoterapia conforme dose calculada");
    recommendedActions.push("Orientar técnica de aplicação e automonitorização");
    recommendedActions.push("Reavaliar em 7-14 dias para ajuste de dose");
  } else if (usesInsulin) {
    const insulinDosePerKg = currentTotalInsulinDose / weight;
    
    if (insulinCalculation.adjustmentNeeded) {
      insulinRecommendation = `AJUSTE DE INSULINOTERAPIA (${CLINICAL_RULES.R4.id}): `;
      insulinCalculation.specificAdjustments.forEach(adj => {
        insulinRecommendation += adj + " ";
      });
      
      if (insulinDosePerKg > 2 && percentAboveTarget >= 30) {
        insulinRecommendation += `Dose atual >2 UI/kg/dia sem controle adequado - considerar associação com metformina (${CLINICAL_RULES.R8.id} - ${CLINICAL_RULES.R8.classification}). `;
      }
      
      if (gestationalWeeks >= 30) {
        recommendedActions.push("Reavaliar em 7 dias (ajustes semanais após 30 semanas)");
      } else {
        recommendedActions.push("Reavaliar em 14 dias (ajustes quinzenais até 30 semanas)");
      }
    } else {
      insulinRecommendation = "Manter esquema de insulinoterapia atual. Controle glicêmico adequado.";
      recommendedActions.push("Manter monitoramento glicêmico e conduta atual");
    }
  } else {
    insulinRecommendation = "Manter terapia não-farmacológica (dieta + atividade física). Controle glicêmico adequado.";
    recommendedActions.push("Manter orientação nutricional e atividade física");
    recommendedActions.push("Continuar automonitorização glicêmica");
  }
  
  if (gestationalWeeks >= 30) {
    recommendedActions.push("Intensificar vigilância fetal (após 30 semanas)");
  }
  
  const guidelineSources = ["SBD 2025", "FEBRASGO 2019", "OMS 2025"];
  
  return {
    patientName,
    gestationalAge,
    weight,
    totalReadings,
    totalDaysAnalyzed,
    percentInTarget,
    percentAboveTarget,
    averageGlucose,
    usesInsulin,
    currentInsulinRegimens: insulinRegimens || [],
    analysisByPeriod,
    criticalAlerts,
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
  prompt += `- **Idade Gestacional:** ${analysis.gestationalAge}\n`;
  prompt += `- **Peso:** ${analysis.weight} kg\n`;
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
    prompt += `\n### ALERTAS CRÍTICOS\n`;
    analysis.criticalAlerts.forEach(alert => {
      const typeLabel = alert.type === "hypoglycemia" ? "HIPOGLICEMIA" : "HIPERGLICEMIA SEVERA";
      prompt += `- **${typeLabel}**: ${alert.value} mg/dL (${alert.timepoint}, Dia ${alert.day})\n`;
    });
  }
  
  if (analysis.insulinCalculation) {
    const ic = analysis.insulinCalculation;
    prompt += `\n### CÁLCULO DE DOSE DE INSULINA (0,5 UI/kg/dia - ${CLINICAL_RULES.R4.id})\n`;
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
  
  prompt += `\n### REGRAS CLÍNICAS ACIONADAS (${analysis.guidelineSources[0]})\n`;
  if (analysis.rulesTriggered.length > 0) {
    analysis.rulesTriggered.forEach(rule => {
      prompt += `- **${rule.id}** (${rule.classification}): ${rule.title}\n`;
    });
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
