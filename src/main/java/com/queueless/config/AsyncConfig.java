package com.queueless.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/** Lets WhatsApp notifications run on a background thread so they never slow down the queue. */
@Configuration
@EnableAsync
public class AsyncConfig {
}
