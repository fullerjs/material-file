"use strict";
let fs = require("fs");
let fsu = require("fsu");
let path = require("path");

let Buf = require("buffer").Buffer;
let Stream = require("stream").Stream;
let Transform = require("stream").Transform;

let File = function(file) {
	if(!file) {
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

	this._error = file._error;
};

File.prototype.isBuffer = function() {
	return typeof this.content === "object" && this.content instanceof Buf;
};

File.prototype.isStream = function() {
	return typeof this.content === "object" && this.content instanceof Stream;
};

File.prototype.isNull = function() {
	return this.content === null;
};

File.prototype.pipe = function(stream, options) {
	if(!options) {
		options = {};
	}

	let end = options.end;

	if (this.isStream()) {
		return this.content.pipe(stream, {end: end});
	}

	//buffer
	if (this.isBuffer()) {
		if(end) {
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
	if(this.isNull()) {
		this.content = fs.createReadStream(this.src.path);
		this._error && this.content.on("error", this._error);
	}
	return this;
};

File.prototype.write = function(options, cb) {
	if(typeof options === "function") {
		cb = options;
		options = {};
	}

	if(!options) {
		options = {};
	}

	if(!options.force) {
		options.force = true;
	}

	let save = fsu.createWriteStreamUnique(this._dst.path, options);

	this._error && save.on("error", this._error);
	cb && save.on("finish", function() {
		cb();
	});

	return this.pipe(save, {end: true});
};

File.prototype.getContent = function(cb) {
	if(this.isBuffer()) {
		cb(this.content);
		return this;
	}

	let self = this;
	let buffer = [];
	let reader = new Transform({
		transform: function(chunk, encoding, next) {
			buffer.push(chunk);
			next();
		},
		flush: function(done) {
			cb( self.setContent(buffer.join("")).content );
			done();
		}
	});

	this.pipe(reader);
	return this;
};

File.prototype.setContent = function(content) {
	if(typeof content === "string") {
		content = new Buf(content);
	}
	this.content = content || null;
	return this;
};

File.prototype.dst = function(dst) {
	if(dst) {
		this._dst = {
			path: dst,
			basename: path.basename(dst),
			dirname: path.dirname(dst)
		};
		return this;
	} else {
		return this._dst;
	}
};

File.prototype.error = function(cb) {
	this._error = cb;
	return this;
};

module.exports = File;
