---
sidebar_position: 3
---

# Custom Data Sources

DataSourceDefinitions let you map robot telemetry to named attributes displayed in dashboards. They are configured through the [ConfigAPI](../api/configapi.md).

## Overview

The data flow for custom data sources:

1. Robot agent publishes custom data via MQTT (`CustomDataMessage`)
2. Ingest `CustomDataModule` stores it in MongoDB
3. A `DataSourceDefinition` maps stored data to a named attribute
4. Widgets display the attribute value on dashboards

## CustomData Widget Types

The CustomData widget supports three display formats:

### KeyValue

Displays named key-value pairs in a table:

```
Battery Level: 87%
Speed: 1.2 m/s
Mode: Autonomous
```

The robot agent publishes these as repeated `Value` fields in a `CustomDataMessage`.

### Text

Renders arbitrary text content published by the agent. Useful for logs, diagnostic messages, or status descriptions.

### Image

Displays images (JPEG) published by the robot agent. Common use cases include camera feeds, visual inspection results, or diagnostic screenshots.

## Defining Data Sources via ConfigAPI

Use the `apply` endpoint to create a `DataSourceDefinition`:

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "kind": "DataSourceDefinition",
    "apiVersion": "v0.1",
    "metadata": {
      "id": "my-custom-source"
    },
    "spec": {
      "label": "Battery",
      "source": { "keyValue": { "key": "battery" } }
    }
  }'
```

## Listing Configured Data Sources

```bash
# Short format (IDs only)
curl -H "x-auth-api-key: YOUR_KEY" \
  "http://localhost:3000/api/configuration/list?kind=DataSourceDefinition"

# Full format (complete spec, re-applicable)
curl -H "x-auth-api-key: YOUR_KEY" \
  "http://localhost:3000/api/configuration/list?kind=DataSourceDefinition&format=full"
```

## Removing a Data Source

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/clear \
  -d '{
    "kind": "DataSourceDefinition",
    "metadata": {
      "id": "my-custom-source"
    }
  }'
```

## Querying Attribute Values

Once a DataSourceDefinition is configured, the computed attribute can be queried via the REST API:

```bash
curl -H "x-auth-api-key: YOUR_KEY" \
  http://localhost:3000/api/robots/{robotId}/attributes/{attributeId}
```

See the [Attributes API](../api/attributes.md) for details.

## Next Steps

- [ConfigAPI Reference](../api/configapi.md) — full API documentation
- [Attributes & Status](../guides/attributes-status.md) — how attributes and status work together
- [Custom Widgets](./custom-widgets.md) — build widgets that consume your data sources
