package org.feiesos.share.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Value("${minecloud.storage.url:http://localhost:8082}")
    private String storageUrl;

    @Bean
    public RestClient storageRestClient(RestClient.Builder builder) {
        return builder.baseUrl(storageUrl).build();
    }
}
