import { logger } from "@/server/observability/logger";

type PasswordResetNotification = {
  type: "PASSWORD_RESET";
  to: string;
  payload: { resetUrl: string; userName: string };
};

type InvitationNotification = {
  type: "INVITATION";
  to: string;
  payload: { invitationUrl: string; userName: string };
};

type Notification = PasswordResetNotification | InvitationNotification;

export function simulateNotification(notification: Notification): void {
  logger.info("notification.simulated", {
    type: notification.type,
    // Omit personal data from log — only log the event type and delivery status
    deliveryStatus: "SIMULATED",
  });
}
