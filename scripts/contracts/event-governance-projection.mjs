const canonicalAsyncApiInfo = {
  title: '语学星 v2 平台集成事件',
  description: '语学星 v2 跨服务集成事实的 canonical AsyncAPI 3.0 投影。每个活动事件对应唯一发送操作与显式消费操作；契约要求 Kafka 兼容总线、事务性 Outbox 和至少一次语义，当前不表示运行态已验证。',
};

function encodeJsonPointerToken(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Build the embedded AsyncAPI projection only from catalog-owned event
 * governance. Fragments are semantic inputs and cannot supply transport,
 * channel, operation, owner, or consumer-group facts.
 */
export function projectCanonicalAsyncApi(catalog) {
  const channels = {};
  const operations = {};
  const usedChannelKeys = new Set();
  const usedOperationKeys = new Set();

  for (const event of (catalog.events ?? []).filter((candidate) => candidate.status === 'CANONICAL_D2')) {
    const eventName = event.eventName;
    const payloadReference = event.payloadSchema?.$ref;
    const governance = event['x-p1r-governance'];
    if (typeof eventName !== 'string' || typeof payloadReference !== 'string' || !governance || typeof governance !== 'object') {
      throw new Error(`Cannot project AsyncAPI for invalid canonical event entry: ${eventName ?? '(missing eventName)'}`);
    }
    const channelKey = governance.transport?.channelId;
    const publishOperationId = governance.producer?.publishOperationId;
    if (typeof channelKey !== 'string' || channelKey.length === 0 || usedChannelKeys.has(channelKey)) {
      throw new Error(`Cannot project AsyncAPI for ${eventName}: channelId must be unique and non-empty`);
    }
    if (typeof publishOperationId !== 'string' || publishOperationId.length === 0 || usedOperationKeys.has(publishOperationId)) {
      throw new Error(`Cannot project AsyncAPI for ${eventName}: publishOperationId must be unique and non-empty`);
    }
    const topic = governance.transport?.topic;
    const bindingVersion = governance.transport?.bindingVersion;
    if (typeof topic !== 'string' || topic.length === 0 || bindingVersion !== '0.5.0') {
      throw new Error(`Cannot project AsyncAPI for ${eventName}: Kafka topic/bindingVersion is incomplete`);
    }
    const messageKey = 'event';
    const channelPointer = `#/asyncapi/channels/${encodeJsonPointerToken(channelKey)}`;
    const messagePointer = `${channelPointer}/messages/${encodeJsonPointerToken(messageKey)}`;

    channels[channelKey] = {
      address: topic,
      bindings: {
        kafka: {
          topic,
          bindingVersion,
        },
      },
      messages: {
        [messageKey]: {
          name: eventName,
          'x-event-name': eventName,
          payload: { $ref: payloadReference },
          bindings: {
            kafka: {
              key: {
                type: 'string',
                description: `Canonical partition key from envelope.${governance.transport.partitionKey}.`,
              },
              bindingVersion,
            },
          },
        },
      },
    };
    usedChannelKeys.add(channelKey);

    operations[publishOperationId] = {
      action: 'send',
      channel: { $ref: channelPointer },
      messages: [{ $ref: messagePointer }],
      bindings: { kafka: { bindingVersion } },
      'x-producer-service': governance.producer.service,
      'x-data-owner': governance.producer.dataOwner,
    };
    usedOperationKeys.add(publishOperationId);

    for (const consumer of governance.consumers ?? []) {
      const operationId = consumer.subscriptionOperationId;
      if (typeof operationId !== 'string' || operationId.length === 0 || usedOperationKeys.has(operationId)) {
        throw new Error(`Cannot project AsyncAPI for ${eventName}: subscriptionOperationId must be unique and non-empty`);
      }
      operations[operationId] = {
        action: 'receive',
        channel: { $ref: channelPointer },
        messages: [{ $ref: messagePointer }],
        bindings: {
          kafka: {
            groupId: { type: 'string', enum: [consumer.consumerGroup] },
            bindingVersion,
          },
        },
        'x-consumer-service': consumer.service,
      };
      usedOperationKeys.add(operationId);
    }
  }

  catalog.asyncapi = {
    asyncapi: '3.0.0',
    info: { ...canonicalAsyncApiInfo, version: catalog.catalogVersion },
    'x-runtime-status': catalog['x-p1r-event-governance']?.runtimeStatus,
    channels,
    operations,
  };

  return catalog.asyncapi;
}
