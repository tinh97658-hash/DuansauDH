import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";

const templates: Record<string, { subject: string; message: string }> = {
  admin: { subject: "Registration", message: "Registration was successful" },
  staffAdd: { subject: "Tài khoản nội bộ đã được cấp", message: "Bạn đã được thêm vào Hệ thống quản lý đào tạo sau đại học" },
  approved: { subject: "Registration on Post Graduate Program", message: "You have been approved by admin" },
  submission: { subject: "Submission successful", message: "You have successfully submitted your report" },
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: ConfigService) {}

  private transporter() {
    const port = Number(this.config.get("HOSTPORT")) || 587;
    return nodemailer.createTransport({
      host: this.config.get("HOST"),
      port,
      secure: port === 465,
      service: this.config.get("SERVICE") || undefined,
      auth: { user: this.config.get("EMAIL_USERNAME"), pass: this.config.get("PASSWORD") },
    });
  }

  async send(email: string | string[], subject: string, message: string) {
    const username = this.config.get<string>("EMAIL_USERNAME");
    const recipients = Array.isArray(email) ? email.filter(Boolean) : [email].filter(Boolean);
    if (!username || !recipients.length) return;
    await this.transporter().sendMail({ from: username, to: recipients, subject, text: message });
  }

  notify(email: string[], template: string, sender: string, link = "") {
    const content = templates[template];
    if (!content || !email.length || !this.config.get("EMAIL_USERNAME")) return;
    const message = template === "admin" ? `${content.message}. Click here to approve: ${link}` : content.message;
    setTimeout(() => this.send(email, content.subject, message).catch((error) => this.logger.error(error)), 5000);
  }
}
