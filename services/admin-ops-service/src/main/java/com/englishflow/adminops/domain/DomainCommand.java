package com.englishflow.adminops.domain;

import java.time.Instant;
import java.util.Map;

/** Server-authored command envelope; it is forwarded only through a port. */
public record DomainCommand(
        String commandId,
        Domain domain,
        CommandAction action,
        String resourceRef,
        String tenantId,
        String actorSubjectId,
        String traceId,
        String expectedVersion,
        String reasonCode,
        Map<String, String> attributes,
        Instant createdAt) {

    public DomainCommand {
        if (commandId == null || commandId.isBlank() || domain == null || action == null
                || action.domain() != domain || resourceRef == null || resourceRef.isBlank()
                || tenantId == null || tenantId.isBlank() || actorSubjectId == null || actorSubjectId.isBlank()
                || traceId == null || traceId.isBlank() || createdAt == null) {
            throw AdminOpsException.invalid("ADMIN_DOMAIN_COMMAND_INVALID", "forwarded command envelope is incomplete");
        }
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
    }
}
