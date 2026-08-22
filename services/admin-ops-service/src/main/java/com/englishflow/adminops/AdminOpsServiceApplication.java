package com.englishflow.adminops;

import com.englishflow.adminops.config.AdminOpsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AdminOpsProperties.class)
public class AdminOpsServiceApplication {
    public static void main(String[] args) { SpringApplication.run(AdminOpsServiceApplication.class, args); }
}
