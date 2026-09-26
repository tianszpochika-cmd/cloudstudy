package com.englishflow.media.config;

import com.englishflow.media.adapter.failclosed.FailClosedSignedUrlPort;
import com.englishflow.media.domain.ByteRange;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaOperationException;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MediaSignedUrlConfigurationTest {

    @Test
    void localRealWithoutAnExplicitObjectStoreNeverReturnsAFakeUrl() {
        var configuration = new MediaServiceConfiguration();
        var port = configuration.localRealSignedUrlPort(new MediaServiceProperties());
        assertInstanceOf(FailClosedSignedUrlPort.class, port);
        assertInstanceOf(FailClosedSignedUrlPort.class, configuration.signedUrlPort(new MediaServiceProperties()));
        assertEquals("MEDIA_OBJECT_STORE_NOT_CONFIGURED", assertThrows(MediaOperationException.class,
                () -> port.issue(null, MediaAuthorizationContext.anonymous(), MediaDeliveryChannel.STREAM,
                        ByteRange.entire(1), Instant.now(), Instant.now().plusSeconds(1))).code());
    }
}
