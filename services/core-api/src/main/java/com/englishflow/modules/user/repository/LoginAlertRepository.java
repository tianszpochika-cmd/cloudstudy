package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.domain.LoginAlert;

import java.util.List;

public interface LoginAlertRepository {

    LoginAlert append(LoginAlert alert);

    List<LoginAlert> findOwned(UserRequestContext context);
}
