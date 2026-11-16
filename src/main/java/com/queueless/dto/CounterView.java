package com.queueless.dto;

public record CounterView(
        Long id,
        String name,
        Long serviceId,
        String serviceName,
        String serviceCode,
        boolean open,
        int waiting,
        TokenView current) {
}
