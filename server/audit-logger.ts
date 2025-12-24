import { db } from "./db";
import { auditLogs, type InsertAuditLog } from "@shared/models/auth";
import type { Request } from "express";

export class AuditLogger {
  static async log(params: {
    userId?: string;
    patientId?: number;
    action: "create" | "update" | "delete" | "view" | "login" | "logout" | "assign" | "unassign";
    entityType: string;
    entityId?: string;
    changes?: Record<string, any>;
    req?: Request;
    success?: boolean;
    errorMessage?: string;
  }) {
    try {
      const logEntry: InsertAuditLog = {
        userId: params.userId || null,
        patientId: params.patientId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        changes: params.changes || null,
        ipAddress: params.req ? this.getClientIp(params.req) : null,
        userAgent: params.req?.headers["user-agent"] || null,
        success: params.success !== undefined ? params.success : true,
        errorMessage: params.errorMessage || null,
      };

      await db.insert(auditLogs).values(logEntry);
    } catch (error) {
      console.error("Failed to log audit entry:", error);
    }
  }

  static async logLogin(userId: string | number, req: Request, success: boolean = true, errorMessage?: string) {
    await this.log({
      userId: String(userId),
      action: "login",
      entityType: "auth",
      entityId: String(userId),
      req,
      success,
      errorMessage,
    });
  }

  static async logLogout(userId: string | number, req: Request) {
    await this.log({
      userId: String(userId),
      action: "logout",
      entityType: "auth",
      entityId: String(userId),
      req,
    });
  }

  static async logPatientView(userId: string, patientId: number, req: Request) {
    await this.log({
      userId,
      patientId,
      action: "view",
      entityType: "patients",
      entityId: String(patientId),
      req,
    });
  }

  static async logEvaluationCreate(userId: string | undefined, patientId: number, evaluationId: number, req: Request) {
    await this.log({
      userId,
      patientId,
      action: "create",
      entityType: "evaluations",
      entityId: String(evaluationId),
      req,
    });
  }

  static async logPatientAssignment(doctorId: string, patientId: number, req: Request) {
    await this.log({
      userId: doctorId,
      patientId,
      action: "assign",
      entityType: "doctor_patients",
      req,
    });
  }

  private static getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
  }

  static async getAuditTrail(params: {
    userId?: string;
    patientId?: number;
    entityType?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(auditLogs);

    if (params.userId) {
      query = query.where(eq(auditLogs.userId, params.userId)) as any;
    }
    if (params.patientId) {
      query = query.where(eq(auditLogs.patientId, params.patientId)) as any;
    }
    if (params.entityType) {
      query = query.where(eq(auditLogs.entityType, params.entityType)) as any;
    }

    query = query.orderBy(desc(auditLogs.timestamp)) as any;

    if (params.limit) {
      query = query.limit(params.limit) as any;
    }
    if (params.offset) {
      query = query.offset(params.offset) as any;
    }

    return await query;
  }
}

import { eq, desc } from "drizzle-orm";
