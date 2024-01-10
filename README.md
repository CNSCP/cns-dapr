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
| CNS_SERVER_HOST  | CNS Dapr server host             | 'localhost'            |
| CNS_SERVER_PORT  | CNS Dapr server port             | '3000'                 |
| CNS_DAPR_HOST    | Dapr host                        | 'localhost'            |
| CNS_DAPR_PORT    | Dapr port                        | '3500'                 |
| CNS_PUBSUB       | CNS Dapr PUBSUB component ID     | 'cns-pubsub'           |
| CNS_BROKER       | CNS Broker service               | 'padi'                 |
| CNS_CONTEXT      | CNS Dapr context                 | Must be set            |
| CNS_TOKEN        | CNS Dapr token                   | Must be set            |

#### Linux

| Command                              | Description                           |
|--------------------------------------|---------------------------------------|
| env                                  | List all variables                    |
| export [name]=[value]                | Set variable                          |
| unset [name]                         | Remove variable                       |

#### Windows

| Command                              | Description                           |
|--------------------------------------|---------------------------------------|
| set                                  | List all variables                    |
| set [name]=[value]                   | Set variable                          |
| set [name]=                          | Remove variable                       |

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

### Invocation Reference

Dapr provides the ability to call other applications that use Dapr with a unique named identifier. The identifier for the CNS Dapr Sidecar is `cns-dapr`. The following HTTP endpoint lets you invoke a method on the Sidecar:

`GET|POST|PUT|DELETE http://localhost:<daprPort>/v1.0/invoke/cns-dapr/method/<method>`

Where the HTTP method will:

| HTTP Method      | Description                                               |
|------------------|-----------------------------------------------------------|
| GET              | Read data from the endpoint                               |
| POST             | Write data to the endpoint                                |
| PUT              | NYI                                                       |
| DELETE           | NYI                                                       |

CNS Dapr exposes the following endpoint methods:

| Invoke Method                                  | Description                 |
|------------------------------------------------|-----------------------------|
| `<context>`                                    | All context and connections |
| `<context>/<name>`                             | A context metadata field    |
| `<context>/connections`                        | All connections             |
| `<context>/connections/<id>`                   | A specific connection       |
| `<context>/connections/<id>/<name>`            | A connection metadata field |
| `<context>/connections/<id>/properties`        | All connection properties   |
| `<context>/connections/<id>/properties/<name>` | A specific property value   |
| `profiles/<name>`                              | A named profile definition  |

After making a request, Dapr returns one of the following status codes:

| Status   | Description                                                       |
|----------|-------------------------------------------------------------------|
| 200      | Request succeded                                                  |
| 400      | Method name not given                                             |
| 403      | Invocation forbidden by access control                            |
| 500      | Request failed                                                    |

All HTTP requests/responses use JSON and the `application/json` mime type.

A successful `GET` request will return:

`{"data": { ... }}`

A successfull `POST`, `PUT` or `DELETE` request will return:

`{"data": "ok"}`

If CNS Dapr encounters an error, it will return:

`{"error": "bad request"}`

#### Examples

The following examples use `curl` in a terminal window:

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/<context>
```

Requests full context metadata and connections and will output:

`{"data": { ... }}`

with the full JSON description of the context (See: Context Schema).

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/<context>/comment
```

Requests a specific context metadata field and will output:

`{"data": "Testing"}`

with the current value of the specified field.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/<context>/garbage
```

Requests a field that does not exist and outputs:

`{"error": "bad request"}`

since **garbage** is not a valid field name.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/<context> \
     -H "Content-Type: application/json" \
     -d '{"comment": "Testing 1"}'
```

Issues a post to the `comment` context metadata field and outputs:

`{"data": "ok"}`

The field should now be set to the string `'Testing 1'`.\
Multiple fields may be set using this method.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/<context>/comment \
     -H "Content-Type: application/json" \
     -d '"Testing 2"'
```

Issues a post to the `comment` field only and outputs:

`{"data": "ok"}`

The field should now be set to the string `'Testing 2'`.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/<context>/connections
```

Requests all the current connections of the context and outputs:

`{"data": { ... }}`

