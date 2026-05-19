---
sidebar_position: 2
---

# Custom Ingest Modules

The ingest service uses a pluggable module architecture. You can create new modules to process custom MQTT message types and store data in MongoDB.

## Module Interface

Each module follows this pattern:

```javascript
class MyModule {
  constructor({ mqtt, mongo }) {
    this.mqtt = mqtt;
    this.mongo = mongo;
  }

  load(settings = {}) {
    // Subscribe to MQTT topics and register handlers
    this.mqtt.subscribe('r/+/my_custom_topic', (robotId, payload) => {
      this.handleMessage(robotId, payload);
    });
  }

  handleMessage(robotId, payload) {
    // 1. Decode the protobuf (or raw) message
    // 2. Transform and validate data
    // 3. Write to MongoDB
  }
}

export default MyModule;
```

## Step-by-Step Guide

### 1. Define Your Protobuf Message (Optional)

If your module uses protobuf, add the message definition to `ingest/src/shared/oro.proto`:

```protobuf
message MyCustomMessage {
  string sensorId = 1;
  float value = 2;
  int64 timestamp = 3;
}
```

After modifying the proto file, regenerate the JavaScript bindings.

### 2. Create the Module

Create a new file at `ingest/src/server/modules/myModule.js`:

```javascript
import protobuf from 'protobufjs';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../../shared/oro.proto');

class MyModule {
  constructor({ mqtt, mongo }) {
    this.mqtt = mqtt;
    this.mongo = mongo;
    this.collection = null;
  }

  async load(settings = {}) {
    // Get or create MongoDB collection
    this.collection = this.mongo.db.collection('my_custom_data');

    // Load protobuf definition
    const root = await protobuf.load(PROTO_PATH);
    this.MyCustomMessage = root.lookupType('MyCustomMessage');

    // Subscribe to MQTT topic
    // The '+' wildcard matches any robot ID
    this.mqtt.subscribe('r/+/my_custom_topic', (robotId, payload) => {
      this.handleMessage(robotId, payload);
    });

    console.log('MyModule loaded');
  }

  async handleMessage(robotId, payload) {
    try {
      // Decode protobuf
      const message = this.MyCustomMessage.decode(payload);

      // Write to MongoDB
      await this.collection.updateOne(
        { _id: robotId },
        {
          $set: {
            sensorId: message.sensorId,
            value: message.value,
            updatedAt: new Date(message.timestamp),
          },
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`MyModule error for robot ${robotId}:`, err);
    }
  }
}

export default MyModule;
```

### 3. Register the Module

Export the module from `ingest/src/server/modules/index.js`:

```javascript
export { default as MyModule } from './myModule';
```

Then load it in `ingest/src/main.js`:

```javascript
import { MyModule, /* other modules */ } from './server/modules';

// In the run() function:
new MyModule({ mqtt, mongo }).load(moduleSettings.myModule);
```

### 4. Configure Module Settings (Optional)

Add per-module settings in `ingest/settings.json`:

```json
{
  "modules": {
    "myModule": {
      "enabled": true,
      "customSetting": "value"
    }
  }
}
```

## MQTT Topic Conventions

- Topics follow the pattern `r/<robot_id>/<message_type>`
- Use `+` wildcard to match any robot ID: `r/+/my_topic`
- The MQTT client extracts `robotId` from the topic and passes it to your handler

## Best Practices

- **Upsert pattern** — use `updateOne` with `upsert: true` for idempotent writes
- **Error handling** — catch and log errors in message handlers; don't let one bad message crash the module
- **Graceful degradation** — check for null/undefined fields in protobuf messages
- **Module settings** — accept a `settings` parameter in `load()` for configurability

## Existing Modules for Reference

| Module | File | What it does |
|--------|------|-------------|
| **BasicsModule** | `modules/basics.js` | Robot identity and status |
| **SystemModule** | `modules/system.js` | System resource metrics |
| **CustomDataModule** | `modules/customData.js` | Arbitrary key-value data |
| **RobotLocalizationModule** | `modules/localization.js` | Pose, maps, lasers, paths |

## Next Steps

- [Ingest Pipeline](../architecture/ingest-pipeline.md) — architecture deep dive
- [MQTT & Protocols](../architecture/mqtt-protocols.md) — topic structure and protobuf messages
- [Data Model](../architecture/data-model.md) — MongoDB collections
