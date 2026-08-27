package com.englishflow.adminops.web;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.CommandAction;
import com.englishflow.adminops.domain.CommandRequest;
import com.englishflow.adminops.domain.Domain;
import java.util.Locale;
import java.util.Map;

/**
 * Public B13 command shape. The browser contract deliberately uses aggregate terminology;
 * the application service keeps its internal domain/action model behind this adapter.
 */
public record B13AdminCommandRequest(
        String aggregateType,
        String aggregateRef,
        String actionCode,
        String reasonCode,
        String confirmationRef) {

    public CommandRequest toDomainRequest() {
        Domain domain = parse(Domain.class, aggregateType, "aggregateType");
        CommandAction action = parse(CommandAction.class, actionCode, "actionCode");
        if (action.domain() != domain) {
            throw AdminOpsException.invalid("ADMIN_COMMAND_DOMAIN_MISMATCH", "actionCode does not belong to aggregateType");
        }
        return new CommandRequest(domain, action, aggregateRef, null, reasonCode, Map.of());
    }

    private static <T extends Enum<T>> T parse(Class<T> type, String value, String field) {
        if (value == null || value.isBlank()) {
            throw AdminOpsException.invalid("ADMIN_COMMAND_SCHEMA_INVALID", field + " is required");
        }
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw AdminOpsException.invalid("ADMIN_COMMAND_ENUM_INVALID", field + " is not allowlisted");
        }
    }
}