with a map of connection objects (See: Context Schema).

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/<context>/connections/<id>/properties \
     -H "Content-Type: application/json" \
     -d '{"foo1": 1000, "foo2": 2000}'
```

Issues a post to the specified `<id>` connection properties and outputs:

`{"data": "ok"}`

The properties `foo1` and `foo2` will be set accordingly.

---

```sh
curl http://localhost:3500/v1.0/invoke/cns-dapr/method/profiles/test.abc
```

Will request the descriptor for the profile `test.abc` and outputs:

`{"data": { ... }}`

with the full descriptor for the profile (See: Profile Schema).

---

### Pub/Sub Reference

CNS Dapr publishes to the following topics:

| Topic            | Description                                               |
|------------------|-----------------------------------------------------------|
| `<context>`      | All context metadata and connection changes               |

Dapr will invoke the following endpoint of an application to discover topic subscriptions:

`GET http://localhost:<appPort>/dapr/subscribe`

The application should return a JSON block containing the topics it wishes to subscribe to:

```sh
[
  {
    "pubsubname": "cns-pubsub",
    "topic": "<context>",
    "route": "/cns-pubsub--<context>--default"
  }
]
```

To deliver topic messages, a HTTP `POST` will be made to the application at the route specified in the subscribe response. A HTTP 200 status response denotes successful processing of message.

#### Examples





### Context Schema

Includes metadata and connection information for a context.

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| name             | Name of the context                                       |
| title            | Title of the context                                      |
| comment          | Comment of the context                                    |
| connections      | Connections of the context                                |

The `connections` property is a map containing the definitions of each connection currently made to this context. The key for the map is a unique ID for the connection. If an existing connection is removed, it will be mapped to `null`. If no connections exist, this map will be empty.

Each connection contains the following properties:

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| profile          | Name of the profile that made the connection              |
| version          | Version of the profile (blank for latest)                 |
| role             | Role of the connection (client or server)                 |
| client           | Client name of the connection                             |
| server           | Server name of the connection                             |
| status           | Status of the connection                                  |
| properties       | Properties of the connection                              |

The `properties` property is a map containing a key / value pair for each property of the connection.

#### Example

```sh
{
  "name": "Example Server",
  "title": "An example server",
  "comment": "This is only an example",
  "connections":
    {
      "wXStyS6Dvju5AMdz0mC6":
        {
          "profile": "test.abc",
          "version": "",
          "role": "server",
          "client": "Example Client",
          "server": "Example Server",
          "status": "new",
          "properties":
            {
              "foo1": 100,
              "foo2": 200,
              "far1": 101,
              "far2": 201
            }
        }
    },
    ...
}
```

### Profile Schema

Includes metadata and version information for a profile.

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| name             | Name of the profile                                       |
| title            | Title of the profile                                      |
| comment          | Comment of the profile                                    |
| versions         | Versions of the profile                                   |

The `versions` property is an array containing the definitions of each version of the profile, with version 1 as the first element, version 2 the second, and so on. If a connection does not specify a version, it is assumed it wants to use the 'latest' version. In this case, the last version in the list will be used.

Each version contains an array of property definition objects:

| Property         | Description                                               |
|------------------|-----------------------------------------------------------|
| name             | Name of the property                                      |
| description      | Description of the property                               |
| server           | Server side flag                                          |
| propagate        | Propagate flag                                            |
| required         | Required flag                                             |

#### Example

```sh
{
  "name": "test.abc",
  "title": "Simple demo Connection Profile",
  "comment": "Used to explain CNS/CP",
  "versions": [
    {
      "properties": [
        {
          "name": "foo1",
          "description": "Foo 1 property",
          "propagate": null
        },
        {
          "name": "foo2",
          "description": "Foo 2 property",
          "propagate": null
        },
        {
          "name": "far1",
          "description": "Far 1 property",
          "server": null,
          "propagate": null
        },
        {
          "name": "far2",
          "description": "Far 2 property"
          "server": null,
          "propagate": null
        }
      ]
    }
  ]
}
```

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright Notice

See [COPYRIGHT.md](./COPYRIGHT.md).
