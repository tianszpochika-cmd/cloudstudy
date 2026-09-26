package com.englishflow.content.config;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContentJdbcPoolConfigurationTest {

    @Test
    void jdbcModeUsesConfiguredBoundedPoolAndClosesIt() {
        ContentPersistenceProperties properties = new ContentPersistenceProperties();
        properties.setMode("jdbc");
        properties.setJdbcUrl("jdbc:h2:mem:content_pool_configuration;MODE=MySQL");
        properties.setDriverClassName("org.h2.Driver");
        properties.setUsername("sa");
        properties.setPassword("");
        properties.setPoolMinIdle(1);
        properties.setPoolMaxSize(2);
        HikariDataSource dataSource = new ContentServiceConfiguration().contentDataSource(properties);
        try (java.sql.Connection connection = dataSource.getConnection()) {
            assertEquals(1, dataSource.getMinimumIdle());
            assertEquals(2, dataSource.getMaximumPoolSize());
            assertTrue(connection.isValid(1));
        } catch (java.sql.SQLException exception) {
            throw new AssertionError(exception);
        } finally {
            dataSource.close();
        }
        assertTrue(dataSource.isClosed());
    }
}
