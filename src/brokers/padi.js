// padi.js - CNS Dapr Padi broker
// Copyright 2023 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const axios = require('axios');
const mqtt = require('mqtt');

const objects = require('../objects.js');

// Constants

const PADI_CP = process.env.CNS_PADI_CP || 'https://cp.padi.io';
const PADI_API = process.env.CNS_PADI_API || 'https://api.padi.io';
const PADI_MQTT = process.env.CNS_PADI_MQTT || 'wss://cns.padi.io:1881';

// Local data

var context;
var token;

var cp;
var api;

// Start broker
async function start(options) {
  // Set context and token
  context = options.context || '';
  token = options.token || '';

  if (context === '' || token === '')
    throw new Error('not configured');

  // Profile server
  cp = axios.create({
    baseURL: PADI_CP,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // API server
  api = axios.create({
    baseURL: PADI_API,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  });
}

// Get broker profile
async function getProfile(profile) {
  console.log('HTTP GET Padi profile', profile);

  // Get profile request
  const res = await cp.get('/profiles/' + profile);
  return toProfile(res.data);
}

// Get broker node
async function getNode() {
  console.log('HTTP GET Padi thing', context);

  // Get thing request
  const res = await api.get('/thing');
  return toNode(res.data);
}

// Post broker node
async function postNode(data, cache) {
  // Convert to thing
  const thing = fromNode(data);

  if (!objects.isEmpty(thing)) {
    // Post thing request
    console.log('HTTP POST Padi thing', context);
    await api.post('/thing', thing);
  }

  // Has connections?
  const conns = data.connections;
  if (conns === undefined) return;

  // Post connections
  for (const id in conns) {
    // Convert to connection
    const conn = fromConnection(conns[id]);

    if (!objects.isEmpty(conn)) {
      // Needs all properties
      if (conn.padiProperties !== undefined)
        conn.padiProperties = cache.node.connections[id].properties;

      // Post connection request
      console.log('HTTP POST Padi connection', id);
      await api.post('/thing/' + id, conn);
    }
  }
}

// Subscribe to node
async function subscribeNode(callback) {
  console.log('MQTT SUB Padi thing', context);

  // Connect client
  const client = mqtt.connect(PADI_MQTT, {
    username: token
  })
  // Client connect
  .on('connect', (connack) => {
    console.log('MQTT CONNECT Padi');
  })
  // Client reconnect
  .on('reconnect', () => {
    console.log('MQTT RECONNECT Padi');
  })
  // Topic message
  .on('message', (topic, data) => {
    console.log('MQTT MESSAGE Padi thing', context);
    callback(toNode(JSON.parse(data)));
  })
  // Client offline
  .on('offline', () => {
    console.log('MQTT OFFLINE Padi');
  })
  // Client disconnect
  .on('disconnect', (packet) => {
    console.log('MQTT DISCONNECT Padi');
  })
  // Client close
  .on('close', () => {
    console.log('MQTT CLOSE Padi');
  })
  // Client end
  .on('end', () => {
    console.log('MQTT END Padi');
  })
  // Failure
  .on('error', (e) => {
    console.error('MQTT ERROR ', e.message);
  });

  // Subscribe to thing
  client.subscribe('thing/' + context);
}

// Convert to profile
function toProfile(data) {
  // From Padi profile
  return {
    name: data.name || '',
    title: data.title || '',
    comment: data.comment || '',
    versions: data.versions || []
  };
}

// Convert to node
function toNode(data) {
  // From Padi thing and connections
  const node = {};

  const thing = data.padiThings[context];
  const conns = data.padiConnections;

  // Convert connections
  const connections = {};

  for (const id in conns)
    connections[id] = toConnection(conns[id]);

  return {
    name: thing.dis || '',
    title: thing.geoAddr || '',
    comment: thing.padiComment || '',
    connections: connections
  };
}

// Convert to connection
function toConnection(data) {
  // From Padi connection
  return {
    profile: data.padiProfile || '',
    version: data.padiVersion || '',
    role: (data.padiClient === context)?'client':'server',
    client: data.padiClientAlias || '',
    server: data.padiServerAlias || '',
    status: data.padiStatus || '',
    properties: data.padiProperties || []
  };
}

// Convert from node
function fromNode(data) {
  // To Padi thing
  const thing = {};

  if (data.name !== undefined) thing.dis = data.name;
  if (data.title !== undefined) thing.geoAddr = data.title;
  if (data.comment !== undefined) thing.padiComment = data.comment;

  return thing;
}

// Convert from connection
function fromConnection(data) {
  // To Padi connection
  const conn = {};

  if (data.status !== undefined) conn.padiStatus = data.status;
  if (data.properties !== undefined) conn.padiProperties = data.properties;

  return conn;
}
// Exports

exports.start = start;

exports.getProfile = getProfile;
exports.getNode = getNode;
exports.postNode = postNode;

exports.subscribeNode = subscribeNode;
