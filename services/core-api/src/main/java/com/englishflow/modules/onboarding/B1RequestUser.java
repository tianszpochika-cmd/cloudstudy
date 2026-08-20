package com.englishflow.modules.onboarding;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;

final class B1RequestUser {
    private B1RequestUser() {
    }

    static UserRequestContext context(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context;
        throw new B1DomainException("AUTH_REQUIRED", "需要登录", HttpStatus.UNAUTHORIZED);
    }

    static long id(HttpServletRequest request) {
        return context(request).userId();
    }
}
