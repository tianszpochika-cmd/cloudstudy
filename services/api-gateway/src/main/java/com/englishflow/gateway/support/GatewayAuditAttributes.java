package com.englishflow.gateway.support;

import org.springframework.web.server.ServerWebExchange;

/** Exchange-local, redacted audit metadata shared by boundary filters. */
public final class GatewayAuditAttributes {

    public static final String REASON_CODE = GatewayAuditAttributes.class.getName() + ".reasonCode";

    private GatewayAuditAttributes() {
    }

    public static void setReasonCode(ServerWebExchange exchange, String reasonCode) {
        if (reasonCode != null && !reasonCode.isBlank()) {
            exchange.getAttributes().put(REASON_CODE, reasonCode);
        }
    }

    public static String reasonCode(ServerWebExchange exchange, String fallback) {
        Object value = exchange.getAttribute(REASON_CODE);
        return value instanceof String reason && !reason.isBlank() ? reason : fallback;
    }
}
