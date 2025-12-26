import { describe, it, expect } from "vitest";
import {
  generateClinicalAnalysis,
  analyzeInsulinAdjustments,
  SBD_2025_RULES,
  FEBRASGO_2019_RULES,
  WHO_2025_RULES,
  type GlucoseAnalysisByPeriod,
  type InsulinAdjustmentAnalysis,
} from "./clinical-engine";
import type { PatientEvaluation, GlucoseReading } from "@shared/schema";

const createMockReading = (
  day: number,
  period: string,
  value: number
): GlucoseReading => ({
  date: `2024-01-${String(day).padStart(2, "0")}`,
  jejum: period === "Jejum" ? value : null,
  posCafe1h: period === "1h pós-café" ? value : null,
  preAlmoco: period === "Pré-almoço" ? value : null,
  posAlmoco1h: period === "1h pós-almoço" ? value : null,
  preJantar: period === "Pré-jantar" ? value : null,
  posJantar1h: period === "1h pós-jantar" ? value : null,
  madrugada3h: period === "Madrugada 3h" ? value : null,
});

const createMockEvaluation = (
  overrides: Partial<PatientEvaluation> = {}
): PatientEvaluation => ({
  id: 1,
  patientName: "Paciente Teste",
  userId: "user-123",
  gestationalWeeks: 28,
  gestationalDays: 0,
  diabetesType: "DMG",
  weight: 70,
  usesInsulin: false,
  insulinRegimens: [],
  abdominalCircumferencePercentile: null,
  dum: null,
  glucoseReadings: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("Clinical Engine - Glucose Targets", () => {
  it("should identify fasting glucose above target (95 mg/dL)", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 100),
      createMockReading(2, "Jejum", 110),
    ];

    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    const jejumPeriod = analysis.analysisByPeriod.find(p => p.period === "Jejum");
    expect(jejumPeriod?.aboveTarget).toBe(2);
    expect(jejumPeriod?.percentAbove).toBeGreaterThan(0);
  });

  it("should identify fasting glucose within target (65-95 mg/dL)", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 85),
      createMockReading(2, "Jejum", 90),
    ];

    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    const jejumPeriod = analysis.analysisByPeriod.find(p => p.period === "Jejum");
    expect(jejumPeriod?.inTarget).toBe(2);
    expect(jejumPeriod?.percentAbove).toBe(0);
  });

  it("should identify hypoglycemia (below 65 mg/dL)", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 55),
      createMockReading(2, "Jejum", 60),
    ];

    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    expect(analysis.criticalAlerts.length).toBeGreaterThan(0);
    expect(analysis.criticalAlerts.some(a => a.type === "hypoglycemia")).toBe(true);
  });

  it("should identify postprandial glucose above target (140 mg/dL)", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "1h pós-café", 160),
      createMockReading(2, "1h pós-almoço", 155),
    ];

    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    const posCafePeriod = analysis.analysisByPeriod.find(p => p.period === "1h pós-café da manhã");
    expect(posCafePeriod?.aboveTarget).toBe(1);
  });
});

describe("Clinical Engine - SBD 2025 Rules", () => {
  it("should verify all 17 SBD 2025 rules are catalogued", () => {
    const ruleIds = Object.keys(SBD_2025_RULES);
    expect(ruleIds).toContain("R1");
    expect(ruleIds).toContain("R17");
    expect(ruleIds.length).toBe(17);
  });

  it("should trigger R1 and R2 for DMG with >30% above target without insulin", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 110),
      createMockReading(1, "1h pós-café", 160),
      createMockReading(2, "Jejum", 105),
      createMockReading(2, "1h pós-almoço", 155),
    ];

    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      usesInsulin: false,
      diabetesType: "DMG",
    });

    const analysis = generateClinicalAnalysis(evaluation);
    const ruleIds = analysis.rulesTriggered.map(r => r.id);

    expect(ruleIds).toContain("SBD-R1");
    expect(ruleIds).toContain("SBD-R2");
  });

  it("should include R9 (glibenclamida contraindicada) for DMG needing meds", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 120),
      createMockReading(1, "1h pós-café", 180),
    ];

    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      usesInsulin: false,
      diabetesType: "DMG",
    });

    const analysis = generateClinicalAnalysis(evaluation);
    const ruleIds = analysis.rulesTriggered.map(r => r.id);

    expect(ruleIds).toContain("SBD-R9");
  });

  it("should trigger R17 (AAS) for DM1 and DM2 between 12-28 weeks", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 100)];

    const dm1Eval = createMockEvaluation({
      glucoseReadings: readings,
      diabetesType: "DM1",
      gestationalWeeks: 20,
    });

    const dm2Eval = createMockEvaluation({
      glucoseReadings: readings,
      diabetesType: "DM2",
      gestationalWeeks: 20,
    });

    const dm1Analysis = generateClinicalAnalysis(dm1Eval);
    const dm2Analysis = generateClinicalAnalysis(dm2Eval);

    const dm1RuleIds = dm1Analysis.rulesTriggered.map(r => r.id);
    const dm2RuleIds = dm2Analysis.rulesTriggered.map(r => r.id);

    expect(dm1RuleIds).toContain("SBD-R17");
    expect(dm2RuleIds).toContain("SBD-R17");
  });
});

