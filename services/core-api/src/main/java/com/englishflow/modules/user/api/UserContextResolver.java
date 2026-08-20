package com.englishflow.modules.user.api;

import com.englishflow.modules.user.UserRequestContext;
import jakarta.servlet.http.HttpServletRequest;

public interface UserContextResolver {

    UserRequestContext resolve(HttpServletRequest request);
}
