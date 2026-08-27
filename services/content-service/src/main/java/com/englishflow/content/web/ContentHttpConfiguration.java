package com.englishflow.content.web;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ContentHttpConfiguration {

    @Bean
    VerifiedContentPrincipalFactory verifiedContentPrincipalFactory() {
        return new VerifiedContentPrincipalFactory();
    }
}
