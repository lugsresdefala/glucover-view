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
Escreva recomendações clínicas em linguagem TÉCNICA e OBJETIVA, como um parecer médico formal.

REGRAS DE ESCRITA OBRIGATÓRIAS:
- Tom NEUTRO e DESCRITIVO - apenas fatos e dados
- PROIBIDO: adjetivos avaliativos (excelente, ótimo, preocupante, alarmante, impressionante)
- PROIBIDO: juízos de valor (parabéns, muito bem, cuidado, atenção)
- PROIBIDO: linguagem sensacionalista ou superlativa
- Use apenas: "adequado/inadequado", "dentro/fora da meta", "estável/variável"
- Seja ESPECÍFICO com números e dados concretos
- Analise TANTO o panorama geral QUANTO os últimos 7 dias separadamente
- Identifique TENDÊNCIAS de forma objetiva (melhora/piora/estabilidade)
- NUNCA contradiga a si mesmo

FORMATO OBRIGATÓRIO (JSON):
{
  "panoramaGeral": {
    "resumo": "Descrição objetiva do controle glicêmico no período total (máximo 3 frases, sem adjetivos avaliativos).",
    "analise": "Dados numéricos: % na meta, médias por período, número de episódios fora da meta."
  },
  "ultimosSeteDias": {
    "resumo": "Descrição objetiva dos últimos 7 dias com dados numéricos.",
    "tendencia": "MELHORA | PIORA | ESTÁVEL - justificativa baseada em números (ex: média passou de X para Y).",
    "comparativo": "Comparação numérica: médias e % na meta dos 7 dias vs período total.",
    "analise": "Dados dia-a-dia: valores específicos, períodos com maior variação."
  },
  "condutaTerapeutica": {
    "imediata": "Conduta específica com doses em UI e horários. Sem linguagem alarmista.",
    "continuada": "Estratégia de médio prazo em tom descritivo."
  },
  "fundamentacao": "Citação das diretrizes SBD 2025, FEBRASGO 2019 e/ou OMS 2025 com códigos (ex: SBD-R4).",
  "urgencyLevel": "info | warning | critical",
  "proximosPassos": ["Lista de 3-5 ações específicas com parâmetros mensuráveis"]
}

METAS GLICÊMICAS (SBD 2025):
- Jejum: 65-95 mg/dL
- 1h pós-prandial: <140 mg/dL
- Pré-prandial/Madrugada: <100 mg/dL

CRITÉRIOS PARA INSULINA (SBD-R1):
- ≥30% das medidas acima da meta após 7-14 dias de dieta
- Dose inicial: 0,5 UI/kg/dia (SBD-R4)

AJUSTES DE INSULINA:
- Jejum alto → NPH noturna (+10-20%)
- Pós-café alto → Rápida manhã (+10-20%)
- Pós-almoço alto → Rápida almoço (+10-20%)
- Pós-jantar alto → Rápida jantar (+10-20%)

COERÊNCIA OBRIGATÓRIA:
- Se urgencyLevel="critical" → conduta objetiva com ajustes de dose
- Se urgencyLevel="info" → manter conduta atual
- Se tendência de PIORA → indicar ajuste de dose específico
- Se tendência de MELHORA → manter esquema, continuar monitorização

