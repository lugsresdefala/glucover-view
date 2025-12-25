import OpenAI from "openai";
import type { PatientEvaluation, ClinicalRecommendation, GlucoseReading, CriticalAlert } from "@shared/schema";
import { glucoseTargets, calculateGlucosePercentageInTarget, calculateAverageGlucose, checkCriticalGlucose, criticalGlucoseThresholds } from "@shared/schema";
import { generateClinicalAnalysis, formatAnalysisForAI, type ClinicalAnalysis } from "./clinical-engine";

const openaiApiKey =
  process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl =
  process.env.OPENAI_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

const openai = openaiApiKey
  ? new OpenAI({
      baseURL: openaiBaseUrl,
      apiKey: openaiApiKey,
    })
  : null;

const CLINICAL_PROMPT = `Você é um endocrinologista especialista em diabetes na gestação. 
Escreva recomendações clínicas em linguagem NATURAL e PROFISSIONAL, como um parecer médico real.

REGRAS DE ESCRITA:
- Use linguagem fluida, não robótica
- Evite repetições
- Seja direto e objetivo
- Use frases completas, não tópicos soltos
- Mantenha coerência entre análise e conduta
- NUNCA contradiga a si mesmo

FORMATO OBRIGATÓRIO (JSON):
{
  "resumoExecutivo": "Parágrafo único resumindo: estado do controle glicêmico, idade gestacional, e conduta principal indicada. Máximo 3 linhas.",
  "interpretacaoClinica": "Análise dos dados em linguagem médica natural. Explique O QUE os números significam clinicamente, não apenas liste-os.",
  "condutaTerapeutica": "Recomendação terapêutica específica com doses quando aplicável. Se indica insulina, forneça doses em UI. Se ajuste, especifique qual insulina e quanto aumentar/reduzir.",
  "fundamentacao": "Justificativa breve citando as diretrizes (SBD, FEBRASGO, OMS) que embasam a conduta.",
  "urgencyLevel": "info | warning | critical",
  "proximosPassos": ["Lista de 2-4 ações práticas prioritárias"]
}

METAS GLICÊMICAS (SBD 2025):
- Jejum: 65-95 mg/dL
- 1h pós-prandial: <140 mg/dL
- Pré-prandial/Madrugada: <100 mg/dL

CRITÉRIOS PARA INSULINA (SBD-R1):
- ≥30% das medidas acima da meta após 7-14 dias de dieta
- Dose inicial: 0,5 UI/kg/dia (SBD-R4)

AJUSTES DE INSULINA:
- Jejum alto → NPH noturna
- Pós-café alto → Rápida manhã
- Pós-almoço alto → Rápida almoço
- Pós-jantar alto → Rápida jantar
- Aumento típico: 10-20% da dose

COERÊNCIA OBRIGATÓRIA:
- Se urgencyLevel="critical" → conduta deve refletir urgência
- Se urgencyLevel="info" → não alarmar desnecessariamente
- Se indica manter conduta → não sugerir ajustes no mesmo texto`;

export async function generateClinicalRecommendation(
  evaluation: PatientEvaluation
): Promise<ClinicalRecommendation> {
  const clinicalAnalysis = generateClinicalAnalysis(evaluation);
  
  if (!openai) {
    const { logger } = await import("./logger");
    logger.warn("OpenAI integration not configured, using deterministic recommendation", {
      patientName: evaluation.patientName,
      gestationalWeeks: evaluation.gestationalWeeks,
    });
    return generateDeterministicRecommendation(clinicalAnalysis, evaluation);
  }

  const analysisData = formatAnalysisForAI(clinicalAnalysis);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CLINICAL_PROMPT },
        { role: "user", content: analysisData },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    const parsed = JSON.parse(content);
    
    return formatAIResponse(parsed, clinicalAnalysis);
  } catch (error) {
    const { logger } = await import("./logger");
    logger.error("Error with AI generation, using deterministic fallback", error as Error, {
      patientName: evaluation.patientName,
      gestationalWeeks: evaluation.gestationalWeeks,
    });
    return generateDeterministicRecommendation(clinicalAnalysis, evaluation);
  }
}

