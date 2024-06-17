// index.js - CNS Dapr
// Copyright 2023 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const dapr = require('@dapr/dapr');

const env = require('dotenv').config();
const objects = require('./src/objects.js');

const pack = require('./package.json');

// Errors

const E_CONTEXT = 'no context';
const E_TOKEN = 'no token';
const E_READONLY = 'read only';
const E_MISSMATCH = 'type missmatch';
const E_NOTFOUND = 'not found';

// Defaults

const defaults = {
  CNS_BROKER: 'padi',
  CNS_CONTEXT: '',
  CNS_TOKEN: '',
  CNS_DAPR: 'cns-dapr',
  CNS_DAPR_HOST: 'localhost',
  CNS_DAPR_PORT: '3500',
  CNS_PUBSUB: 'cns-pubsub',
  CNS_SERVER_HOST: 'localhost',
  CNS_SERVER_PORT: '3000'
};

// Config

const config = {
  CNS_BROKER: process.env.CNS_BROKER || defaults.CNS_BROKER,
  CNS_CONTEXT: process.env.CNS_CONTEXT || defaults.CNS_CONTEXT,
  CNS_TOKEN: process.env.CNS_TOKEN || defaults.CNS_TOKEN,
  CNS_DAPR: process.env.CNS_DAPR || defaults.CNS_DAPR,
  CNS_DAPR_HOST: process.env.CNS_DAPR_HOST || defaults.CNS_DAPR_HOST,
  CNS_DAPR_PORT: process.env.CNS_DAPR_PORT || defaults.CNS_DAPR_PORT,
  CNS_PUBSUB: process.env.CNS_PUBSUB || defaults.CNS_PUBSUB,
  CNS_SERVER_HOST: process.env.CNS_SERVER_HOST || defaults.CNS_SERVER_HOST,
  CNS_SERVER_PORT: process.env.CNS_SERVER_PORT || defaults.CNS_SERVER_PORT
};

// Dapr server

const server = new dapr.DaprServer({
  serverHost: config.CNS_SERVER_HOST,
  serverPort: config.CNS_SERVER_PORT,
  clientOptions: {
    daprHost: config.CNS_DAPR_HOST,
    daprPort: config.CNS_DAPR_PORT
  },
  logger: {
    level: dapr.LogLevel.Error
  }
});

// Node cache

const cache = {
  profiles: {},
  node: {
    version: pack.version,
    broker: config.CNS_BROKER,
    status: {
      started: new Date().toISOString(),
      reads: 0,
      writes: 0,
      updates: 0,
      errors: 0,
      connection: 'online'
    },
    contexts: {}
  }
};

// Local data

var broker;
var topic;

// Local functions

// Get profile endpoint
async function getProfile(req) {
  try {
    // Locate query
    const keys = getKeys(req.query);
    const loc = await readProfile(keys);

    // Success
    console.log('APP GET', req.query, 'OK');
    return getResponse(req, loc);
  } catch(e) {
    // Failure
    console.error('APP GET', req.query, 'ERROR', e.message);
    return getError(e);
  }
}

// Get node endpoint
async function getNode(req) {
  try {
    // Locate query
    const keys = getKeys(req.query);
    const loc = getLocation(keys);

    // Success
    console.log('APP GET', req.query, 'OK');
    return getResponse(req, loc);
  } catch(e) {
    // Failure
    console.error('APP GET', req.query, 'ERROR', e.message);
    return getError(e);
  }
}

// Post node endpoint
async function postNode(req) {
  try {
    // Locate query
    const keys = getKeys(req.query);
    const loc = postLocation(keys);

    // Take snapshot
    const context = config.CNS_CONTEXT;
    const prev = objects.duplicate(cache.node.contexts[context]);

    // Merge into cache
    const data1 = loc.obj[loc.key];
    const data2 = getRequest(req.body);

    const obj1 = objects.isObject(data1);
    const obj2 = objects.isObject(data2);

    if (obj1 && !obj2)
      throw new Error(E_MISSMATCH);

    if (obj1 && obj2) {
      if (!objects.contains(data1, data2))
        throw new Error(E_NOTFOUND);

      loc.obj[loc.key] = objects.merge(data1, data2);
    } else loc.obj[loc.key] = data2;

    // Publish differences
    const next = cache.node.contexts[context];
    const diff = objects.difference(prev, next);

    if (!objects.isEmpty(diff)) {
      await broker.postNode(diff, prev, next);
      await server.client.pubsub.publish(config.CNS_PUBSUB, topic, diff);
    }

    // Success
    console.log('APP POST', req.query, 'OK');
    return postResponse(diff);
  } catch(e) {
    // Failure
    console.error('APP POST', req.query, 'ERROR', e.message);
    return getError(e);
  }
}

// Put node endpoint
async function putNode(req) {
  try {
    throw new Error('NYI: ' + req.query);
  } catch(e) {
    // Failure
    console.error('APP PUT', req.query, 'ERROR', e.message);
    return getError(e);
  }
}

// Delete node endpoint
async function deleteNode(req) {
  try {
    throw new Error('NYI: ' + req.query);
  } catch(e) {
    // Failure
    console.error('APP DELETE', req.query, 'ERROR', e.message);
    return getError(e);
  }
}

