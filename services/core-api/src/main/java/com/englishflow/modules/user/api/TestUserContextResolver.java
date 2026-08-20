package com.englishflow.modules.user.api;

import com.englishflow.modules.user.UserModuleException;
import com.englishflow.modules.user.UserRequestContext;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Test substitute for controller tests.  It is intentionally not a Spring
 * component and never reads client headers.
 */
public final class TestUserContextResolver implements UserContextResolver {

    private UserRequestContext context;

    public TestUserContextResolver(UserRequestContext context) {
        this.context = context;
    }

    public void setContext(UserRequestContext context) {
        this.context = context;
    }

    @Override
    public UserRequestContext resolve(HttpServletRequest request) {
        if (context == null) {
            throw new UserModuleException("UNAUTHENTICATED", "登录状态无效", 401, false);
        }
        return context;
    }
}
