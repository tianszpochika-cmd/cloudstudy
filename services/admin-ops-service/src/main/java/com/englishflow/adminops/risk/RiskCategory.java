package com.englishflow.adminops.risk;

/** Risk signal categories. Detection rules and analyst filings both use this closed set. */
public enum RiskCategory {
    ACCOUNT_SECURITY,
    DEVICE_ANOMALY,
    PAYMENT_ANOMALY,
    ACTIVATION_ABUSE,
    EXPORT_ANOMALY,
    CONTENT_RIGHTS
}