// Publish node topic
async function publishNode(data) {
  try {
    // Locate topic
    const keys = getKeys(topic);

    // Publish to context only
    if (keys[0] !== 'node' || keys[1] !== 'contexts' ||
      keys[2] !== config.CNS_CONTEXT)
      throw new Error(E_NOTFOUND);

    //const loc = getLocation(keys);

    // Take snapshot
    const context = config.CNS_CONTEXT;
    const prev = objects.duplicate(cache.node.contexts[context]);

    // Merge into cache
    const data1 = cache.node.contexts[context];
    const data2 = getRequest(data);

    const obj1 = objects.isObject(data1);
    const obj2 = objects.isObject(data2);

    if (!obj1 || !obj2)
      throw new Error(E_MISSMATCH);

    if (!objects.contains(data1, data2))
      throw new Error(E_NOTFOUND);

    cache.node.contexts[context] = objects.merge(data1, data2);

    // Remove deleted objects
    purgeContexts(cache.node.contexts);
    purgeCapabilities(prev.capabilities);

    // Post differences
    const next = cache.node.contexts[context];
    const diff = objects.difference(prev, next);

    if (!objects.isEmpty(diff))
      await broker.postNode(diff, prev, next);

    // Success
    console.log('APP PUB', topic, 'OK');
  } catch(e) {
    // Failure
    console.error('APP PUB', topic, 'ERROR', e.message);
  }
}

// Remove deleted contexts
function purgeContexts(contexts) {
  for (const id in contexts) {
    if (contexts[id] === null) delete contexts[id];
    else purgeCapabilities(contexts[id].capabilities);
  }
}

// Remove deleted capabilities
function purgeCapabilities(caps) {
  for (const id in caps) {
    if (caps[id] === null) delete caps[id];
    else purgeConnections(caps[id].connections);
  }
}

// Remove deleted connections
function purgeConnections(conns) {
  for (const id in conns)
    if (conns[id] === null) delete conns[id];
}

// Subscription update
async function updateNode(data) {
  // Compute differences
  const context = config.CNS_CONTEXT;
  const diff = objects.difference(cache.node.contexts[context], data);

  if (!objects.isEmpty(diff)) {
    // Publish differences
    cache.node.contexts[context] = data;

    console.log('DAPR PUB', topic);
    await server.client.pubsub.publish(config.CNS_PUBSUB, topic, diff);
  }
  cache.node.status.updates++;
}

// Split query into keys
function getKeys(query) {
  const keys = query.split('/');

  if (query.startsWith('/')) keys.shift();
  if (query.endsWith('/')) keys.pop();

  return keys;
}

// Get location from keys
function getLocation(keys) {
  const loc = objects.locate(keys, cache);

  if (loc === null)
    throw new Error('not found');

  return loc;
}

// Post location from keys
function postLocation(keys) {
  const node = keys[0];
  const contexts = keys[1];
  const context = keys[2];

  // Post to context only
  if (node !== 'node' || contexts !== 'contexts' ||
    context !== config.CNS_CONTEXT)
    throw new Error(E_READONLY);

  const capabilities = keys[3];
  const profile = keys[4];
  const property = keys[5];

  // Post to properties or connections only
  if (capabilities === 'capabilities' &&
    property !== 'properties' && property !== 'connections')
    throw new Error(E_READONLY);

  return getLocation(keys);
}

// Read profile data from keys
async function readProfile(keys) {
  const profiles = keys[0];
  const profile = keys[1];

  // Profile cached?
  var data = cache.profiles[profile];

  if (data === undefined) {
    try {
      // Read profile
      data = await broker.getProfile(profile);
    } catch(e) {
      // Failure
      data = null;
    }

    // Cache result
    cache.profiles[profile] = data;
  }

  // Found anything?
  if (data === null)
    throw new Error(E_NOTFOUND);

  return getLocation(keys);
}

// Get request data
function getRequest(data) {
  if (data === '{}') return null;
  try {
    return JSON.parse(data);
  } catch(e) {
    // Failure
    return data;
  }
}

// Get response data
function getResponse(req, loc) {
  if (!req.query.startsWith('/node/status'))
    cache.node.status.reads++;

  return {data: loc.obj[loc.key]};
}

// Post response data
function postResponse(diff) {
  cache.node.status.writes++;
  return {data: diff};
}

// Get response error
function getError(e) {
  cache.node.status.errors++;
  return {error: e.message};
}

// Start application
async function start() {
  // Output welcome
  console.log('CNS Dapr', pack.version);
  console.log('CNS Dapr on', config.CNS_DAPR_HOST, 'port', config.CNS_DAPR_PORT);

  if (config.context === '')
    throw new Error(C_CONTEXT);

  if (config.token === '')
    throw new Error(C_TOKEN);

  console.log('CNS context', config.CNS_CONTEXT);
  console.log('CNS broker', config.CNS_BROKER);

  // Bind broker
  broker = require('./src/brokers/' + config.CNS_BROKER + '.js');
  topic = 'node/contexts/' + config.CNS_CONTEXT;

  // Start broker
  await broker.start({
    context: config.CNS_CONTEXT,
    token: config.CNS_TOKEN
  });

  // Ask broker for context
  cache.node.contexts[config.CNS_CONTEXT] = await broker.getNode();
  await broker.subscribeNode(updateNode);

  // Endpoint listeners
  await server.invoker.listen('profiles/:profile*', getProfile, {method: dapr.HttpMethod.GET});

  await server.invoker.listen('node(/*)?', getNode, {method: dapr.HttpMethod.GET});
  await server.invoker.listen('node(/*)?', postNode, {method: dapr.HttpMethod.POST});

  await server.invoker.listen('node(/*)?', putNode, {method: dapr.HttpMethod.PUT});
  await server.invoker.listen('node(/*)?', deleteNode, {method: dapr.HttpMethod.DELETE});

  // Topic listeners
  await server.pubsub.subscribe(config.CNS_PUBSUB, topic, publishNode);

  // Start Dapr server
  await server.start();
}

// Start application
start().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
