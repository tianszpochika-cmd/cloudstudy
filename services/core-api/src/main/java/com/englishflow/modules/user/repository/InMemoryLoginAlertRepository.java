package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.domain.LoginAlert;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Repository
public final class InMemoryLoginAlertRepository implements LoginAlertRepository {

    private final CopyOnWriteArrayList<LoginAlert> alerts = new CopyOnWriteArrayList<>();

    @Override
    public LoginAlert append(LoginAlert alert) {
        alerts.add(alert);
        return alert;
    }

    @Override
    public List<LoginAlert> findOwned(UserRequestContext context) {
        return alerts.stream()
                .filter(alert -> context.owns(alert.tenantId(), alert.userId()))
                .toList();
    }
}
