package com.englishflow.adminops.domain;

import java.util.List;

/** Query-only seam to content/commerce/learner/analytics read models. There is intentionally no write method. */
public interface AdminProjectionPort {

    List<ProjectionRecord> query(AdminPrincipal principal, ProjectionQuery query);
}
