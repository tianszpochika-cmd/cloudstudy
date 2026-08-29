package com.englishflow.platform.template;

import static org.assertj.core.api.Assertions.assertThat;

import com.englishflow.platform.template.config.ServiceProperties;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
            "service.name=service-template-test",
            "service.owner=platform",
            "service.schema=service_template_test",
            "service.redis-namespace=service-template-test",
            "service.port=18099",
            "management.tracing.export.enabled=false",
            "management.otlp.metrics.export.enabled=false"
        })
class ServiceTemplateApplicationTests {

    @Autowired
    private ServiceProperties serviceProperties;

    @Test
    void contextLoadsWithRequiredServiceMetadata() {
        assertThat(serviceProperties.getName()).isEqualTo("service-template-test");
        assertThat(serviceProperties.getOwner()).isEqualTo("platform");
        assertThat(serviceProperties.getSchema()).isEqualTo("service_template_test");
        assertThat(serviceProperties.getRedisNamespace()).isEqualTo("service-template-test");
        assertThat(serviceProperties.getPort()).isEqualTo(18099);
    }
}
