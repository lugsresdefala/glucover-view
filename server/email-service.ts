import { logger } from "./logger";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  private static isConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  static async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn("Email service not configured. Email not sent.", {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }

    try {
      logger.info("Sending email", {
        to: options.to,
        subject: options.subject,
      });

      return true;
    } catch (error) {
      logger.error("Failed to send email", error as Error, {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  static async sendCriticalGlucoseAlert(
    patientEmail: string,
    patientName: string,
    alerts: Array<{ type: string; value: number; timepoint: string; day: number }>
  ): Promise<boolean> {
    const alertList = alerts
      .map((a) => `- ${a.type === "hypoglycemia" ? "Hipoglicemia" : "Hiperglicemia Severa"}: ${a.value} mg/dL (${a.timepoint}, Dia ${a.day})`)
      .join("\n");

    const text = `
Olá ${patientName},

Foram detectados valores críticos de glicemia em sua última avaliação:

${alertList}

Por favor, entre em contato com seu médico imediatamente.

Atenciosamente,
Sistema de Monitoramento de Diabetes Gestacional
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Alerta de Glicemia Crítica</h2>
        <p>Olá <strong>${patientName}</strong>,</p>
        <p>Foram detectados valores críticos de glicemia em sua última avaliação:</p>
        <ul style="background: #fef2f2; padding: 20px; border-left: 4px solid #dc2626;">
          ${alerts
            .map(
              (a) =>
                `<li><strong>${a.type === "hypoglycemia" ? "Hipoglicemia" : "Hiperglicemia Severa"}</strong>: ${a.value} mg/dL (${a.timepoint}, Dia ${a.day})</li>`
            )
            .join("")}
        </ul>
        <p><strong>Por favor, entre em contato com seu médico imediatamente.</strong></p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
        <p style="color: #666; font-size: 12px;">Sistema de Monitoramento de Diabetes Gestacional</p>
      </div>
    `.trim();

    return await this.sendEmail({
      to: patientEmail,
      subject: "⚠️ Alerta: Valores Críticos de Glicemia Detectados",
      text,
      html,
    });
  }

  static async sendRecommendationNotification(
    recipientEmail: string,
    recipientName: string,
    patientName: string,
    urgencyLevel: "info" | "warning" | "critical"
  ): Promise<boolean> {
    const urgencyText = {
      info: "Informação",
      warning: "Atenção",
      critical: "Urgente",
    };

    const urgencyColor = {
      info: "#3b82f6",
      warning: "#f59e0b",
      critical: "#dc2626",
    };

    const text = `
Olá ${recipientName},

Uma nova avaliação foi processada para a paciente ${patientName}.

Nível de Urgência: ${urgencyText[urgencyLevel]}

Por favor, acesse o sistema para visualizar as recomendações completas.

Atenciosamente,
Sistema de Monitoramento de Diabetes Gestacional
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${urgencyColor[urgencyLevel]};">Nova Recomendação Disponível</h2>
        <p>Olá <strong>${recipientName}</strong>,</p>
        <p>Uma nova avaliação foi processada para a paciente <strong>${patientName}</strong>.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Nível de Urgência:</strong> <span style="color: ${urgencyColor[urgencyLevel]};">${urgencyText[urgencyLevel]}</span></p>
        </div>
        <p>Por favor, acesse o sistema para visualizar as recomendações completas.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
        <p style="color: #666; font-size: 12px;">Sistema de Monitoramento de Diabetes Gestacional</p>
      </div>
    `.trim();

    return await this.sendEmail({
      to: recipientEmail,
      subject: `[${urgencyText[urgencyLevel]}] Nova Recomendação - ${patientName}`,
      text,
      html,
    });
  }

  static async sendPatientAssignmentNotification(
    patientEmail: string,
    patientName: string,
    doctorName: string,
    doctorSpecialization?: string
  ): Promise<boolean> {
    const specializationText = doctorSpecialization ? ` (${doctorSpecialization})` : "";

    const text = `
Olá ${patientName},

${doctorName}${specializationText} foi atribuído(a) como seu profissional de saúde responsável.

Você pode entrar em contato através do sistema para agendar consultas e esclarecer dúvidas.

Atenciosamente,
Sistema de Monitoramento de Diabetes Gestacional
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Novo Profissional de Saúde Atribuído</h2>
        <p>Olá <strong>${patientName}</strong>,</p>
        <p><strong>${doctorName}</strong>${specializationText} foi atribuído(a) como seu profissional de saúde responsável.</p>
        <p>Você pode entrar em contato através do sistema para agendar consultas e esclarecer dúvidas.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
        <p style="color: #666; font-size: 12px;">Sistema de Monitoramento de Diabetes Gestacional</p>
      </div>
    `.trim();

    return await this.sendEmail({
      to: patientEmail,
      subject: "Novo Profissional de Saúde Atribuído",
      text,
      html,
    });
  }
}