DETALHAMENTO: Analise os últimos 7 dias com dados numéricos específicos.`;

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
  
  // Build panorama geral section
  let panoramaGeral = "";
  if (parsed.panoramaGeral) {
    panoramaGeral = `PANORAMA GERAL\n\n${parsed.panoramaGeral.resumo || ""}\n\n${parsed.panoramaGeral.analise || ""}`;
  } else if (parsed.resumoExecutivo) {
    panoramaGeral = `PANORAMA GERAL\n\n${parsed.resumoExecutivo}\n\n${parsed.interpretacaoClinica || ""}`;
  }
  
  // Build últimos 7 dias section
  let ultimos7Dias = "";
  if (parsed.ultimosSeteDias) {
    const u7 = parsed.ultimosSeteDias;
    ultimos7Dias = `ÚLTIMOS 7 DIAS\n\n`;
    if (u7.resumo) ultimos7Dias += `${u7.resumo}\n\n`;
    if (u7.tendencia) ultimos7Dias += `Tendência: ${u7.tendencia}\n\n`;
    if (u7.comparativo) ultimos7Dias += `${u7.comparativo}\n\n`;
    if (u7.analise) ultimos7Dias += `${u7.analise}`;
  } else if (analysis.sevenDayAnalysis) {
    const s7 = analysis.sevenDayAnalysis;
    ultimos7Dias = `ÚLTIMOS 7 DIAS\n\n`;
    ultimos7Dias += `${s7.trendDescription}\n\n`;
    ultimos7Dias += `Média glicêmica: ${s7.averageGlucose} mg/dL (${s7.percentInTarget}% na meta)`;
  }
  
  const fullAnalysis = [panoramaGeral, ultimos7Dias].filter(Boolean).join("\n\n---\n\n");
  
  // Build conduta
  let conduta = "";
  if (parsed.condutaTerapeutica) {
    if (typeof parsed.condutaTerapeutica === "object") {
      if (parsed.condutaTerapeutica.imediata) conduta += `Conduta Imediata: ${parsed.condutaTerapeutica.imediata}\n\n`;
      if (parsed.condutaTerapeutica.continuada) conduta += `Estratégia Continuada: ${parsed.condutaTerapeutica.continuada}`;
    } else {
      conduta = parsed.condutaTerapeutica;
    }
  } else {
    conduta = analysis.insulinRecommendation;
  }
  
  return {
    analysis: fullAnalysis || analysis.technicalSummary,
    mainRecommendation: conduta.trim(),
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
  
  const nextSteps: string[] = [];
  let urgency: "info" | "warning" | "critical" = analysis.urgencyLevel;
  
  const igText = `${evaluation.gestationalWeeks} semanas e ${evaluation.gestationalDays} dias`;
  const diasAnalise = evaluation.glucoseReadings.length;
  const s7 = analysis.sevenDayAnalysis;
  
  // ============== PANORAMA GERAL ==============
  let panoramaResumo = "";
  let panoramaAnalise = "";
  
  if (hasHypo || hasSevereHyper) {
    urgency = "critical";
    const hypoCount = criticalAlerts.filter(a => a.type === "hypoglycemia").length;
    const hyperCount = criticalAlerts.filter(a => a.type === "severe_hyperglycemia").length;
    
    panoramaResumo = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    
    if (hasHypo && hasSevereHyper) {
      panoramaAnalise = `Perfil glicêmico com variabilidade: ${hypoCount} episódio(s) de hipoglicemia (<65 mg/dL) e ${hyperCount} episódio(s) de hiperglicemia (>200 mg/dL). Média glicêmica: ${analysis.averageGlucose} mg/dL. Percentual na meta: ${analysis.percentInTarget}%.`;
    } else if (hasHypo) {
      panoramaAnalise = `Registrados ${hypoCount} episódio(s) de hipoglicemia (<65 mg/dL). ${evaluation.usesInsulin ? "Avaliar dose de insulina e esquema alimentar." : "Avaliar padrão alimentar e atividade física."} Média glicêmica: ${analysis.averageGlucose} mg/dL. Percentual na meta: ${analysis.percentInTarget}%.`;
    } else {
      panoramaAnalise = `Registrados ${hyperCount} episódio(s) de hiperglicemia (>200 mg/dL). Média glicêmica: ${analysis.averageGlucose} mg/dL. Percentual na meta: ${analysis.percentInTarget}%.`;
    }
  } else if (analysis.percentInTarget >= 70) {
    urgency = "info";
    panoramaResumo = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    panoramaAnalise = `Percentual na meta: ${analysis.percentInTarget}% (metas: jejum 65-95, 1h pós-prandial <140 mg/dL). Média glicêmica: ${analysis.averageGlucose} mg/dL. ${evaluation.usesInsulin ? "Manter esquema de insulinoterapia atual." : "Manter manejo nutricional atual."}`;
  } else if (analysis.percentInTarget >= 50) {
    urgency = "warning";
    const periodInfo = generatePeriodAnalysis(analysis);
    panoramaResumo = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    panoramaAnalise = `Percentual na meta: ${analysis.percentInTarget}%. Percentual acima da meta: ${analysis.percentAboveTarget}%. Média glicêmica: ${analysis.averageGlucose} mg/dL. ${periodInfo}`;
  } else {
    urgency = "critical";
    const periodInfo2 = generatePeriodAnalysis(analysis);
    panoramaResumo = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    panoramaAnalise = `Percentual na meta: ${analysis.percentInTarget}%. Percentual acima da meta: ${analysis.percentAboveTarget}%. Média glicêmica: ${analysis.averageGlucose} mg/dL. ${periodInfo2}`;
  }
  
  // ============== ÚLTIMOS 7 DIAS ==============
  let ultimos7Resumo = "";
  let ultimos7Tendencia = "";
  let ultimos7Comparativo = "";
  let ultimos7Analise = "";
  
  if (s7) {
    const tendenciaLabel = s7.trend === "improving" ? "MELHORA" : s7.trend === "worsening" ? "PIORA" : "ESTÁVEL";
    
    ultimos7Resumo = `Nos últimos 7 dias, a paciente apresenta ${s7.percentInTarget}% das medidas na meta, com média glicêmica de ${s7.averageGlucose} mg/dL.`;
    
    ultimos7Tendencia = `${tendenciaLabel}: ${s7.trendDescription}`;
    
    // Comparativo detalhado
    const diffPercent = s7.percentInTarget - analysis.percentInTarget;
    const diffMedia = s7.averageGlucose - analysis.averageGlucose;
    if (diffPercent > 5) {
      ultimos7Comparativo = `Melhora recente: percentual na meta subiu de ${analysis.percentInTarget}% (geral) para ${s7.percentInTarget}% (últimos 7 dias). Média glicêmica ${diffMedia < 0 ? `reduziu ${Math.abs(diffMedia)} mg/dL` : `aumentou ${diffMedia} mg/dL`}.`;
    } else if (diffPercent < -5) {
      ultimos7Comparativo = `Piora recente: percentual na meta caiu de ${analysis.percentInTarget}% (geral) para ${s7.percentInTarget}% (últimos 7 dias). Média glicêmica ${diffMedia > 0 ? `aumentou ${diffMedia} mg/dL` : `reduziu ${Math.abs(diffMedia)} mg/dL`}.`;
    } else {
      ultimos7Comparativo = `Padrão consistente: percentual na meta mantido em torno de ${s7.percentInTarget}% nos últimos 7 dias, similar ao período total (${analysis.percentInTarget}%). Média glicêmica estável em ${s7.averageGlucose} mg/dL.`;
    }
    
    // Análise dia-a-dia
    if (s7.dailyAverages.length > 0) {
      const dailyDetails = s7.dailyAverages.map(d => 
        `Dia ${d.day}: ${d.average} mg/dL (${d.inTarget}/${d.total} na meta)`
      ).join("; ");
      ultimos7Analise = `Evolução diária: ${dailyDetails}.`;
      
      // Períodos com mudança
      const worsePeriods = s7.periodComparison.filter(p => p.change === "worse");
      const betterPeriods = s7.periodComparison.filter(p => p.change === "better");
      
      if (worsePeriods.length > 0) {
        ultimos7Analise += ` Períodos com aumento recente: ${worsePeriods.map(p => `${p.period} (${p.overall}→${p.last7Days} mg/dL)`).join(", ")}.`;
      }
      if (betterPeriods.length > 0) {
        ultimos7Analise += ` Períodos com redução recente: ${betterPeriods.map(p => `${p.period} (${p.overall}→${p.last7Days} mg/dL)`).join(", ")}.`;
      }
    }
    
    // Alertas recentes
    if (s7.criticalAlerts.length > 0) {
      const hypoRecent = s7.criticalAlerts.filter(a => a.type === "hypoglycemia").length;
      const hyperRecent = s7.criticalAlerts.filter(a => a.type === "severe_hyperglycemia").length;
      if (hypoRecent > 0) ultimos7Analise += ` Hipoglicemia: ${hypoRecent} episódio(s) nos últimos 7 dias.`;
      if (hyperRecent > 0) ultimos7Analise += ` Hiperglicemia >200: ${hyperRecent} episódio(s) nos últimos 7 dias.`;
    }
  } else {
    ultimos7Resumo = `Período de análise inferior a 7 dias (${diasAnalise} dias disponíveis).`;
    ultimos7Tendencia = "Dados insuficientes para análise de tendência detalhada.";
    ultimos7Comparativo = "Comparativo não disponível com menos de 7 dias de dados.";
    ultimos7Analise = "Recomenda-se continuar monitoramento para permitir análise de tendência mais robusta.";
  }
  
  // ============== CONDUTA TERAPÊUTICA ==============
  // Use 7-day trend to inform immediate actions
  // Refined trend detection: consider BOTH percent-in-target AND average changes to avoid misclassification
  const recentTrend = s7?.trend || "stable";
  const recent7DayPercent = s7?.percentInTarget ?? analysis.percentInTarget;
  const percentDelta = s7 ? (s7.percentInTarget - analysis.percentInTarget) : 0;
  const avgDelta = s7 ? (s7.averageGlucose - analysis.averageGlucose) : 0;
  
  // Worsening: either explicit trend OR significant drop in percent-in-target AND higher average
  const isRecentWorsening = (
    recentTrend === "worsening" ||
    (s7 && percentDelta < -10 && avgDelta > 5)
  );
  // Improving: either explicit trend OR significant increase in percent-in-target AND lower average
  const isRecentImproving = (
    recentTrend === "improving" ||
    (s7 && percentDelta > 10 && avgDelta < -5)
  );
  
  let condutaImediata = "";
  let condutaContinuada = "";
  let fundamentacao = "";
  
  // Get 7-day specific period issues for targeted adjustments - always include when worsening
  const sevenDayWorseningPeriods = s7?.periodComparison?.filter(p => p.change === "worse") || [];
  const sevenDayAdjustments = sevenDayWorseningPeriods.length > 0 
    ? `Atenção especial aos períodos com piora recente: ${sevenDayWorseningPeriods.map(p => `${p.period} (${p.overall}→${p.last7Days} mg/dL)`).join(", ")}.`
    : (isRecentWorsening && s7 ? `Piora observada na média geral (${analysis.averageGlucose}→${s7.averageGlucose} mg/dL nos últimos 7 dias).` : "");
  
  // Verificar padrão recorrente de hipoglicemia antes de recomendar redução de dose
  const hypoPattern = hasRecurrentHypoglycemia(analysis);
  
  if (hasHypo || hasSevereHyper) {
    if (hasHypo && hasSevereHyper) {
      const insulinAdjust = generateInsulinAdjustmentRecommendation(analysis, evaluation);
      condutaImediata = `REVISÃO DO ESQUEMA INSULÍNICO. Perfil instável com variabilidade glicêmica significativa. ${insulinAdjust}`;
      condutaContinuada = `Reavaliação em 3-5 dias. Ajuste individual por período para reduzir oscilação glicêmica.`;
      nextSteps.push("Mapear horários específicos de hipo e hiperglicemia");
      nextSteps.push("Ajustar insulina por período conforme indicado");
      nextSteps.push("Revisar técnica de aplicação e armazenamento");
      nextSteps.push("Orientar tratamento de hipoglicemia (15g carboidrato)");
      nextSteps.push("Reavaliar em 3-5 dias");
    } else if (hasHypo) {
      // Hipoglicemia isolada NÃO justifica alteração de dose - apenas padrão recorrente
      if (hypoPattern.hasPattern && evaluation.usesInsulin) {
        // Padrão recorrente: recomendar redução específica
        const periodosAfetados = hypoPattern.periods.length > 0 
          ? hypoPattern.periods.map(p => {
              const mapping = INSULIN_PERIOD_MAP[p];
              return mapping ? `REDUZIR 2 UI de ${mapping.insulinType} ${mapping.timing}` : null;
            }).filter(Boolean).join(". ")
          : "Reduzir 2-4 UI da insulina correspondente ao período com hipoglicemia recorrente";
        condutaImediata = `${periodosAfetados}. Padrão recorrente identificado (${hypoPattern.count} episódios).`;
        condutaContinuada = `Monitoramento intensificado. Verificar intervalo insulina-refeição e adequação de carboidratos.`;
        nextSteps.push("Implementar redução de dose conforme indicado");
        nextSteps.push("Verificar horário de aplicação da insulina");
        nextSteps.push("Orientar tratamento de hipoglicemia (15g carboidrato)");
        nextSteps.push("Reavaliar em 5-7 dias");
      } else {
        // Episódio isolado: NÃO alterar dose, apenas orientar
        condutaImediata = evaluation.usesInsulin 
          ? `MANTER esquema insulínico atual. Episódio isolado de hipoglicemia não justifica alteração de dose. Investigar causa: jejum prolongado, atividade física ou inadequação alimentar.`
          : `Investigar causa da hipoglicemia: jejum prolongado, atividade física ou padrão alimentar inadequado.`;
        condutaContinuada = `Manter monitoramento. Orientar reconhecimento precoce de sintomas e tratamento adequado (15g carboidrato).`;
        nextSteps.push("Investigar causa do episódio isolado");
        nextSteps.push("Orientar tratamento de hipoglicemia");
        nextSteps.push("Continuar monitorização para identificar padrão");
        nextSteps.push("Reavaliar em 7-14 dias");
      }
    } else {
      // Hiperglicemia severa apenas
      const insulinAdjust = generateInsulinAdjustmentRecommendation(analysis, evaluation);
      if (evaluation.usesInsulin) {
        condutaImediata = insulinAdjust || `AUMENTAR doses de insulina nos períodos com hiperglicemia severa (>200 mg/dL).`;
      } else {
        const doseInicial = evaluation.weight ? `${Math.round(evaluation.weight * 0.5)} UI/dia` : "0,5 UI/kg/dia";
        condutaImediata = `INICIAR insulinoterapia: ${doseInicial}, esquema basal-bolus (SBD-R4).`;
      }
      condutaContinuada = `Vigilância fetal intensificada. Se persistência, considerar internação para ajuste supervisionado.`;
      nextSteps.push("Implementar ajustes de insulina conforme indicado");
      nextSteps.push("Reforçar adesão à dieta prescrita");
      nextSteps.push("Solicitar ultrassonografia obstétrica");
      nextSteps.push("Reavaliar em 3-5 dias");
    }
    fundamentacao = "Valores críticos de glicemia requerem intervenção imediata para prevenção de complicações materno-fetais conforme SBD 2025 e FEBRASGO 2019 (F8 - vigilância fetal).";
  } else if (analysis.percentInTarget >= 70) {
    // Good overall control - check if recent trend is worsening
    if (isRecentWorsening) {
      condutaImediata = evaluation.usesInsulin 
        ? `Atenção: tendência de piora nos últimos 7 dias (${recent7DayPercent}% na meta vs ${analysis.percentInTarget}% geral). Avaliar necessidade de ajuste preventivo. ${sevenDayAdjustments}`
        : `Tendência de piora recente observada (${recent7DayPercent}% na meta nos últimos 7 dias). Intensificar orientação dietética e monitorar de perto.`;
      condutaContinuada = `Reavaliação antecipada em 7 dias para confirmar tendência. Se piora persistir, considerar ajuste terapêutico.`;
      nextSteps.push("Reavaliação antecipada em 7 dias");
      nextSteps.push("Intensificar orientação nutricional");
    } else {
      condutaImediata = evaluation.usesInsulin 
        ? `Manter esquema atual de insulinoterapia. Controle adequado demonstrado${isRecentImproving ? ", com tendência de melhora recente confirmando eficácia do tratamento" : ""}.`
        : `Manter orientação dietética e atividade física regular. Não há indicação de insulinoterapia no momento.`;
      condutaContinuada = `Continuar monitoramento conforme protocolo. ${evaluation.gestationalWeeks >= 32 ? "Intensificar vigilância fetal a partir de 32 semanas." : "Manter seguimento ambulatorial regular."}`;
    }
    nextSteps.push("Manter automonitorização glicêmica");
    nextSteps.push("Continuar orientação nutricional");
    nextSteps.push(evaluation.gestationalWeeks >= 32 ? "Vigilância fetal semanal (CTG, PBF)" : "Próxima consulta em 15 dias");
    fundamentacao = `Controle adequado conforme metas SBD 2025 (jejum 65-95, 1h pós-prandial <140 mg/dL).${isRecentWorsening ? " Tendência de piora recente requer vigilância." : ""} ${evaluation.gestationalWeeks >= 32 ? "Vigilância fetal intensificada após 32 semanas (FEBRASGO-F8, OMS-W8)." : ""}`;
  } else if (analysis.percentInTarget >= 50) {
    // Moderate control - use 7-day data to guide urgency
    const urgencyModifier = isRecentWorsening ? " com urgência - tendência de piora detectada nos últimos 7 dias" : "";
    
    if (evaluation.usesInsulin) {
      const insulinAdjust = generateInsulinAdjustmentRecommendation(analysis, evaluation);
      condutaImediata = `OTIMIZAR insulina${urgencyModifier}. ${insulinAdjust || "Ajustar conforme perfil."} ${sevenDayAdjustments}`;
      condutaContinuada = isRecentWorsening 
        ? `Reavaliação em 5-7 dias. Vigilância fetal intensificada.`
        : `Reavaliar em 7-14 dias. Manter vigilância fetal.`;
      nextSteps.push("Implementar ajustes de insulina indicados");
    } else {
      const doseInicial = evaluation.weight ? `${Math.round(evaluation.weight * 0.5)} UI/dia` : "0,5 UI/kg/dia";
      condutaImediata = `INICIAR insulina${urgencyModifier}: ${doseInicial} (SBD-R1). ${analysis.percentAboveTarget}% acima da meta.`;
      condutaContinuada = `Esquema basal-bolus. Reavaliação em ${isRecentWorsening ? "5-7" : "7-14"} dias.`;
      nextSteps.push("Prescrever insulinoterapia");
      nextSteps.push("Orientar técnica de aplicação");
    }
    nextSteps.push("Reforçar adesão à dieta prescrita");
    nextSteps.push(isRecentWorsening ? "Reavaliar em 5-7 dias" : "Reavaliar em 7-14 dias");
    if (evaluation.gestationalWeeks >= 29) nextSteps.push("Solicitar USG para avaliação de crescimento fetal");
    fundamentacao = `Conforme SBD-R1 (Classe IIb, Nível C), ${analysis.percentAboveTarget}% das medidas acima da meta justifica início ou intensificação de insulinoterapia.${isRecentWorsening ? " Tendência de piora recente reforça necessidade de intervenção." : ""} Insulina é primeira escolha (SBD-R2, Classe I, Nível A).`;
  } else {
    // Poor control
    const trendNote = isRecentImproving 
      ? " Nota: tendência de melhora nos últimos 7 dias sugere resposta inicial ao tratamento."
      : isRecentWorsening 
        ? " URGENTE: tendência de piora progressiva nos últimos 7 dias."
        : "";
    
    if (evaluation.usesInsulin) {
      const insulinAdjust = generateInsulinAdjustmentRecommendation(analysis, evaluation);
      condutaImediata = `INTENSIFICAR insulina +20-30%. ${insulinAdjust || "Ajustar todos os períodos."} ${sevenDayAdjustments}${trendNote}`;
      condutaContinuada = isRecentWorsening 
        ? `Considerar internação imediata. Vigilância fetal obrigatória.`
        : `Considerar internação se não houver resposta em 5-7 dias. Vigilância fetal obrigatória.`;
    } else {
      const doseInicial = evaluation.weight ? `${Math.round(evaluation.weight * 0.5)} UI/dia` : "0,5 UI/kg/dia";
      condutaImediata = `INICIAR insulina URGENTE: ${doseInicial} (SBD-R4), esquema basal-bolus.${trendNote}`;
      condutaContinuada = `Reavaliação em ${isRecentWorsening ? "5" : "7"} dias com ajuste de doses. Vigilância fetal intensificada.`;
    }
    nextSteps.push("Iniciar ou intensificar insulinoterapia imediatamente");
    nextSteps.push("Reforçar orientação nutricional");
    nextSteps.push("Solicitar USG obstétrica");
    nextSteps.push(isRecentWorsening ? "Reavaliar em 5 dias" : "Reavaliar em 7 dias");
    if (isRecentWorsening) nextSteps.push("Considerar internação para ajuste supervisionado");
    else nextSteps.push("Considerar internação se necessário");
    fundamentacao = `Descontrole glicêmico grave (apenas ${analysis.percentInTarget}% na meta${s7 ? `, ${recent7DayPercent}% nos últimos 7 dias` : ""}) requer intervenção imediata conforme SBD-R1 e SBD-R2. Associação com complicações materno-fetais bem documentada.`;
  }
  
  const ruleIds = analysis.rulesTriggered.map(r => r.id);
  
  // Montar análise completa com duas seções - ensure consistent format even with empty content
  const panoramaSection = [
    `PANORAMA GERAL`,
    ``,
    panoramaResumo || `Gestante com ${igText}, ${analysis.diabetesType}, em acompanhamento.`,
    ``,
    panoramaAnalise || `Análise baseada em ${diasAnalise} dias de monitoramento glicêmico.`,
  ].join("\n");
  
  const ultimos7Section = [
    `ÚLTIMOS 7 DIAS`,
    ``,
    ultimos7Resumo,
    ``,
    `Tendência: ${ultimos7Tendencia}`,
    ``,
    ultimos7Comparativo,
    ``,
    ultimos7Analise,
  ].join("\n");
  
  const fullAnalysis = [
    panoramaSection,
    ``,
    `---`,
    ``,
    ultimos7Section,
  ].join("\n");
  
  const mainRec = [
    `Conduta Imediata: ${condutaImediata}`,
    ``,
    `Estratégia Continuada: ${condutaContinuada}`,
  ].join("\n");
  
  return {
    analysis: fullAnalysis,
    mainRecommendation: mainRec,
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

// Mapeamento profissional: período → tipo de insulina + horário de aplicação
const INSULIN_PERIOD_MAP: Record<string, { insulinType: string; timing: string; component: "basal" | "bolus" }> = {
  "Jejum": { insulinType: "NPH", timing: "às 22h (ao deitar)", component: "basal" },
  "1h pós-café": { insulinType: "Regular ou Lispro/Asparte", timing: "antes do café da manhã", component: "bolus" },
  "1h pós-almoço": { insulinType: "Regular ou Lispro/Asparte", timing: "antes do almoço", component: "bolus" },
  "1h pós-jantar": { insulinType: "Regular ou Lispro/Asparte", timing: "antes do jantar", component: "bolus" },
  "Pré-almoço": { insulinType: "NPH", timing: "pela manhã (7-8h)", component: "basal" },
  "Pré-jantar": { insulinType: "NPH ou Regular", timing: "antes do almoço (para NPH) ou antes do jantar (para Regular)", component: "basal" },
  "Madrugada": { insulinType: "NPH", timing: "ao jantar (reduzir se hipoglicemia recorrente)", component: "basal" },
};

function generateInsulinAdjustmentRecommendation(analysis: ClinicalAnalysis, evaluation: PatientEvaluation): string {
  if (!analysis.analysisByPeriod || analysis.analysisByPeriod.length === 0) {
    return "";
  }
  
  const adjustments: string[] = [];
  
  analysis.analysisByPeriod.forEach(period => {
    const avg = Math.round(period.average);
    const target = period.period === "Jejum" ? 95 : 
                   (period.period.includes("Pré-") || period.period === "Madrugada") ? 100 : 140;
    const excess = avg - target;
    
    // Só recomendar ajuste se padrão consistente (>40% acima ou excesso >20 mg/dL)
    if (period.percentAbove > 40 || excess > 20) {
      // Cálculo: 2 UI por cada 20 mg/dL acima da meta, mínimo 2, máximo 6
      const suggestedIncrease = Math.max(2, Math.min(6, Math.ceil(excess / 20) * 2));
      const mapping = INSULIN_PERIOD_MAP[period.period];
      
      if (mapping) {
        adjustments.push(
          `AUMENTAR ${suggestedIncrease} UI de ${mapping.insulinType} ${mapping.timing}`
        );
      }
    }
  });
  
  if (adjustments.length === 0) {
    return "";
  }
  
  return adjustments.join(". ") + ".";
}

// Normaliza nome do período para alinhar com INSULIN_PERIOD_MAP
function normalizePeriodName(rawPeriod: string): string {
  const normalized = rawPeriod.toLowerCase().trim();
  if (normalized.includes("jejum")) return "Jejum";
  if (normalized.includes("pós-café") || normalized.includes("pos-cafe") || normalized.includes("café")) return "1h pós-café";
  if (normalized.includes("pós-almoço") || normalized.includes("pos-almoco") || normalized.includes("almoço") && normalized.includes("pós")) return "1h pós-almoço";
  if (normalized.includes("pós-jantar") || normalized.includes("pos-jantar") || normalized.includes("jantar") && normalized.includes("pós")) return "1h pós-jantar";
  if (normalized.includes("pré-almoço") || normalized.includes("pre-almoco")) return "Pré-almoço";
  if (normalized.includes("pré-jantar") || normalized.includes("pre-jantar")) return "Pré-jantar";
  if (normalized.includes("madrugada") || normalized.includes("3h")) return "Madrugada";
  return rawPeriod; // Fallback
}

// Verifica se há padrão recorrente de hipoglicemia (≥2 episódios no mesmo período nos últimos 7 dias)
function hasRecurrentHypoglycemia(analysis: ClinicalAnalysis): { hasPattern: boolean; periods: string[]; count: number } {
  if (!analysis.sevenDayAnalysis?.criticalAlerts) {
    return { hasPattern: false, periods: [], count: 0 };
  }
  
  const hypoAlerts = analysis.sevenDayAnalysis.criticalAlerts.filter(a => a.type === "hypoglycemia");
  const count = hypoAlerts.length;
  
  // Agrupar por período normalizado para verificar recorrência
  const byPeriod: Record<string, number> = {};
  hypoAlerts.forEach(alert => {
    // Usar timepoint que é o período do alerta
    if (alert.timepoint) {
      const normalizedPeriod = normalizePeriodName(alert.timepoint);
      byPeriod[normalizedPeriod] = (byPeriod[normalizedPeriod] || 0) + 1;
    }
  });
  
  // Só considera padrão se ≥2 episódios no mesmo período ou ≥3 total
  const recurrentPeriods = Object.entries(byPeriod)
    .filter(([_, cnt]) => cnt >= 2)
    .map(([period]) => period);
  
  return { 
    hasPattern: recurrentPeriods.length > 0 || count >= 3, 
    periods: recurrentPeriods,
    count 
  };
}