function formatAIResponse(parsed: any, analysis: ClinicalAnalysis): ClinicalRecommendation {
  const ruleIds = analysis.rulesTriggered.map(r => r.id);
  
  const fullAnalysis = [
    parsed.resumoExecutivo || "",
    "",
    parsed.interpretacaoClinica || "",
  ].filter(Boolean).join("\n\n");
  
  return {
    analysis: fullAnalysis || analysis.technicalSummary,
    mainRecommendation: parsed.condutaTerapeutica || analysis.insulinRecommendation,
    justification: parsed.fundamentacao || `Baseado nas Diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025.`,
    nextSteps: Array.isArray(parsed.proximosPassos) && parsed.proximosPassos.length > 0 
      ? parsed.proximosPassos 
      : analysis.recommendedActions,
    urgencyLevel: validateUrgencyLevel(parsed.urgencyLevel, analysis.urgencyLevel),
    guidelineReferences: ruleIds.length > 0 ? ruleIds : [],
  };
}

function validateUrgencyLevel(
  aiLevel: string | undefined, 
  calculatedLevel: "info" | "warning" | "critical"
): "info" | "warning" | "critical" {
  if (aiLevel === "info" || aiLevel === "warning" || aiLevel === "critical") {
    return aiLevel;
  }
  return calculatedLevel;
}

