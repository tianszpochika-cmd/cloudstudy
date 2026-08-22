package com.englishflow.analytics.port;

import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.RecomputeResult;

/** Replay/recompute seam that only replays analytics-owned sanitized journal entries. */
public interface AnalyticsReplayPort {

    RecomputeResult recompute(RecomputeRequest request);

    default RecomputeResult replay(RecomputeRequest request) {
        return recompute(request);
    }
}
