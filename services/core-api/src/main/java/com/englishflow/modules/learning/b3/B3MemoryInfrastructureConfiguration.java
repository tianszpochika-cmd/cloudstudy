package com.englishflow.modules.learning.b3;

import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.dao.PersistenceExceptionTranslationAutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.context.annotation.Configuration;

/** Keeps the documented memory adapter usable on a developer machine without MySQL/Redis. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "englishflow.b3", name = "persistence", havingValue = "memory", matchIfMissing = true)
@EnableAutoConfiguration(exclude = {
        DataSourceAutoConfiguration.class,
        DataSourceTransactionManagerAutoConfiguration.class,
        RedisAutoConfiguration.class,
        RedisRepositoriesAutoConfiguration.class,
        PersistenceExceptionTranslationAutoConfiguration.class
})
public class B3MemoryInfrastructureConfiguration {}
