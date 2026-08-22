package com.englishflow.adminops.adapter.memory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.englishflow.adminops.domain.CommandForwardResult;
import com.englishflow.adminops.domain.DomainCommand;
import com.englishflow.adminops.domain.DomainCommandPort;

/** Pure command-forwarding test seam; no commerce/content/learner fact is written here. */
public final class InMemoryDomainCommandPort implements DomainCommandPort {

    private final List<DomainCommand> forwarded = new ArrayList<>();

    @Override
    public synchronized CommandForwardResult forward(DomainCommand command) {
        forwarded.add(command);
        return new CommandForwardResult(command.commandId(), command.domain().targetService(), "ACCEPTED", Instant.now());
    }

    public synchronized List<DomainCommand> forwarded() {
        return List.copyOf(forwarded);
    }
}
