import { db } from "./db";
import { notifications, type InsertNotification, patients, users } from "@shared/models/auth";
import { eq, and, desc } from "drizzle-orm";
import type { CriticalAlert } from "@shared/schema";
import { EmailService } from "./email-service";
import { logger } from "./logger";

export class NotificationService {
  static async createNotification(params: InsertNotification) {
    const [notification] = await db
      .insert(notifications)
      .values(params)
      .returning();
    return notification;
  }

  static async notifyCriticalGlucose(
    patientId: number,
    userId: string | undefined,
    evaluationId: number,
    alerts: CriticalAlert[]
  ) {
    const alertMessages = alerts.map(alert => {
      const type = alert.type === "hypoglycemia" ? "Hipoglicemia" : "Hiperglicemia Severa";
      return `${type}: ${alert.value} mg/dL (${alert.timepoint}, Dia ${alert.day})`;
    }).join("\n");

    const notification = await this.createNotification({
      userId: userId || null,
      patientId,
      type: "critical_glucose",
      title: "⚠️ Valores Críticos de Glicemia Detectados",
      message: `Atenção! Foram detectados valores críticos de glicemia:\n\n${alertMessages}\n\nAção imediata recomendada.`,
      severity: "critical",
      relatedEvaluationId: evaluationId,
      isRead: false,
      sentViaEmail: false,
    });

    try {
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (patient?.email) {
        const emailSent = await EmailService.sendCriticalGlucoseAlert(
          patient.email,
          patient.name,
          alerts
        );

        if (emailSent && notification) {
          await db
            .update(notifications)
            .set({ sentViaEmail: true })
            .where(eq(notifications.id, notification.id));
        }
      }
    } catch (error) {
      logger.error("Failed to send critical glucose email", error as Error, {
        patientId,
        evaluationId,
      });
    }
  }

  static async notifyPatientAssignment(
    patientId: number,
    doctorId: string,
    doctorName: string
  ) {
    const notification = await this.createNotification({
      patientId,
      userId: null,
      type: "assignment",
      title: "Novo Profissional de Saúde Atribuído",
      message: `${doctorName} foi atribuído(a) como seu profissional de saúde responsável.`,
      severity: "info",
      relatedEvaluationId: null,
      isRead: false,
      sentViaEmail: false,
    });

    try {
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      const [doctor] = await db
        .select()
        .from(users)
        .where(eq(users.id, doctorId))
        .limit(1);

      if (patient?.email && doctor) {
        const emailSent = await EmailService.sendPatientAssignmentNotification(
          patient.email,
          patient.name,
          `${doctor.firstName} ${doctor.lastName || ""}`.trim(),
          doctor.specialization || undefined
        );

        if (emailSent && notification) {
          await db
            .update(notifications)
            .set({ sentViaEmail: true })
            .where(eq(notifications.id, notification.id));
        }
      }
    } catch (error) {
      logger.error("Failed to send assignment email", error as Error, {
        patientId,
        doctorId,
      });
    }
  }

  static async notifyRecommendationReady(
    patientId: number,
    userId: string | undefined,
    evaluationId: number,
    urgencyLevel: "info" | "warning" | "critical"
  ) {
    const severityMap = {
      info: "info",
      warning: "warning",
      critical: "critical",
    } as const;

    await this.createNotification({
      userId: userId || null,
      patientId,
      type: "system",
      title: "Nova Recomendação Disponível",
      message: "Uma nova avaliação foi processada e as recomendações estão disponíveis para visualização.",
      severity: severityMap[urgencyLevel],
      relatedEvaluationId: evaluationId,
      isRead: false,
      sentViaEmail: false,
    });
  }

  static async getUserNotifications(userId: string, includeRead: boolean = false) {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    if (!includeRead) {
      query = query.where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      )) as any;
    }

    return await query;
  }

  static async getPatientNotifications(patientId: number, includeRead: boolean = false) {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.patientId, patientId))
      .orderBy(desc(notifications.createdAt));

    if (!includeRead) {
      query = query.where(and(
        eq(notifications.patientId, patientId),
        eq(notifications.isRead, false)
      )) as any;
    }

    return await query;
  }

  static async markAsRead(notificationId: number, userId?: string, patientId?: number) {
    const conditions = [eq(notifications.id, notificationId)];

    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }
    if (patientId) {
      conditions.push(eq(notifications.patientId, patientId));
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  static async markAllAsRead(userId?: string, patientId?: number) {
    if (userId) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));
    } else if (patientId) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.patientId, patientId));
    }
  }

  static async getUnreadCount(userId?: string, patientId?: number): Promise<number> {
    let notifications_list;

    if (userId) {
      notifications_list = await db
        .select()
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));
    } else if (patientId) {
      notifications_list = await db
        .select()
        .from(notifications)
        .where(and(
          eq(notifications.patientId, patientId),
          eq(notifications.isRead, false)
        ));
    } else {
      return 0;
    }

    return notifications_list.length;
  }
}