function generateDeterministicRecommendation(
  analysis: ClinicalAnalysis, 
  evaluation: PatientEvaluation
): ClinicalRecommendation {
  const criticalAlerts = checkCriticalGlucose(evaluation.glucoseReadings);
  const hasHypo = criticalAlerts.some(a => a.type === "hypoglycemia");
  const hasSevereHyper = criticalAlerts.some(a => a.type === "severe_hyperglycemia");
  
  let resumo = "";
  let interpretacao = "";
  let conduta = "";
  let fundamentacao = "";
  const nextSteps: string[] = [];
  let urgency: "info" | "warning" | "critical" = analysis.urgencyLevel;
  
  const igText = `${evaluation.gestationalWeeks} semanas e ${evaluation.gestationalDays} dias`;
  const diasAnalise = evaluation.glucoseReadings.length;
  
  if (hasHypo || hasSevereHyper) {
    urgency = "critical";
    
    if (hasHypo && hasSevereHyper) {
      resumo = `Paciente com ${igText} de idade gestacional apresenta controle glicêmico instável com episódios de hipoglicemia E hiperglicemia severa. Requer ajuste imediato do esquema terapêutico.`;
      interpretacao = `A análise de ${diasAnalise} dias revela padrão de grande variabilidade glicêmica. Foram detectados ${criticalAlerts.filter(a => a.type === "hypoglycemia").length} episódio(s) de hipoglicemia (<65 mg/dL) e ${criticalAlerts.filter(a => a.type === "severe_hyperglycemia").length} episódio(s) de hiperglicemia severa (>200 mg/dL). Esta instabilidade representa risco tanto materno quanto fetal.`;
      conduta = `Revisar esquema de insulinoterapia com urgência. Avaliar horários de aplicação e alimentação. Considerar ajuste das doses com base no perfil glicêmico: reduzir dose nos horários com hipoglicemia e aumentar nos horários com hiperglicemia.`;
      nextSteps.push("Revisar doses de insulina por período");
      nextSteps.push("Avaliar padrão alimentar e horários de refeições");
      nextSteps.push("Orientar sobre reconhecimento de hipoglicemia");
      nextSteps.push("Reavaliar em 3-5 dias");
    } else if (hasHypo) {
      const hypoCount = criticalAlerts.filter(a => a.type === "hypoglycemia").length;
      resumo = `Paciente com ${igText} apresenta ${hypoCount} episódio(s) de hipoglicemia. Necessário ajuste do tratamento para evitar risco materno-fetal.`;
      interpretacao = `A análise de ${diasAnalise} dias identificou episódios de glicemia <65 mg/dL, configurando hipoglicemia. ${evaluation.usesInsulin ? "Como a paciente está em uso de insulina, há possível excesso de dose." : "A causa deve ser investigada."}`;
      conduta = evaluation.usesInsulin 
        ? `Reduzir dose de insulina em 10-20% no período relacionado à hipoglicemia. Avaliar ajuste do plano alimentar.`
        : `Investigar causa da hipoglicemia. Avaliar padrão alimentar e intervalo entre refeições.`;
      nextSteps.push("Revisar doses de insulina");
      nextSteps.push("Orientar tratamento de hipoglicemia (15g carboidrato)");
      nextSteps.push("Reavaliar em 3-5 dias");
    } else if (hasSevereHyper) {
      const hyperCount = criticalAlerts.filter(a => a.type === "severe_hyperglycemia").length;
      resumo = `Paciente com ${igText} apresenta ${hyperCount} episódio(s) de hiperglicemia severa (>200 mg/dL). Controle glicêmico inadequado requerendo intervenção imediata.`;
      interpretacao = `A análise de ${diasAnalise} dias revela glicemias muito elevadas, acima de 200 mg/dL. Este nível de descontrole está associado a risco aumentado de complicações fetais, incluindo macrossomia e complicações neonatais.`;
      conduta = evaluation.usesInsulin 
        ? `Aumentar doses de insulina em 20-30%. Se persistência, considerar internação para ajuste intensivo.`
        : `Iniciar insulinoterapia com urgência. Dose inicial sugerida: 0,5 UI/kg/dia (SBD-R4).`;
      nextSteps.push("Aumentar doses de insulina");
      nextSteps.push("Reforçar orientação dietética");
      nextSteps.push("Considerar avaliação hospitalar se persistência");
      nextSteps.push("Reavaliar em 3-5 dias");
    }
    fundamentacao = "Valores críticos de glicemia requerem intervenção imediata para prevenção de complicações materno-fetais (SBD 2025, FEBRASGO 2019).";
  } else if (analysis.percentInTarget >= 70) {
    urgency = "info";
    resumo = `Paciente com ${igText} apresenta bom controle glicêmico, com ${analysis.percentInTarget}% das medidas dentro da meta. ${evaluation.usesInsulin ? "Manter esquema atual de insulinoterapia." : "Manter acompanhamento com medidas não-farmacológicas."}`;
    interpretacao = `A análise de ${diasAnalise} dias demonstra controle glicêmico adequado, com média de ${analysis.averageGlucose} mg/dL. Os valores estão predominantemente dentro das metas estabelecidas pelas diretrizes brasileiras.`;
    conduta = evaluation.usesInsulin 
      ? `Manter esquema de insulinoterapia atual. Controle glicêmico está adequado.`
      : `Manter orientação dietética e atividade física. Não há indicação de insulinoterapia no momento.`;
    nextSteps.push("Manter monitoramento glicêmico conforme protocolo");
    nextSteps.push("Continuar orientação nutricional");
    if (evaluation.gestationalWeeks >= 32) {
      nextSteps.push("Intensificar vigilância fetal");
      nextSteps.push("Reavaliar semanalmente");
    } else {
      nextSteps.push("Reavaliar em 15 dias");
    }
    fundamentacao = `Controle adequado conforme metas SBD 2025 (jejum 65-95, 1h pós-prandial <140 mg/dL). ${evaluation.gestationalWeeks >= 32 ? "Vigilância fetal intensificada após 32 semanas (FEBRASGO-F8)." : ""}`;
  } else if (analysis.percentInTarget >= 50) {
    urgency = "warning";
    resumo = `Paciente com ${igText} apresenta controle glicêmico parcial, com ${analysis.percentAboveTarget}% das medidas acima da meta. ${evaluation.usesInsulin ? "Necessário ajuste do esquema de insulina." : "Considerar início de insulinoterapia."}`;
    const periodInfo = generatePeriodAnalysis(analysis);
    interpretacao = `A análise de ${diasAnalise} dias revela ${analysis.percentAboveTarget}% das medidas acima da meta, com média de ${analysis.averageGlucose} mg/dL.${periodInfo ? " " + periodInfo : ""}`;
    
    if (evaluation.usesInsulin) {
      conduta = generateInsulinAdjustmentRecommendation(analysis, evaluation);
      nextSteps.push("Ajustar doses de insulina conforme recomendado");
    } else {
      conduta = `Indicado início de insulinoterapia. Mais de 30% das medidas estão fora da meta após período de terapia não-farmacológica, cumprindo critério SBD-R1.${evaluation.weight ? ` Dose inicial sugerida: ${Math.round(evaluation.weight * 0.5)} UI/dia (0,5 UI/kg).` : " Dose inicial: 0,5 UI/kg/dia."}`;
      nextSteps.push("Iniciar insulinoterapia conforme dose sugerida");
    }
    nextSteps.push("Reavaliar em 7-14 dias para ajuste de dose");
    if (evaluation.gestationalWeeks >= 29) {
      nextSteps.push("Intensificar vigilância fetal");
    }
    fundamentacao = `Conforme SBD-R1, ${analysis.percentAboveTarget}% das medidas acima da meta após terapia não-farmacológica justifica intervenção farmacológica. Insulina é primeira escolha (SBD-R2, Classe I, Nível A).`;
  } else {
    urgency = "critical";
    resumo = `Paciente com ${igText} apresenta controle glicêmico inadequado, com apenas ${analysis.percentInTarget}% das medidas na meta. Intervenção terapêutica necessária com urgência.`;
    const periodInfo2 = generatePeriodAnalysis(analysis);
    interpretacao = `A análise de ${diasAnalise} dias revela descontrole glicêmico significativo, com ${analysis.percentAboveTarget}% das medidas acima da meta e média de ${analysis.averageGlucose} mg/dL.${periodInfo2 ? " " + periodInfo2 : ""}`;
    
    if (evaluation.usesInsulin) {
      conduta = `Intensificar esquema de insulinoterapia. Aumentar doses em 20-30% nos períodos com maior descontrole. ${generateInsulinAdjustmentRecommendation(analysis, evaluation)}`;
    } else {
      conduta = `Início imediato de insulinoterapia. ${evaluation.weight ? `Dose inicial: ${Math.round(evaluation.weight * 0.5)} UI/dia (0,5 UI/kg), distribuída conforme perfil glicêmico.` : "Dose inicial: 0,5 UI/kg/dia (SBD-R4)."}`;
    }
    nextSteps.push("Iniciar ou intensificar insulinoterapia");
    nextSteps.push("Reforçar orientação nutricional");
    nextSteps.push("Reavaliar em 7 dias");
    nextSteps.push("Intensificar vigilância fetal");
    fundamentacao = `Descontrole glicêmico importante requer intervenção imediata conforme SBD-R1 e SBD-R2. Metas não atingidas associam-se a risco aumentado de complicações materno-fetais.`;
  }

  const ruleIds = analysis.rulesTriggered.map(r => r.id);
  
  return {
    analysis: `${resumo}\n\n${interpretacao}`,
    mainRecommendation: conduta,
    justification: fundamentacao,
    nextSteps,
    urgencyLevel: urgency,
    guidelineReferences: ruleIds,
  };
}

