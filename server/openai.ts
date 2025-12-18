import OpenAI from "openai";
import type { PatientEvaluation, ClinicalRecommendation, GlucoseReading, CriticalAlert } from "@shared/schema";
import { glucoseTargets, calculateGlucosePercentageInTarget, calculateAverageGlucose, checkCriticalGlucose, criticalGlucoseThresholds } from "@shared/schema";
import { generateClinicalAnalysis, formatAnalysisForAI, type ClinicalAnalysis } from "./clinical-engine";

// Using Replit's AI Integrations service - provides OpenAI-compatible API access
// without requiring your own API key. Charges are billed to your Replit credits.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// DMG Guidelines prompt context
const DMG_GUIDELINES = `
Você é um especialista em diabetes mellitus gestacional (DMG) e deve analisar dados clínicos para sugerir condutas baseadas nas diretrizes brasileiras.

## METAS GLICÊMICAS (DMG)
- Jejum: ≤ 95 mg/dL
- 1 hora pós-prandial: ≤ 140 mg/dL
- 2 horas pós-prandial: ≤ 120 mg/dL

## RECOMENDAÇÕES PRINCIPAIS (R1-R7)

R1 - INÍCIO DA TERAPIA FARMACOLÓGICA:
PODE SER CONSIDERADO iniciar terapia farmacológica quando duas ou mais medidas de glicemia, avaliadas após 7 a 14 dias de terapia não farmacológica, estiverem acima da meta.
Alternativa: 30% a 50% das medidas alteradas em uma semana.

R2 - INSULINA COMO PRIMEIRA ESCOLHA:
É RECOMENDADA a insulina como terapia farmacológica de primeira escolha para controle glicêmico na mulher com DMG.

R3 - CRITÉRIO DE CRESCIMENTO FETAL:
PODE SER CONSIDERADO iniciar insulinoterapia quando a circunferência abdominal fetal for ≥ percentil 75 em ultrassonografia entre 29ª e 33ª semana.

R4 - DOSE INICIAL DE INSULINA:
A terapia com insulina PODE SER CONSIDERADA na dose total inicial de 0,5 UI/kg/dia, com ajustes individualizados a cada 1-2 semanas.

R5 - TIPOS DE INSULINA:
DEVE SER CONSIDERADO o uso de insulinas humanas NPH/Regular e análogos aprovados para gestação.
- Categoria A (mais seguros): Asparte, Fast-Asparte, Detemir, Degludeca
- Categoria B: Regular, NPH, Lispro
- Categoria C: Glargina, Glulisina (usar com cautela)

R6 - ANÁLOGOS DE AÇÃO RÁPIDA:
DEVE SER CONSIDERADA a indicação de análogos de insulina de ação rápida/ultrarrápida em casos de difícil controle das excursões glicêmicas pós-prandiais.

R7 - METFORMINA COMO ALTERNATIVA:
É RECOMENDADO o uso da metformina como alternativa terapêutica na inviabilidade do uso de insulina.

## AJUSTES DE INSULINA
- Até 30ª semana: ajustes a cada 15 dias
- Após 30ª semana: ajustes semanais
- Aumentos típicos: 10-20% da dose quando valores fora da meta
- Distribuição baseada no perfil glicêmico:
  * Glicemia de jejum alta: aumentar NPH noturna
  * Glicemia pós-prandial alta: aumentar insulina rápida/ultrarrápida antes da refeição correspondente
`;

