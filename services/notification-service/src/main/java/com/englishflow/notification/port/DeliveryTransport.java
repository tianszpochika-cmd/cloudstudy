package com.englishflow.notification.port;

import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationMessage;

/** Channel adapter. It receives a service-owned message, never an arbitrary payload. */
public interface DeliveryTransport {

    DeliveryOutcome deliver(NotificationMessage message, NotificationChannel channel);

    enum FailureDisposition {
        RETRYABLE,
        TERMINAL
    }

    record DeliveryOutcome(boolean delivered, String failureCode, FailureDisposition disposition) {
        public DeliveryOutcome(boolean delivered, String failureCode) {
            this(delivered, failureCode, delivered ? null : FailureDisposition.RETRYABLE);
        }

        public DeliveryOutcome {
            if (delivered && (failureCode != null || disposition != null)) {
                throw new IllegalArgumentException("successful delivery cannot have failure metadata");
            }
            if (!delivered && (failureCode == null || !failureCode.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,79}")
                    || disposition == null)) {
                throw new IllegalArgumentException("failed delivery must have a safe failure code");
            }
        }

        public static DeliveryOutcome success() {
            return new DeliveryOutcome(true, null, null);
        }

        public static DeliveryOutcome failed(String failureCode) {
            return new DeliveryOutcome(false, failureCode, FailureDisposition.RETRYABLE);
        }

        public static DeliveryOutcome terminal(String failureCode) {
            return new DeliveryOutcome(false, failureCode, FailureDisposition.TERMINAL);
        }
    }
}
