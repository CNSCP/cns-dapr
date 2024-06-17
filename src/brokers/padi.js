// padi.js - CNS Dapr Padi broker
// Copyright 2023 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const axios = require('axios');
const mqtt = require('mqtt');

const objects = require('../objects.js');

// Errors

const E_CONTEXT = 'no context';
const E_TOKEN = 'no token';
const E_READONLY = 'read only';
const E_NOTFOUND = 'not found';

// Defaults

const defaults = {
  CNS_PADI_CP: 'https://cp.padi.io',
  CNS_PADI_API: 'https://api.padi.io',
  CNS_PADI_MQTT: 'wss://cns.padi.io:1881'
};

// Config

const config = {
  CNS_PADI_CP: process.env.CNS_PADI_CP || defaults.CNS_PADI_CP,
  CNS_PADI_API: process.env.CNS_PADI_API || defaults.CNS_PADI_API,
  CNS_PADI_MQTT: process.env.CNS_PADI_MQTT || defaults.CNS_PADI_MQTT
};

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

  // No context?
  if (context === '')
    throw new Error(E_CONTEXT);

  // No token?
  if (token === '')
    throw new Error(E_TOKEN);

  // Profile server
  cp = axios.create({
    baseURL: config.CNS_PADI_CP,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // API server
  api = axios.create({
    baseURL: config.CNS_PADI_API,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  });
}

// Get broker profile
async function getProfile(name) {
  // Decode profile
  const profile = fromProfileName(name);

  try {
    // Get profile request
    console.log('HTTP GET Padi profile', name);

    const res = await cp.get('/profiles/' + profile.name);
    return toProfile(res.data, profile.version);
  } catch(e) {
    // Failure
    console.error(e.message);
    throw new Error(E_NOTFOUND);
  }
}

// Get broker node
async function getNode() {
  try {
    // Get thing request
    console.log('HTTP GET Padi thing', context);

    const res = await api.get('/thing');
    return toNode(res.data);
  } catch(e) {
    // Failure
    console.error(e.message);
    throw new Error(E_NOTFOUND);
  }
}

// Post broker node
async function postNode(data, prev, cache) {
  // Convert to thing
  const thing = fromNode(data, prev, cache);
  const conns = fromConnections(data, prev, cache);

  // Post thing
  if (!objects.isEmpty(thing)) {
    // Post thing request
    console.log('HTTP POST Padi thing', context);
    await api.post('/thing', thing);
  }

  // Post connections
  for (const id in conns) {
    // Post connection request
    console.log('HTTP POST Padi connection', id);
    await api.post('/thing/' + id, conns[id]);
  }
}

// Put broker node
async function putNode(data, prev, cache) {
}

// Delete broker node
async function deleteNode(data, prev, cache) {
}

// Subscribe to node
async function subscribeNode(callback) {
  // Connect client
  const client = mqtt.connect(config.CNS_PADI_MQTT, {
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
  console.log('MQTT SUB Padi thing', context);
  client.subscribe('thing/' + context);
}

// Convert to profile
function toProfile(data, version) {
  // From Padi profile
  const title = data.title || '';
  const comment = data.comment || '';
  const vers = data.versions || [];

  // Find version
  var properties;

  for (var v = 0; v < vers.length; v++) {
    // Found it?
    if ('v' + (v + 1) === version) {
      properties = toVersion(vers[v]);
      break;
    }
  }

  // Version not found?
  if (properties === undefined)
    throw new Error(E_NOTFOUND);

  return {
    title: title,
    comment: comment,
    definition: config.CNS_PADI_CP + '/profiles/' + data.name,
    properties: properties
  };
}

// Convert to version properties
function toVersion(data) {
  // From Padi profile version
  const props = data.properties || [];

  // Convert properties
  const properties = {};

  for (const attr of props)
    properties[attr.name] = toAttributes(attr);

  return properties;
}

// Convert to property attributes
function toAttributes(data) {
  // From Padi version properties
  const attrs = data || {};
  const comment = attrs.description || '';
  const required = (attrs.required === null);
  const propagate = (attrs.propagate === null);

  return {
    comment: comment,
    required: required,
    propagate: propagate
  };
}

// Convert to node
function toNode(data) {
  // From Padi thing and connections
  const thing = data.padiThings[context];
  const conns = data.padiConnections;

  return toContext(thing, conns);
}

// Convert to context
function toContext(data, conns) {
  // From Padi thing
  const name = data.dis || '';
  const title = data.geoAddr || '';
  const comment = data.padiComment || '';

  // Convert capabilities
  const capabilities = {};

  toCapability(data, conns, 'padiUse', 'consumer', false, capabilities);
  toCapability(data, conns, 'padiNeed', 'consumer', true, capabilities);
  toCapability(data, conns, 'padiHave', 'provider', false, capabilities);

  return {
    name: name,
    title: title,
    comment: comment,
    capabilities: capabilities
  };
}

// Convert to capability
function toCapability(data, conns, type, role, required, capabilities) {
  // From Padi profile definitions
  const profiles = data[type] || [];
  const versions = data[type + 'Versions'] || [];
  const scopes = data[type + 'Scopes'] || [];
  const properties = data[type + 'Properties'] || [];

  for (var n = 0; n < profiles.length; n++) {
    // Convert each definition
    const profile = profiles[n];
    const version = versions[n] || '';
    const scope = scopes[n] || '';
    const property = properties[n] || {};

    const name = toCapabilityName(profile, version, role);

    // Find connections
    const connections = {};

    for (const id in conns)
      toConnections(conns[id], id, name, connections);

    // Add capability
    capabilities[name] = {
      scope: scope,
      required: required,
      properties: property,
      connections: connections
    };
  }
}

// Convert to connections
function toConnections(data, id, capability, connections) {
  // From Padi connection
  const profile = data.padiProfile || '';
  const version = data.padiVersion || '';
  const role = (data.padiClient === context)?'consumer':'provider';
  const provider = data.padiServerAlias || '';
  const consumer = data.padiClientAlias || '';
  const status = data.padiStatus || '';
  const properties = data.padiProperties || {};

  // Right capability?
  const name = toCapabilityName(profile, version, role);
  if (name !== capability) return;

  // Add connection
  connections[id] = {
    provider: provider,
    consumer: consumer,
    status: status,
    properties: properties
  };
}

// Convert to capability name
function toCapabilityName(profile, version, role) {
  return 'cp:' + profile + '.v' + (version || 1) + ':' + role;
}

// Convert from node
function fromNode(data, prev, cache) {
  // To Padi thing
  const thing = {};

  if (data.name !== undefined) thing.dis = data.name;
  if (data.title !== undefined) thing.geoAddr = data.title;
  if (data.comment !== undefined) thing.padiComment = data.comment;

  fromCapabilities(data, prev, cache, thing);

  return thing;
}

// Convert from capabilities
function fromCapabilities(data, prev, cache, thing) {
  // To Padi profiles
  var rebuild = false;

  for (const name in data.capabilities) {
    const cap = data.capabilities[name];

    // Removing capability?
    if (cap === null) {
      delete cache.capabilities[name];
      rebuild = true;
    } else {
      // Changing capability?
      if (cap.scope !== undefined || cap.required !== undefined ||
        cap.properties !== undefined)
        rebuild = true;
    }
  }

  // Need to rebuild?
  if (!rebuild) return;

  // Convert capabilities
  const caps = cache.capabilities;

  fromCapability(data, caps, 'padiUse', 'consumer', false, thing);
  fromCapability(data, caps, 'padiNeed', 'consumer', true, thing);
  fromCapability(data, caps, 'padiHave', 'provider', false, thing);
}

// Convert from capability
function fromCapability(data, caps, type, role, required, thing) {
  // To Padi profile definitions
  const profiles = [];
  const versions = [];
  const scopes = [];
  const properties = [];

  // Add capabilities
  for (const profile in caps) {
    const cap = caps[profile];
    const capability = fromCapabilityName(profile);

    // Right definition?
    if (role === capability.role && cap.required === required) {
      // Add to definition
      profiles.push(capability.name);
      versions.push('');//capability.version.substr(1));
      scopes.push(cap.scope);
      properties.push(cap.properties);
    }
  }

  if (profiles.length === 0) {
// should delete fields here
    return;
  }

  // Set thing properties
  thing[type] = profiles;
  thing[type + 'Versions'] = versions;
  thing[type + 'Scopes'] = scopes;
  thing[type + 'Properties'] = properties;
}

//
function fromConnections(data, prev, cache) {
  const connections = {};

  // Has capabilities?
  const caps = data.capabilities;

  for (const profile in caps) {
    const cap = caps[profile];

    // Cannot add a capability
    if (prev.capabilities[profile] === undefined)
      throw new Error(E_READONLY);

    // Has connections?
    const conns = cap.connections;

    for (const id in conns) {
      // Cannot add a connection
      if (prev.capabilities[profile].connections[id] === undefined)
        throw new Error(E_READONLY);

      // Convert connection
      const conn = fromConnection(conns[id]);

      // Needs all properties
      if (conn.padiProperties !== undefined)
        conn.padiProperties = cache.capabilities[profile].connections[id].properties;

      if (!objects.isEmpty(conn))
        connections[id] = conn;
    }
  }
  return connections;
}

// Convert from connection
function fromConnection(data) {
  // To Padi connection
  const conn = {};

  if (data.provider !== undefined || data.consumer !== undefined)
    throw new Error(E_READONLY);

  if (data.status !== undefined) conn.padiStatus = data.status;
  if (data.properties !== undefined) conn.padiProperties = data.properties;

  return conn;
}

//
function fromProfileName(name) {
  const match = name
    .toLowerCase()
    .match(/^cp:(.+?).(v[0-9]+)$/);

  if (match === null)
    throw new Error(E_NOTFOUND);

  return {
    name: match[1],
    version: match[2]
  };
}

//
function fromCapabilityName(name) {
  const match = name
    .toLowerCase()
    .match(/^cp:(.+?).(v[0-9]+):(provider|consumer)$/);

  if (match === null)
    throw new Error(E_NOTFOUND);

  return {
    name: match[1],
    version: match[2],
    role: match[3]
  };
}

// Exports

exports.start = start;

exports.getProfile = getProfile;
exports.getNode = getNode;
exports.postNode = postNode;
exports.putNode = putNode;
exports.deleteNode = deleteNode;
exports.subscribeNode = subscribeNode;
