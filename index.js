// index.js - CNS Dapr
// Copyright 2023 Padi, Inc. All Rights Reserved.

'use strict';

// Constants

const SERVER_HOST = process.env.CNS_SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.CNS_SERVER_PORT || '3000';

const DAPR_HOST = process.env.CNS_DAPR_HOST || 'localhost';
const DAPR_PORT = process.env.CNS_DAPR_PORT || '3500';

const CNS_PUBSUB = process.env.CNS_PUBSUB || 'cns-pubsub';
const CNS_BROKER = process.env.CNS_BROKER || 'padi';
const CNS_CONTEXT = process.env.CNS_CONTEXT || '';
const CNS_TOKEN = process.env.CNS_TOKEN || '';

// Imports

const dapr = require('@dapr/dapr');

const broker = require('./src/brokers/' + CNS_BROKER + '.js');
const objects = require('./src/objects.js');

// Dapr server

const server = new dapr.DaprServer({
  serverHost: SERVER_HOST,
  serverPort: SERVER_PORT,
  clientOptions: {
    daprHost: DAPR_HOST,
    daprPort: DAPR_PORT
  }
});

// Dapr client

const client = new dapr.DaprClient({
  daprHost: DAPR_HOST,
  daprPort: DAPR_PORT
});

// Local data

const cache = {
  profiles: {}
};

// Get profile endpoint
async function getProfile(query) {
  try {
    // Profile cached?
    const keys = getKeys(query);
    const profile = keys[1];

    if (cache.profiles[profile] === undefined)
      cache.profiles[profile] = await broker.getProfile(profile);

    // Locate query
    const loc = objects.locate(keys, cache);

    if (loc === null)
      throw new Error('not found');

    // Success
    console.log('APP GET', query, 'OK');
    return {data: loc.obj[loc.key]};
  } catch(e) {
    // Failure
    console.log('APP GET', query, 'ERROR', e.message);
    return {error: 'bad request'};
  }
}

// Get node endpoint
async function getNode(query) {
  try {
    // Locate query
    const keys = getNodeKeys(query);
    const loc = objects.locate(keys, cache);

    if (loc === null)
      throw new Error('not found');

    // Success
    console.log('APP GET', query, 'OK');
    return {data: loc.obj[loc.key]};
  } catch(e) {
    // Failure
    console.log('APP GET', query, 'ERROR', e.message);
    return {error: 'bad request'};
  }
}

// Post node endpoint
async function postNode(query, data) {
  try {
    // Locate query
    const keys = getNodeKeys(query);
    const loc = objects.locate(keys, cache);

    if (loc === null)
      throw new Error('not found');

    // Merge into cache
    const prev = objects.duplicate(cache.node);

    const data1 = loc.obj[loc.key];
    const data2 = getData(data);

    const obj1 = objects.isObject(data1);
    const obj2 = objects.isObject(data2);

    loc.obj[loc.key] = (obj1 && obj2)?objects.merge(data1, data2):data2;

    // Publish differences
    const diff = objects.difference(prev, cache.node);

    if (!objects.isEmpty(diff)) {
      await broker.postNode(diff, cache);
      await client.pubsub.publish(CNS_PUBSUB, CNS_CONTEXT, diff);
    }

    // Success
    console.log('APP POST', query, 'OK');
    return {data: 'ok'};
  } catch(e) {
    // Failure
    console.log('APP POST', query, 'ERROR', e.message);
    return {error: 'bad request'};
  }
}

// Publish node topic
async function publishNode(topic, data) {
  try {
    // Currently only one topic
    if (topic !== CNS_CONTEXT)
      throw new Error('not found');

    // Merge into cache
    const prev = objects.duplicate(cache.node);
    const next = getData(data);

    if (!objects.isObject(next))
      throw new Error('type missmatch');

    cache.node = objects.merge(cache.node, next);

    // Remove deleted connections
    const conns = cache.node.connections;

    for (const connId in conns) {
      if (conns[connId] === null)
        delete conns[connId];
    }

    // Post differences
    const diff = objects.difference(prev, cache.node);

    if (!objects.isEmpty(diff))
      await broker.postNode(diff, cache);

    // Success
    console.log('APP PUB', topic, 'OK');
  } catch(e) {
    // Failure
    console.log('APP PUB', topic, 'ERROR', e.message);
  }
}

// Subscription update
async function updateNode(data) {
  // Compute differences
  const diff = objects.difference(cache.node, data);

  if (!objects.isEmpty(diff)) {
    // Publish differences
    cache.node = data;

    console.log('DAPR PUB node');
    await client.pubsub.publish(CNS_PUBSUB, CNS_CONTEXT, diff);
  }
}

// Split query into keys
function getKeys(query) {
  const keys = query.split('/');

  if (query.startsWith('/'))
    keys.shift();

  return keys;
}

// Split node query into keys
function getNodeKeys(query) {
  const keys = getKeys(query);

  if (keys[0] !== CNS_CONTEXT)
    throw new Error('wrong context');

  keys[0] = 'node';

  return keys;
}

// Parse request data
function getData(data) {
  try {return JSON.parse(data);}
  catch(e) {return data;}
}

// Start application
async function start() {
  // Ask broker for node
  await broker.start({
    context: CNS_CONTEXT,
    token: CNS_TOKEN
  });

  cache.node = await broker.getNode();
  await broker.subscribeNode(updateNode);

  // Endpoint listeners
  await server.invoker.listen('profiles/:profile*', (data) => getProfile(data.query), {method: dapr.HttpMethod.GET});
  await server.invoker.listen(CNS_CONTEXT + '(/*)?', (data) => getNode(data.query), {method: dapr.HttpMethod.GET});
  await server.invoker.listen(CNS_CONTEXT + '(/*)?', (data) => postNode(data.query, data.body), {method: dapr.HttpMethod.POST});

  // Publish listeners
  await server.pubsub.subscribe(CNS_PUBSUB, CNS_CONTEXT, (data) => publishNode(CNS_CONTEXT, data));

  // Dapr start
  await server.start();
  await client.start();
}

// Start application
start().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