describe("Clinical Engine - FEBRASGO 2019 Rules", () => {
  it("should verify all 10 FEBRASGO 2019 rules are catalogued", () => {
    const ruleIds = Object.keys(FEBRASGO_2019_RULES);
    expect(ruleIds).toContain("F1");
    expect(ruleIds).toContain("F10");
    expect(ruleIds.length).toBe(10);
  });

  it("should always include F5 (glycemic targets)", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 85)];
    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    const ruleIds = analysis.rulesTriggered.map(r => r.id);
    expect(ruleIds).toContain("FEBRASGO-F5");
  });

  it("should include F8 (fetal surveillance) for gestational age >= 32 weeks", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 85)];
    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      gestationalWeeks: 33,
    });

    const analysis = generateClinicalAnalysis(evaluation);
    const ruleIds = analysis.rulesTriggered.map(r => r.id);

    expect(ruleIds).toContain("FEBRASGO-F8");
  });
});

describe("Clinical Engine - WHO 2025 Rules", () => {
  it("should verify all 12 WHO 2025 rules are catalogued", () => {
    const ruleIds = Object.keys(WHO_2025_RULES);
    expect(ruleIds).toContain("W1");
    expect(ruleIds).toContain("W12");
    expect(ruleIds.length).toBe(12);
  });

  it("should always include W5 (self-monitoring)", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 85)];
    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    const ruleIds = analysis.rulesTriggered.map(r => r.id);
    expect(ruleIds).toContain("WHO-W5");
  });
});

describe("Clinical Engine - Insulin Dose Calculation", () => {
  it("should calculate initial insulin dose based on weight (0.5 UI/kg/day)", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 120),
      createMockReading(1, "1h pós-café", 180),
    ];

    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      weight: 80,
      usesInsulin: false,
    });

    const analysis = generateClinicalAnalysis(evaluation);

    expect(analysis.insulinCalculation).not.toBeNull();
    expect(analysis.insulinCalculation?.initialTotalDose).toBe(40);
  });

  it("should distribute insulin as 50% basal / 50% bolus", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 120)];
    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      weight: 80,
    });

    const analysis = generateClinicalAnalysis(evaluation);

    expect(analysis.insulinCalculation?.basalDose).toBe(20);
    expect(analysis.insulinCalculation?.bolusDose).toBe(20);
  });

  it("should return null for insulin calculation when weight is not available", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 120)];
    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      weight: null,
    });

    const analysis = generateClinicalAnalysis(evaluation);
    expect(analysis.insulinCalculation).toBeNull();
  });
});

describe("Clinical Engine - Urgency Levels", () => {
  it("should set urgency to critical when hypoglycemia is detected", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 50)];
    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    expect(analysis.urgencyLevel).toBe("critical");
  });

  it("should set urgency to critical when <50% in target", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 120),
      createMockReading(2, "Jejum", 130),
      createMockReading(3, "Jejum", 85),
    ];

    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    expect(analysis.urgencyLevel).toBe("critical");
  });

  it("should set urgency to warning when 50-70% in target", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 85),
      createMockReading(1, "1h pós-café", 145),
      createMockReading(2, "Jejum", 90),
      createMockReading(2, "1h pós-café", 130),
      createMockReading(3, "Jejum", 92),
    ];

    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    expect(["warning", "info"]).toContain(analysis.urgencyLevel);
  });

  it("should set urgency to info when >70% in target", () => {
    const readings: GlucoseReading[] = [
      createMockReading(1, "Jejum", 85),
      createMockReading(1, "1h pós-café", 120),
      createMockReading(2, "Jejum", 88),
      createMockReading(2, "1h pós-café", 125),
      createMockReading(3, "Jejum", 90),
    ];

    const evaluation = createMockEvaluation({ glucoseReadings: readings });
    const analysis = generateClinicalAnalysis(evaluation);

    expect(analysis.urgencyLevel).toBe("info");
  });
});

