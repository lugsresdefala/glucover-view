# Design Guidelines: Clinical Decision Support Platform for Gestational Diabetes

## Design Approach: Medical Data Dashboard System

**Selected Approach:** Design System-Based (Material Design adapted for healthcare)

**Justification:** This is a utility-focused, information-dense clinical application where accuracy, clarity, and efficiency are paramount. Healthcare professionals need quick access to patient data and clear, unambiguous recommendations. The design must prioritize data hierarchy, readability, and professional credibility over visual flair.

**Key Design Principles:**
- Clinical clarity over aesthetic decoration
- Data-first hierarchy with medical information prominently displayed
- Professional, trustworthy interface appropriate for healthcare settings
- Efficient workflows minimizing clicks to critical information
- Accessibility for use in various clinical environments

---

## Typography

**Font Selection:**
- Primary: Inter (via Google Fonts) - exceptional readability for medical data
- Monospace: JetBrains Mono - for numerical data, dosages, measurements

**Type Scale:**
- Page Headers: text-3xl font-semibold (patient name, dashboard title)
- Section Headers: text-xl font-semibold (Dados Glicêmicos, Recomendações)
- Subsection Headers: text-lg font-medium (Insulina Atual, Histórico)
- Body Text: text-base (clinical descriptions, guidelines)
- Data Labels: text-sm font-medium uppercase tracking-wide (field labels)
- Numerical Data: text-lg font-mono font-semibold (glucose readings, doses)
- Small Print: text-xs (timestamps, metadata)

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6 or p-8
- Section spacing: mb-8 or mb-12
- Form field gaps: gap-4 or gap-6
- Card spacing: space-y-6
- Grid gaps: gap-6

**Container Strategy:**
- Main container: max-w-7xl mx-auto px-4 (dashboard width)
- Form cards: max-w-2xl (data entry forms)
- Recommendation panels: max-w-4xl (clinical guidance display)

---

## Component Library

### Navigation & Header
**Top Navigation Bar:**
- Fixed header with logo/title on left: "Sistema de Suporte - DMG"
- Patient identifier in center when applicable
- User profile/settings on right
- Height: h-16
- Border bottom for separation

### Dashboard Layout
**Main Layout Structure:**
- Two-column grid on desktop (lg:grid-cols-3)
- Left sidebar (lg:col-span-1): Patient summary card, quick stats
- Main content area (lg:col-span-2): Data entry form, recommendations, charts

### Data Entry Form
**Form Card Components:**
- White cards with subtle border and shadow
- Grouped sections with section headers
- Form fields organized in responsive grid (grid-cols-1 md:grid-cols-2)
- Input fields: rounded-lg border with focus states
- Labels above inputs (block mb-2)
- Numerical inputs with large, legible text (text-lg font-mono)
- Date pickers for gestational age
- Radio buttons for yes/no selections (insulin use)
- Dropdowns for insulin type selection

**Critical Input Fields:**
1. Medidas Glicêmicas (multiple time points: jejum, 1h pós-café, pré-almoço, 2h pós-almoço, etc.)
2. Peso Atual (kg)
3. Idade Gestacional (semanas + dias)
4. Uso de Insulina (sim/não)
5. Tipo de Insulina (NPH, Regular, Asparte, etc.)
6. Dose Atual (UI/dia)
7. Adesão à Dieta (escala ou sim/não)

### Recommendation Panel
**Clinical Guidance Display:**
- Prominent card with distinct visual treatment
- Alert-style indicators for urgency (neutral info, yellow warning for action needed)
- Recommendation header: "Conduta Sugerida"
- Structured recommendation sections:
  - Análise dos Dados (summary of patient status)
  - Recomendação Principal (primary clinical action)
  - Justificativa (reasoning based on guidelines R1-R7)
  - Próximos Passos (follow-up actions)
- Citation references to specific guideline recommendations (e.g., "Baseado em R4")

### Data Visualization
**Glycemic Charts:**
- Line charts for glucose trends over time
- Target range shaded areas (meta glicêmica)
- Clear axis labels and legends
- Use chart library like Chart.js via CDN
- Responsive container: aspect-video or aspect-[16/9]

**Stats Display:**
- Grid of metric cards (grid-cols-2 lg:grid-cols-4)
- Each card shows: label, large number, trend indicator
- Metrics: % valores na meta, média glicêmica, dias desde diagnóstico

### Patient History Table
**Timeline/History Component:**
- Table or card-based timeline showing previous evaluations
- Columns: Data, IG (idade gestacional), Conduta, Status
- Collapsible rows for detailed view
- Most recent entries first

### Action Buttons
**Primary Actions:**
- Large, prominent button: "Analisar e Gerar Recomendação"
- Button styling: px-8 py-3 rounded-lg font-semibold
- Secondary actions: "Salvar Dados", "Ver Histórico", "Imprimir"
- Icon support using Heroicons (document, chart, printer icons)

### Alert/Status Components
**Clinical Alerts:**
- Info boxes for guidelines and context
- Warning boxes for values out of range
- Success confirmation for saved data
- Rounded containers with left border accent

---

## Medical-Specific Considerations

**Data Accuracy Indicators:**
- Clear visual distinction between entered data and calculated/suggested values
- Required field indicators (asterisks) for critical medical data
- Validation messages for out-of-range values (e.g., impossible glucose readings)

**Professional Trust Elements:**
- Disclaimer footer: "Sistema de suporte à decisão. Decisões finais devem ser tomadas por profissional de saúde."
- Reference to source guidelines: "Baseado nas Diretrizes DMG 2024"
- Clear version/update information

**Accessibility for Clinical Use:**
- High contrast for readability in various lighting
- Large touch targets for tablet use (min h-12 for buttons)
- Print-friendly recommendation output
- Keyboard navigation support for rapid data entry

---

## Images

**No hero images or decorative photography.** This is a professional clinical tool requiring a data-centric approach.

**Icon Usage Only:**
- Medical icons from Heroicons: document-text, chart-bar, beaker, clipboard-document-list
- Status icons: check-circle (success), exclamation-triangle (warning), information-circle (info)
- Use sparingly, only to enhance data comprehension

---

## Animation

**Minimal, purposeful only:**
- Smooth transitions on form validation (duration-200)
- Loading spinner when generating AI recommendations
- Fade-in for recommendation panel appearance
- NO decorative animations that distract from clinical workflow