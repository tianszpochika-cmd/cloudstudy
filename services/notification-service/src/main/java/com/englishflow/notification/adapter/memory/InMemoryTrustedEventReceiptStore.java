package com.englishflow.notification.adapter.memory;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.TrustedEventReceipt;
import com.englishflow.notification.port.TrustedEventReceiptPort;

import java.util.LinkedHashMap;
import java.util.Map;

/** Deterministic receipt ledger with atomic event-id and dedupe-key claims. */
public final class InMemoryTrustedEventReceiptStore implements TrustedEventReceiptPort {

    private final Map<String, TrustedEventReceipt> byEvent = new LinkedHashMap<>();
    private final Map<String, String> eventByDedupe = new LinkedHashMap<>();

    @Override
    public synchronized ReceiptClaim claim(TrustedEventReceipt candidate) {
        String eventKey = key(candidate.consumerName(), candidate.eventId());
        String dedupeKey = key(candidate.consumerName(), candidate.dedupeKey());
        TrustedEventReceipt existing = byEvent.get(eventKey);
        if (existing != null) {
            if (!existing.fingerprint().equals(candidate.fingerprint())) {
                throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                        "trusted event id was reused with a different envelope");
            }
            return ReceiptClaim.existingClaim(existing);
        }
        String existingEventId = eventByDedupe.get(dedupeKey);
        if (existingEventId != null) {
            TrustedEventReceipt deduped = byEvent.get(key(candidate.consumerName(), existingEventId));
            if (deduped == null || !deduped.fingerprint().equals(candidate.fingerprint())) {
                throw new NotificationDomainException(NotificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                        "trusted dedupe key was reused with a different envelope");
            }
            return ReceiptClaim.existingClaim(deduped);
        }
        byEvent.put(eventKey, candidate);
        eventByDedupe.put(dedupeKey, candidate.eventId());
        return ReceiptClaim.newClaim();
    }

    @Override
    public synchronized void save(TrustedEventReceipt receipt) {
        byEvent.put(key(receipt.consumerName(), receipt.eventId()), receipt);
        eventByDedupe.put(key(receipt.consumerName(), receipt.dedupeKey()), receipt.eventId());
    }

    public synchronized java.util.Optional<TrustedEventReceipt> find(String consumerName, String eventId) {
        return java.util.Optional.ofNullable(byEvent.get(key(consumerName, eventId)));
    }

    public synchronized java.util.List<TrustedEventReceipt> receipts() {
        return java.util.List.copyOf(byEvent.values());
    }

    private static String key(String consumerName, String value) {
        return consumerName + '|' + value;
    }
}
