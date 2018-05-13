'use strict';
const fs = require('fs');
const fsu = require('fsu');
const path = require('path');

const Buffer = require('buffer').Buffer;
const Stream = require('stream').Stream;
const Transform = require('stream').Transform;
const isArray = Array.isArray;

const File = function(file) {
  if (!file) {
    file = {};
  }

  this.id = file.id;
  this.dst(file.path || file.dst())
    .setContent(file.content || null);

  this.src = {
    path: this._dst.path,
    basename: this._dst.basename,
    dirname: this._dst.dirname
  };

  this._dependencies = file._dependencies || new Set();
  this._error = file._error;
};

File.prototype.isBuffer = function() {
  return typeof this.content === 'object' && this.content instanceof Buffer;
};

File.prototype.isStream = function() {
  return typeof this.content === 'object' && this.content instanceof Stream;
};

File.prototype.isNull = function() {
  return this.content === null;
};

File.prototype.pipe = function(stream, options) {
  if (!options) {
    options = {};
  }

  let end = options.end;

  if (this.isStream()) {
    return this.content.pipe(stream, { end: end });
  }

  //buffer
  if (this.isBuffer()) {
    if (end) {
      stream.end(this.content);
    } else {
      stream.write(this.content);
    }
    return stream;
  }

  //null
  return this.read().pipe(stream, options);
};

File.prototype.read = function() {
  if (this.isNull()) {
    this.content = fs.createReadStream(this.src.path);
    this._error && this.content.on('error', this._error);
  }
  return this;
};

File.prototype.write = function(options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  if (!options) {
    options = {};
  }

  if (!options.force) {
    options.force = true;
  }

  const save = fsu.createWriteStreamUnique(this._dst.path, options);

  this._error && save.on('error', this._error);
  cb && save.on('finish', cb);

  return this.pipe(save, { end: true });
};

File.prototype.getContent = function(cb) {
  if (this.isBuffer()) {
    cb(this.content);
    return this;
  }

  let buffer = [];
  let reader = new Transform({
    transform: (chunk, encoding, next) => {
      buffer.push(chunk);
      next();
    },
    flush: done => {
      cb(this.setContent(buffer.join('')).content);
      done();
    }
  });

  this.pipe(reader);
  return this;
};

File.prototype.setContent = function(content) {
  if (typeof content === 'string') {
    content = Buffer.from(content);
  }
  this.content = content || null;
  return this;
};

File.prototype.dst = function(dst) {
  if (dst) {
    this._dst = {
      path: dst,
      basename: path.basename(dst),
      dirname: path.dirname(dst)
    };
    return this;
  }

  return this._dst;
};

File.prototype.dependencies = function(deps) {
  if (deps) {
    if (isArray(deps)) {
      this._dependencies.add.apply(this._dependencies, deps);
    } else {
      this._dependencies.add(deps);
    }
    return this;
  }

  return this._dependencies;
};

File.prototype.clear = function() {
  this.dependencies.clear();
  return this;
};

File.prototype.error = function(cb) {
  this._error = cb;
  return this;
};

module.exports = File;
