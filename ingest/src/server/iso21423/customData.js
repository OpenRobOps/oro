/**
 * OpenRobOps' `customData` extension resource: an ISO robot's deployment-specific key-value pairs,
 * the ISO counterpart of the wire protocol's `custom` subtopic (`oro.CustomDataMessage`).
 *
 * ISO 21423 leaves the resource catalog open (extension clause); the SDK's
 * `registerExtensionResource` adds this one to its QoS table. Both ends register the same config.
 *
 * Topic:   /ISO_21423/v1/IMR/<uuid>/customData      QoS 1, not retained
 * Payload: { "timestamp": ISO-8601, "values": { "<key>": "<string value>", ... } }
 *
 * Values are strings, as in the wire protocol; ORO's key-value data sources parse them.
 */
const CUSTOM_DATA_RESOURCE = 'customData';
const CUSTOM_DATA_RESOURCE_CONFIG = { qos: 1, retain: false };
/** The wire protocol's `customField`; key-value mappings without a mappingKey match any field. */
const ISO_CUSTOM_FIELD = 'iso21423';

/**
 * Parses a raw `customData` payload into wire-shaped `{ key, value }` pairs.
 * @returns {{ ts: number, pairs: Array<{key: string, value: string}> } | null} null when malformed
 */
const parseCustomData = (text) => {
  let body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    return null;
  }
  if (!body || typeof body !== 'object' || !body.values || typeof body.values !== 'object') return null;
  const pairs = Object.entries(body.values)
    .filter(([key, value]) => key && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
    .map(([key, value]) => ({ key, value: String(value) }));
  const parsedTs = Date.parse(body.timestamp);
  return { ts: Number.isFinite(parsedTs) ? parsedTs : Date.now(), pairs };
};

export {
  CUSTOM_DATA_RESOURCE, CUSTOM_DATA_RESOURCE_CONFIG, ISO_CUSTOM_FIELD, parseCustomData,
};