function analyzeGlucosePatterns(readings: GlucoseReading[]): string {
  const patterns: string[] = [];
  let jejumAlto = 0,
    posCafeAlto = 0,
    posAlmocoAlto = 0,
    posJantarAlto = 0;
  let total = 0;

  readings.forEach((r) => {
    if (typeof r.jejum === "number") {
      total++;
      if (r.jejum > glucoseTargets.jejum.max) jejumAlto++;
    }
    if (typeof r.posCafe1h === "number") {
      total++;
      if (r.posCafe1h > glucoseTargets.posPrandial1h.max) posCafeAlto++;
    }
    if (typeof r.posAlmoco1h === "number") {
      total++;
      if (r.posAlmoco1h > glucoseTargets.posPrandial1h.max) posAlmocoAlto++;
    }
    if (typeof r.posJantar1h === "number") {
      total++;
      if (r.posJantar1h > glucoseTargets.posPrandial1h.max) posJantarAlto++;
    }
  });

  if (jejumAlto > 0) patterns.push(`Jejum elevado em ${jejumAlto} medida(s)`);
  if (posCafeAlto > 0) patterns.push(`Pós-café elevado em ${posCafeAlto} medida(s)`);
  if (posAlmocoAlto > 0) patterns.push(`Pós-almoço elevado em ${posAlmocoAlto} medida(s)`);
  if (posJantarAlto > 0) patterns.push(`Pós-jantar elevado em ${posJantarAlto} medida(s)`);

  return patterns.length > 0 ? patterns.join("; ") : "Todas as medidas dentro da meta";
}

function formatEvaluationForAI(evaluation: PatientEvaluation): string {
  const percentInTarget = calculateGlucosePercentageInTarget(evaluation.glucoseReadings);
  const avgGlucose = calculateAverageGlucose(evaluation.glucoseReadings);
  const patterns = analyzeGlucosePatterns(evaluation.glucoseReadings);

  let prompt = `
## DADOS DA PACIENTE

**Identificação:** ${evaluation.patientName}
**Peso atual:** ${evaluation.weight} kg
**Idade gestacional:** ${evaluation.gestationalWeeks} semanas e ${evaluation.gestationalDays} dias
**Adesão à dieta:** ${evaluation.dietAdherence}
`;

  if (evaluation.abdominalCircumference) {
    prompt += `**Circunferência abdominal fetal:** ${evaluation.abdominalCircumference} mm`;
    if (evaluation.abdominalCircumferencePercentile) {
      prompt += ` (percentil ${evaluation.abdominalCircumferencePercentile})`;
    }
    prompt += "\n";
  }

  prompt += `
## ANÁLISE GLICÊMICA
**Percentual na meta:** ${percentInTarget}%
**Média glicêmica:** ${avgGlucose} mg/dL
**Padrões identificados:** ${patterns}

## MEDIDAS GLICÊMICAS (mg/dL)
`;

  evaluation.glucoseReadings.forEach((reading, index) => {
    prompt += `\n**Dia ${index + 1}:**\n`;
    if (reading.jejum !== undefined) prompt += `- Jejum: ${reading.jejum}\n`;
    if (reading.posCafe1h !== undefined) prompt += `- 1h pós-café: ${reading.posCafe1h}\n`;
    if (reading.preAlmoco !== undefined) prompt += `- Pré-almoço: ${reading.preAlmoco}\n`;
    if (reading.posAlmoco2h !== undefined) prompt += `- 2h pós-almoço: ${reading.posAlmoco2h}\n`;
    if (reading.preJantar !== undefined) prompt += `- Pré-jantar: ${reading.preJantar}\n`;
    if (reading.posJantar2h !== undefined) prompt += `- 2h pós-jantar: ${reading.posJantar2h}\n`;
    if (reading.madrugada !== undefined) prompt += `- Madrugada: ${reading.madrugada}\n`;
  });

  if (evaluation.usesInsulin && evaluation.insulinRegimens && evaluation.insulinRegimens.length > 0) {
    prompt += `\n## INSULINOTERAPIA ATUAL\n`;
    evaluation.insulinRegimens.forEach((regimen) => {
      const totalDose =
        (regimen.doseManhaUI || 0) +
        (regimen.doseAlmocoUI || 0) +
        (regimen.doseJantarUI || 0) +
        (regimen.doseDormirUI || 0);
      prompt += `\n**${regimen.type}:** Dose total ${totalDose} UI/dia\n`;
      if (regimen.doseManhaUI) prompt += `- Manhã: ${regimen.doseManhaUI} UI\n`;
      if (regimen.doseAlmocoUI) prompt += `- Almoço: ${regimen.doseAlmocoUI} UI\n`;
      if (regimen.doseJantarUI) prompt += `- Jantar: ${regimen.doseJantarUI} UI\n`;
      if (regimen.doseDormirUI) prompt += `- Dormir: ${regimen.doseDormirUI} UI\n`;
    });
  } else {
    prompt += `\n## INSULINOTERAPIA\nPaciente NÃO está em uso de insulina.\n`;
  }

  return prompt;
}

