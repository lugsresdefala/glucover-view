import type { PatientEvaluation, GlucoseReading, InsulinRegimen, CriticalAlert } from "@shared/schema";
import { glucoseTargets, criticalGlucoseThresholds, checkCriticalGlucose } from "@shared/schema";

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
  
  rulesTrigggered: string[];
  urgencyLevel: "info" | "warning" | "critical";
  
  technicalSummary: string;
  recommendedActions: string[];
  insulinRecommendation: string;
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
  criticalAlerts: CriticalAlert[]
): string[] {
  const rules: string[] = [];
  
  if (!usesInsulin && percentAbove >= 30) {
    rules.push("R1");
  }
  
  if (!usesInsulin && percentAbove >= 30) {
    rules.push("R2");
  }
  
  if (hasCAFPercentile75 && gestationalWeeks >= 29 && gestationalWeeks <= 33 && !usesInsulin) {
    rules.push("R3");
  }
  
  if (usesInsulin || percentAbove >= 30) {
    rules.push("R4");
  }
  
  if (usesInsulin) {
    rules.push("R5");
  }
  
  const hasHighPostprandial = percentAbove >= 50;
  if (usesInsulin && hasHighPostprandial) {
    rules.push("R6");
  }
  
  return Array.from(new Set(rules));
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
  
  const rulesTrigggered = determineTriggeredRules(
    percentAboveTarget,
    usesInsulin,
    gestationalWeeks,
    hasCAFPercentile75,
    criticalAlerts
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
    technicalSummary += `Em uso de insulinoterapia. `;
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
    insulinRecommendation = `INDICAÇÃO DE INSULINOTERAPIA (R1, R2): ${percentAboveTarget}% das medidas acima da meta após terapia não-farmacológica. `;
    insulinRecommendation += `Dose inicial sugerida: ${insulinCalculation.initialTotalDose} UI/dia (0,5 UI/kg × ${weight} kg). `;
    insulinRecommendation += `Distribuição sugerida: NPH ${insulinCalculation.distribution.nphManha} UI manhã + ${insulinCalculation.distribution.nphNoite} UI ao deitar. `;
    
    if (analysisByPeriod.some(p => p.period.includes("pós") && p.percentAbove >= 50)) {
      insulinRecommendation += `Adicionar insulina rápida/ultrarrápida antes das refeições com excursões pós-prandiais (R6): `;
      insulinRecommendation += `Café ${insulinCalculation.distribution.rapidaManha} UI, Almoço ${insulinCalculation.distribution.rapidaAlmoco} UI, Jantar ${insulinCalculation.distribution.rapidaJantar} UI. `;
    }
    
    recommendedActions.push("Iniciar insulinoterapia conforme dose calculada");
    recommendedActions.push("Orientar técnica de aplicação e automonitorização");
    recommendedActions.push("Reavaliar em 7-14 dias para ajuste de dose");
  } else if (usesInsulin) {
    if (insulinCalculation.adjustmentNeeded) {
      insulinRecommendation = `AJUSTE DE INSULINOTERAPIA (R4): `;
      insulinCalculation.specificAdjustments.forEach(adj => {
        insulinRecommendation += adj + " ";
      });
      
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
    rulesTrigggered,
    urgencyLevel,
    technicalSummary,
    recommendedActions,
    insulinRecommendation,
  };
}

export function formatAnalysisForAI(analysis: ClinicalAnalysis): string {
  let prompt = `## ANÁLISE CLÍNICA COMPUTADA (DADOS REAIS DA PACIENTE)\n\n`;
  
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
    prompt += `\n### CÁLCULO DE DOSE DE INSULINA (0,5 UI/kg/dia)\n`;
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
  if (analysis.rulesTrigggered.length > 0) {
    prompt += `Regras aplicáveis: ${analysis.rulesTrigggered.join(", ")}\n`;
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
