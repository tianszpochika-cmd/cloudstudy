package com.englishflow.gateway.support;

@FunctionalInterface
public interface SecurityAuditSink {
    void record(SecurityAuditRecord record);
}
