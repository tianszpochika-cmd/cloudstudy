package com.englishflow.modules.user.api;

import com.englishflow.modules.user.UserModuleException;
import com.englishflow.modules.user.UserRequestContext;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Adapter boundary for auth.  Only a server-side request attribute is
 * accepted; client-controlled X-User-Id/X-Tenant-Id headers are deliberately
 * ignored so the user endpoints cannot be impersonated by header injection.
 */
@Component
public final class RequestAttributeUserContextResolver implements UserContextResolver {

    public static final String REQUEST_ATTRIBUTE =
            RequestAttributeUserContextResolver.class.getName() + ".context";

    @Override
    public UserRequestContext resolve(HttpServletRequest request) {
        Object value = request.getAttribute(REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) {
            return context;
        }
        throw new UserModuleException(
                "UNAUTHENTICATED",
                "登录状态无效",
                401,
                false
        );
    }

    public static void bind(HttpServletRequest request, UserRequestContext context) {
        request.setAttribute(REQUEST_ATTRIBUTE, context);
    }
}