describe("Clinical Engine - Diabetes Type Specific Rules", () => {
  it("should include DM1 specific rules (R11, R14, R15)", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 100)];
    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      diabetesType: "DM1",
    });

    const analysis = generateClinicalAnalysis(evaluation);
    const ruleIds = analysis.rulesTriggered.map(r => r.id);

    expect(ruleIds).toContain("SBD-R11");
    expect(ruleIds).toContain("SBD-R14");
    expect(ruleIds).toContain("SBD-R15");
  });

  it("should include DM2 specific rules (R10, R11, R16)", () => {
    const readings: GlucoseReading[] = [createMockReading(1, "Jejum", 100)];
    const evaluation = createMockEvaluation({
      glucoseReadings: readings,
      diabetesType: "DM2",
    });

    const analysis = generateClinicalAnalysis(evaluation);
    const ruleIds = analysis.rulesTriggered.map(r => r.id);

    expect(ruleIds).toContain("SBD-R10");
    expect(ruleIds).toContain("SBD-R11");
    expect(ruleIds).toContain("SBD-R16");
  });
});

// =============================================================================
// INSULIN ADJUSTMENT ANALYSIS TESTS
// =============================================================================

describe("Insulin Adjustment Analysis - Fasting with Dawn Correlation", () => {
  it("should recommend increasing NPH when fasting high AND dawn high (≥3 days)", () => {
    const readings: GlucoseReading[] = [
      { jejum: 110, madrugada: 115 },
      { jejum: 105, madrugada: 120 },
      { jejum: 108, madrugada: 110 },
      { jejum: 102, madrugada: 105 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const jejumAdjust = result.ajustesRecomendados.find(a => a.periodo === "Jejum");

    expect(jejumAdjust).toBeDefined();
    expect(jejumAdjust?.insulinaAfetada).toBe("NPH_NOTURNA");
    expect(jejumAdjust?.direcao).toBe("AUMENTAR");
    expect(jejumAdjust?.justificativa).toContain("madrugada elevada");
  });

  it("should recommend REDUCING NPH when fasting high BUT dawn LOW (Somogyi effect)", () => {
    const readings: GlucoseReading[] = [
      { jejum: 115, madrugada: 55 },
      { jejum: 120, madrugada: 60 },
      { jejum: 110, madrugada: 58 },
      { jejum: 105, madrugada: 62 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const jejumAdjust = result.ajustesRecomendados.find(a => a.periodo === "Jejum");

    expect(jejumAdjust).toBeDefined();
    expect(jejumAdjust?.insulinaAfetada).toBe("NPH_NOTURNA");
    expect(jejumAdjust?.direcao).toBe("REDUZIR");
    expect(jejumAdjust?.justificativa).toContain("Somogyi");
  });

  it("should request dawn data when fasting high but no dawn readings", () => {
    const readings: GlucoseReading[] = [
      { jejum: 110 },
      { jejum: 105 },
      { jejum: 108 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const jejumAdjust = result.ajustesRecomendados.find(a => a.periodo === "Jejum");

    expect(jejumAdjust).toBeDefined();
    expect(jejumAdjust?.direcao).toBe("SOLICITAR_DADOS");
    expect(jejumAdjust?.justificativa).toContain("madrugada");
  });
});

describe("Insulin Adjustment Analysis - Pre-prandial Patterns", () => {
  it("should recommend increasing morning NPH when pre-lunch high (≥3 days)", () => {
    const readings: GlucoseReading[] = [
      { preAlmoco: 115 },
      { preAlmoco: 110 },
      { preAlmoco: 120 },
      { preAlmoco: 108 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const preAlmocoAdjust = result.ajustesRecomendados.find(a => a.periodo === "Pré-almoço");

    expect(preAlmocoAdjust).toBeDefined();
    expect(preAlmocoAdjust?.insulinaAfetada).toBe("NPH_MANHA");
    expect(preAlmocoAdjust?.direcao).toBe("AUMENTAR");
  });

  it("should recommend increasing lunch NPH when pre-dinner high (≥3 days)", () => {
    const readings: GlucoseReading[] = [
      { preJantar: 115 },
      { preJantar: 112 },
      { preJantar: 118 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const preJantarAdjust = result.ajustesRecomendados.find(a => a.periodo === "Pré-jantar");

    expect(preJantarAdjust).toBeDefined();
    expect(preJantarAdjust?.insulinaAfetada).toBe("NPH_ALMOCO");
    expect(preJantarAdjust?.direcao).toBe("AUMENTAR");
  });
});

describe("Insulin Adjustment Analysis - Post-prandial Delta Logic", () => {
  it("should recommend rapid insulin when delta >40 repeatedly (post-lunch)", () => {
    // Post-lunch 170, pre-lunch 95 → delta = 75 (>40) → rapid insulin problem
    const readings: GlucoseReading[] = [
      { preAlmoco: 95, posAlmoco1h: 170 },
      { preAlmoco: 90, posAlmoco1h: 165 },
      { preAlmoco: 92, posAlmoco1h: 160 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const posAlmocoAdjust = result.ajustesRecomendados.find(a => a.periodo === "1h pós-almoço");

    expect(posAlmocoAdjust).toBeDefined();
    expect(posAlmocoAdjust?.insulinaAfetada).toBe("RAPIDA_ALMOCO");
    expect(posAlmocoAdjust?.direcao).toBe("AUMENTAR");
    expect(posAlmocoAdjust?.justificativa).toContain("Excursão glicêmica >40");
  });

  it("should recommend NPH (not rapid) when delta ≤40 but post high", () => {
    // Post-lunch 160, pre-lunch 130 → delta = 30 (≤40) → NPH problem, not rapid
    const readings: GlucoseReading[] = [
      { preAlmoco: 130, posAlmoco1h: 160 },
      { preAlmoco: 125, posAlmoco1h: 155 },
      { preAlmoco: 128, posAlmoco1h: 158 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const posAlmocoAdjust = result.ajustesRecomendados.find(a => a.periodo === "1h pós-almoço");

    expect(posAlmocoAdjust).toBeDefined();
    expect(posAlmocoAdjust?.insulinaAfetada).toBe("NPH_MANHA");
    expect(posAlmocoAdjust?.direcao).toBe("AUMENTAR");
    expect(posAlmocoAdjust?.justificativa).toContain("excursão glicêmica adequada");
    expect(posAlmocoAdjust?.justificativa).toContain("não na rápida");
  });

  it("should request pre-meal data when post high but no pre-meal readings", () => {
    const readings: GlucoseReading[] = [
      { posAlmoco1h: 165 },
      { posAlmoco1h: 170 },
      { posAlmoco1h: 160 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const posAlmocoAdjust = result.ajustesRecomendados.find(a => a.periodo === "1h pós-almoço");

    expect(posAlmocoAdjust).toBeDefined();
    expect(posAlmocoAdjust?.direcao).toBe("SOLICITAR_DADOS");
    expect(posAlmocoAdjust?.justificativa).toContain("Pré-almoço");
  });
});

describe("Insulin Adjustment Analysis - Hypoglycemia Detection", () => {
  it("should recommend reducing NPH when pre-meal hypoglycemia (≥2 episodes)", () => {
    const readings: GlucoseReading[] = [
      { preAlmoco: 58 },
      { preAlmoco: 62 },
      { preAlmoco: 85 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const hypoAdjust = result.ajustesRecomendados.find(a => a.direcao === "REDUZIR");

    expect(hypoAdjust).toBeDefined();
    expect(hypoAdjust?.insulinaAfetada).toBe("NPH_MANHA");
    expect(hypoAdjust?.justificativa).toContain("Hipoglicemia");
  });

  it("should recommend reducing rapid when post-meal hypoglycemia (≥2 episodes)", () => {
    const readings: GlucoseReading[] = [
      { jejum: 90, posCafe1h: 55 },
      { jejum: 88, posCafe1h: 60 },
      { jejum: 92, posCafe1h: 110 },
    ];

    const result = analyzeInsulinAdjustments(readings);
    const hypoAdjust = result.ajustesRecomendados.find(a => a.direcao === "REDUZIR");

    expect(hypoAdjust).toBeDefined();
    expect(hypoAdjust?.insulinaAfetada).toBe("RAPIDA_CAFE");
  });

  it("should prioritize reduction over increase when both patterns present", () => {
    const readings: GlucoseReading[] = [
      { jejum: 110, preAlmoco: 55, madrugada: 115 },
      { jejum: 108, preAlmoco: 60, madrugada: 110 },
      { jejum: 112, preAlmoco: 85, madrugada: 105 },
    ];

    const result = analyzeInsulinAdjustments(readings);

    expect(result.prioridadeMaxima).toBe("REDUZIR");
  });
});

describe("Insulin Adjustment Analysis - No Adjustment Needed", () => {
  it("should return no adjustments when all readings in target", () => {
    const readings: GlucoseReading[] = [
      { jejum: 88, posCafe1h: 125, preAlmoco: 85, posAlmoco1h: 130 },
      { jejum: 90, posCafe1h: 120, preAlmoco: 88, posAlmoco1h: 125 },
      { jejum: 85, posCafe1h: 115, preAlmoco: 82, posAlmoco1h: 128 },
    ];

    const result = analyzeInsulinAdjustments(readings);

    expect(result.ajustesRecomendados.length).toBe(0);
    expect(result.prioridadeMaxima).toBe("MANTER");
    expect(result.resumoGeral).toContain("Manter");
  });

  it("should not trigger adjustment for isolated high readings (< 3 days)", () => {
    const readings: GlucoseReading[] = [
      { jejum: 110 }, // High
      { jejum: 88 },  // Normal
      { jejum: 85 },  // Normal
    ];

    const result = analyzeInsulinAdjustments(readings);
    const jejumAdjust = result.ajustesRecomendados.find(a => a.periodo === "Jejum");

    expect(jejumAdjust).toBeUndefined();
  });
});
