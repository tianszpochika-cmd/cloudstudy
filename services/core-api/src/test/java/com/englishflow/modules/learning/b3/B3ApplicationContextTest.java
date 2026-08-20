package com.englishflow.modules.learning.b3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.englishflow.CoreApiApplication;

@SpringBootTest(
        classes = CoreApiApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "B3_PERSISTENCE_MODE=memory")
class B3ApplicationContextTest {
    @Autowired
    private B3MultimodalService service;

    @Test
    void memoryAdapterWiresWithoutExternalInfrastructure() {
        assertEquals(12, ((java.util.List<?>) ((java.util.Map<?, ?>) service.listGrammarPoints(20, null).get("data")).get("items")).size());
    }
}