function generatePeriodAnalysis(analysis: ClinicalAnalysis): string {
  if (!analysis.analysisByPeriod || analysis.analysisByPeriod.length === 0) {
    return "";
  }
  
  const problems: string[] = [];
  
  analysis.analysisByPeriod.forEach(period => {
    if (period.percentAbove > 30) {
      problems.push(`${period.period}: ${period.percentAbove}% acima da meta (média ${Math.round(period.average)} mg/dL)`);
    }
  });
  
  if (problems.length === 0) {
    return "";
  } else if (problems.length === 1) {
    return `Período com maior descontrole: ${problems[0]}.`;
  } else {
    return `Períodos com descontrole: ${problems.join("; ")}.`;
  }
}

function generateInsulinAdjustmentRecommendation(analysis: ClinicalAnalysis, evaluation: PatientEvaluation): string {
  if (!analysis.analysisByPeriod || analysis.analysisByPeriod.length === 0) {
    return "Avaliar perfil glicêmico para determinar ajustes específicos.";
  }
  
  const adjustments: string[] = [];
  
  analysis.analysisByPeriod.forEach(period => {
    if (period.percentAbove > 40) {
      switch (period.period) {
        case "Jejum":
          adjustments.push("aumentar NPH noturna em 2-4 UI");
          break;
        case "1h pós-café":
          adjustments.push("aumentar insulina rápida da manhã em 1-2 UI");
          break;
        case "1h pós-almoço":
          adjustments.push("aumentar insulina rápida do almoço em 1-2 UI");
          break;
        case "1h pós-jantar":
          adjustments.push("aumentar insulina rápida do jantar em 1-2 UI");
          break;
      }
    }
  });
  
  if (adjustments.length === 0) {
    return "Avaliar perfil glicêmico para determinar ajustes específicos.";
  }
  
  return `Sugestão de ajuste: ${adjustments.join("; ")}.`;
}
