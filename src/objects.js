// objects.js - Object helper
// Copyright 2023 Padi, Inc. All Rights Reserved.

'use strict';

// Constants

const UNDEFINED = '[object Undefined]';
const OBJECT = '[object Object]';
const ARRAY = '[object Array]';

// Methods

// Check for undefined
function isUndefined(obj) {
  return typeOf(obj) === UNDEFINED;
}

// Check for object
function isObject(obj) {
  return typeOf(obj) === OBJECT;
}

// Check for array
function isArray(obj) {
  return typeOf(obj) === ARRAY;
}

// Check for empty object
function isEmpty(obj) {
  return (Object.keys(obj).length === 0);
}

// Locate keys in object
function locate(keys, obj) {
  // No keys?
  if (keys.length === 0)
    return null;

  var key;

  while (keys.length > 0) {
    // Match next key in object?
    key = keys.shift();

    if (obj[key] === undefined)
      return null;

    if (keys.length > 0)
      obj = obj[key];
  }

  return {
    obj: obj,
    key: key
  }
}

// Object contains keys?
function contains(obj1, obj2) {
  for (const key in obj2) {
    // Each key must exist
    if (obj1[key] === undefined ||
      (isObject(obj2[key]) && !contains(obj1[key], obj2[key])))
      return false;
  }
  return true;
}

// Perform deep copy
function duplicate(obj) {
  return merge(obj);//JSON.parse(JSON.stringify(obj));
}

// Merge multiple objects
function merge() {
  const args = [].splice.call(arguments, 0);
  const obj1 = {};

  // Combine each object
  while (args.length > 0) {
    // Get object
    const obj2 = args.splice(0, 1)[0];
    if (!isObject(obj2)) continue;

    for (const key in obj2) {
      // Merge child
      if (isObject(obj2[key]))
        obj1[key] = merge(obj1[key] || {}, obj2[key]);
      else obj1[key] = obj2[key];
    }
  }
  return obj1;
}

// Get object differences
function difference(obj1, obj2) {
  // Must be objects
  if (!isObject(obj2)) return null;
  if (!isObject(obj1)) return obj2;

  // Scan for changes
  const changes = {};

  // Comapre first with second
  for (const key in obj1)
    compare(obj1[key], obj2[key], key, changes);

  // Add missing from second
  for (const key in obj2) {
    if (isUndefined(obj1[key]) && !isUndefined(obj2[key]))
      changes[key] = obj2[key];
  }
  return changes;
}

// Compare two properties
function compare(prop1, prop2, key, changes) {
  // Get the object type
  const type1 = typeOf(prop1);
  const type2 = typeOf(prop2);

  // Item removed?
  if (type1 !== UNDEFINED && type2 === UNDEFINED) {
    changes[key] = null;
    return;
  }

  // Type changed?
  if (type1 !== type2) {
    changes[key] = prop2;
    return;
  }

  // Array type?
  if (type1 === ARRAY) {
    // Arrays changed?
    if (!includes(prop1, prop2))
      changes[key] = prop2;
    return;
  }

  // Object type?
  if (type1 === OBJECT) {
    // Get object changes
    const diff = difference(prop1, prop2);

    if (!isEmpty(diff))
      changes[key] = diff;
    return;
  }

  // Value changed?
  if (prop1 !== prop2 )
    changes[key] = prop2;
}

// Compare two arrays
function includes(arr1, arr2) {
  const len = arr1.length;

  if (len !== arr2.length)
    return false;

  for(var n = 0; n < len; n++) {
    if (arr2[n] !== arr1[n])
      return false;
  }
  return true;
}

// Get object type
function typeOf(obj) {
  return Object.prototype.toString.call(obj);
}

// Exports

exports.isUndefined = isUndefined;
exports.isObject = isObject;
exports.isArray = isArray;
exports.isEmpty = isEmpty;

exports.locate = locate;
exports.contains = contains;
exports.duplicate = duplicate;
exports.merge = merge;
exports.difference = difference;
