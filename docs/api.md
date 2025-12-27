# GluCover API Documentation

## Overview

GluCover is a clinical decision support system for diabetes mellitus in pregnancy. This document describes the REST API endpoints.

**Base URL:** `/api`

**Authentication:** Session-based with CSRF protection for mutating requests.

---

## Authentication

### Professional Authentication

#### POST /api/auth/register
Register a new healthcare professional.

**Request Body:**
```json
{
  "email": "string",
  "password": "string (min 6 chars)",
  "firstName": "string (min 2 chars)",
  "lastName": "string (optional)",
  "role": "medico | enfermeira | nutricionista | admin | coordinator"
}
```

**Response:** `201 Created`
```json
{
  "message": "Cadastro realizado com sucesso",
  "user": { "id": "uuid", "email": "string", "firstName": "string" }
}
```

#### POST /api/auth/login
Login for healthcare professionals.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login realizado com sucesso",
  "user": { "id": "uuid", "email": "string", "firstName": "string", "role": "string" }
}
```

#### POST /api/auth/logout
Logout current session.

**Response:** `200 OK`
```json
{ "message": "Logout realizado com sucesso" }
```

#### GET /api/user/me
Get current authenticated user.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "role": "string"
  }
}
```

### Patient Authentication

#### POST /api/patient/register
Register a new patient.

**Request Body:**
```json
{
  "email": "string",
  "password": "string (min 6 chars)",
  "name": "string (min 2 chars)",
  "phone": "string (optional)"
}
```

#### POST /api/patient/login
Login for patients.

#### GET /api/patient/me
Get current authenticated patient.

---

## Clinical Evaluations

### POST /api/evaluate
Create or update a patient evaluation with glucose data.

**Authentication:** Required (professional)

**Request Body:**
```json
{
  "patientName": "string",
  "gestationalWeeks": "number (0-42)",
  "gestationalDays": "number (0-6)",
  "diabetesType": "DMG | DM1 | DM2",
  "weight": "number | null",
  "usesInsulin": "boolean",
  "insulinRegimens": [{
    "type": "string",
    "doseManhaUI": "number",
    "doseAlmocoUI": "number",
    "doseJantarUI": "number",
    "doseDormirUI": "number"
  }],
  "glucoseReadings": [{
    "date": "string (YYYY-MM-DD)",
    "jejum": "number | null",
    "posCafe1h": "number | null",
    "preAlmoco": "number | null",
    "posAlmoco1h": "number | null",
    "preJantar": "number | null",
    "posJantar1h": "number | null",
    "madrugada3h": "number | null"
  }],
  "abdominalCircumferencePercentile": "number | null",
  "dum": "string | null"
}
```

**Response:** `200 OK`
```json
{
  "id": "number",
  "patientName": "string",
  ...
}
```

### GET /api/evaluations
Get all evaluations for the authenticated user.

**Authentication:** Required (professional)

**Response:** `200 OK`
```json
[
  {
    "id": "number",
    "patientName": "string",
    "gestationalWeeks": "number",
    "diabetesType": "string",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  }
]
```

### GET /api/evaluations/:id
Get a specific evaluation by ID.

**Authentication:** Required (professional)

### DELETE /api/evaluations/:id
Delete an evaluation.

**Authentication:** Required (professional)

---

## Clinical Analysis

### POST /api/analyze
Generate AI-powered clinical analysis and recommendations.

**Authentication:** Required (professional)

**Rate Limit:** 20 requests per minute

**Request Body:**
```json
{
  "evaluation": {
    // Same structure as POST /api/evaluate
  }
}
```

**Response:** `200 OK`
```json
{
  "recommendation": "string (clinical recommendation text)",
  "analysis": {
    "patientName": "string",
    "gestationalAge": "string",
    "diabetesType": "DMG | DM1 | DM2",
    "totalReadings": "number",
    "percentInTarget": "number",
    "percentAboveTarget": "number",
    "averageGlucose": "number",
    "criticalAlerts": [{
      "type": "hypoglycemia | hyperglycemia",
      "date": "string",
      "period": "string",
      "value": "number"
    }],
    "rulesTriggered": [{
      "id": "string",
      "title": "string",
      "classification": "string",
      "description": "string",
      "source": "SBD 2025 | FEBRASGO 2019 | WHO 2025"
    }],
    "urgencyLevel": "info | warning | critical",
    "recommendedActions": ["string"],
    "insulinRecommendation": "string"
  }
}
```

### POST /api/batch-evaluate
Process multiple patient evaluations in batch.

**Authentication:** Required (professional)

**Rate Limit:** 20 requests per minute

---

## Health Check

### GET /healthz
Basic health check - server is running.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "ISO 8601 datetime",
  "uptime": "number (seconds)"
}
```

### GET /readyz
Readiness check - verifies database connection.

**Response:** `200 OK`
```json
{
  "status": "ready",
  "timestamp": "ISO 8601 datetime",
  "database": "connected",
  "evaluationsCount": "number"
}
```

---

## Security

### GET /api/csrf-token
Get CSRF token for mutating requests.

**Response:** `200 OK`
```json
{ "csrfToken": "string" }
```

### Headers

All mutating requests (POST, PUT, PATCH, DELETE) must include:
- `X-CSRF-Token: <token>` or
- `X-XSRF-Token: <token>`

---

## Rate Limits

| Route Pattern | Limit | Window |
|---------------|-------|--------|
| Global `/api/*` | 100 requests | 1 minute |
| `/api/auth/*` | 10 requests | 15 minutes |
| `/api/patient/auth/*` | 10 requests | 15 minutes |
| `/api/analyze` | 20 requests | 1 minute |
| `/api/batch-evaluate` | 20 requests | 1 minute |

---

## Error Responses

All errors return a JSON object with a `message` field:

```json
{ "message": "Error description" }
```

Common status codes:
- `400` - Bad Request (validation error)
- `401` - Not authenticated
- `403` - Forbidden (CSRF or permission error)
- `404` - Resource not found
- `429` - Too many requests (rate limited)
- `500` - Internal server error

---

## Clinical Guidelines Reference

The system applies recommendations from:
- **SBD 2025** (R1-R17): Sociedade Brasileira de Diabetes
- **FEBRASGO 2019** (F1-F10): Federacao Brasileira de Ginecologia
- **WHO 2025** (W1-W12): World Health Organization

### Glycemic Targets (FEBRASGO-F5)
| Period | Target |
|--------|--------|
| Fasting | 65-95 mg/dL |
| Pre-meal | <100 mg/dL |
| 1h Post-prandial | <140 mg/dL |
| 3h Midnight | <100 mg/dL |
