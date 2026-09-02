package com.englishflow.iam.domain;

import java.util.Objects;
import java.util.Optional;
import java.util.List;

/**
 * IAM-owned consent persistence boundary. Implementations must append every decision and keep a
 * current projection separately; withdrawal must never overwrite or delete prior evidence.
 */
public interface ConsentStore {

    ConsentRecord append(ConsentRecord record);

    Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type);

    /** Reads the current fact under the store's write lock before a withdrawal CAS. */
    default Optional<ConsentRecord> findForUpdate(PrincipalId principalId, ConsentType type) {
        return find(principalId, type);
    }

    /** Appends only if the current version still equals the caller's observed fact. */
    default ConsentRecord appendIfCurrent(ConsentRecord record, ConsentRecord expected) {
        Objects.requireNonNull(record, "record");
        Optional<ConsentRecord> current = find(record.principalId(), record.type());
        if (!Objects.equals(current.orElse(null), expected)) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_mismatch");
        }
        return append(record);
    }

    List<ConsentRecord> history(PrincipalId principalId, ConsentType type);
}
