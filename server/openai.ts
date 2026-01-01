import OpenAI from "openai";
import type { PatientEvaluation, ClinicalRecommendation, GlucoseReading, CriticalAlert } from "@shared/schema";
import { glucoseTargets, calculateGlucosePercentageInTarget, calculateAverageGlucose, checkCriticalGlucose, criticalGlucoseThresholds } from "@shared/schema";
import { generateClinicalAnalysis, formatAnalysisForAI, type ClinicalAnalysis, type InsulinAdjustmentAnalysis } from "./clinical-engine";

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
  
  // Build unified analysis section (no more repetitive PANORAMA GERAL / ÚLTIMOS 7 DIAS)
  let analysisContent = "";
  
  // Extract main summary from AI response
  if (parsed.panoramaGeral) {
    const resumo = parsed.panoramaGeral.resumo || "";
    const analise = parsed.panoramaGeral.analise || "";
    analysisContent = [resumo, analise].filter(Boolean).join(" ");
  } else if (parsed.resumoExecutivo) {
    analysisContent = [parsed.resumoExecutivo, parsed.interpretacaoClinica].filter(Boolean).join(" ");
  }
  
  // Add trend info only if significantly different (avoid repetition)
  let trendInfo = "";
  if (parsed.ultimosSeteDias && parsed.ultimosSeteDias.tendencia) {
    const u7 = parsed.ultimosSeteDias;
    // Only add if there's a meaningful trend difference
    if (u7.tendencia && u7.tendencia !== "ESTÁVEL") {
      trendInfo = `Tendência: ${u7.tendencia}.`;
    }
  } else if (analysis.sevenDayAnalysis) {
    const s7 = analysis.sevenDayAnalysis;
    if (s7.trend !== "stable") {
      const tendenciaLabel = s7.trend === "improving" ? "MELHORA" : "PIORA";
      trendInfo = `Tendência: ${tendenciaLabel}.`;
    }
  }
  
  const fullAnalysis = `ANÁLISE CLÍNICA\n\n${analysisContent}${trendInfo ? `\n\n${trendInfo}` : ""}`;
  
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
  
  // Extract chronology info - prefer main analysis, fallback to insulinAdjustments
  const chronologyWarning = analysis.chronologyWarning || analysis.insulinAdjustments?.chronologyWarning;
  const dateRange = analysis.dateRange || analysis.insulinAdjustments?.dateRange;
  
  // Convert PeriodAdjustmentResult to InsulinAdjustment for frontend
  const ajustesRecomendados = analysis.insulinAdjustments?.ajustesRecomendados?.map(a => ({
    periodo: a.periodo,
    insulinaAfetada: a.insulinaAfetada,
    direcao: a.direcao,
    justificativa: a.justificativa,
    diasComProblema: a.diasComProblema,
    totalDiasAnalisados: a.totalDiasAnalisados,
    valoresObservados: a.valoresObservados,
    suspended: a.suspended,
  })) || [];

  return {
    analysis: fullAnalysis || analysis.technicalSummary,
    mainRecommendation: conduta.trim(),
    justification: parsed.fundamentacao || `Baseado nas Diretrizes SBD 2025, FEBRASGO 2019 e OMS 2025.`,
    nextSteps: Array.isArray(parsed.proximosPassos) && parsed.proximosPassos.length > 0 
      ? parsed.proximosPassos 
      : analysis.recommendedActions,
    urgencyLevel: validateUrgencyLevel(parsed.urgencyLevel, analysis.urgencyLevel),
    guidelineReferences: ruleIds.length > 0 ? ruleIds : [],
    chronologyWarning,
    dateRange,
    totalDaysAnalyzed: analysis.totalDaysAnalyzed,
    ajustesRecomendados,
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
  // CRITICAL: Use pre-computed alerts from last 7 days (already in analysis.criticalAlerts)
  const criticalAlerts = analysis.criticalAlerts;
  const hasHypo = criticalAlerts.some(a => a.type === "hypoglycemia");
  const hasSevereHyper = criticalAlerts.some(a => a.type === "severe_hyperglycemia");
  
  const nextSteps: string[] = [];
  let urgency: "info" | "warning" | "critical" = analysis.urgencyLevel;
  
  const igText = `${evaluation.gestationalWeeks} semanas e ${evaluation.gestationalDays} dias`;
  // Use the 7-day count from analysis, not full history
  const diasAnalise = analysis.totalDaysAnalyzed;
  const s7 = analysis.sevenDayAnalysis;
  
  // ============== ANÁLISE CLÍNICA UNIFICADA ==============
  // Texto único, sem repetições, focado no que importa clinicamente
  
  let analysisSummary = "";
  let trendInfo = "";
  let periodDetails = "";
  
  const metasText = "metas: jejum 65-95, 1h pós-prandial <140 mg/dL";
  
  if (hasHypo || hasSevereHyper) {
    urgency = "critical";
    const hypoCount = criticalAlerts.filter(a => a.type === "hypoglycemia").length;
    const hyperCount = criticalAlerts.filter(a => a.type === "severe_hyperglycemia").length;
    
    analysisSummary = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    
    if (hasHypo && hasSevereHyper) {
      analysisSummary += ` Perfil glicêmico com variabilidade significativa: ${hypoCount} hipoglicemia(s) e ${hyperCount} hiperglicemia(s) severa(s).`;
    } else if (hasHypo) {
      analysisSummary += ` ${hypoCount} episódio(s) de hipoglicemia (<65 mg/dL) registrado(s).`;
    } else {
      analysisSummary += ` ${hyperCount} episódio(s) de hiperglicemia severa (>200 mg/dL) registrado(s).`;
    }
    analysisSummary += ` Percentual na meta: ${analysis.percentInTarget}% (${metasText}). Média glicêmica: ${analysis.averageGlucose} mg/dL.`;
    
  } else if (analysis.percentInTarget >= 70) {
    urgency = "info";
    analysisSummary = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    analysisSummary += ` Percentual na meta: ${analysis.percentInTarget}% (${metasText}). Média glicêmica: ${analysis.averageGlucose} mg/dL. ${evaluation.usesInsulin ? "Manutenção do esquema de insulinoterapia atual indicada." : "Manutenção do manejo nutricional atual indicada."}`;
    
  } else if (analysis.percentInTarget >= 50) {
    urgency = "warning";
    analysisSummary = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    analysisSummary += ` Percentual na meta: ${analysis.percentInTarget}%. Percentual acima da meta: ${analysis.percentAboveTarget}%. Média glicêmica: ${analysis.averageGlucose} mg/dL.`;
    periodDetails = generatePeriodAnalysis(analysis);
    
  } else {
    urgency = "critical";
    analysisSummary = `Gestante com ${igText}, ${analysis.diabetesType}. Período analisado: ${diasAnalise} dias.`;
    analysisSummary += ` Percentual na meta: ${analysis.percentInTarget}%. Percentual acima da meta: ${analysis.percentAboveTarget}%. Média glicêmica: ${analysis.averageGlucose} mg/dL.`;
    periodDetails = generatePeriodAnalysis(analysis);
  }
  
  // ============== TENDÊNCIA RECENTE ==============
  // Só mostra se houver dados suficientes E se a tendência diferir do geral
  if (s7 && diasAnalise > 7) {
    const tendenciaLabel = s7.trend === "improving" ? "MELHORA" : s7.trend === "worsening" ? "PIORA" : "ESTÁVEL";
    const diffPercent = s7.percentInTarget - analysis.percentInTarget;
    const diffMedia = s7.averageGlucose - analysis.averageGlucose;
    
    // Só mostra se há diferença significativa entre 7 dias e período geral
    if (Math.abs(diffPercent) > 5 || Math.abs(diffMedia) > 5) {
      trendInfo = `Últimos 7 dias: ${s7.percentInTarget}% na meta, média ${s7.averageGlucose} mg/dL. `;
      if (diffPercent > 5) {
        trendInfo += `Tendência: ${tendenciaLabel} (+${Math.abs(diffPercent)}pp vs período geral).`;
      } else if (diffPercent < -5) {
        trendInfo += `Tendência: ${tendenciaLabel} (${diffPercent}pp vs período geral).`;
      }
    } else {
      trendInfo = `Tendência: ${tendenciaLabel} - padrão consistente com período geral.`;
    }
    
    // Períodos com mudança significativa (apenas se houver)
    const worsePeriods = s7.periodComparison.filter(p => p.change === "worse");
    const betterPeriods = s7.periodComparison.filter(p => p.change === "better");
    
    if (worsePeriods.length > 0 || betterPeriods.length > 0) {
      const changes: string[] = [];
      if (worsePeriods.length > 0) {
        changes.push(`piora em ${worsePeriods.map(p => p.period).join(", ")}`);
      }
      if (betterPeriods.length > 0) {
        changes.push(`melhora em ${betterPeriods.map(p => p.period).join(", ")}`);
      }
      trendInfo += ` Mudanças recentes: ${changes.join("; ")}.`;
    }
  } else if (s7) {
    // Se só tem 7 dias, a tendência já está no resumo principal
    trendInfo = `Tendência: ${s7.trend === "improving" ? "MELHORA" : s7.trend === "worsening" ? "PIORA" : "ESTÁVEL"} - padrão consistente com período geral.`;
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
  // Only show "piora" message if there's an actual increase in average glucose (avgDelta > 0)
  const sevenDayAdjustments = sevenDayWorseningPeriods.length > 0 
    ? `Atenção especial aos períodos com piora recente: ${sevenDayWorseningPeriods.map(p => `${p.period} (${p.overall}→${p.last7Days} mg/dL)`).join(", ")}.`
    : (isRecentWorsening && s7 && avgDelta > 0 ? `Piora observada na média geral (${analysis.averageGlucose}→${s7.averageGlucose} mg/dL nos últimos 7 dias).` : "");
  
  // Verificar padrão recorrente de hipoglicemia antes de recomendar redução de dose
  const hypoPattern = hasRecurrentHypoglycemia(analysis);
  
  // CRITICAL FIX: Check if recent 7-day data shows good control despite historical alerts
  // If recent control is good (≥70% in target AND not worsening), don't escalate based on old data
  const recentHypoCount = s7?.criticalAlerts?.filter(a => a.type === "hypoglycemia").length || 0;
  const recentHyperCount = s7?.criticalAlerts?.filter(a => a.type === "severe_hyperglycemia").length || 0;
  const hasRecentCriticalIssues = recentHypoCount >= 2 || recentHyperCount >= 2;
  const recentControlIsGood = recent7DayPercent >= 70 && !isRecentWorsening;
  
  // Override historical alerts if recent control is good and no recent critical issues
  const shouldIgnoreHistoricalAlerts = recentControlIsGood && !hasRecentCriticalIssues && s7 !== null;
  
  if ((hasHypo || hasSevereHyper) && !shouldIgnoreHistoricalAlerts) {
    // Use pre-computed insulin adjustments from analysis
    const insulinAdjust = generateInsulinAdjustmentRecommendation(analysis);
    const insulinAnalysis = analysis.insulinAdjustments;
    
    if (hasHypo && hasSevereHyper) {
      condutaImediata = `Perfil glicêmico instável com variabilidade significativa. ${insulinAdjust || "Revisão individualizada do esquema insulínico indicada."}`;
      condutaContinuada = `Reavaliação programada para 3-5 dias.`;
      nextSteps.push("Ajuste de insulina por período conforme análise");
      nextSteps.push("Orientação sobre tratamento de hipoglicemia (15g carboidrato)");
      nextSteps.push("Reavaliação em 3-5 dias");
    } else if (hasHypo) {
      // Hipoglicemia: usar análise estruturada
      const reducoes = insulinAnalysis?.ajustesRecomendados?.filter(a => a.direcao === "REDUZIR") || [];
      if (reducoes.length > 0 && evaluation.usesInsulin) {
        condutaImediata = reducoes.map(r => r.justificativa).join(" ");
        condutaContinuada = `Monitoramento intensificado indicado.`;
        nextSteps.push("Implementação de redução de dose conforme indicado");
        nextSteps.push("Orientação sobre tratamento de hipoglicemia (15g carboidrato)");
        nextSteps.push("Reavaliação em 5-7 dias");
      } else {
        condutaImediata = evaluation.usesInsulin 
          ? `Manutenção do esquema insulínico atual indicada. Episódio isolado de hipoglicemia não justifica alteração de dose.`
          : `Investigação de causa da hipoglicemia indicada.`;
        condutaContinuada = `Manutenção do monitoramento.`;
        nextSteps.push("Investigação de causa do episódio");
        nextSteps.push("Reavaliação em 7-14 dias");
      }
    } else {
      // Hiperglicemia severa apenas
      if (evaluation.usesInsulin) {
        condutaImediata = insulinAdjust || `Ajuste de doses de insulina indicado nos períodos com hiperglicemia severa (>200 mg/dL).`;
      } else {
        const doseInicial = evaluation.weight ? `${Math.round(evaluation.weight * 0.5)} UI/dia` : "0,5 UI/kg/dia";
        condutaImediata = `Início de insulinoterapia indicado: ${doseInicial}, esquema basal-bolus (SBD-R4).`;
      }
      condutaContinuada = `Vigilância fetal intensificada recomendada. Se persistência, internação para ajuste supervisionado pode ser considerada.`;
      nextSteps.push("Implementação de ajustes de insulina conforme indicado");
      nextSteps.push("Reforço de adesão à dieta prescrita");
      nextSteps.push("Solicitação de ultrassonografia obstétrica");
      nextSteps.push("Reavaliação em 3-5 dias");
    }
    fundamentacao = "Valores críticos de glicemia indicam necessidade de intervenção para prevenção de complicações materno-fetais conforme SBD 2025 e FEBRASGO 2019 (F8 - vigilância fetal).";
  } else if (analysis.percentInTarget >= 70) {
    // Good overall control - check if recent trend is worsening
    // Only show worsening message if there's actual decrease in percent-in-target (percentDelta < 0)
    const hasActualWorsening = isRecentWorsening && percentDelta < 0;
    if (hasActualWorsening) {
      condutaImediata = evaluation.usesInsulin 
        ? `Tendência de piora observada nos últimos 7 dias (${recent7DayPercent}% na meta vs ${analysis.percentInTarget}% geral). Avaliação de ajuste preventivo indicada. ${sevenDayAdjustments}`
        : `Tendência de piora recente observada (${recent7DayPercent}% na meta nos últimos 7 dias). Intensificação da orientação dietética e monitoramento recomendados.`;
      condutaContinuada = `Reavaliação antecipada em 7 dias para confirmação de tendência. Se piora persistir, ajuste terapêutico pode ser considerado.`;
      nextSteps.push("Reavaliação antecipada em 7 dias");
      nextSteps.push("Intensificação da orientação nutricional");
    } else {
      condutaImediata = evaluation.usesInsulin 
        ? `Manutenção do esquema atual de insulinoterapia indicada. Controle adequado demonstrado${isRecentImproving ? ", com tendência de melhora recente confirmando eficácia do tratamento" : ""}.`
        : `Manutenção da orientação dietética e atividade física regular indicada. Não há indicação de insulinoterapia no momento.`;
      condutaContinuada = `Continuidade do monitoramento conforme protocolo. ${evaluation.gestationalWeeks >= 32 ? "Intensificação da vigilância fetal indicada a partir de 32 semanas." : "Seguimento ambulatorial regular recomendado."}`;
    }
    nextSteps.push("Manutenção da automonitorização glicêmica");
    nextSteps.push("Continuidade da orientação nutricional");
    nextSteps.push(evaluation.gestationalWeeks >= 32 ? "Vigilância fetal semanal (CTG, PBF)" : "Próxima consulta em 15 dias");
    fundamentacao = `Controle adequado conforme metas SBD 2025 (jejum 65-95, 1h pós-prandial <140 mg/dL).${hasActualWorsening ? " Tendência de piora recente requer vigilância." : ""} ${evaluation.gestationalWeeks >= 32 ? "Vigilância fetal intensificada após 32 semanas (FEBRASGO-F8, OMS-W8)." : ""}`;
  } else if (analysis.percentInTarget >= 50) {
    // Moderate control - use 7-day data to guide urgency
    const urgencyNote = isRecentWorsening ? " Tendência de piora detectada nos últimos 7 dias." : "";
    
    if (evaluation.usesInsulin) {
      const insulinAdjust = generateInsulinAdjustmentRecommendation(analysis);
      condutaImediata = `Otimização do esquema insulínico indicada.${urgencyNote} ${insulinAdjust || "Ajuste conforme perfil glicêmico."} ${sevenDayAdjustments}`;
      condutaContinuada = isRecentWorsening 
        ? `Reavaliação em 5-7 dias recomendada. Vigilância fetal intensificada.`
        : `Reavaliação em 7-14 dias. Manutenção da vigilância fetal.`;
      nextSteps.push("Implementação de ajustes de insulina indicados");
    } else {
      const doseInicial = evaluation.weight ? `${Math.round(evaluation.weight * 0.5)} UI/dia` : "0,5 UI/kg/dia";
      condutaImediata = `Início de insulinoterapia indicado: ${doseInicial} (SBD-R1).${urgencyNote} ${analysis.percentAboveTarget}% das medidas acima da meta.`;
      condutaContinuada = `Esquema basal-bolus recomendado. Reavaliação em ${isRecentWorsening ? "5-7" : "7-14"} dias.`;
      nextSteps.push("Prescrição de insulinoterapia");
      nextSteps.push("Orientação sobre técnica de aplicação");
    }
    nextSteps.push("Reforço de adesão à dieta prescrita");
    nextSteps.push(isRecentWorsening ? "Reavaliação em 5-7 dias" : "Reavaliação em 7-14 dias");
    if (evaluation.gestationalWeeks >= 29) nextSteps.push("Solicitação de USG para avaliação de crescimento fetal");
    fundamentacao = `Conforme SBD-R1 (Classe IIb, Nível C), ${analysis.percentAboveTarget}% das medidas acima da meta indica início ou intensificação de insulinoterapia.${isRecentWorsening ? " Tendência de piora recente reforça indicação de intervenção." : ""} Insulina como primeira escolha (SBD-R2, Classe I, Nível A).`;
  } else {
    // Poor control
    // Only show worsening trend if there's actual increase in average glucose
    const trendNote = isRecentImproving 
      ? " Tendência de melhora nos últimos 7 dias sugere resposta inicial ao tratamento."
      : (isRecentWorsening && avgDelta > 0)
        ? " Tendência de piora progressiva nos últimos 7 dias observada."
        : "";
    
    if (evaluation.usesInsulin) {
      const insulinAdjust = generateInsulinAdjustmentRecommendation(analysis);
      condutaImediata = `Intensificação do esquema insulínico indicada (+20-30%). ${insulinAdjust || "Ajuste em todos os períodos recomendado."} ${sevenDayAdjustments}${trendNote}`;
      condutaContinuada = isRecentWorsening 
        ? `Internação pode ser considerada. Vigilância fetal intensificada indicada.`
        : `Internação pode ser considerada se não houver resposta em 5-7 dias. Vigilância fetal intensificada indicada.`;
    } else {
      const doseInicial = evaluation.weight ? `${Math.round(evaluation.weight * 0.5)} UI/dia` : "0,5 UI/kg/dia";
      condutaImediata = `Início de insulinoterapia indicado: ${doseInicial} (SBD-R4), esquema basal-bolus.${trendNote}`;
      condutaContinuada = `Reavaliação em ${isRecentWorsening ? "5" : "7"} dias com ajuste de doses. Vigilância fetal intensificada recomendada.`;
    }
    nextSteps.push("Início ou intensificação de insulinoterapia");
    nextSteps.push("Reforço de orientação nutricional");
    nextSteps.push("Solicitação de USG obstétrica");
    nextSteps.push(isRecentWorsening ? "Reavaliação em 5 dias" : "Reavaliação em 7 dias");
    if (isRecentWorsening) nextSteps.push("Considerar internação para ajuste supervisionado");
    else nextSteps.push("Internação pode ser considerada se necessário");
    fundamentacao = `Descontrole glicêmico significativo (${analysis.percentInTarget}% na meta${s7 ? `, ${recent7DayPercent}% nos últimos 7 dias` : ""}) indica necessidade de intervenção conforme SBD-R1 e SBD-R2. Associação com complicações materno-fetais documentada.`;
  }
  
  const ruleIds = analysis.rulesTriggered.map(r => r.id);
  
  // Montar análise completa - texto único e conciso
  const analysisSection = [
    `ANÁLISE CLÍNICA`,
    ``,
    analysisSummary,
  ];
  
  if (periodDetails) {
    analysisSection.push(``, periodDetails);
  }
  
  if (trendInfo) {
    analysisSection.push(``, trendInfo);
  }
  
  const fullAnalysis = analysisSection.join("\n");
  
  const mainRec = [
    `Conduta Imediata: ${condutaImediata}`,
    ``,
    `Estratégia Continuada: ${condutaContinuada}`,
  ].join("\n");
  
  // Deduplicate nextSteps to avoid repetition
  const uniqueNextSteps = Array.from(new Set(nextSteps));
  
  // Extract chronology info - prefer main analysis, fallback to insulinAdjustments
  const chronologyWarning = analysis.chronologyWarning || analysis.insulinAdjustments?.chronologyWarning;
  const dateRange = analysis.dateRange || analysis.insulinAdjustments?.dateRange;
  
  // Convert PeriodAdjustmentResult to InsulinAdjustment for frontend
  const ajustesRecomendados = analysis.insulinAdjustments?.ajustesRecomendados?.map(a => ({
    periodo: a.periodo,
    insulinaAfetada: a.insulinaAfetada,
    direcao: a.direcao,
    justificativa: a.justificativa,
    diasComProblema: a.diasComProblema,
    totalDiasAnalisados: a.totalDiasAnalisados,
    valoresObservados: a.valoresObservados,
    suspended: a.suspended,
  })) || [];
  
  return {
    analysis: fullAnalysis,
    mainRecommendation: mainRec,
    justification: fundamentacao,
    nextSteps: uniqueNextSteps,
    urgencyLevel: urgency,
    guidelineReferences: ruleIds,
    chronologyWarning,
    dateRange,
    totalDaysAnalyzed: analysis.totalDaysAnalyzed,
    ajustesRecomendados,
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

/**
 * NOVA IMPLEMENTAÇÃO: Usa algoritmo baseado em evidências com análise de delta pré/pós
 * e consideração do Efeito Somogyi para jejum elevado
 * 
 * PRIORIDADE DE SEGURANÇA: Redução > Solicitação de dados > Aumento
 */
function generateInsulinAdjustmentRecommendation(analysis: ClinicalAnalysis): string {
  // Use pre-computed insulin adjustments from analysis (already uses last 7 days)
  const insulinAnalysis = analysis.insulinAdjustments;
  
  if (!insulinAnalysis || insulinAnalysis.ajustesRecomendados.length === 0) {
    return "";
  }
  
  // Return the consolidated summary - already contains ordered recommendations
  return insulinAnalysis.resumoGeral || "";
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