export async function generateClinicalRecommendation(
  evaluation: PatientEvaluation
): Promise<ClinicalRecommendation> {
  const clinicalAnalysis = generateClinicalAnalysis(evaluation);
  
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.warn("OpenAI integration not configured, using deterministic recommendation");
    return generateDeterministicRecommendation(clinicalAnalysis);
  }

  const analysisData = formatAnalysisForAI(clinicalAnalysis);

  const systemPrompt = `${DMG_GUIDELINES}

## INSTRUÇÕES OBRIGATÓRIAS - LEIA COM ATENÇÃO

Você está recebendo uma ANÁLISE CLÍNICA PRÉ-COMPUTADA com dados REAIS da paciente.
Os cálculos de doses de insulina JÁ FORAM REALIZADOS com base no peso da paciente.
As métricas por período (jejum, pós-prandial, etc.) JÁ FORAM CALCULADAS.

SUA TAREFA:
1. INCORPORAR os dados reais e cálculos fornecidos na sua resposta
2. USAR a linguagem técnica das diretrizes brasileiras de DMG
3. CITAR as regras R1-R7 quando aplicáveis
4. FORNECER doses específicas em UI conforme calculado
5. NUNCA dar recomendações genéricas - sempre incluir os valores reais

## FORMATO OBRIGATÓRIO DA RESPOSTA (JSON)
{
  "analysis": "Análise técnica usando os dados reais fornecidos. DEVE incluir: percentuais calculados, média glicêmica, períodos problemáticos identificados",
  "mainRecommendation": "Recomendação ESPECÍFICA com doses de insulina em UI quando aplicável. Exemplo: 'Iniciar insulina NPH 12 UI manhã + 8 UI noite' ou 'Aumentar Regular do almoço de 4 UI para 5 UI (aumento de 25%)'",
  "justification": "Justificativa técnica citando OBRIGATORIAMENTE as regras R1-R7 aplicáveis e os critérios numéricos que as acionam. Exemplo: 'Conforme R1, 45% das medidas acima da meta justifica início de insulinoterapia'",
  "nextSteps": ["Passos práticos ESPECÍFICOS com prazos. Incluir doses quando relevante"],
  "urgencyLevel": "${clinicalAnalysis.urgencyLevel}",
  "guidelineReferences": ${JSON.stringify(clinicalAnalysis.rulesTrigggered)}
}

## REGRAS CRÍTICAS
1. urgencyLevel JÁ FOI CALCULADO: USE "${clinicalAnalysis.urgencyLevel}"
2. guidelineReferences JÁ FORAM IDENTIFICADAS: USE ${JSON.stringify(clinicalAnalysis.rulesTrigggered)}
3. SEMPRE inclua os valores de dose calculados (ex: "NPH 15 UI", não apenas "insulina NPH")
4. SEMPRE referencie os percentuais reais (ex: "32% acima da meta", não "várias medidas elevadas")
5. Se há ajustes específicos calculados, INCLUA-OS na recomendação`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: analysisData },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Não foi possível gerar recomendação");
    }

    const parsed = JSON.parse(content) as ClinicalRecommendation;

    return {
      analysis: parsed.analysis || clinicalAnalysis.technicalSummary,
      mainRecommendation: parsed.mainRecommendation || clinicalAnalysis.insulinRecommendation,
      justification: parsed.justification || `Baseado nas Diretrizes Brasileiras para DMG. ${clinicalAnalysis.percentInTarget}% das medidas dentro da meta.`,
      nextSteps: Array.isArray(parsed.nextSteps) && parsed.nextSteps.length > 0 
        ? parsed.nextSteps 
        : clinicalAnalysis.recommendedActions,
      urgencyLevel: clinicalAnalysis.urgencyLevel,
      guidelineReferences: clinicalAnalysis.rulesTrigggered.length > 0 
        ? clinicalAnalysis.rulesTrigggered 
        : [],
    };
  } catch (error) {
    console.error("Error with AI generation, using deterministic:", error);
    return generateDeterministicRecommendation(clinicalAnalysis);
  }
}

