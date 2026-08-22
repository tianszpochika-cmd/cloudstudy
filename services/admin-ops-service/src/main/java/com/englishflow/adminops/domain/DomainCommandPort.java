package com.englishflow.adminops.domain;

/**
 * Command forwarding seam. An HTTP/gRPC/Kafka adapter can implement this port later; this service
 * must never replace it with a direct write into another service's tables.
 */
public interface DomainCommandPort {

    CommandForwardResult forward(DomainCommand command);
}
