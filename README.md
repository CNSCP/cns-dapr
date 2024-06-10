# CNS-Dapr

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [License](#license)
- [Copyright Notice](#copyright-notice)

## About

This repository contains the CNS Dapr Sidecar, written in [Node.js](https://nodejs.org/en/about) and using the [Dapr SDK](https://docs.dapr.io/developing-applications/sdks/js/).

When running, the Sidecar connects to a CNS Broker and monitors context and connection changes. Changes are published to the context topic of the `cns-pubsub` service. The Sidecar also exposes various HTTP endpoints to read and write to the context and its connections.

## Installing

To **install** or **update** the application, you should fetch the latest version from this Git repository. To do that, you may either download and unpack the repo zip file, or clone the repo using:

```sh
git clone https://github.com/cnscp/cns-dapr.git
```

Either method should get you a copy of the latest version. It is recommended (but not compulsory) to place the repo in the `~/cns-dapr` project directory. Go to the project directory and install Node.js dependancies with:

```sh
npm install
```

Now install the Dapr docker image with:

```sh
dapr init
```

Your application should now be ready to rock.

## Usage

Once installed, run the application with:

```sh
npm run start
```

To shut down the application, hit `ctrl-c`.

### Environment Variables

The Sidecar uses the following environment variables to configure itself:

| Name             | Description                      | Default                |
|------------------|----------------------------------|------------------------|
| CNS_BROKER       | CNS Broker service               | 'padi'                 |
| CNS_CONTEXT      | CNS Broker context               | Must be set            |
| CNS_TOKEN        | CNS Broker token                 | Must be set            |
| CNS_DAPR         | CNS Dapr application             | 'cns-dapr'             |
| CNS_DAPR_HOST    | CNS Dapr host                    | 'localhost'            |
| CNS_DAPR_PORT    | CNS Dapr port                    | '3500'                 |
| CNS_PUBSUB       | CNS Dapr PUBSUB component        | 'cns-pubsub'           |
| CNS_SERVER_HOST  | Dapr server host                 | 'localhost'            |
| CNS_SERVER_PORT  | Dapr server port                 | '3000'                 |

Alternatively, variables can be stored in a `.env` file in the project directory.

#### Broker Service

The Sidecar communicates to the CNS Broker via the service specified in `CNS_BROKER`.

| Service          | Description                                               |
|------------------|-----------------------------------------------------------|
| padi             | Padi CNS Broker                                           |

Currently, only the Padi CNS Broker is implemented.

##### Padi CNS Broker

The Padi CNS Broker service uses the following environment variables:

| Name             | Description                 | Default                     |
|------------------|-----------------------------|-----------------------------|
| CNS_PADI_CP      | Padi Profile server URI     | 'https<area>://cp.padi.io'  |
| CNS_PADI_API     | Padi API server URI         | 'https<area>://api.padi.io' |
| CNS_PADI_MQTT    | Padi MQTT server URI        | 'wss://cns.padi.io:1881'    |

### Dapr SDK

A [Dapr SDK](https://docs.dapr.io/developing-applications/sdks/) exists that puts a wrapper around the functionality described below and is implemented for various languages.

### Object Hierarchy


### Invocation Reference

Dapr provides the ability to call other applications that use Dapr with a unique named identifier. The identifier for CNS Dapr is defined in the `CNS_DAPR` environment variable. The following HTTP endpoint lets you invoke a method on the CNS Dapr application:

`GET|POST http://<CNS_DAPR_HOST>:<CNS_DAPR_PORT>/v1.0/invoke/<CNS_DAPR>/method/<path>`

Where the HTTP method will:

| HTTP Method      | Description                                               |
|------------------|-----------------------------------------------------------|
| GET              | Read data from the endpoint path                          |
| POST             | Write data to the endpoint path                           |

The basic hierarchy of endpoints in CNS Dapr is as follows:

```
node                         A node in a CNS network, as the CNS service root
↳ contexts                   A list of contexts within the scope of the node
  ↳ <id>                     A specific context referenced by a unique ID
    ↳ capabilities           A list of capabilities supported by the context
      ↳ <name>               A specific capability defined by profile name
        ↳ connections        A list of connections made for the capability
          ↳ <id>             A specific connection referenced by a unique ID
            ↳ properties     A list of properties supplied by the profile
```

After making a request, Dapr returns one of the following status codes:

| Status   | Description                                                       |
|----------|-------------------------------------------------------------------|
| 200      | Request succeeded                                                 |
| 400      | Endpoint not found                                                |
| 403      | Invocation forbidden                                              |
| 500      | Request failed                                                    |

All HTTP requests/responses use JSON and the `application/json` mime type.

A successful request will return:

`{"data": { ... }}`

If CNS Dapr encounters an error, it will return:

`{"error": "<text>"}`

#### Examples

The following examples use `curl` in a terminal window:

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/node/contexts/<id>
```

Requests full context metadata, capabilities and connections and will output:

`{"data": { ... }}`

with the full JSON description of the context (See: Context Schema).

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/node/contexts/<id>/comment
```

Requests a specific context metadata field and will output:

`{"data": <value>}`

with the current value of the specified field.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/node/contexts/<id>/garbage
```

Requests a field that does not exist and outputs:

`{"error": "not found"}`

since **garbage** is not a valid field name.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/node/contexts/<id> \
     -H "Content-Type: application/json" \
     -d '{"comment": "Testing"}'
```

Issues a post to the `comment` context metadata field and outputs:

`{"data": {"node": {"contexts": {"<context>": {"comment": "Testing"}}}}}`

The field should now be set to the string `'Testing'`.\
Multiple fields may be set at the same time using this method.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/node/contexts/<id>/capabilities/cp:test.abc.v1/connections
```

Requests all the current connections of the `test.abc` capability and outputs:

`{"data": { ... }}`

with a map of connection objects (See: Connection Schema).

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/node/contexts/<id>/capabilities/cp:test.abc.v1/connections/<connid>/properties \
     -H "Content-Type: application/json" \
     -d '{"foo1": 1000, "foo2": 2000}'
```

Issues a post to the specified `<connid>` connection properties and outputs:

`{"data": { ... }}`

The properties `foo1` and `foo2` will be set accordingly.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/profiles/cp:test.abc.v1
```

Will request the definition for the `test.abc` profile and outputs:

`{"data": { ... }}`

with the full descriptor for the profile (See: Profile Schema).

---

### Pub/Sub Reference

CNS Dapr publishes to the following topics:

| Topic                     | Description                                      |
|---------------------------|--------------------------------------------------|
| `node/contexts/<id>`      | All context metadata and connection changes      |

Dapr will invoke the following endpoint of an application to discover topic subscriptions:

`GET http://localhost:<appPort>/dapr/subscribe`

The application should return a JSON block containing the topics it wishes to subscribe to:

```json
[
  {
    "pubsubname": "cns-pubsub",
    "topic": "node/contexts/<id>",
    "route": "/cns-pubsub--<id>--default"
  }
]
```

To deliver topic messages, a HTTP `POST` will be made to the application at the route specified in the subscribe response. A HTTP 200 status response denotes successful processing of the message.

#### Examples


### Node Schema

Includes metadata and context information for a node.

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| version          | CNS Dapr version                                          |
| broker           | CNS Broker in charge of the node                          |
| status           | CNS Broker status information                             |
| contexts         | Contexts of the node                                      |

#### Example

```json
{
  "data": {
    "version": "1.1.0",
    "broker": "padi",
    "status": {
      "started": "2024-05-31T11:17:09.553Z",
      "reads": 36,
      "writes": 1,
      "updates": 0,
      "errors": 2,
      "connection": "online"
    },
    "contexts": {
      "IcE3x5xwsyP64GoLEZfZ": { ... }
    }
  }
}
```

### Context Schema

Includes metadata and capability information for a context.

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| name             | Name of the context                                       |
| title            | Title of the context                                      |
| comment          | Comment of the context                                    |
| capabilities     | Capabilities of the context                               |

#### Example

```json
{
  "data": {
    "name": "Example Context",
    "title": "An example context",
    "comment": "This is only an example",
    "capabilities": {
      "cp:test.abc.v1": { ... }
    }
  }
}
```

### Capability Schema

Includes profile and connection information for a capability.

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| scope            | Broker specific property                                  |
| required         | Broker specific property                                  |
| properties       | Connection property defaults                              |
| connections      | Connections made by the broker                            |

#### Example

```json
{
  "data": {
    "scope": "children",
    "required": false,
    "properties": {
      "far1": "321",
      "far2": "123"
    },
    "connections": {
      "ubcMmlEklEH45puTCpMa": { ... }
    }
  }
}
```

### Connection Schema

Includes metadata and properties for a connection

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| provider         | Provider name of the connection                           |
| consumer         | Consumer name of the connection                           |
| status           | Status of the connection                                  |
| properties       | Properties of the connection                              |

#### Example

```json
{
  "data": {
    "provider": "Server 1",
    "consumer": "Client 1",
    "status": "new",
    "properties": {
      "foo1": "666",
      "foo2": "999"
    }
  }
}
```
### Profile Schema

Includes metadata and property information for a profile.

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| title            | Title of the profile                                      |
| comment          | Comment of the profile                                    |
| properties       | Properties of the profile                                 |

The properties object contains an entry defining each property:

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| comment          | Comment of the property                                   |
| required         | Required flag                                             |
| propagate        | Propagate flag                                            |

#### Example

```json
{
  "data": {
    "title": "Simple demo Connection Profile",
    "comment": "Used to explain CNS/CP",
    "properties": {
      "foo1": {
        "comment": "Foo 1 property",
        "required": true,
        "propagate": true
      },
      "foo2": {
        "comment": "Foo 2 property",
        "required": true,
        "propagate": true
      },
      "far1": {
        "comment": "Far 1 property",
        "required": true,
        "propagate": true
      },
      "far2": {
        "comment": "Far 2 property",
        "required": true,
        "propagate": true
      }
    }
  }
}
```

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright Notice

See [COPYRIGHT.md](./COPYRIGHT.md).