function generateDeterministicRecommendation(analysis: ClinicalAnalysis): ClinicalRecommendation {
  return {
    analysis: analysis.technicalSummary,
    mainRecommendation: analysis.insulinRecommendation,
    justification: `Análise baseada nas Diretrizes Brasileiras para DMG. ` +
      `Métricas: ${analysis.percentInTarget}% na meta, ${analysis.percentAboveTarget}% acima da meta, média ${analysis.averageGlucose} mg/dL. ` +
      (analysis.rulesTrigggered.length > 0 
        ? `Regras clínicas aplicadas: ${analysis.rulesTrigggered.join(", ")}.`
        : "Controle glicêmico adequado conforme metas estabelecidas."),
    nextSteps: analysis.recommendedActions,
    urgencyLevel: analysis.urgencyLevel,
    guidelineReferences: analysis.rulesTrigggered,
  };
}

// Fallback recommendation when AI is unavailable or fails
function generateFallbackRecommendation(evaluation: PatientEvaluation): ClinicalRecommendation {
  const percentInTarget = calculateGlucosePercentageInTarget(evaluation.glucoseReadings);
  const avgGlucose = calculateAverageGlucose(evaluation.glucoseReadings);
  const criticalAlerts = checkCriticalGlucose(evaluation.glucoseReadings);
  
  let urgencyLevel: "info" | "warning" | "critical" = "info";
  let mainRecommendation = "";
  let analysis = "";
  const nextSteps: string[] = [];
  const guidelineReferences: string[] = [];

  // Check for critical glucose values first - these override everything else
  const hasHypoglycemia = criticalAlerts.some(a => a.type === "hypoglycemia");
  const hasSevereHyperglycemia = criticalAlerts.some(a => a.type === "severe_hyperglycemia");

  if (hasHypoglycemia || hasSevereHyperglycemia) {
    urgencyLevel = "critical";
    
    if (hasHypoglycemia) {
      const hypoAlerts = criticalAlerts.filter(a => a.type === "hypoglycemia");
      analysis = `ATENÇÃO: Detectada hipoglicemia (<${criticalGlucoseThresholds.hypo} mg/dL) em ${hypoAlerts.length} ocasião(ões). `;
      mainRecommendation = "Investigar causa de hipoglicemia imediatamente. Risco de comprometimento fetal e materno.";
      nextSteps.push("Revisar doses de insulina - possível excesso");
      nextSteps.push("Avaliar padrão alimentar e horários de refeições");
      nextSteps.push("Orientar sobre reconhecimento e tratamento de hipoglicemia");
      nextSteps.push("Considerar redução de 10-20% na dose de insulina relacionada");
    }
    
    if (hasSevereHyperglycemia) {
      const hyperAlerts = criticalAlerts.filter(a => a.type === "severe_hyperglycemia");
      analysis += `ATENÇÃO: Detectada hiperglicemia severa (>${criticalGlucoseThresholds.severeHyper} mg/dL) em ${hyperAlerts.length} ocasião(ões). `;
      mainRecommendation = "Controle glicêmico severamente inadequado. Ação imediata necessária para prevenir complicações.";
      nextSteps.push("Aumentar doses de insulina em 20-30%");
      nextSteps.push("Avaliar adesão à dieta e orientação nutricional");
      nextSteps.push("Considerar hospitalização se persistência");
      guidelineReferences.push("R2", "R4", "R6");
    }
    
    nextSteps.push("Reavaliar em 3-5 dias ou antes se sintomas");
    return {
      analysis: analysis + `Paciente ${evaluation.patientName} apresenta ${percentInTarget}% das medidas na meta, com média de ${avgGlucose} mg/dL.`,
      mainRecommendation,
      justification: "Valores críticos de glicemia detectados requerem ação imediata conforme protocolo de segurança.",
      nextSteps,
      urgencyLevel,
      guidelineReferences,
    };
  }

  if (percentInTarget >= 70) {
    urgencyLevel = "info";
    analysis = `Paciente ${evaluation.patientName} apresenta ${percentInTarget}% das medidas glicêmicas dentro da meta, com média de ${avgGlucose} mg/dL. Controle glicêmico adequado.`;
    mainRecommendation = "Manter conduta atual. Controle glicêmico está adequado.";
    nextSteps.push("Continuar monitoramento glicêmico diário");
    nextSteps.push("Manter orientação nutricional");
    if (evaluation.gestationalWeeks >= 30) {
      nextSteps.push("Reavaliar semanalmente conforme protocolo");
    } else {
      nextSteps.push("Reavaliar em 15 dias");
    }
  } else if (percentInTarget >= 50) {
    urgencyLevel = "warning";
    analysis = `Paciente ${evaluation.patientName} apresenta ${percentInTarget}% das medidas glicêmicas dentro da meta, com média de ${avgGlucose} mg/dL. Controle glicêmico parcialmente adequado.`;
    
    if (!evaluation.usesInsulin) {
      mainRecommendation = "Considerar início de terapia farmacológica com insulina, conforme R1. Mais de 30% das medidas estão fora da meta.";
      guidelineReferences.push("R1", "R2");
      nextSteps.push("Avaliar início de insulina NPH/Regular");
      nextSteps.push("Dose inicial sugerida: 0,5 UI/kg/dia");
    } else {
      mainRecommendation = "Ajustar doses de insulina. Aumentar 10-20% nas doses relacionadas aos horários com valores elevados.";
      guidelineReferences.push("R4", "R5");
      nextSteps.push("Identificar horários com glicemias mais elevadas");
      nextSteps.push("Ajustar dose de insulina correspondente");
    }
    nextSteps.push("Reforçar orientação nutricional");
  } else {
    urgencyLevel = "critical";
    analysis = `Paciente ${evaluation.patientName} apresenta apenas ${percentInTarget}% das medidas glicêmicas dentro da meta, com média de ${avgGlucose} mg/dL. Controle glicêmico inadequado, necessária ação imediata.`;
    
    if (!evaluation.usesInsulin) {
      mainRecommendation = "Iniciar insulinoterapia imediatamente. Controle muito inadequado com alto risco de complicações perinatais.";
      guidelineReferences.push("R1", "R2", "R4");
      nextSteps.push("Iniciar insulina NPH e/ou Regular");
      nextSteps.push("Dose inicial: 0,5 UI/kg/dia");
      nextSteps.push("Considerar análogos de ação rápida se difícil controle pós-prandial (R6)");
    } else {
      mainRecommendation = "Ajuste urgente das doses de insulina. Considerar mudança de esquema ou adição de análogo de ação rápida.";
      guidelineReferences.push("R4", "R5", "R6");
      nextSteps.push("Aumentar doses de insulina em 20%");
      nextSteps.push("Avaliar necessidade de adicionar insulina ultrarrápida");
      nextSteps.push("Considerar avaliação especializada");
    }
    nextSteps.push("Reavaliar em 7 dias");
  }

  // Check abdominal circumference criteria (R3)
  if (evaluation.abdominalCircumferencePercentile && evaluation.abdominalCircumferencePercentile >= 75) {
    if (evaluation.gestationalWeeks >= 29 && evaluation.gestationalWeeks <= 33) {
      if (!evaluation.usesInsulin) {
        mainRecommendation += " Circunferência abdominal fetal ≥ percentil 75 indica início de insulina independente dos valores glicêmicos (R3).";
        guidelineReferences.push("R3");
      }
    }
  }

  return {
    analysis,
    mainRecommendation,
    justification: `Recomendação baseada nas Diretrizes Brasileiras para DMG. ${percentInTarget}% das medidas estão dentro da meta glicêmica estabelecida (jejum ≤95 mg/dL, 1h pós-prandial ≤140 mg/dL, 2h pós-prandial ≤120 mg/dL).`,
    nextSteps,
    urgencyLevel,
    guidelineReferences: Array.from(new Set(guidelineReferences)),
  };
}
