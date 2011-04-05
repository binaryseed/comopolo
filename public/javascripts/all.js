/*  Prototype JavaScript framework, version 1.6.0.3
 *  (c) 2005-2008 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {
  Version: '1.6.0.3',

  Browser: {
    IE:     !!(window.attachEvent &&
      navigator.userAgent.indexOf('Opera') === -1),
    Opera:  navigator.userAgent.indexOf('Opera') > -1,
    WebKit: navigator.userAgent.indexOf('AppleWebKit/') > -1,
    Gecko:  navigator.userAgent.indexOf('Gecko') > -1 &&
      navigator.userAgent.indexOf('KHTML') === -1,
    MobileSafari: !!navigator.userAgent.match(/Apple.*Mobile.*Safari/)
  },

  BrowserFeatures: {
    XPath: !!document.evaluate,
    SelectorsAPI: !!document.querySelector,
    ElementExtensions: !!window.HTMLElement,
    SpecificElementExtensions:
      document.createElement('div')['__proto__'] &&
      document.createElement('div')['__proto__'] !==
        document.createElement('form')['__proto__']
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },
  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


/* Based on Alex Arnell's inheritance implementation. */
var Class = {
  create: function() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      var subclass = function() { };
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0; i < properties.length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;

    return klass;
  }
};

Class.Methods = {
  addMethods: function(source) {
    var ancestor   = this.superclass && this.superclass.prototype;
    var properties = Object.keys(source);

    if (!Object.keys({ toString: true }).length)
      properties.push("toString", "valueOf");

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames().first() == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments) };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }
};

var Abstract = { };

Object.extend = function(destination, source) {
  for (var property in source)
    destination[property] = source[property];
  return destination;
};

Object.extend(Object, {
  inspect: function(object) {
    try {
      if (Object.isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  },

  toJSON: function(object) {
    var type = typeof object;
    switch (type) {
      case 'undefined':
      case 'function':
      case 'unknown': return;
      case 'boolean': return object.toString();
    }

    if (object === null) return 'null';
    if (object.toJSON) return object.toJSON();
    if (Object.isElement(object)) return;

    var results = [];
    for (var property in object) {
      var value = Object.toJSON(object[property]);
      if (!Object.isUndefined(value))
        results.push(property.toJSON() + ': ' + value);
    }

    return '{' + results.join(', ') + '}';
  },

  toQueryString: function(object) {
    return $H(object).toQueryString();
  },

  toHTML: function(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  },

  keys: function(object) {
    var keys = [];
    for (var property in object)
      keys.push(property);
    return keys;
  },

  values: function(object) {
    var values = [];
    for (var property in object)
      values.push(object[property]);
    return values;
  },

  clone: function(object) {
    return Object.extend({ }, object);
  },

  isElement: function(object) {
    return !!(object && object.nodeType == 1);
  },

  isArray: function(object) {
    return object != null && typeof object == "object" &&
      'splice' in object && 'join' in object;
  },

  isHash: function(object) {
    return object instanceof Hash;
  },

  isFunction: function(object) {
    return typeof object == "function";
  },

  isString: function(object) {
    return typeof object == "string";
  },

  isNumber: function(object) {
    return typeof object == "number";
  },

  isUndefined: function(object) {
    return typeof object == "undefined";
  }
});

Object.extend(Function.prototype, {
  argumentNames: function() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^\)]*)\)/)[1]
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  },

  bind: function() {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = $A(arguments), object = args.shift();
    return function() {
      return __method.apply(object, args.concat($A(arguments)));
    }
  },

  bindAsEventListener: function() {
    var __method = this, args = $A(arguments), object = args.shift();
    return function(event) {
      return __method.apply(object, [event || window.event].concat(args));
    }
  },

  curry: function() {
    if (!arguments.length) return this;
    var __method = this, args = $A(arguments);
    return function() {
      return __method.apply(this, args.concat($A(arguments)));
    }
  },

  delay: function() {
    var __method = this, args = $A(arguments), timeout = args.shift() * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  },

  defer: function() {
    var args = [0.01].concat($A(arguments));
    return this.delay.apply(this, args);
  },

  wrap: function(wrapper) {
    var __method = this;
    return function() {
      return wrapper.apply(this, [__method.bind(this)].concat($A(arguments)));
    }
  },

  methodize: function() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      return __method.apply(null, [this].concat($A(arguments)));
    };
  }
});

Date.prototype.toJSON = function() {
  return '"' + this.getUTCFullYear() + '-' +
    (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
    this.getUTCDate().toPaddedString(2) + 'T' +
    this.getUTCHours().toPaddedString(2) + ':' +
    this.getUTCMinutes().toPaddedString(2) + ':' +
    this.getUTCSeconds().toPaddedString(2) + 'Z"';
};

var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};

/*--------------------------------------------------------------------------*/

var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
      } finally {
        this.currentlyExecuting = false;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, {
  gsub: function(pattern, replacement) {
    var result = '', source = this, match;
    replacement = arguments.callee.prepareReplacement(replacement);

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  },

  sub: function(pattern, replacement, count) {
    replacement = this.gsub.prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  },

  scan: function(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  },

  truncate: function(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  },

  strip: function() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  },

  stripTags: function() {
    return this.replace(/<\/?[^>]+>/gi, '');
  },

  stripScripts: function() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  },

  extractScripts: function() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img');
    var matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  },

  evalScripts: function() {
    return this.extractScripts().map(function(script) { return eval(script) });
  },

  escapeHTML: function() {
    var self = arguments.callee;
    self.text.data = this;
    return self.div.innerHTML;
  },

  unescapeHTML: function() {
    var div = new Element('div');
    div.innerHTML = this.stripTags();
    return div.childNodes[0] ? (div.childNodes.length > 1 ?
      $A(div.childNodes).inject('', function(memo, node) { return memo+node.nodeValue }) :
      div.childNodes[0].nodeValue) : '';
  },

  toQueryParams: function(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift());
        var value = pair.length > 1 ? pair.join('=') : pair[0];
        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  },

  toArray: function() {
    return this.split('');
  },

  succ: function() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  },

  times: function(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  },

  camelize: function() {
    var parts = this.split('-'), len = parts.length;
    if (len == 1) return parts[0];

    var camelized = this.charAt(0) == '-'
      ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1)
      : parts[0];

    for (var i = 1; i < len; i++)
      camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);

    return camelized;
  },

  capitalize: function() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  },

  underscore: function() {
    return this.gsub(/::/, '/').gsub(/([A-Z]+)([A-Z][a-z])/,'#{1}_#{2}').gsub(/([a-z\d])([A-Z])/,'#{1}_#{2}').gsub(/-/,'_').toLowerCase();
  },

  dasherize: function() {
    return this.gsub(/_/,'-');
  },

  inspect: function(useDoubleQuotes) {
    var escapedString = this.gsub(/[\x00-\x1f\\]/, function(match) {
      var character = String.specialChar[match[0]];
      return character ? character : '\\u00' + match[0].charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  },

  toJSON: function() {
    return this.inspect(true);
  },

  unfilterJSON: function(filter) {
    return this.sub(filter || Prototype.JSONFilter, '#{1}');
  },

  isJSON: function() {
    var str = this;
    if (str.blank()) return false;
    str = this.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"/g, '');
    return (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/).test(str);
  },

  evalJSON: function(sanitize) {
    var json = this.unfilterJSON();
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  },

  include: function(pattern) {
    return this.indexOf(pattern) > -1;
  },

  startsWith: function(pattern) {
    return this.indexOf(pattern) === 0;
  },

  endsWith: function(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.lastIndexOf(pattern) === d;
  },

  empty: function() {
    return this == '';
  },

  blank: function() {
    return /^\s*$/.test(this);
  },

  interpolate: function(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }
});

if (Prototype.Browser.WebKit || Prototype.Browser.IE) Object.extend(String.prototype, {
  escapeHTML: function() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  unescapeHTML: function() {
    return this.stripTags().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  }
});

String.prototype.gsub.prepareReplacement = function(replacement) {
  if (Object.isFunction(replacement)) return replacement;
  var template = new Template(replacement);
  return function(match) { return template.evaluate(match) };
};

String.prototype.parseQuery = String.prototype.toQueryParams;

Object.extend(String.prototype.escapeHTML, {
  div:  document.createElement('div'),
  text: document.createTextNode('')
});

String.prototype.escapeHTML.div.appendChild(String.prototype.escapeHTML.text);

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return '';

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3];
      var pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;
      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].gsub('\\\\]', ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = {
  each: function(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  },

  eachSlice: function(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  },

  all: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  },

  any: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  },

  collect: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  },

  detect: function(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  },

  findAll: function(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  },

  grep: function(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(filter);

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  },

  include: function(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  },

  inGroupsOf: function(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  },

  inject: function(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  },

  invoke: function(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  },

  max: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  },

  min: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  },

  partition: function(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  },

  pluck: function(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  },

  reject: function(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  },

  sortBy: function(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  },

  toArray: function() {
    return this.map();
  },

  zip: function() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  },

  size: function() {
    return this.toArray().length;
  },

  inspect: function() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }
};

Object.extend(Enumerable, {
  map:     Enumerable.collect,
  find:    Enumerable.detect,
  select:  Enumerable.findAll,
  filter:  Enumerable.findAll,
  member:  Enumerable.include,
  entries: Enumerable.toArray,
  every:   Enumerable.all,
  some:    Enumerable.any
});
function $A(iterable) {
  if (!iterable) return [];
  if (iterable.toArray) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}

if (Prototype.Browser.WebKit) {
  $A = function(iterable) {
    if (!iterable) return [];
    // In Safari, only use the `toArray` method if it's not a NodeList.
    // A NodeList is a function, has an function `item` property, and a numeric
    // `length` property. Adapted from Google Doctype.
    if (!(typeof iterable === 'function' && typeof iterable.length ===
        'number' && typeof iterable.item === 'function') && iterable.toArray)
      return iterable.toArray();
    var length = iterable.length || 0, results = new Array(length);
    while (length--) results[length] = iterable[length];
    return results;
  };
}

Array.from = $A;

Object.extend(Array.prototype, Enumerable);

if (!Array.prototype._reverse) Array.prototype._reverse = Array.prototype.reverse;

Object.extend(Array.prototype, {
  _each: function(iterator) {
    for (var i = 0, length = this.length; i < length; i++)
      iterator(this[i]);
  },

  clear: function() {
    this.length = 0;
    return this;
  },

  first: function() {
    return this[0];
  },

  last: function() {
    return this[this.length - 1];
  },

  compact: function() {
    return this.select(function(value) {
      return value != null;
    });
  },

  flatten: function() {
    return this.inject([], function(array, value) {
      return array.concat(Object.isArray(value) ?
        value.flatten() : [value]);
    });
  },

  without: function() {
    var values = $A(arguments);
    return this.select(function(value) {
      return !values.include(value);
    });
  },

  reverse: function(inline) {
    return (inline !== false ? this : this.toArray())._reverse();
  },

  reduce: function() {
    return this.length > 1 ? this : this[0];
  },

  uniq: function(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  },

  intersect: function(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  },

  clone: function() {
    return [].concat(this);
  },

  size: function() {
    return this.length;
  },

  inspect: function() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  },

  toJSON: function() {
    var results = [];
    this.each(function(object) {
      var value = Object.toJSON(object);
      if (!Object.isUndefined(value)) results.push(value);
    });
    return '[' + results.join(', ') + ']';
  }
});

// use native browser JS 1.6 implementation if available
if (Object.isFunction(Array.prototype.forEach))
  Array.prototype._each = Array.prototype.forEach;

if (!Array.prototype.indexOf) Array.prototype.indexOf = function(item, i) {
  i || (i = 0);
  var length = this.length;
  if (i < 0) i = length + i;
  for (; i < length; i++)
    if (this[i] === item) return i;
  return -1;
};

if (!Array.prototype.lastIndexOf) Array.prototype.lastIndexOf = function(item, i) {
  i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
  var n = this.slice(0, i).reverse().indexOf(item);
  return (n < 0) ? n : i - n - 1;
};

Array.prototype.toArray = Array.prototype.clone;

function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

if (Prototype.Browser.Opera){
  Array.prototype.concat = function() {
    var array = [];
    for (var i = 0, length = this.length; i < length; i++) array.push(this[i]);
    for (var i = 0, length = arguments.length; i < length; i++) {
      if (Object.isArray(arguments[i])) {
        for (var j = 0, arrayLength = arguments[i].length; j < arrayLength; j++)
          array.push(arguments[i][j]);
      } else {
        array.push(arguments[i]);
      }
    }
    return array;
  };
}
Object.extend(Number.prototype, {
  toColorPart: function() {
    return this.toPaddedString(2, 16);
  },

  succ: function() {
    return this + 1;
  },

  times: function(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  },

  toPaddedString: function(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  },

  toJSON: function() {
    return isFinite(this) ? this.toString() : 'null';
  }
});

$w('abs round ceil floor').each(function(method){
  Number.prototype[method] = Math[method].methodize();
});
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  return {
    initialize: function(object) {
      this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
    },

    _each: function(iterator) {
      for (var key in this._object) {
        var value = this._object[key], pair = [key, value];
        pair.key = key;
        pair.value = value;
        iterator(pair);
      }
    },

    set: function(key, value) {
      return this._object[key] = value;
    },

    get: function(key) {
      // simulating poorly supported hasOwnProperty
      if (this._object[key] !== Object.prototype[key])
        return this._object[key];
    },

    unset: function(key) {
      var value = this._object[key];
      delete this._object[key];
      return value;
    },

    toObject: function() {
      return Object.clone(this._object);
    },

    keys: function() {
      return this.pluck('key');
    },

    values: function() {
      return this.pluck('value');
    },

    index: function(value) {
      var match = this.detect(function(pair) {
        return pair.value === value;
      });
      return match && match.key;
    },

    merge: function(object) {
      return this.clone().update(object);
    },

    update: function(object) {
      return new Hash(object).inject(this, function(result, pair) {
        result.set(pair.key, pair.value);
        return result;
      });
    },

    toQueryString: function() {
      return this.inject([], function(results, pair) {
        var key = encodeURIComponent(pair.key), values = pair.value;

        if (values && typeof values == 'object') {
          if (Object.isArray(values))
            return results.concat(values.map(toQueryPair.curry(key)));
        } else results.push(toQueryPair(key, values));
        return results;
      }).join('&');
    },

    inspect: function() {
      return '#<Hash:{' + this.map(function(pair) {
        return pair.map(Object.inspect).join(': ');
      }).join(', ') + '}>';
    },

    toJSON: function() {
      return Object.toJSON(this.toObject());
    },

    clone: function() {
      return new Hash(this);
    }
  }
})());

Hash.prototype.toTemplateReplacements = Hash.prototype.toObject;
Hash.from = $H;
var ObjectRange = Class.create(Enumerable, {
  initialize: function(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  },

  _each: function(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  },

  include: function(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }
});

var $R = function(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
};

var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});

Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isString(this.options.parameters))
      this.options.parameters = this.options.parameters.toQueryParams();
    else if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});

Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.clone(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      // simulate other verbs over post
      params['_method'] = this.method;
      this.method = 'post';
    }

    this.parameters = params;

    if (params = Object.toQueryString(params)) {
      // when GET, append parameters to URL
      if (this.method == 'get')
        this.url += (this.url.include('?') ? '&' : '?') + params;
      else if (/Konqueror|Safari|KHTML/.test(navigator.userAgent))
        params += '&_=';
    }

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    // user-defined headers
    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300);
  },

  getStatus: function() {
    try {
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      // avoid memory leak in MSIE: clean up
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];

Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if(readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,
  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});
function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!window.Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  // DOM level 2 ECMAScript Language Binding
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}

(function() {
  var element = this.Element;
  this.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;
    if (Prototype.Browser.IE && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }
    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));
    return Element.writeAttribute(cache[tagName].cloneNode(false), attributes);
  };
  Object.extend(this.Element, element || { });
  if (element) this.Element.prototype = element.prototype;
}).call(window);

Element.cache = { };

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) return element.update().insert(content);
    content = Object.toHTML(content);
    element.innerHTML = content.stripScripts();
    content.evalScripts.bind(content).defer();
    return element;
  },

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(), attribute = pair.last();
      var value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property) {
    element = $(element);
    var elements = [];
    while (element = element[property])
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
    return elements;
  },

  ancestors: function(element) {
    return $(element).recursivelyCollect('parentNode');
  },

  descendants: function(element) {
    return $(element).select("*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    if (!(element = $(element).firstChild)) return [];
    while (element && element.nodeType != 1) element = element.nextSibling;
    if (element) return [element].concat($(element).nextSiblings());
    return [];
  },

  previousSiblings: function(element) {
    return $(element).recursivelyCollect('previousSibling');
  },

  nextSiblings: function(element) {
    return $(element).recursivelyCollect('nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return element.previousSiblings().reverse().concat(element.nextSiblings());
  },

  match: function(element, selector) {
    if (Object.isString(selector))
      selector = new Selector(selector);
    return selector.match($(element));
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = element.ancestors();
    return Object.isNumber(expression) ? ancestors[expression] :
      Selector.findElement(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return element.firstDescendant();
    return Object.isNumber(expression) ? element.descendants()[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.previousElementSibling(element));
    var previousSiblings = element.previousSiblings();
    return Object.isNumber(expression) ? previousSiblings[expression] :
      Selector.findElement(previousSiblings, expression, index);
  },

  next: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.nextElementSibling(element));
    var nextSiblings = element.nextSiblings();
    return Object.isNumber(expression) ? nextSiblings[expression] :
      Selector.findElement(nextSiblings, expression, index);
  },

  select: function() {
    var args = $A(arguments), element = $(args.shift());
    return Selector.findChildElements(element, args);
  },

  adjacent: function() {
    var args = $A(arguments), element = $(args.shift());
    return Selector.findChildElements(element.parentNode, args).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = element.readAttribute('id'), self = arguments.callee;
    if (id) return id;
    do { id = 'anonymous_element_' + self.counter++ } while ($(id));
    element.writeAttribute('id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return $(element).getDimensions().height;
  },

  getWidth: function(element) {
    return $(element).getDimensions().width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!element.hasClassName(className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return element[element.hasClassName(className) ?
      'removeClassName' : 'addClassName'](className);
  },

  // removes whitespace-only text node children
  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = element.cumulativeOffset();
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  getDimensions: function(element) {
    element = $(element);
    var display = element.getStyle('display');
    if (display != 'none' && display != null) // Safari bug
      return {width: element.offsetWidth, height: element.offsetHeight};

    // All *Width and *Height properties give 0 on elements with display none,
    // so enable the element temporarily
    var els = element.style;
    var originalVisibility = els.visibility;
    var originalPosition = els.position;
    var originalDisplay = els.display;
    els.visibility = 'hidden';
    els.position = 'absolute';
    els.display = 'block';
    var originalWidth = element.clientWidth;
    var originalHeight = element.clientHeight;
    els.display = originalDisplay;
    els.position = originalPosition;
    els.visibility = originalVisibility;
    return {width: originalWidth, height: originalHeight};
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      // Opera returns the offset relative to the positioning context, when an
      // element is position relative but top and left have not been defined
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  cumulativeOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  positionedOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (element.tagName.toUpperCase() == 'BODY') break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  absolutize: function(element) {
    element = $(element);
    if (element.getStyle('position') == 'absolute') return element;
    // Position.prepare(); // To be done manually by Scripty when it needs it.

    var offsets = element.positionedOffset();
    var top     = offsets[1];
    var left    = offsets[0];
    var width   = element.clientWidth;
    var height  = element.clientHeight;

    element._originalLeft   = left - parseFloat(element.style.left  || 0);
    element._originalTop    = top  - parseFloat(element.style.top || 0);
    element._originalWidth  = element.style.width;
    element._originalHeight = element.style.height;

    element.style.position = 'absolute';
    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.width  = width + 'px';
    element.style.height = height + 'px';
    return element;
  },

  relativize: function(element) {
    element = $(element);
    if (element.getStyle('position') == 'relative') return element;
    // Position.prepare(); // To be done manually by Scripty when it needs it.

    element.style.position = 'relative';
    var top  = parseFloat(element.style.top  || 0) - (element._originalTop || 0);
    var left = parseFloat(element.style.left || 0) - (element._originalLeft || 0);

    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.height = element._originalHeight;
    element.style.width  = element._originalWidth;
    return element;
  },

  cumulativeScrollOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  getOffsetParent: function(element) {
    if (element.offsetParent) return $(element.offsetParent);
    if (element == document.body) return $(element);

    while ((element = element.parentNode) && element != document.body)
      if (Element.getStyle(element, 'position') != 'static')
        return $(element);

    return $(document.body);
  },

  viewportOffset: function(forElement) {
    var valueT = 0, valueL = 0;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;

      // Safari fix
      if (element.offsetParent == document.body &&
        Element.getStyle(element, 'position') == 'absolute') break;

    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (!Prototype.Browser.Opera || (element.tagName && (element.tagName.toUpperCase() == 'BODY'))) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);

    return Element._returnOffset(valueL, valueT);
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    // find page position of source
    source = $(source);
    var p = source.viewportOffset();

    // find coordinate system to use
    element = $(element);
    var delta = [0, 0];
    var parent = null;
    // delta [0,0] will do fine with position: fixed elements,
    // position:absolute needs offsetParent deltas
    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = element.getOffsetParent();
      delta = parent.viewportOffset();
    }

    // correct by body offsets (fixes Safari)
    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    // set position
    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Element.Methods.identify.counter = 1;

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,
  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'left': case 'top': case 'right': case 'bottom':
          if (proceed(element, 'position') === 'static') return null;
        case 'height': case 'width':
          // returns '0px' for hidden elements; we want it to return null
          if (!Element.visible(element)) return null;

          // returns the border-box dimensions rather than the content-box
          // dimensions, so we subtract padding and borders from the value
          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  // IE doesn't report offsets correctly for static elements, so we change them
  // to "relative" to get the values, then change them back.
  Element.Methods.getOffsetParent = Element.Methods.getOffsetParent.wrap(
    function(proceed, element) {
      element = $(element);
      // IE throws an error if element is not in document
      try { element.offsetParent }
      catch(e) { return $(document.body) }
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);
      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    }
  );

  $w('positionedOffset viewportOffset').each(function(method) {
    Element.Methods[method] = Element.Methods[method].wrap(
      function(proceed, element) {
        element = $(element);
        try { element.offsetParent }
        catch(e) { return Element._returnOffset(0,0) }
        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);
        // Trigger hasLayout on the offset parent so that IE6 reports
        // accurate offsetTop and offsetLeft values for position: fixed.
        var offsetParent = element.getOffsetParent();
        if (offsetParent && offsetParent.getStyle('position') === 'fixed')
          offsetParent.setStyle({ zoom: 1 });
        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );
  });

  Element.Methods.cumulativeOffset = Element.Methods.cumulativeOffset.wrap(
    function(proceed, element) {
      try { element.offsetParent }
      catch(e) { return Element._returnOffset(0,0) }
      return proceed(element);
    }
  );

  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = {
    read: {
      names: {
        'class': 'className',
        'for':   'htmlFor'
      },
      values: {
        _getAttr: function(element, attribute) {
          return element.getAttribute(attribute, 2);
        },
        _getAttrNode: function(element, attribute) {
          var node = element.getAttributeNode(attribute);
          return node ? node.value : "";
        },
        _getEv: function(element, attribute) {
          attribute = element.getAttribute(attribute);
          return attribute ? attribute.toString().slice(23, -2) : null;
        },
        _flag: function(element, attribute) {
          return $(element).hasAttribute(attribute) ? attribute : null;
        },
        style: function(element) {
          return element.style.cssText.toLowerCase();
        },
        title: function(element) {
          return element.title;
        }
      }
    }
  };

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr,
      src:         v._getAttr,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);
}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if(element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };

  // Safari returns margins on body which is incorrect if the child is absolutely
  // positioned.  For performance reasons, redefine Element#cumulativeOffset for
  // KHTML/WebKit only.
  Element.Methods.cumulativeOffset = function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == document.body)
        if (Element.getStyle(element, 'position') == 'absolute') break;

      element = element.offsetParent;
    } while (element);

    return Element._returnOffset(valueL, valueT);
  };
}

if (Prototype.Browser.IE || Prototype.Browser.Opera) {
  // IE and Opera are missing .innerHTML support for TABLE-related and SELECT elements
  Element.Methods.update = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) return element.update().insert(content);

    content = Object.toHTML(content);
    var tagName = element.tagName.toUpperCase();

    if (tagName in Element._insertionTranslations.tags) {
      $A(element.childNodes).each(function(node) { element.removeChild(node) });
      Element._getContentFromAnonymousElement(tagName, content.stripScripts())
        .each(function(node) { element.appendChild(node) });
    }
    else element.innerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

if ('outerHTML' in document.createElement('div')) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next();
      var fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html) {
  var div = new Element('div'), t = Element._insertionTranslations.tags[tagName];
  if (t) {
    div.innerHTML = t[0] + html + t[1];
    t[2].times(function() { div = div.firstChild });
  } else div.innerHTML = html;
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  Object.extend(this.tags, {
    THEAD: this.tags.TBODY,
    TFOOT: this.tags.TBODY,
    TH:    this.tags.TD
  });
}).call(Element._insertionTranslations);

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

if (!Prototype.BrowserFeatures.ElementExtensions &&
    document.createElement('div')['__proto__']) {
  window.HTMLElement = { };
  window.HTMLElement.prototype = document.createElement('div')['__proto__'];
  Prototype.BrowserFeatures.ElementExtensions = true;
}

Element.extend = (function() {
  if (Prototype.BrowserFeatures.SpecificElementExtensions)
    return Prototype.K;

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || element._extendedByPrototype ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
      tagName = element.tagName.toUpperCase(), property, value;

    // extend methods for specific tags
    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    for (property in methods) {
      value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      // extend methods for all tags (Safari doesn't need this)
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

Element.hasAttribute = function(element, attribute) {
  if (element.hasAttribute) return element.hasAttribute(attribute);
  return Element.Methods.Simulated.hasAttribute(element, attribute);
};

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    window[klass] = { };
    window[klass].prototype = document.createElement(tagName)['__proto__'];
    return window[klass];
  }

  if (F.ElementExtensions) {
    copy(Element.Methods, HTMLElement.prototype);
    copy(Element.Methods.Simulated, HTMLElement.prototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};

document.viewport = {
  getDimensions: function() {
    var dimensions = { }, B = Prototype.Browser;
    $w('width height').each(function(d) {
      var D = d.capitalize();
      if (B.WebKit && !document.evaluate) {
        // Safari <3.0 needs self.innerWidth/Height
        dimensions[d] = self['inner' + D];
      } else if (B.Opera && parseFloat(window.opera.version()) < 9.5) {
        // Opera <9.5 needs document.body.clientWidth/Height
        dimensions[d] = document.body['client' + D]
      } else {
        dimensions[d] = document.documentElement['client' + D];
      }
    });
    return dimensions;
  },

  getWidth: function() {
    return this.getDimensions().width;
  },

  getHeight: function() {
    return this.getDimensions().height;
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop);
  }
};
/* Portions of the Selector class are derived from Jack Slocum's DomQuery,
 * part of YUI-Ext version 0.40, distributed under the terms of an MIT-style
 * license.  Please see http://www.yui-ext.com/ for more information. */

var Selector = Class.create({
  initialize: function(expression) {
    this.expression = expression.strip();

    if (this.shouldUseSelectorsAPI()) {
      this.mode = 'selectorsAPI';
    } else if (this.shouldUseXPath()) {
      this.mode = 'xpath';
      this.compileXPathMatcher();
    } else {
      this.mode = "normal";
      this.compileMatcher();
    }

  },

  shouldUseXPath: function() {
    if (!Prototype.BrowserFeatures.XPath) return false;

    var e = this.expression;

    // Safari 3 chokes on :*-of-type and :empty
    if (Prototype.Browser.WebKit &&
     (e.include("-of-type") || e.include(":empty")))
      return false;

    // XPath can't do namespaced attributes, nor can it read
    // the "checked" property from DOM nodes
    if ((/(\[[\w-]*?:|:checked)/).test(e))
      return false;

    return true;
  },

  shouldUseSelectorsAPI: function() {
    if (!Prototype.BrowserFeatures.SelectorsAPI) return false;

    if (!Selector._div) Selector._div = new Element('div');

    // Make sure the browser treats the selector as valid. Test on an
    // isolated element to minimize cost of this check.
    try {
      Selector._div.querySelector(this.expression);
    } catch(e) {
      return false;
    }

    return true;
  },

  compileMatcher: function() {
    var e = this.expression, ps = Selector.patterns, h = Selector.handlers,
        c = Selector.criteria, le, p, m;

    if (Selector._cache[e]) {
      this.matcher = Selector._cache[e];
      return;
    }

    this.matcher = ["this.matcher = function(root) {",
                    "var r = root, h = Selector.handlers, c = false, n;"];

    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        p = ps[i];
        if (m = e.match(p)) {
          this.matcher.push(Object.isFunction(c[i]) ? c[i](m) :
            new Template(c[i]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.matcher.push("return h.unique(n);\n}");
    eval(this.matcher.join('\n'));
    Selector._cache[this.expression] = this.matcher;
  },

  compileXPathMatcher: function() {
    var e = this.expression, ps = Selector.patterns,
        x = Selector.xpath, le, m;

    if (Selector._cache[e]) {
      this.xpath = Selector._cache[e]; return;
    }

    this.matcher = ['.//*'];
    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        if (m = e.match(ps[i])) {
          this.matcher.push(Object.isFunction(x[i]) ? x[i](m) :
            new Template(x[i]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.xpath = this.matcher.join('');
    Selector._cache[this.expression] = this.xpath;
  },

  findElements: function(root) {
    root = root || document;
    var e = this.expression, results;

    switch (this.mode) {
      case 'selectorsAPI':
        // querySelectorAll queries document-wide, then filters to descendants
        // of the context element. That's not what we want.
        // Add an explicit context to the selector if necessary.
        if (root !== document) {
          var oldId = root.id, id = $(root).identify();
          e = "#" + id + " " + e;
        }

        results = $A(root.querySelectorAll(e)).map(Element.extend);
        root.id = oldId;

        return results;
      case 'xpath':
        return document._getElementsByXPath(this.xpath, root);
      default:
       return this.matcher(root);
    }
  },

  match: function(element) {
    this.tokens = [];

    var e = this.expression, ps = Selector.patterns, as = Selector.assertions;
    var le, p, m;

    while (e && le !== e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        p = ps[i];
        if (m = e.match(p)) {
          // use the Selector.assertions methods unless the selector
          // is too complex.
          if (as[i]) {
            this.tokens.push([i, Object.clone(m)]);
            e = e.replace(m[0], '');
          } else {
            // reluctantly do a document-wide search
            // and look for a match in the array
            return this.findElements(document).include(element);
          }
        }
      }
    }

    var match = true, name, matches;
    for (var i = 0, token; token = this.tokens[i]; i++) {
      name = token[0], matches = token[1];
      if (!Selector.assertions[name](element, matches)) {
        match = false; break;
      }
    }

    return match;
  },

  toString: function() {
    return this.expression;
  },

  inspect: function() {
    return "#<Selector:" + this.expression.inspect() + ">";
  }
});

Object.extend(Selector, {
  _cache: { },

  xpath: {
    descendant:   "//*",
    child:        "/*",
    adjacent:     "/following-sibling::*[1]",
    laterSibling: '/following-sibling::*',
    tagName:      function(m) {
      if (m[1] == '*') return '';
      return "[local-name()='" + m[1].toLowerCase() +
             "' or local-name()='" + m[1].toUpperCase() + "']";
    },
    className:    "[contains(concat(' ', @class, ' '), ' #{1} ')]",
    id:           "[@id='#{1}']",
    attrPresence: function(m) {
      m[1] = m[1].toLowerCase();
      return new Template("[@#{1}]").evaluate(m);
    },
    attr: function(m) {
      m[1] = m[1].toLowerCase();
      m[3] = m[5] || m[6];
      return new Template(Selector.xpath.operators[m[2]]).evaluate(m);
    },
    pseudo: function(m) {
      var h = Selector.xpath.pseudos[m[1]];
      if (!h) return '';
      if (Object.isFunction(h)) return h(m);
      return new Template(Selector.xpath.pseudos[m[1]]).evaluate(m);
    },
    operators: {
      '=':  "[@#{1}='#{3}']",
      '!=': "[@#{1}!='#{3}']",
      '^=': "[starts-with(@#{1}, '#{3}')]",
      '$=': "[substring(@#{1}, (string-length(@#{1}) - string-length('#{3}') + 1))='#{3}']",
      '*=': "[contains(@#{1}, '#{3}')]",
      '~=': "[contains(concat(' ', @#{1}, ' '), ' #{3} ')]",
      '|=': "[contains(concat('-', @#{1}, '-'), '-#{3}-')]"
    },
    pseudos: {
      'first-child': '[not(preceding-sibling::*)]',
      'last-child':  '[not(following-sibling::*)]',
      'only-child':  '[not(preceding-sibling::* or following-sibling::*)]',
      'empty':       "[count(*) = 0 and (count(text()) = 0)]",
      'checked':     "[@checked]",
      'disabled':    "[(@disabled) and (@type!='hidden')]",
      'enabled':     "[not(@disabled) and (@type!='hidden')]",
      'not': function(m) {
        var e = m[6], p = Selector.patterns,
            x = Selector.xpath, le, v;

        var exclusion = [];
        while (e && le != e && (/\S/).test(e)) {
          le = e;
          for (var i in p) {
            if (m = e.match(p[i])) {
              v = Object.isFunction(x[i]) ? x[i](m) : new Template(x[i]).evaluate(m);
              exclusion.push("(" + v.substring(1, v.length - 1) + ")");
              e = e.replace(m[0], '');
              break;
            }
          }
        }
        return "[not(" + exclusion.join(" and ") + ")]";
      },
      'nth-child':      function(m) {
        return Selector.xpath.pseudos.nth("(count(./preceding-sibling::*) + 1) ", m);
      },
      'nth-last-child': function(m) {
        return Selector.xpath.pseudos.nth("(count(./following-sibling::*) + 1) ", m);
      },
      'nth-of-type':    function(m) {
        return Selector.xpath.pseudos.nth("position() ", m);
      },
      'nth-last-of-type': function(m) {
        return Selector.xpath.pseudos.nth("(last() + 1 - position()) ", m);
      },
      'first-of-type':  function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-of-type'](m);
      },
      'last-of-type':   function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-last-of-type'](m);
      },
      'only-of-type':   function(m) {
        var p = Selector.xpath.pseudos; return p['first-of-type'](m) + p['last-of-type'](m);
      },
      nth: function(fragment, m) {
        var mm, formula = m[6], predicate;
        if (formula == 'even') formula = '2n+0';
        if (formula == 'odd')  formula = '2n+1';
        if (mm = formula.match(/^(\d+)$/)) // digit only
          return '[' + fragment + "= " + mm[1] + ']';
        if (mm = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
          if (mm[1] == "-") mm[1] = -1;
          var a = mm[1] ? Number(mm[1]) : 1;
          var b = mm[2] ? Number(mm[2]) : 0;
          predicate = "[((#{fragment} - #{b}) mod #{a} = 0) and " +
          "((#{fragment} - #{b}) div #{a} >= 0)]";
          return new Template(predicate).evaluate({
            fragment: fragment, a: a, b: b });
        }
      }
    }
  },

  criteria: {
    tagName:      'n = h.tagName(n, r, "#{1}", c);      c = false;',
    className:    'n = h.className(n, r, "#{1}", c);    c = false;',
    id:           'n = h.id(n, r, "#{1}", c);           c = false;',
    attrPresence: 'n = h.attrPresence(n, r, "#{1}", c); c = false;',
    attr: function(m) {
      m[3] = (m[5] || m[6]);
      return new Template('n = h.attr(n, r, "#{1}", "#{3}", "#{2}", c); c = false;').evaluate(m);
    },
    pseudo: function(m) {
      if (m[6]) m[6] = m[6].replace(/"/g, '\\"');
      return new Template('n = h.pseudo(n, "#{1}", "#{6}", r, c); c = false;').evaluate(m);
    },
    descendant:   'c = "descendant";',
    child:        'c = "child";',
    adjacent:     'c = "adjacent";',
    laterSibling: 'c = "laterSibling";'
  },

  patterns: {
    // combinators must be listed first
    // (and descendant needs to be last combinator)
    laterSibling: /^\s*~\s*/,
    child:        /^\s*>\s*/,
    adjacent:     /^\s*\+\s*/,
    descendant:   /^\s/,

    // selectors follow
    tagName:      /^\s*(\*|[\w\-]+)(\b|$)?/,
    id:           /^#([\w\-\*]+)(\b|$)/,
    className:    /^\.([\w\-\*]+)(\b|$)/,
    pseudo:
/^:((first|last|nth|nth-last|only)(-child|-of-type)|empty|checked|(en|dis)abled|not)(\((.*?)\))?(\b|$|(?=\s|[:+~>]))/,
    attrPresence: /^\[((?:[\w]+:)?[\w]+)\]/,
    attr:         /\[((?:[\w-]*:)?[\w-]+)\s*(?:([!^$*~|]?=)\s*((['"])([^\4]*?)\4|([^'"][^\]]*?)))?\]/
  },

  // for Selector.match and Element#match
  assertions: {
    tagName: function(element, matches) {
      return matches[1].toUpperCase() == element.tagName.toUpperCase();
    },

    className: function(element, matches) {
      return Element.hasClassName(element, matches[1]);
    },

    id: function(element, matches) {
      return element.id === matches[1];
    },

    attrPresence: function(element, matches) {
      return Element.hasAttribute(element, matches[1]);
    },

    attr: function(element, matches) {
      var nodeValue = Element.readAttribute(element, matches[1]);
      return nodeValue && Selector.operators[matches[2]](nodeValue, matches[5] || matches[6]);
    }
  },

  handlers: {
    // UTILITY FUNCTIONS
    // joins two collections
    concat: function(a, b) {
      for (var i = 0, node; node = b[i]; i++)
        a.push(node);
      return a;
    },

    // marks an array of nodes for counting
    mark: function(nodes) {
      var _true = Prototype.emptyFunction;
      for (var i = 0, node; node = nodes[i]; i++)
        node._countedByPrototype = _true;
      return nodes;
    },

    unmark: function(nodes) {
      for (var i = 0, node; node = nodes[i]; i++)
        node._countedByPrototype = undefined;
      return nodes;
    },

    // mark each child node with its position (for nth calls)
    // "ofType" flag indicates whether we're indexing for nth-of-type
    // rather than nth-child
    index: function(parentNode, reverse, ofType) {
      parentNode._countedByPrototype = Prototype.emptyFunction;
      if (reverse) {
        for (var nodes = parentNode.childNodes, i = nodes.length - 1, j = 1; i >= 0; i--) {
          var node = nodes[i];
          if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
        }
      } else {
        for (var i = 0, j = 1, nodes = parentNode.childNodes; node = nodes[i]; i++)
          if (node.nodeType == 1 && (!ofType || node._countedByPrototype)) node.nodeIndex = j++;
      }
    },

    // filters out duplicates and extends all nodes
    unique: function(nodes) {
      if (nodes.length == 0) return nodes;
      var results = [], n;
      for (var i = 0, l = nodes.length; i < l; i++)
        if (!(n = nodes[i])._countedByPrototype) {
          n._countedByPrototype = Prototype.emptyFunction;
          results.push(Element.extend(n));
        }
      return Selector.handlers.unmark(results);
    },

    // COMBINATOR FUNCTIONS
    descendant: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, node.getElementsByTagName('*'));
      return results;
    },

    child: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        for (var j = 0, child; child = node.childNodes[j]; j++)
          if (child.nodeType == 1 && child.tagName != '!') results.push(child);
      }
      return results;
    },

    adjacent: function(nodes) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        var next = this.nextElementSibling(node);
        if (next) results.push(next);
      }
      return results;
    },

    laterSibling: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, Element.nextSiblings(node));
      return results;
    },

    nextElementSibling: function(node) {
      while (node = node.nextSibling)
        if (node.nodeType == 1) return node;
      return null;
    },

    previousElementSibling: function(node) {
      while (node = node.previousSibling)
        if (node.nodeType == 1) return node;
      return null;
    },

    // TOKEN FUNCTIONS
    tagName: function(nodes, root, tagName, combinator) {
      var uTagName = tagName.toUpperCase();
      var results = [], h = Selector.handlers;
      if (nodes) {
        if (combinator) {
          // fastlane for ordinary descendant combinators
          if (combinator == "descendant") {
            for (var i = 0, node; node = nodes[i]; i++)
              h.concat(results, node.getElementsByTagName(tagName));
            return results;
          } else nodes = this[combinator](nodes);
          if (tagName == "*") return nodes;
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName.toUpperCase() === uTagName) results.push(node);
        return results;
      } else return root.getElementsByTagName(tagName);
    },

    id: function(nodes, root, id, combinator) {
      var targetNode = $(id), h = Selector.handlers;
      if (!targetNode) return [];
      if (!nodes && root == document) return [targetNode];
      if (nodes) {
        if (combinator) {
          if (combinator == 'child') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (targetNode.parentNode == node) return [targetNode];
          } else if (combinator == 'descendant') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Element.descendantOf(targetNode, node)) return [targetNode];
          } else if (combinator == 'adjacent') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Selector.handlers.previousElementSibling(targetNode) == node)
                return [targetNode];
          } else nodes = h[combinator](nodes);
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node == targetNode) return [targetNode];
        return [];
      }
      return (targetNode && Element.descendantOf(targetNode, root)) ? [targetNode] : [];
    },

    className: function(nodes, root, className, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      return Selector.handlers.byClassName(nodes, root, className);
    },

    byClassName: function(nodes, root, className) {
      if (!nodes) nodes = Selector.handlers.descendant([root]);
      var needle = ' ' + className + ' ';
      for (var i = 0, results = [], node, nodeClassName; node = nodes[i]; i++) {
        nodeClassName = node.className;
        if (nodeClassName.length == 0) continue;
        if (nodeClassName == className || (' ' + nodeClassName + ' ').include(needle))
          results.push(node);
      }
      return results;
    },

    attrPresence: function(nodes, root, attr, combinator) {
      if (!nodes) nodes = root.getElementsByTagName("*");
      if (nodes && combinator) nodes = this[combinator](nodes);
      var results = [];
      for (var i = 0, node; node = nodes[i]; i++)
        if (Element.hasAttribute(node, attr)) results.push(node);
      return results;
    },

    attr: function(nodes, root, attr, value, operator, combinator) {
      if (!nodes) nodes = root.getElementsByTagName("*");
      if (nodes && combinator) nodes = this[combinator](nodes);
      var handler = Selector.operators[operator], results = [];
      for (var i = 0, node; node = nodes[i]; i++) {
        var nodeValue = Element.readAttribute(node, attr);
        if (nodeValue === null) continue;
        if (handler(nodeValue, value)) results.push(node);
      }
      return results;
    },

    pseudo: function(nodes, name, value, root, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      if (!nodes) nodes = root.getElementsByTagName("*");
      return Selector.pseudos[name](nodes, value, root);
    }
  },

  pseudos: {
    'first-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.previousElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'last-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.nextElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'only-child': function(nodes, value, root) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!h.previousElementSibling(node) && !h.nextElementSibling(node))
          results.push(node);
      return results;
    },
    'nth-child':        function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root);
    },
    'nth-last-child':   function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true);
    },
    'nth-of-type':      function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, false, true);
    },
    'nth-last-of-type': function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true, true);
    },
    'first-of-type':    function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, false, true);
    },
    'last-of-type':     function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, true, true);
    },
    'only-of-type':     function(nodes, formula, root) {
      var p = Selector.pseudos;
      return p['last-of-type'](p['first-of-type'](nodes, formula, root), formula, root);
    },

    // handles the an+b logic
    getIndices: function(a, b, total) {
      if (a == 0) return b > 0 ? [b] : [];
      return $R(1, total).inject([], function(memo, i) {
        if (0 == (i - b) % a && (i - b) / a >= 0) memo.push(i);
        return memo;
      });
    },

    // handles nth(-last)-child, nth(-last)-of-type, and (first|last)-of-type
    nth: function(nodes, formula, root, reverse, ofType) {
      if (nodes.length == 0) return [];
      if (formula == 'even') formula = '2n+0';
      if (formula == 'odd')  formula = '2n+1';
      var h = Selector.handlers, results = [], indexed = [], m;
      h.mark(nodes);
      for (var i = 0, node; node = nodes[i]; i++) {
        if (!node.parentNode._countedByPrototype) {
          h.index(node.parentNode, reverse, ofType);
          indexed.push(node.parentNode);
        }
      }
      if (formula.match(/^\d+$/)) { // just a number
        formula = Number(formula);
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.nodeIndex == formula) results.push(node);
      } else if (m = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
        if (m[1] == "-") m[1] = -1;
        var a = m[1] ? Number(m[1]) : 1;
        var b = m[2] ? Number(m[2]) : 0;
        var indices = Selector.pseudos.getIndices(a, b, nodes.length);
        for (var i = 0, node, l = indices.length; node = nodes[i]; i++) {
          for (var j = 0; j < l; j++)
            if (node.nodeIndex == indices[j]) results.push(node);
        }
      }
      h.unmark(nodes);
      h.unmark(indexed);
      return results;
    },

    'empty': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        // IE treats comments as element nodes
        if (node.tagName == '!' || node.firstChild) continue;
        results.push(node);
      }
      return results;
    },

    'not': function(nodes, selector, root) {
      var h = Selector.handlers, selectorType, m;
      var exclusions = new Selector(selector).findElements(root);
      h.mark(exclusions);
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node._countedByPrototype) results.push(node);
      h.unmark(exclusions);
      return results;
    },

    'enabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node.disabled && (!node.type || node.type !== 'hidden'))
          results.push(node);
      return results;
    },

    'disabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.disabled) results.push(node);
      return results;
    },

    'checked': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.checked) results.push(node);
      return results;
    }
  },

  operators: {
    '=':  function(nv, v) { return nv == v; },
    '!=': function(nv, v) { return nv != v; },
    '^=': function(nv, v) { return nv == v || nv && nv.startsWith(v); },
    '$=': function(nv, v) { return nv == v || nv && nv.endsWith(v); },
    '*=': function(nv, v) { return nv == v || nv && nv.include(v); },
    '$=': function(nv, v) { return nv.endsWith(v); },
    '*=': function(nv, v) { return nv.include(v); },
    '~=': function(nv, v) { return (' ' + nv + ' ').include(' ' + v + ' '); },
    '|=': function(nv, v) { return ('-' + (nv || "").toUpperCase() +
     '-').include('-' + (v || "").toUpperCase() + '-'); }
  },

  split: function(expression) {
    var expressions = [];
    expression.scan(/(([\w#:.~>+()\s-]+|\*|\[.*?\])+)\s*(,|$)/, function(m) {
      expressions.push(m[1].strip());
    });
    return expressions;
  },

  matchElements: function(elements, expression) {
    var matches = $$(expression), h = Selector.handlers;
    h.mark(matches);
    for (var i = 0, results = [], element; element = elements[i]; i++)
      if (element._countedByPrototype) results.push(element);
    h.unmark(matches);
    return results;
  },

  findElement: function(elements, expression, index) {
    if (Object.isNumber(expression)) {
      index = expression; expression = false;
    }
    return Selector.matchElements(elements, expression || '*')[index || 0];
  },

  findChildElements: function(element, expressions) {
    expressions = Selector.split(expressions.join(','));
    var results = [], h = Selector.handlers;
    for (var i = 0, l = expressions.length, selector; i < l; i++) {
      selector = new Selector(expressions[i].strip());
      h.concat(results, selector.findElements(element));
    }
    return (l > 1) ? h.unique(results) : results;
  }
});

if (Prototype.Browser.IE) {
  Object.extend(Selector.handlers, {
    // IE returns comment nodes on getElementsByTagName("*").
    // Filter them out.
    concat: function(a, b) {
      for (var i = 0, node; node = b[i]; i++)
        if (node.tagName !== "!") a.push(node);
      return a;
    },

    // IE improperly serializes _countedByPrototype in (inner|outer)HTML.
    unmark: function(nodes) {
      for (var i = 0, node; node = nodes[i]; i++)
        node.removeAttribute('_countedByPrototype');
      return nodes;
    }
  });
}

function $$() {
  return Selector.findChildElements(document, $A(arguments));
}
var Form = {
  reset: function(form) {
    $(form).reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit;

    var data = elements.inject({ }, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          if (key in result) {
            // a key is already present; construct an array of values
            if (!Object.isArray(result[key])) result[key] = [result[key]];
            result[key].push(value);
          }
          else result[key] = value;
        }
      }
      return result;
    });

    return options.hash ? data : Object.toQueryString(data);
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    return $A($(form).getElementsByTagName('*')).inject([],
      function(elements, child) {
        if (Form.Element.Serializers[child.tagName.toLowerCase()])
          elements.push(Element.extend(child));
        return elements;
      }
    );
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return ['input', 'select', 'textarea'].include(element.tagName.toLowerCase());
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    form.findFirstElement().activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/

Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {
  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !['button', 'reset', 'submit'].include(element.type)))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;
var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = {
  input: function(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return Form.Element.Serializers.inputSelector(element, value);
      default:
        return Form.Element.Serializers.textarea(element, value);
    }
  },

  inputSelector: function(element, value) {
    if (Object.isUndefined(value)) return element.checked ? element.value : null;
    else element.checked = !!value;
  },

  textarea: function(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  },

  select: function(element, value) {
    if (Object.isUndefined(value))
      return this[element.type == 'select-one' ?
        'selectOne' : 'selectMany'](element);
    else {
      var opt, currentValue, single = !Object.isArray(value);
      for (var i = 0, length = element.length; i < length; i++) {
        opt = element.options[i];
        currentValue = this.optionValue(opt);
        if (single) {
          if (currentValue == value) {
            opt.selected = true;
            return;
          }
        }
        else opt.selected = value.include(currentValue);
      }
    }
  },

  selectOne: function(element) {
    var index = element.selectedIndex;
    return index >= 0 ? this.optionValue(element.options[index]) : null;
  },

  selectMany: function(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(this.optionValue(opt));
    }
    return values;
  },

  optionValue: function(opt) {
    // extend element because hasAttribute may not be native
    return Element.extend(opt).hasAttribute('value') ? opt.value : opt.text;
  }
};

/*--------------------------------------------------------------------------*/

Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
if (!window.Event) var Event = { };

Object.extend(Event, {
  KEY_BACKSPACE: 8,
  KEY_TAB:       9,
  KEY_RETURN:   13,
  KEY_ESC:      27,
  KEY_LEFT:     37,
  KEY_UP:       38,
  KEY_RIGHT:    39,
  KEY_DOWN:     40,
  KEY_DELETE:   46,
  KEY_HOME:     36,
  KEY_END:      35,
  KEY_PAGEUP:   33,
  KEY_PAGEDOWN: 34,
  KEY_INSERT:   45,

  cache: { },

  relatedTarget: function(event) {
    var element;
    switch(event.type) {
      case 'mouseover': element = event.fromElement; break;
      case 'mouseout':  element = event.toElement;   break;
      default: return null;
    }
    return Element.extend(element);
  }
});

Event.Methods = (function() {
  var isButton;

  if (Prototype.Browser.IE) {
    var buttonMap = { 0: 1, 1: 4, 2: 2 };
    isButton = function(event, code) {
      return event.button == buttonMap[code];
    };

  } else if (Prototype.Browser.WebKit) {
    isButton = function(event, code) {
      switch (code) {
        case 0: return event.which == 1 && !event.metaKey;
        case 1: return event.which == 1 && event.metaKey;
        default: return false;
      }
    };

  } else {
    isButton = function(event, code) {
      return event.which ? (event.which === code + 1) : (event.button === code);
    };
  }

  return {
    isLeftClick:   function(event) { return isButton(event, 0) },
    isMiddleClick: function(event) { return isButton(event, 1) },
    isRightClick:  function(event) { return isButton(event, 2) },

    element: function(event) {
      event = Event.extend(event);

      var node          = event.target,
          type          = event.type,
          currentTarget = event.currentTarget;

      if (currentTarget && currentTarget.tagName) {
        // Firefox screws up the "click" event when moving between radio buttons
        // via arrow keys. It also screws up the "load" and "error" events on images,
        // reporting the document as the target instead of the original image.
        if (type === 'load' || type === 'error' ||
          (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
            && currentTarget.type === 'radio'))
              node = currentTarget;
      }
      if (node.nodeType == Node.TEXT_NODE) node = node.parentNode;
      return Element.extend(node);
    },

    findElement: function(event, expression) {
      var element = Event.element(event);
      if (!expression) return element;
      var elements = [element].concat(element.ancestors());
      return Selector.findElement(elements, expression, 0);
    },

    pointer: function(event) {
      var docElement = document.documentElement,
      body = document.body || { scrollLeft: 0, scrollTop: 0 };
      return {
        x: event.pageX || (event.clientX +
          (docElement.scrollLeft || body.scrollLeft) -
          (docElement.clientLeft || 0)),
        y: event.pageY || (event.clientY +
          (docElement.scrollTop || body.scrollTop) -
          (docElement.clientTop || 0))
      };
    },

    pointerX: function(event) { return Event.pointer(event).x },
    pointerY: function(event) { return Event.pointer(event).y },

    stop: function(event) {
      Event.extend(event);
      event.preventDefault();
      event.stopPropagation();
      event.stopped = true;
    }
  };
})();

Event.extend = (function() {
  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (Prototype.Browser.IE) {
    Object.extend(methods, {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return "[object Event]" }
    });

    return function(event) {
      if (!event) return false;
      if (event._extendedByPrototype) return event;

      event._extendedByPrototype = Prototype.emptyFunction;
      var pointer = Event.pointer(event);
      Object.extend(event, {
        target: event.srcElement,
        relatedTarget: Event.relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });
      return Object.extend(event, methods);
    };

  } else {
    Event.prototype = Event.prototype || document.createEvent("HTMLEvents")['__proto__'];
    Object.extend(Event.prototype, methods);
    return Prototype.K;
  }
})();

Object.extend(Event, (function() {
  var cache = Event.cache;

  function getEventID(element) {
    if (element._prototypeEventID) return element._prototypeEventID[0];
    arguments.callee.id = arguments.callee.id || 1;
    return element._prototypeEventID = [++arguments.callee.id];
  }

  function getDOMEventName(eventName) {
    if (eventName && eventName.include(':')) return "dataavailable";
    return eventName;
  }

  function getCacheForID(id) {
    return cache[id] = cache[id] || { };
  }

  function getWrappersForEventName(id, eventName) {
    var c = getCacheForID(id);
    return c[eventName] = c[eventName] || [];
  }

  function createWrapper(element, eventName, handler) {
    var id = getEventID(element);
    var c = getWrappersForEventName(id, eventName);
    if (c.pluck("handler").include(handler)) return false;

    var wrapper = function(event) {
      if (!Event || !Event.extend ||
        (event.eventName && event.eventName != eventName))
          return false;

      Event.extend(event);
      handler.call(element, event);
    };

    wrapper.handler = handler;
    c.push(wrapper);
    return wrapper;
  }

  function findWrapper(id, eventName, handler) {
    var c = getWrappersForEventName(id, eventName);
    return c.find(function(wrapper) { return wrapper.handler == handler });
  }

  function destroyWrapper(id, eventName, handler) {
    var c = getCacheForID(id);
    if (!c[eventName]) return false;
    c[eventName] = c[eventName].without(findWrapper(id, eventName, handler));
  }

  function destroyCache() {
    for (var id in cache)
      for (var eventName in cache[id])
        cache[id][eventName] = null;
  }


  // Internet Explorer needs to remove event handlers on page unload
  // in order to avoid memory leaks.
  if (window.attachEvent) {
    window.attachEvent("onunload", destroyCache);
  }

  // Safari has a dummy event handler on page unload so that it won't
  // use its bfcache. Safari <= 3.1 has an issue with restoring the "document"
  // object when page is returned to via the back button using its bfcache.
  if (Prototype.Browser.WebKit) {
    window.addEventListener('unload', Prototype.emptyFunction, false);
  }

  return {
    observe: function(element, eventName, handler) {
      element = $(element);
      var name = getDOMEventName(eventName);

      var wrapper = createWrapper(element, eventName, handler);
      if (!wrapper) return element;

      if (element.addEventListener) {
        element.addEventListener(name, wrapper, false);
      } else {
        element.attachEvent("on" + name, wrapper);
      }

      return element;
    },

    stopObserving: function(element, eventName, handler) {
      element = $(element);
      var id = getEventID(element), name = getDOMEventName(eventName);

      if (!handler && eventName) {
        getWrappersForEventName(id, eventName).each(function(wrapper) {
          element.stopObserving(eventName, wrapper.handler);
        });
        return element;

      } else if (!eventName) {
        Object.keys(getCacheForID(id)).each(function(eventName) {
          element.stopObserving(eventName);
        });
        return element;
      }

      var wrapper = findWrapper(id, eventName, handler);
      if (!wrapper) return element;

      if (element.removeEventListener) {
        element.removeEventListener(name, wrapper, false);
      } else {
        element.detachEvent("on" + name, wrapper);
      }

      destroyWrapper(id, eventName, handler);

      return element;
    },

    fire: function(element, eventName, memo) {
      element = $(element);
      if (element == document && document.createEvent && !element.dispatchEvent)
        element = document.documentElement;

      var event;
      if (document.createEvent) {
        event = document.createEvent("HTMLEvents");
        event.initEvent("dataavailable", true, true);
      } else {
        event = document.createEventObject();
        event.eventType = "ondataavailable";
      }

      event.eventName = eventName;
      event.memo = memo || { };

      if (document.createEvent) {
        element.dispatchEvent(event);
      } else {
        element.fireEvent(event.eventType, event);
      }

      return Event.extend(event);
    }
  };
})());

Object.extend(Event, Event.Methods);

Element.addMethods({
  fire:          Event.fire,
  observe:       Event.observe,
  stopObserving: Event.stopObserving
});

Object.extend(document, {
  fire:          Element.Methods.fire.methodize(),
  observe:       Element.Methods.observe.methodize(),
  stopObserving: Element.Methods.stopObserving.methodize(),
  loaded:        false
});

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards and John Resig. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearInterval(timer);
    document.fire("dom:loaded");
    document.loaded = true;
  }

  if (document.addEventListener) {
    if (Prototype.Browser.WebKit) {
      timer = window.setInterval(function() {
        if (/loaded|complete/.test(document.readyState))
          fireContentLoadedEvent();
      }, 0);

      Event.observe(window, "load", fireContentLoadedEvent);

    } else {
      document.addEventListener("DOMContentLoaded",
        fireContentLoadedEvent, false);
    }

  } else {
    document.write("<script id=__onDOMContentLoaded defer src=//:><\/script>");
    $("__onDOMContentLoaded").onreadystatechange = function() {
      if (this.readyState == "complete") {
        this.onreadystatechange = null;
        fireContentLoadedEvent();
      }
    };
  }
})();
/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

// This should be moved to script.aculo.us; notice the deprecated methods
// further below, that map to the newer Element methods.
var Position = {
  // set to true if needed, warning: firefox performance problems
  // NOT neeeded for page scrolling, only if draggable contained in
  // scrollable elements
  includeScrollOffsets: false,

  // must be called before calling withinIncludingScrolloffset, every time the
  // page is scrolled
  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  // caches x/y coordinate pair to use with overlap
  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  // within must be called directly before
  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },

  // Deprecation layer -- use newer Element methods now (1.5.2).

  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

Element.addMethods();

// Flash Audio Player: http://www.1pixelout.net/code/audio-player-wordpress-plugin/

var ap_instances = new Array();

function ap_stopAll(playerID) {
	for(var i = 0;i<ap_instances.length;i++) {
		try {
			if(ap_instances[i] != playerID) document.getElementById("audioplayer" + ap_instances[i].toString()).SetVariable("closePlayer", 1);
			else document.getElementById("audioplayer" + ap_instances[i].toString()).SetVariable("closePlayer", 0);
		} catch( errorObject ) {
			// stop any errors
		}
	}
}

function ap_registerPlayers() {
	var objectID;
	var objectTags = document.getElementsByTagName("object");
	for(var i=0;i<objectTags.length;i++) {
		objectID = objectTags[i].id;
		if(objectID.indexOf("audioplayer") == 0) {
			ap_instances[i] = objectID.substring(11, objectID.length);
		}
	}
}

var ap_clearID = setInterval( ap_registerPlayers, 100 );

// CalendarDateSelect version 1.10.2 - a prototype based date picker
// Questions, comments, bugs? - email the Author - Tim Harper <"timseeharper@gmail.seeom".gsub("see", "c")> 
if (typeof Prototype == 'undefined') alert("CalendarDateSelect Error: Prototype could not be found. Please make sure that your application's layout includes prototype.js (.g. <%= javascript_include_tag :defaults %>) *before* it includes calendar_date_select.js (.g. <%= calendar_date_select_includes %>).");
if (Prototype.Version < "1.6") alert("Prototype 1.6.0 is required.  If using earlier version of prototype, please use calendar_date_select version 1.8.3");

Element.addMethods({
  purgeChildren: function(element) { $A(element.childNodes).each(function(e){$(e).remove();}); },
  build: function(element, type, options, style) {
    var newElement = Element.build(type, options, style);
    element.appendChild(newElement);
    return newElement;
  }
});

Element.build = function(type, options, style)
{
  var e = $(document.createElement(type));
  $H(options).each(function(pair) { eval("e." + pair.key + " = pair.value" ); });
  if (style) 
    $H(style).each(function(pair) { eval("e.style." + pair.key + " = pair.value" ); });
  return e;
};
nil = null;

Date.one_day = 24*60*60*1000;
Date.weekdays = $w("S M T W T F S");
Date.first_day_of_week = 0;
Date.months = $w("January February March April May June July August September October November December" );
Date.padded2 = function(hour) { var padded2 = parseInt(hour, 10); if (hour < 10) padded2 = "0" + padded2; return padded2; }
Date.prototype.getPaddedMinutes = function() { return Date.padded2(this.getMinutes()); }
Date.prototype.getAMPMHour = function() { var hour = this.getHours(); return (hour == 0) ? 12 : (hour > 12 ? hour - 12 : hour ) }
Date.prototype.getAMPM = function() { return (this.getHours() < 12) ? "AM" : "PM"; }
Date.prototype.stripTime = function() { return new Date(this.getFullYear(), this.getMonth(), this.getDate());};
Date.prototype.daysDistance = function(compare_date) { return Math.round((compare_date - this) / Date.one_day); };
Date.prototype.toFormattedString = function(include_time){
  var hour, str;
  str = Date.months[this.getMonth()] + " " + this.getDate() + ", " + this.getFullYear();
  
  if (include_time) { hour = this.getHours(); str += " " + this.getAMPMHour() + ":" + this.getPaddedMinutes() + " " + this.getAMPM() }
  return str;
}
Date.parseFormattedString = function(string) { return new Date(string);}
Math.floor_to_interval = function(n, i) { return Math.floor(n/i) * i;}
window.f_height = function() { return( [window.innerHeight ? window.innerHeight : null, document.documentElement ? document.documentElement.clientHeight : null, document.body ? document.body.clientHeight : null].select(function(x){return x>0}).first()||0); }
window.f_scrollTop = function() { return ([window.pageYOffset ? window.pageYOffset : null, document.documentElement ? document.documentElement.scrollTop : null, document.body ? document.body.scrollTop : null].select(function(x){return x>0}).first()||0 ); }

_translations = {
  "OK": "OK",
  "Now": "Now",
  "Today": "Today"
}
SelectBox = Class.create();
SelectBox.prototype = {
  initialize: function(parent_element, values, html_options, style_options) {
    this.element = $(parent_element).build("select", html_options, style_options);
    this.populate(values);
  },
  populate: function(values) {
    this.element.purgeChildren();
    var that = this; $A(values).each(function(pair) { if (typeof(pair)!="object") {pair = [pair, pair]}; that.element.build("option", { value: pair[1], innerHTML: pair[0]}) });
  },
  setValue: function(value) {
    var e = this.element;
    var matched = false;
    $R(0, e.options.length - 1 ).each(function(i) { if(e.options[i].value==value.toString()) {e.selectedIndex = i; matched = true;}; } );
    return matched;
  },
  getValue: function() { return $F(this.element)}
}
CalendarDateSelect = Class.create();
CalendarDateSelect.prototype = {
  initialize: function(target_element, options) {
    this.target_element = $(target_element); // make sure it's an element, not a string
    if (!this.target_element) { alert("Target element " + target_element + " not found!"); return false;}
    if (this.target_element.tagName != "INPUT") this.target_element = this.target_element.down("INPUT")
    
    this.target_element.calendar_date_select = this;
    this.last_click_at = 0;
    // initialize the date control
    this.options = $H({
      embedded: false,
      popup: nil,
      time: false,
      buttons: true,
      year_range: 10,
      close_on_click: nil,
      minute_interval: 5,
      popup_by: this.target_element,
      month_year: "dropdowns",
      onchange: this.target_element.onchange,
      valid_date_check: nil
    }).merge(options || {});
    this.use_time = this.options.get("time");
    this.parseDate();
    this.callback("before_show")
    this.initCalendarDiv();
    if(!this.options.get("embedded")) {
      this.positionCalendarDiv()
      // set the click handler to check if a user has clicked away from the document
      Event.observe(document, "mousedown", this.closeIfClickedOut_handler = this.closeIfClickedOut.bindAsEventListener(this));
      Event.observe(document, "keypress", this.keyPress_handler = this.keyPress.bindAsEventListener(this));
    }
    this.callback("after_show")
  },
  positionCalendarDiv: function() {
    var above = false;
    var c_pos = this.calendar_div.cumulativeOffset(), c_left = c_pos[0], c_top = c_pos[1], c_dim = this.calendar_div.getDimensions(), c_height = c_dim.height, c_width = c_dim.width; 
    var w_top = window.f_scrollTop(), w_height = window.f_height();
    var e_dim = $(this.options.get("popup_by")).cumulativeOffset(), e_top = e_dim[1], e_left = e_dim[0], e_height = $(this.options.get("popup_by")).getDimensions().height, e_bottom = e_top + e_height;
    
    if ( (( e_bottom + c_height ) > (w_top + w_height)) && ( e_bottom - c_height > w_top )) above = true;
    var left_px = e_left.toString() + "px", top_px = (above ? (e_top - c_height ) : ( e_top + e_height )).toString() + "px";
    
    this.calendar_div.style.left = left_px;  this.calendar_div.style.top = top_px;
    
    this.calendar_div.setStyle({visibility:""});
    
    // draw an iframe behind the calendar -- ugly hack to make IE 6 happy
    if(navigator.appName=="Microsoft Internet Explorer") this.iframe = $(document.body).build("iframe", {src: "javascript:false", className: "ie6_blocker"}, { left: left_px, top: top_px, height: c_height.toString()+"px", width: c_width.toString()+"px", border: "0px"})
  },
  initCalendarDiv: function() {
    if (this.options.get("embedded")) {
      var parent = this.target_element.parentNode;
      var style = {}
    } else {
      var parent = document.body
      var style = { position:"absolute", visibility: "hidden", left:0, top:0 }
    }
    this.calendar_div = $(parent).build('div', {className: "calendar_date_select"}, style);
    
    var that = this;
    // create the divs
    $w("top header body buttons footer bottom").each(function(name) {
      eval("var " + name + "_div = that." + name + "_div = that.calendar_div.build('div', { className: 'cds_"+name+"' }, { clear: 'left'} ); ");
    });
    
    this.initHeaderDiv();
    this.initButtonsDiv();
    this.initCalendarGrid();
    this.updateFooter("&#160;");
    
    this.refresh();
    this.setUseTime(this.use_time);
  },
  initHeaderDiv: function() {
    var header_div = this.header_div;
    this.close_button = header_div.build("a", { innerHTML: "x", href:"#", onclick:function () { this.close(); return false; }.bindAsEventListener(this), className: "close" });
    this.next_month_button = header_div.build("a", { innerHTML: "&gt;", href:"#", onclick:function () { this.navMonth(this.date.getMonth() + 1 ); return false; }.bindAsEventListener(this), className: "next" });
    this.prev_month_button = header_div.build("a", { innerHTML: "&lt;", href:"#", onclick:function () { this.navMonth(this.date.getMonth() - 1 ); return false; }.bindAsEventListener(this), className: "prev" });
    
    if (this.options.get("month_year")=="dropdowns") {
      this.month_select = new SelectBox(header_div, $R(0,11).map(function(m){return [Date.months[m], m]}), {className: "month", onchange: function () { this.navMonth(this.month_select.getValue()) }.bindAsEventListener(this)}); 
      this.year_select = new SelectBox(header_div, [], {className: "year", onchange: function () { this.navYear(this.year_select.getValue()) }.bindAsEventListener(this)}); 
      this.populateYearRange();
    } else {
      this.month_year_label = header_div.build("span")
    }
  },
  initCalendarGrid: function() {
    var body_div = this.body_div;
    this.calendar_day_grid = [];
    var days_table = body_div.build("table", { cellPadding: "0px", cellSpacing: "0px", width: "100%" })
    // make the weekdays!
    var weekdays_row = days_table.build("thead").build("tr");
    Date.weekdays.each( function(weekday) { 
      weekdays_row.build("th", {innerHTML: weekday});
    });
    
    var days_tbody = days_table.build("tbody")
    // Make the days!
    var row_number = 0, weekday;
    for(var cell_index = 0; cell_index<42; cell_index++)
    {
      weekday = (cell_index+Date.first_day_of_week ) % 7;
      if ( cell_index % 7==0 ) days_row = days_tbody.build("tr", {className: 'row_'+row_number++});
      (this.calendar_day_grid[cell_index] = days_row.build("td", {
          calendar_date_select: this,
          onmouseover: function () { this.calendar_date_select.dayHover(this); },
          onmouseout: function () { this.calendar_date_select.dayHoverOut(this) },
          onclick: function() { this.calendar_date_select.updateSelectedDate(this, true); },
          className: (weekday==0) || (weekday==6) ? " weekend" : "" //clear the class
        },
        { cursor: "pointer" }
      )).build("div");
      this.calendar_day_grid[cell_index];
    }
  },
  initButtonsDiv: function()
  {
    var buttons_div = this.buttons_div;
    if (this.options.get("time"))
    {
      var blank_time = $A(this.options.get("time")=="mixed" ? [[" - ", ""]] : []);
      buttons_div.build("span", {innerHTML:"@", className: "at_sign"});
      
      var t = new Date();
      this.hour_select = new SelectBox(buttons_div,
        blank_time.concat($R(0,23).map(function(x) {t.setHours(x); return $A([t.getAMPMHour()+ " " + t.getAMPM(),x])} )),
        { 
          calendar_date_select: this, 
          onchange: function() { this.calendar_date_select.updateSelectedDate( { hour: this.value });},
          className: "hour" 
        }
      );
      buttons_div.build("span", {innerHTML:":", className: "seperator"});
      var that = this;
      this.minute_select = new SelectBox(buttons_div,
        blank_time.concat($R(0,59).select(function(x){return (x % that.options.get('minute_interval')==0)}).map(function(x){ return $A([ Date.padded2(x), x]); } ) ),
        { 
          calendar_date_select: this, 
          onchange: function() { this.calendar_date_select.updateSelectedDate( {minute: this.value }) }, 
          className: "minute" 
        }
      );
      
    } else if (! this.options.get("buttons")) buttons_div.remove();
    
    if (this.options.get("buttons")) {
      buttons_div.build("span", {innerHTML: "&#160;"});
      if (this.options.get("time")=="mixed" || !this.options.get("time")) b = buttons_div.build("a", {
          innerHTML: _translations["Today"],
          href: "#",
          onclick: function() {this.today(false); return false;}.bindAsEventListener(this)
        });
      
      if (this.options.get("time")=="mixed") buttons_div.build("span", {innerHTML: " | ", className:"button_seperator"})
      
      if (this.options.get("time")) b = buttons_div.build("a", {
        innerHTML: _translations["Now"],
        href: "#",
        onclick: function() {this.today(true); return false}.bindAsEventListener(this)
      });
      
      if (!this.options.get("embedded"))
      {
        buttons_div.build("span", {innerHTML: "&#160;"});
        buttons_div.build("a", { innerHTML: _translations["OK"], href: "#", onclick: function() {this.close(); return false;}.bindAsEventListener(this) });
      }
    }
  },
  refresh: function ()
  {
    this.refreshMonthYear();
    this.refreshCalendarGrid();
    
    this.setSelectedClass();
    this.updateFooter();
  },
  refreshCalendarGrid: function () {
    this.beginning_date = new Date(this.date).stripTime();
    this.beginning_date.setDate(1);
    this.beginning_date.setHours(12); // Prevent daylight savings time boundaries from showing a duplicate day
    var pre_days = this.beginning_date.getDay() // draw some days before the fact
    if (pre_days < 3) pre_days += 7;
    this.beginning_date.setDate(1 - pre_days + Date.first_day_of_week);
    
    var iterator = new Date(this.beginning_date);
    
    var today = new Date().stripTime();
    var this_month = this.date.getMonth();
    vdc = this.options.get("valid_date_check");
    for (var cell_index = 0;cell_index<42; cell_index++)
    {
      day = iterator.getDate(); month = iterator.getMonth();
      cell = this.calendar_day_grid[cell_index];
      Element.remove(cell.childNodes[0]); div = cell.build("div", {innerHTML:day});
      if (month!=this_month) div.className = "other";
      cell.day = day; cell.month = month; cell.year = iterator.getFullYear();
      if (vdc) { if (vdc(iterator.stripTime())) cell.removeClassName("disabled"); else cell.addClassName("disabled") };
      iterator.setDate( day + 1);
    }
    
    if (this.today_cell) this.today_cell.removeClassName("today");
    
    if ( $R( 0, 41 ).include(days_until = this.beginning_date.stripTime().daysDistance(today)) ) {
      this.today_cell = this.calendar_day_grid[days_until];
      this.today_cell.addClassName("today");
    }
  },
  refreshMonthYear: function() {
    var m = this.date.getMonth();
    var y = this.date.getFullYear();
    // set the month
    if (this.options.get("month_year") == "dropdowns") 
    {
      this.month_select.setValue(m, false);
      
      var e = this.year_select.element; 
      if (this.flexibleYearRange() && (!(this.year_select.setValue(y, false)) || e.selectedIndex <= 1 || e.selectedIndex >= e.options.length - 2 )) this.populateYearRange();
      
      this.year_select.setValue(y);
      
    } else {
      this.month_year_label.update( Date.months[m] + " " + y.toString()  );
    }
  },
  populateYearRange: function() {
    this.year_select.populate(this.yearRange().toArray());
  },
  yearRange: function() {
    if (!this.flexibleYearRange())
      return $R(this.options.get("year_range")[0], this.options.get("year_range")[1]);
      
    var y = this.date.getFullYear();
    return $R(y - this.options.get("year_range"), y + this.options.get("year_range"));
  },
  flexibleYearRange: function() { return (typeof(this.options.get("year_range")) == "number"); },
  validYear: function(year) { if (this.flexibleYearRange()) { return true;} else { return this.yearRange().include(year);}  },
  dayHover: function(element) {
    var hover_date = new Date(this.selected_date);
    hover_date.setYear(element.year); hover_date.setMonth(element.month); hover_date.setDate(element.day);
    this.updateFooter(hover_date.toFormattedString(this.use_time));
  },
  dayHoverOut: function(element) { this.updateFooter(); },
  clearSelectedClass: function() {if (this.selected_cell) this.selected_cell.removeClassName("selected");},
  setSelectedClass: function() {
    if (!this.selection_made) return;
    this.clearSelectedClass()
    if ($R(0,42).include( days_until = this.beginning_date.stripTime().daysDistance(this.selected_date.stripTime()) )) {
      this.selected_cell = this.calendar_day_grid[days_until];
      this.selected_cell.addClassName("selected");
    }
  },
  reparse: function() { this.parseDate(); this.refresh(); },
  dateString: function() {
    return (this.selection_made) ? this.selected_date.toFormattedString(this.use_time) : "&#160;";
  },
  parseDate: function()
  {
    var value = $F(this.target_element).strip()
    this.selection_made = (value != "");
    this.date = value=="" ? NaN : Date.parseFormattedString(this.options.get("date") || value);
    if (isNaN(this.date)) this.date = new Date();
    if (!this.validYear(this.date.getFullYear())) this.date.setYear( (this.date.getFullYear() < this.yearRange().start) ? this.yearRange().start : this.yearRange().end);
    this.selected_date = new Date(this.date);
    this.use_time = /[0-9]:[0-9]{2}/.exec(value) ? true : false;
    this.date.setDate(1);
  },
  updateFooter:function(text) { if (!text) text = this.dateString(); this.footer_div.purgeChildren(); this.footer_div.build("span", {innerHTML: text }); },
  updateSelectedDate:function(partsOrElement, via_click) {
    var parts = $H(partsOrElement);
    if ((this.target_element.disabled || this.target_element.readOnly) && this.options.get("popup") != "force") return false;
    if (parts.get("day")) {
      var t_selected_date = this.selected_date, vdc = this.options.get("valid_date_check");
      for (var x = 0; x<=3; x++) t_selected_date.setDate(parts.get("day"));
      t_selected_date.setYear(parts.get("year"));
      t_selected_date.setMonth(parts.get("month"));
      
      if (vdc && ! vdc(t_selected_date.stripTime())) { return false; }
      this.selected_date = t_selected_date;
      this.selection_made = true;
    }
    
    if (!isNaN(parts.get("hour"))) this.selected_date.setHours(parts.get("hour"));
    if (!isNaN(parts.get("minute"))) this.selected_date.setMinutes( Math.floor_to_interval(parts.get("minute"), this.options.get("minute_interval")) );
    if (parts.get("hour") === "" || parts.get("minute") === "") 
      this.setUseTime(false);
    else if (!isNaN(parts.get("hour")) || !isNaN(parts.get("minute")))
      this.setUseTime(true);
    
    this.updateFooter();
    this.setSelectedClass();
    
    if (this.selection_made) this.updateValue();
    if (this.closeOnClick()) { this.close(); }
    if (via_click && !this.options.get("embedded")) {
      if ((new Date() - this.last_click_at) < 333) this.close();
      this.last_click_at = new Date();
    }
  },
  closeOnClick: function() {
    if (this.options.get("embedded")) return false;
    if (this.options.get("close_on_click")===nil )
      return (this.options.get("time")) ? false : true
    else
      return (this.options.get("close_on_click"))
  },
  navMonth: function(month) { (target_date = new Date(this.date)).setMonth(month); return (this.navTo(target_date)); },
  navYear: function(year) { (target_date = new Date(this.date)).setYear(year); return (this.navTo(target_date)); },
  navTo: function(date) {
    if (!this.validYear(date.getFullYear())) return false;
    this.date = date;
    this.date.setDate(1);
    this.refresh();
    this.callback("after_navigate", this.date);
    return true;
  },
  setUseTime: function(turn_on) {
    this.use_time = this.options.get("time") && (this.options.get("time")=="mixed" ? turn_on : true) // force use_time to true if time==true && time!="mixed"
    if (this.use_time && this.selected_date) { // only set hour/minute if a date is already selected
      var minute = Math.floor_to_interval(this.selected_date.getMinutes(), this.options.get("minute_interval"));
      var hour = this.selected_date.getHours();
      
      this.hour_select.setValue(hour);
      this.minute_select.setValue(minute)
    } else if (this.options.get("time")=="mixed") {
      this.hour_select.setValue(""); this.minute_select.setValue("");
    }
  },
  updateValue: function() {
    var last_value = this.target_element.value;
    this.target_element.value = this.dateString();
    if (last_value!=this.target_element.value) this.callback("onchange");
  },
  today: function(now) {
    var d = new Date(); this.date = new Date();
    var o = $H({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), hour: d.getHours(), minute: d.getMinutes()});
    if ( ! now ) o = o.merge({hour: "", minute:""}); 
    this.updateSelectedDate(o, true);
    this.refresh();
  },
  close: function() {
    if (this.closed) return false;
    this.callback("before_close");
    this.target_element.calendar_date_select = nil;
    Event.stopObserving(document, "mousedown", this.closeIfClickedOut_handler);
    Event.stopObserving(document, "keypress", this.keyPress_handler);
    this.calendar_div.remove(); this.closed = true;
    if (this.iframe) this.iframe.remove();
    if (this.target_element.type!="hidden") this.target_element.focus();
    this.callback("after_close");
  },
  closeIfClickedOut: function(e) {
    if (! $(Event.element(e)).descendantOf(this.calendar_div) ) this.close();
  },
  keyPress: function(e) {
    if (e.keyCode==Event.KEY_ESC) this.close();
  },
  callback: function(name, param) { if (this.options.get(name)) { this.options.get(name).bind(this.target_element)(param); } }
}

//  Prototip 1.1.0
//  by Nick Stakenburg - http://www.nickstakenburg.com
//  08-11-2007
//
//  More information on this project:
//  http://www.nickstakenburg.com/projects/prototip/
//
//  Licensed under the Creative Commons Attribution 3.0 License
//  http://creativecommons.org/licenses/by/3.0/
//

var Prototip = {
  Version: '1.1.0',

  REQUIRED_Prototype: '1.6.0',
  REQUIRED_Scriptaculous: '1.8.0',

  start: function() { this.require('Prototype'); },

  require: function(library) {
    if ((typeof window[library] == 'undefined') ||
      (this.convertVersionString(window[library].Version) < this.convertVersionString(this['REQUIRED_' + library])))
      throw('Prototip requires ' + library + ' >= ' + this['REQUIRED_' + library]);
  },

  // based on Scriptaculous' implementation
  convertVersionString: function(versionString) {
    var r = versionString.split('.');
    return parseInt(r[0])*100000 + parseInt(r[1])*1000 + parseInt(r[2]);
  },

  // fixed viewport.getDimensions. Also excludes scrollbars in firefox. Valid doctype required.
  viewport : {
    getDimensions: function() {
      var dimensions = { };
      var B = Prototype.Browser;
      $w('width height').each(function(d) {
        var D = d.capitalize();
        if (B.Opera) dimensions[d] = document.body['client' + D];
        else if (B.WebKit) dimensions[d] = self['inner' + D];
        else dimensions[d] = document.documentElement['client' + D];
        });
      return dimensions;
    }
  }
};
Prototip.start();

var Tips = {
  // Configuration
  closeButtons: false,
  zIndex: 1200,

  fixIE: (function(agent){
    var version = new RegExp('MSIE ([\\d.]+)').exec(agent);
    return version ? (parseFloat(version[1]) <= 6) : false;
  })(navigator.userAgent),

  tips : [],
  visible : [],

  add: function(tip) {
    this.tips.push(tip);
  },

  remove: function(element) {
    var tip = this.tips.find(function(t){ return t.element == $(element); });
    if (tip) {
      tip.deactivate();
      if (tip.tooltip) {
        tip.wrapper.remove();
        if (Tips.fixIE) tip.iframeShim.remove();
      }
      this.tips = this.tips.without(tip);
    }
  },

  zIndexRestore : 1200,
  raise: function(tip) {
    var highestZ = this.zIndexHighest();
    if (!highestZ) {
      tip.style.zIndex = this.zIndexRestore;
      return;
    }
    var newZ = (tip.style.zIndex != highestZ) ? highestZ + 1 : highestZ;
    this.tips.pluck('wrapper').invoke('removeClassName', 'highest');
							
    tip.setStyle({ zIndex : newZ }).addClassName('highest');
  },

  zIndexHighest: function() {
    var highestZ = this.visible.max(function(v) {
      return parseInt(v.style.zIndex);
    });
    return highestZ;
  },

  addVisibile: function(tip) {
    this.removeVisible(tip);
    this.visible.push(tip);
  },

  removeVisible: function(tip) {
    this.visible = this.visible.without(tip);
  }
};

var Tip = Class.create({
  initialize: function(element, content) {
    this.element = $(element);
    Tips.remove(this.element);
	
    this.content = content;    

    var isHooking = (arguments[2] && arguments[2].hook);
    var isShowOnClick = (arguments[2] && arguments[2].showOn == 'click');

    this.options = Object.extend({
      className: 'default',                 // see css, this will lead to .prototip .default
      closeButton: Tips.closeButtons,       // true, false
      delay: !isShowOnClick ? 0.2 : false,  // seconds before tooltip appears
      duration: 0.3,                        // duration of the effect
      effect: false,                        // false, 'appear' or 'blind'
      hideOn: 'mouseout',
      hook: false,                          // { element: topLeft|topRight|bottomLeft|bottomRight, tip: see element }
      offset: isHooking ? {x:0, y:0} : {x:16, y:16},
      fixed: isHooking ? true : false,      // follow the mouse if false
      showOn: 'mousemove',
      target: this.element,                 // or another element
      title: false,

      viewport: isHooking ? false : true    // keep within viewport if mouse is followed
    }, arguments[2] || {});

    this.target = $(this.options.target);

    this.setup();

    if (this.options.effect) {
      Prototip.require('Scriptaculous');
      this.queue = { position: 'end', limit: 1, scope: this.wrapper.identify() }
    }

    Tips.add(this);
    this.activate();
  },

  setup: function() {
    // Everything that needs to be build for observing is done here
    this.wrapper = new Element('div', { 'class' : 'prototip' }).setStyle({
      display: 'none', zIndex: Tips.zIndex++ });
    this.wrapper.identify();	

    if (Tips.fixIE) {
      this.iframeShim = new Element('iframe', { 'class' : 'iframeShim', src: 'javascript:false;' }).setStyle({
        display: 'none', zIndex: Tips.zIndexRestore - 1 });
    }

    this.tip = new Element('div', { 'class' : 'content' }).update(this.content);
    this.tip.insert(new Element('div').setStyle({ clear: 'both' }));

    if (this.options.closeButton || (this.options.hideOn.element && this.options.hideOn.element == 'closeButton'))
      this.closeButton = new Element('a', { href: 'javascript:;', 'class' : 'close' });
  },

  build: function() {
    if (Tips.fixIE) document.body.appendChild(this.iframeShim).setOpacity(0);

    // effects go smooth with extra wrapper
    var wrapper = 'wrapper';
    if (this.options.effect) {
      this.effectWrapper = this.wrapper.appendChild(new Element('div', { 'class' : 'effectWrapper' }));
      wrapper = 'effectWrapper';
    }

    this.tooltip = this[wrapper].appendChild(new Element('div', { 'class' : 'tooltip ' + this.options.className }));

    if (this.options.title || this.options.closeButton) {
      this.toolbar = this.tooltip.appendChild(new Element('div', { 'class' : 'toolbar' }));
      this.title = this.toolbar.appendChild(new Element('div', { 'class' : 'title' }).update(this.options.title || ' '));
    }

    this.tooltip.insert(this.tip);
    document.body.appendChild(this.wrapper);
	
    // fixate elements for better positioning and effects
    var fixate = (this.options.effect) ? [this.wrapper, this.effectWrapper]: [this.wrapper];
    if (Tips.fixIE) fixate.push(this.iframeShim);

    // fix width
    var fixedWidth = this.wrapper.getWidth();
    fixate.invoke('setStyle', { width: fixedWidth + 'px' });
	
    // make toolbar width fixed
    if(this.toolbar) {
      this.wrapper.setStyle({ visibility : 'hidden' }).show();
      this.toolbar.setStyle({ width: this.toolbar.getWidth() + 'px'});
      this.wrapper.hide().setStyle({ visibility : 'visible' });
    }

    // add close button
    if (this.closeButton)
      this.title.insert({ top: this.closeButton }).insert(new Element('div').setStyle({ clear: 'both' }));

    var fixedHeight = this.wrapper.getHeight();
    fixate.invoke('setStyle', { width: fixedWidth + 'px', height: fixedHeight + 'px' });

    this[this.options.effect ? wrapper : 'tooltip'].hide();
  },

  activate: function() {
    this.eventShow = this.showDelayed.bindAsEventListener(this);
    this.eventHide = this.hide.bindAsEventListener(this);

    // if fixed use mouseover instead of mousemove for less event calls
    if (this.options.fixed && this.options.showOn == 'mousemove') this.options.showOn = 'mouseover';

    if(this.options.showOn == this.options.hideOn) {
      this.eventToggle = this.toggle.bindAsEventListener(this);
      this.element.observe(this.options.showOn, this.eventToggle);
    }

    this.hideElement = Object.isUndefined(this.options.hideOn.element) ? 'element' : this.options.hideOn.element;
    var hideOptions = {
      'element': this.eventToggle ? [] : [this.element],
      'target': this.eventToggle ? [] : [this.target],
      'tip': this.eventToggle ? [] : [this.wrapper],
      'closeButton': [],
      '.close' : this.tip.select('.close')
    }
    this.hideTargets = hideOptions[this.hideElement];

    // add show and hide observers
    if (this.element && !this.eventToggle) this.element.observe(this.options.showOn, this.eventShow);
    this.hideAction = (this.options.hideOn.event || this.options.hideOn);
    if (this.hideTargets) this.hideTargets.invoke('observe', this.hideAction, this.eventHide);

    // add position observer if not fixed
    if (!this.options.fixed && this.options.showOn == 'click') {
      this.eventPosition = this.position.bindAsEventListener(this);
      this.element.observe('mousemove', this.eventPosition);
    }

    // add hide observers to close button and non click elements when they are not the close (delay needs this)
    if (this.closeButton) this.closeButton.observe('click', this.eventHide);
    if (this.options.showOn != 'click' && this.hideElement != 'element') {
      this.eventCheckDelay = this.checkDelay.bindAsEventListener(this);
      this.element.observe('mouseout', this.eventCheckDelay);
    }

    // observe wrapper to raise zIndex
    this.wrapper.observe('mouseover', function(){ Tips.raise(this.wrapper); }.bind(this));
  },

  deactivate: function() {
    if(this.options.showOn == this.options.hideOn) 
      this.element.stopObserving(this.options.showOn, this.eventToggle);
    else {
      this.element.stopObserving(this.options.showOn, this.eventShow);
      this.hideTargets.invoke('stopObserving', this.hideAction, this.eventHide);
    }

    if (this.eventPosition) this.element.stopObserving('mousemove', this.eventPosition);
    if (this.closeButton) this.closeButton.stopObserving();
    if (this.eventCheckDelay) this.element.stopObserving('mouseout', this.eventCheckDelay);
    this.wrapper.stopObserving();
  },

  showDelayed: function(event){
    if (!this.tooltip) this.build();
    this.position(event); // follow mouse
    if (this.wrapper.visible()) return;

    this.checkDelay();
    this.timer = this.show.bind(this).delay(this.options.delay);
  },

  checkDelay: function(){
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  show: function(){
    if (this.wrapper.visible() && this.options.effect != 'appear') return;

    if (Tips.fixIE) this.iframeShim.show();
    Tips.addVisibile(this.wrapper);
    this.wrapper.show();

    if (!this.options.effect) this.tooltip.show();
    else {
      if (this.activeEffect) Effect.Queues.get(this.queue.scope).remove(this.activeEffect);
      this.activeEffect = Effect[Effect.PAIRS[this.options.effect][0]](this.effectWrapper,
        { duration: this.options.duration, queue: this.queue});
    }
  },

  hide: function(){
    this.checkDelay();
    if(!this.wrapper.visible()) return;

    if (!this.options.effect) {
      if (Tips.fixIE) this.iframeShim.hide();
      this.tooltip.hide();
      this.wrapper.hide();
      Tips.removeVisible(this.wrapper);
    }
    else {
      if (this.activeEffect) Effect.Queues.get(this.queue.scope).remove(this.activeEffect);
      this.activeEffect = Effect[Effect.PAIRS[this.options.effect][1]](this.effectWrapper, 
        { duration: this.options.duration, queue: this.queue, afterFinish: function(){
        if (Tips.fixIE) this.iframeShim.hide();
        this.wrapper.hide();
        Tips.removeVisible(this.wrapper);
      }.bind(this)});
    }
  },

  toggle: function(event){
    if (this.wrapper && this.wrapper.visible()) this.hide(event);
    else this.showDelayed(event);
  },

  position: function(event){
    if (!this.wrapper.hasClassName('highest')) Tips.raise(this.wrapper);

    var offset = {left: this.options.offset.x, top: this.options.offset.y};
    var targetPosition = Position.cumulativeOffset(this.target);
    var tipd = this.wrapper.getDimensions();
    var pos = { left: (this.options.fixed) ? targetPosition[0] : Event.pointerX(event),
      top: (this.options.fixed) ? targetPosition[1] : Event.pointerY(event) };

    // add offsets
    pos.left += offset.left;
    pos.top += offset.top;

    if (this.options.hook) {
      var dims = {target: this.target.getDimensions(), tip: tipd}
      var hooks = {target: Position.cumulativeOffset(this.target), tip: Position.cumulativeOffset(this.target)}

      for(var z in hooks) {
        switch(this.options.hook[z]){
          case 'topRight':
            hooks[z][0] += dims[z].width;
            break;
          case 'topMiddle':
            hooks[z][0] += (dims[z].width / 2);
            break;
          case 'rightMiddle':
            hooks[z][0] += dims[z].width;
            hooks[z][1] += (dims[z].height / 2);
            break;
          case 'bottomLeft':
            hooks[z][1] += dims[z].height;
            break;
          case 'bottomRight':
            hooks[z][0] += dims[z].width;
            hooks[z][1] += dims[z].height;
            break;
          case 'bottomMiddle':
            hooks[z][0] += (dims[z].width / 2);
            hooks[z][1] += dims[z].height;
            break;
          case 'leftMiddle':
            hooks[z][1] += (dims[z].height / 2);
            break;
        }
      }

      // move based on hooks
      pos.left += -1*(hooks.tip[0] - hooks.target[0]);
      pos.top += -1*(hooks.tip[1] - hooks.target[1]);
    }

    // move tooltip when there is a different target
    if (!this.options.fixed && this.element !== this.target) {
      var elementPosition = Position.cumulativeOffset(this.element);
      pos.left += -1*(elementPosition[0] - targetPosition[0]);
      pos.top += -1*(elementPosition[1] - targetPosition[1]);
    }

    if (!this.options.fixed && this.options.viewport) {
      var scroll = document.viewport.getScrollOffsets();
      var viewport = Prototip.viewport.getDimensions();
      var pair = {left: 'width', top: 'height'};

      for(var z in pair) {
        if ((pos[z] + tipd[pair[z]] - scroll[z]) > viewport[pair[z]])
          pos[z] = pos[z] - tipd[pair[z]] - 2*offset[z];
      }
    }

    var finalPosition = { left: pos.left + 'px', top: pos.top + 'px' };
    this.wrapper.setStyle(finalPosition);
    if (Tips.fixIE) this.iframeShim.setStyle(finalPosition);
  }
});

// http://softwaremaniacs.org/soft/highlight/en/ - bash, css, django, html/xml, javascript, php, perl, python, ruby, sql, diff
var hljs=new function(){var p={};var a={};function n(c){return c.replace(/&/gm,"&amp;").replace(/</gm,"&lt;").replace(/>/gm,"&gt;")}function k(s,r){if(!s){return false}for(var c=0;c<s.length;c++){if(s[c]==r){return true}}return false}function g(K,E){function L(P,O){P.sm=[];for(var N=0;N<P.c.length;N++){for(var r=0;r<O.m.length;r++){if(O.m[r].cN==P.c[N]){P.sm[P.sm.length]=O.m[r]}}}}function A(r,O){if(!O.c){return null}if(!O.sm){L(O,I)}for(var N=0;N<O.sm.length;N++){if(O.sm[N].bR.test(r)){return O.sm[N]}}return null}function x(N,r){if(D[N].e&&D[N].eR.test(r)){return 1}if(D[N].eW){var O=x(N-1,r);return O?O+1:0}return 0}function y(r,N){return N.iR&&N.iR.test(r)}function B(S,Q){var O=[];function R(T){if(!k(O,T)){O[O.length]=T}}if(S.c){for(var N=0;N<Q.m.length;N++){if(k(S.c,Q.m[N].cN)){R(Q.m[N].b)}}}var r=D.length-1;do{if(D[r].e){R(D[r].e)}r--}while(D[r+1].eW);if(S.i){R(S.i)}var P="("+O[0];for(var N=0;N<O.length;N++){P+="|"+O[N]}P+=")";return e(Q,P)}function t(O,N){var P=D[D.length-1];if(!P.t){P.t=B(P,I)}O=O.substr(N);var r=P.t.exec(O);if(!r){return[O,"",true]}if(r.index==0){return["",r[0],false]}else{return[O.substr(0,r.index),r[0],false]}}function s(Q,r){var N=I.cI?r[0].toLowerCase():r[0];for(var P in Q.keywordGroups){if(!Q.keywordGroups.hasOwnProperty(P)){continue}var O=Q.keywordGroups[P].hasOwnProperty(N);if(O){return[P,O]}}return false}function G(P,S){if(!S.k||!S.l){return n(P)}if(!S.lR){var R="("+S.l[0];for(var O=1;O<S.l.length;O++){R+="|"+S.l[O]}R+=")";S.lR=e(I,R,true)}var Q="";var T=0;S.lR.lastIndex=0;var N=S.lR.exec(P);while(N){Q+=n(P.substr(T,N.index-T));var r=s(S,N);if(r){u+=r[1];Q+='<span class="'+r[0]+'">'+n(N[0])+"</span>"}else{Q+=n(N[0])}T=S.lR.lastIndex;N=S.lR.exec(P)}Q+=n(P.substr(T,P.length-T));return Q}function M(r,O){if(O.subLanguage&&a[O.subLanguage]){var N=g(O.subLanguage,r);u+=N.keyword_count;C+=N.r;return N.value}else{return G(r,O)}}function J(O,r){var N=O.nM?"":'<span class="'+O.cN+'">';if(O.rB){c+=N;O.buffer=""}else{if(O.eB){c+=n(r)+N;O.buffer=""}else{c+=N;O.buffer=r}}D[D.length]=O}function F(R,N,S){var T=D[D.length-1];if(S){c+=M(T.buffer+R,T);return false}var O=A(N,T);if(O){c+=M(T.buffer+R,T);J(O,N);C+=O.r;return O.rB}var r=x(D.length-1,N);if(r){var Q=T.nM?"":"</span>";if(T.rE){c+=M(T.buffer+R,T)+Q}else{if(T.eE){c+=M(T.buffer+R,T)+Q+n(N)}else{c+=M(T.buffer+R+N,T)+Q}}while(r>1){Q=D[D.length-2].nM?"":"</span>";c+=Q;r--;D.length--}D.length--;D[D.length-1].buffer="";if(T.starts){for(var P=0;P<I.m.length;P++){if(I.m[P].cN==T.starts){J(I.m[P],"");break}}}return T.rE}if(y(N,T)){throw"Illegal"}}var I=p[K];var D=[I.dM];var C=0;var u=0;var c="";try{var w=0;I.dM.buffer="";do{var z=t(E,w);var v=F(z[0],z[1],z[2]);w+=z[0].length;if(!v){w+=z[1].length}}while(!z[2]);if(D.length>1){throw"Illegal"}return{r:C,keyword_count:u,value:c}}catch(H){if(H=="Illegal"){return{r:0,keyword_count:0,value:n(E)}}else{throw H}}}function h(s){var r="";for(var c=0;c<s.childNodes.length;c++){if(s.childNodes[c].nodeType==3){r+=s.childNodes[c].nodeValue}else{if(s.childNodes[c].nodeName=="BR"){r+="\n"}else{r+=h(s.childNodes[c])}}}return r}function b(t){var r=t.className.split(/\s+/);r=r.concat(t.parentNode.className.split(/\s+/));for(var c=0;c<r.length;c++){var s=r[c].replace(/^language-/,"");if(s=="no-highlight"){throw"No highlight"}if(p[s]){return s}}}function d(c){var r=[];(function(t,u){for(var s=0;s<t.childNodes.length;s++){if(t.childNodes[s].nodeType==3){u+=t.childNodes[s].nodeValue.length}else{if(t.childNodes[s].nodeName=="BR"){u+=1}else{r.push({event:"start",offset:u,node:t.childNodes[s]});u=arguments.callee(t.childNodes[s],u);r.push({event:"stop",offset:u,node:t.childNodes[s]})}}}return u})(c,0);return r}function m(z,A,y){var s=0;var x="";var u=[];function v(){if(z.length&&A.length){if(z[0].offset!=A[0].offset){return(z[0].offset<A[0].offset)?z:A}else{return(z[0].event=="start"&&A[0].event=="stop")?A:z}}else{return z.length?z:A}}function t(D){var E="<"+D.nodeName.toLowerCase();for(var C=0;C<D.attributes.length;C++){E+=" "+D.attributes[C].nodeName.toLowerCase()+'="'+n(D.attributes[C].nodeValue)+'"'}return E+">"}function B(C){return"</"+C.nodeName.toLowerCase()+">"}while(z.length||A.length){var w=v().splice(0,1)[0];x+=n(y.substr(s,w.offset-s));s=w.offset;if(w.event=="start"){x+=t(w.node);u.push(w.node)}else{if(w.event=="stop"){var r=u.length;do{r--;var c=u[r];x+=B(c)}while(c!=w.node);u.splice(r,1);while(r<u.length){x+=t(u[r]);r++}}}}x+=y.substr(s);return x}function q(y,C){try{var F=h(y);var v=b(y)}catch(z){if(z=="No highlight"){return}}if(v){var B=g(v,F).value}else{var D=0;for(var E in a){if(!a.hasOwnProperty(E)){continue}var t=g(E,F);var c=t.keyword_count+t.r;if(c>D){D=c;var B=t.value;v=E}}}if(B){if(C){B=B.replace(/^(\t+)/gm,function(r,I,H,G){return I.replace(/\t/g,C)})}var x=y.className;if(!x.match(v)){x+=" "+v}var s=d(y);if(s.length){var u=document.createElement("pre");u.innerHTML=B;B=m(s,d(u),F)}var A=document.createElement("div");A.innerHTML='<pre><code class="'+x+'">'+B+"</code></pre>";var w=y.parentNode.parentNode;w.replaceChild(A.firstChild,y.parentNode)}}function e(s,r,c){var t="m"+(s.cI?"i":"")+(c?"g":"");return new RegExp(r,t)}function j(){for(var r in p){if(!p.hasOwnProperty(r)){continue}var s=p[r];for(var c=0;c<s.m.length;c++){if(s.m[c].b){s.m[c].bR=e(s,"^"+s.m[c].b)}if(s.m[c].e){s.m[c].eR=e(s,"^"+s.m[c].e)}if(s.m[c].i){s.m[c].iR=e(s,"^(?:"+s.m[c].i+")")}s.dM.iR=e(s,"^(?:"+s.dM.i+")");if(s.m[c].r==undefined){s.m[c].r=1}}}}function f(){function s(v){if(!v.keywordGroups){for(var u in v.k){if(!v.k.hasOwnProperty(u)){continue}if(v.k[u] instanceof Object){v.keywordGroups=v.k}else{v.keywordGroups={keyword:v.k}}break}}}for(var r in p){if(!p.hasOwnProperty(r)){continue}var t=p[r];s(t.dM);for(var c=0;c<t.m.length;c++){s(t.m[c])}}}function i(r){for(var c=0;c<r.childNodes.length;c++){node=r.childNodes[c];if(node.nodeName=="CODE"){return node}if(!(node.nodeType==3&&node.nodeValue.match(/\s+/))){return null}}}function l(){if(l.called){return}l.called=true;j();f();if(arguments.length){for(var c=0;c<arguments.length;c++){if(p[arguments[c]]){a[arguments[c]]=p[arguments[c]]}}}else{a=p}var s=document.getElementsByTagName("pre");for(var c=0;c<s.length;c++){var r=i(s[c]);if(r){q(r,hljs.tabReplace)}}}function o(){var c=arguments;var r=function(){l.apply(null,c)};if(window.addEventListener){window.addEventListener("DOMContentLoaded",r,false);window.addEventListener("load",r,false)}else{if(window.attachEvent){window.attachEvent("onload",r)}else{window.onload=r}}}this.LANGUAGES=p;this.initHighlightingOnLoad=o;this.highlightBlock=q;this.initHighlighting=l;this.IR="[a-zA-Z][a-zA-Z0-9_]*";this.UIR="[a-zA-Z_][a-zA-Z0-9_]*";this.NR="\\b\\d+(\\.\\d+)?";this.CNR="\\b(0x[A-Za-z0-9]+|\\d+(\\.\\d+)?)";this.RSR="!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|\\.|-|-=|/|/=|:|;|<|<<|<<=|<=|=|==|===|>|>=|>>|>>=|>>>|>>>=|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~";this.ASM={cN:"string",b:"'",e:"'",i:"\\n",c:["escape"],r:0};this.QSM={cN:"string",b:'"',e:'"',i:"\\n",c:["escape"],r:0};this.BE={cN:"escape",b:"\\\\.",e:"^",nM:true,r:0};this.CLCM={cN:"comment",b:"//",e:"$",r:0};this.CBLCLM={cN:"comment",b:"/\\*",e:"\\*/"};this.HCM={cN:"comment",b:"#",e:"$"};this.CNM={cN:"number",b:this.CNR,e:"^",r:0}}();var initHighlightingOnLoad=hljs.initHighlightingOnLoad;hljs.LANGUAGES.bash=function(){var a={"true":1,"false":1};return{dM:{l:[hljs.IR],c:["string","shebang","comment","number","test_condition","string","variable"],k:{keyword:{"if":1,then:1,"else":1,fi:1,"for":1,"break":1,"continue":1,"while":1,"in":1,"do":1,done:1,echo:1,exit:1,"return":1,set:1,declare:1},literal:a}},cI:false,m:[{cN:"shebang",b:"(#!\\/bin\\/bash)|(#!\\/bin\\/sh)",e:"^",r:10},hljs.HCM,{cN:"test_condition",b:"\\[ ",e:" \\]",c:["string","variable","number"],l:[hljs.IR],k:{literal:a},r:0},{cN:"test_condition",b:"\\[\\[ ",e:" \\]\\]",c:["string","variable","number"],l:[hljs.IR],k:{literal:a}},{cN:"variable",b:"\\$([a-zA-Z0-9_]+)\\b",e:"^"},{cN:"variable",b:"\\$\\{(([^}])|(\\\\}))+\\}",e:"^",c:["number"]},{cN:"string",b:'"',e:'"',i:"\\n",c:["escape","variable"],r:0},{cN:"string",b:'"',e:'"',i:"\\n",c:["escape","variable"],r:0},hljs.BE,hljs.CNM,{cN:"comment",b:"\\/\\/",e:"$",i:"."}]}}();hljs.LANGUAGES.cs={dM:{l:[hljs.UIR],c:["comment","string","number"],k:{"abstract":1,as:1,base:1,bool:1,"break":1,"byte":1,"case":1,"catch":1,"char":1,checked:1,"class":1,"const":1,"continue":1,decimal:1,"default":1,delegate:1,"do":1,"do":1,"double":1,"else":1,"enum":1,event:1,explicit:1,extern:1,"false":1,"finally":1,fixed:1,"float":1,"for":1,foreach:1,"goto":1,"if":1,implicit:1,"in":1,"int":1,"interface":1,internal:1,is:1,lock:1,"long":1,namespace:1,"new":1,"null":1,object:1,operator:1,out:1,override:1,params:1,"private":1,"protected":1,"public":1,readonly:1,ref:1,"return":1,sbyte:1,sealed:1,"short":1,sizeof:1,stackalloc:1,"static":1,string:1,struct:1,"switch":1,"this":1,"throw":1,"true":1,"try":1,"typeof":1,uint:1,ulong:1,unchecked:1,unsafe:1,ushort:1,using:1,virtual:1,"volatile":1,"void":1,"while":1,ascending:1,descending:1,from:1,get:1,group:1,into:1,join:1,let:1,orderby:1,partial:1,select:1,set:1,value:1,"var":1,where:1,yield:1}},m:[{cN:"comment",b:"///",e:"$",rB:true,c:["xmlDocTag"]},{cN:"xmlDocTag",b:"///|<!--|-->",e:"^"},{cN:"xmlDocTag",b:"</?",e:">"},{cN:"string",b:'@"',e:'"',c:["quoteQuote"]},{cN:"quoteQuote",b:'""',e:"^"},hljs.CLCM,hljs.CBLCLM,hljs.ASM,hljs.QSM,hljs.BE,hljs.CNM]};hljs.LANGUAGES.ruby=function(){var a="[a-zA-Z_][a-zA-Z0-9_]*(\\!|\\?)?";var b=["comment","string","char","class","function","module_name","symbol","number","variable","regexp_container"];var c={keyword:{and:1,"false":1,then:1,defined:1,module:1,"in":1,"return":1,redo:1,"if":1,BEGIN:1,retry:1,end:1,"for":1,"true":1,self:1,when:1,next:1,until:1,"do":1,begin:1,unless:1,END:1,rescue:1,nil:1,"else":1,"break":1,undef:1,not:1,"super":1,"class":1,"case":1,require:1,yield:1,alias:1,"while":1,ensure:1,elsif:1,or:1,def:1},keymethods:{__id__:1,__send__:1,abort:1,abs:1,"all?":1,allocate:1,ancestors:1,"any?":1,arity:1,assoc:1,at:1,at_exit:1,autoload:1,"autoload?":1,"between?":1,binding:1,binmode:1,"block_given?":1,call:1,callcc:1,caller:1,capitalize:1,"capitalize!":1,casecmp:1,"catch":1,ceil:1,center:1,chomp:1,"chomp!":1,chop:1,"chop!":1,chr:1,"class":1,class_eval:1,"class_variable_defined?":1,class_variables:1,clear:1,clone:1,close:1,close_read:1,close_write:1,"closed?":1,coerce:1,collect:1,"collect!":1,compact:1,"compact!":1,concat:1,"const_defined?":1,const_get:1,const_missing:1,const_set:1,constants:1,count:1,crypt:1,"default":1,default_proc:1,"delete":1,"delete!":1,delete_at:1,delete_if:1,detect:1,display:1,div:1,divmod:1,downcase:1,"downcase!":1,downto:1,dump:1,dup:1,each:1,each_byte:1,each_index:1,each_key:1,each_line:1,each_pair:1,each_value:1,each_with_index:1,"empty?":1,entries:1,eof:1,"eof?":1,"eql?":1,"equal?":1,"eval":1,exec:1,exit:1,"exit!":1,extend:1,fail:1,fcntl:1,fetch:1,fileno:1,fill:1,find:1,find_all:1,first:1,flatten:1,"flatten!":1,floor:1,flush:1,for_fd:1,foreach:1,fork:1,format:1,freeze:1,"frozen?":1,fsync:1,getc:1,gets:1,global_variables:1,grep:1,gsub:1,"gsub!":1,"has_key?":1,"has_value?":1,hash:1,hex:1,id:1,"include?":1,included_modules:1,index:1,indexes:1,indices:1,induced_from:1,inject:1,insert:1,inspect:1,instance_eval:1,instance_method:1,instance_methods:1,"instance_of?":1,"instance_variable_defined?":1,instance_variable_get:1,instance_variable_set:1,instance_variables:1,"integer?":1,intern:1,invert:1,ioctl:1,"is_a?":1,isatty:1,"iterator?":1,join:1,"key?":1,keys:1,"kind_of?":1,lambda:1,last:1,length:1,lineno:1,ljust:1,load:1,local_variables:1,loop:1,lstrip:1,"lstrip!":1,map:1,"map!":1,match:1,max:1,"member?":1,merge:1,"merge!":1,method:1,"method_defined?":1,method_missing:1,methods:1,min:1,module_eval:1,modulo:1,name:1,nesting:1,"new":1,next:1,"next!":1,"nil?":1,nitems:1,"nonzero?":1,object_id:1,oct:1,open:1,pack:1,partition:1,pid:1,pipe:1,pop:1,popen:1,pos:1,prec:1,prec_f:1,prec_i:1,print:1,printf:1,private_class_method:1,private_instance_methods:1,"private_method_defined?":1,private_methods:1,proc:1,protected_instance_methods:1,"protected_method_defined?":1,protected_methods:1,public_class_method:1,public_instance_methods:1,"public_method_defined?":1,public_methods:1,push:1,putc:1,puts:1,quo:1,raise:1,rand:1,rassoc:1,read:1,read_nonblock:1,readchar:1,readline:1,readlines:1,readpartial:1,rehash:1,reject:1,"reject!":1,remainder:1,reopen:1,replace:1,require:1,"respond_to?":1,reverse:1,"reverse!":1,reverse_each:1,rewind:1,rindex:1,rjust:1,round:1,rstrip:1,"rstrip!":1,scan:1,seek:1,select:1,send:1,set_trace_func:1,shift:1,singleton_method_added:1,singleton_methods:1,size:1,sleep:1,slice:1,"slice!":1,sort:1,"sort!":1,sort_by:1,split:1,sprintf:1,squeeze:1,"squeeze!":1,srand:1,stat:1,step:1,store:1,strip:1,"strip!":1,sub:1,"sub!":1,succ:1,"succ!":1,sum:1,superclass:1,swapcase:1,"swapcase!":1,sync:1,syscall:1,sysopen:1,sysread:1,sysseek:1,system:1,syswrite:1,taint:1,"tainted?":1,tell:1,test:1,"throw":1,times:1,to_a:1,to_ary:1,to_f:1,to_hash:1,to_i:1,to_int:1,to_io:1,to_proc:1,to_s:1,to_str:1,to_sym:1,tr:1,"tr!":1,tr_s:1,"tr_s!":1,trace_var:1,transpose:1,trap:1,truncate:1,"tty?":1,type:1,ungetc:1,uniq:1,"uniq!":1,unpack:1,unshift:1,untaint:1,untrace_var:1,upcase:1,"upcase!":1,update:1,upto:1,"value?":1,values:1,values_at:1,warn:1,write:1,write_nonblock:1,"zero?":1,zip:1}};return{dM:{l:[a],c:b,k:c},m:[hljs.HCM,{cN:"comment",b:"^\\=begin",e:"^\\=end",r:10},{cN:"comment",b:"^__END__",e:"\\n$"},{cN:"params",b:"\\(",e:"\\)",l:[a],k:c,c:b},{cN:"function",b:"\\bdef\\b",e:"$|;",l:[a],k:c,c:["title","params","comment"]},{cN:"class",b:"\\b(class|module)\\b",e:"$",l:[hljs.UIR],k:c,c:["title","inheritance","comment"],k:{"class":1,module:1}},{cN:"title",b:"[A-Za-z_]\\w*(::\\w+)*(\\?|\\!)?",e:"^",r:0},{cN:"inheritance",b:"<\\s*",e:"^",c:["parent"]},{cN:"parent",b:"("+hljs.IR+"::)?"+hljs.IR,e:"^"},{cN:"number",b:"(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b",e:"^",r:0},{cN:"number",b:"\\?\\w",e:"^"},{cN:"string",b:"'",e:"'",c:["escape","subst"],r:0},{cN:"string",b:'"',e:'"',c:["escape","subst"],r:0},{cN:"string",b:"%[qw]?\\(",e:"\\)",c:["escape","subst"],r:10},{cN:"string",b:"%[qw]?\\[",e:"\\]",c:["escape","subst"],r:10},{cN:"string",b:"%[qw]?{",e:"}",c:["escape","subst"],r:10},{cN:"string",b:"%[qw]?<",e:">",c:["escape","subst"],r:10},{cN:"string",b:"%[qw]?/",e:"/",c:["escape","subst"],r:10},{cN:"string",b:"%[qw]?%",e:"%",c:["escape","subst"],r:10},{cN:"string",b:"%[qw]?-",e:"-",c:["escape","subst"],r:10},{cN:"string",b:"%[qw]?\\|",e:"\\|",c:["escape","subst"],r:10},{cN:"module_name",b:":{2}"+a,e:"^",nM:true},{cN:"symbol",b:":"+a,e:"^"},{cN:"symbol",b:":",e:"^",c:["string"]},hljs.BE,{cN:"subst",b:"#\\{",e:"}",l:[a],k:c,c:b},{cN:"regexp_container",b:"("+hljs.RSR+")\\s*",e:"^",nM:true,c:["comment","regexp"],r:0},{cN:"regexp",b:"/",e:"/[a-z]*",i:"\\n",c:["escape"]},{cN:"variable",b:"(\\$\\W)|((\\$|\\@\\@?)(\\w+))",e:"^"}]}}();hljs.LANGUAGES.diff={cI:true,dM:{c:["chunk","header","addition","deletion","change"]},m:[{cN:"chunk",b:"^\\@\\@ +\\-\\d+,\\d+ +\\+\\d+,\\d+ +\\@\\@$",e:"^",r:10},{cN:"chunk",b:"^\\*\\*\\* +\\d+,\\d+ +\\*\\*\\*\\*$",e:"^",r:10},{cN:"chunk",b:"^\\-\\-\\- +\\d+,\\d+ +\\-\\-\\-\\-$",e:"^",r:10},{cN:"header",b:"Index: ",e:"$"},{cN:"header",b:"=====",e:"=====$"},{cN:"header",b:"^\\-\\-\\-",e:"$"},{cN:"header",b:"^\\*{3} ",e:"$"},{cN:"header",b:"^\\+\\+\\+",e:"$"},{cN:"header",b:"\\*{5}",e:"\\*{5}$"},{cN:"addition",b:"^\\+",e:"$"},{cN:"deletion",b:"^\\-",e:"$"},{cN:"change",b:"^\\!",e:"$"}]};hljs.XML_COMMENT={cN:"comment",b:"<!--",e:"-->"};hljs.XML_ATTR={cN:"attribute",b:"\\s[a-zA-Z\\:-]+=",e:"^",c:["value"]};hljs.XML_VALUE_QUOT={cN:"value",b:'"',e:'"'};hljs.XML_VALUE_APOS={cN:"value",b:"'",e:"'"};hljs.LANGUAGES.xml={dM:{c:["pi","comment","cdata","tag"]},cI:true,m:[{cN:"pi",b:"<\\?",e:"\\?>",r:10},hljs.XML_COMMENT,{cN:"cdata",b:"<\\!\\[CDATA\\[",e:"\\]\\]>"},{cN:"tag",b:"</?",e:">",c:["title","tag_internal"],r:1.5},{cN:"title",b:"[A-Za-z:_][A-Za-z0-9\\._:-]+",e:"^",r:0},{cN:"tag_internal",b:"^",eW:true,nM:true,c:["attribute"],r:0,i:"[\\+\\.]"},hljs.XML_ATTR,hljs.XML_VALUE_QUOT,hljs.XML_VALUE_APOS]};hljs.HTML_TAGS={code:1,kbd:1,font:1,noscript:1,style:1,img:1,title:1,menu:1,tt:1,tr:1,param:1,li:1,tfoot:1,th:1,input:1,td:1,dl:1,blockquote:1,fieldset:1,big:1,dd:1,abbr:1,optgroup:1,dt:1,button:1,isindex:1,p:1,small:1,div:1,dir:1,em:1,frame:1,meta:1,sub:1,bdo:1,label:1,acronym:1,sup:1,body:1,xml:1,basefont:1,base:1,br:1,address:1,strong:1,legend:1,ol:1,script:1,caption:1,s:1,col:1,h2:1,h3:1,h1:1,h6:1,h4:1,h5:1,table:1,select:1,noframes:1,span:1,area:1,dfn:1,strike:1,cite:1,thead:1,head:1,option:1,form:1,hr:1,"var":1,link:1,b:1,colgroup:1,ul:1,applet:1,del:1,iframe:1,pre:1,frameset:1,ins:1,tbody:1,html:1,samp:1,map:1,object:1,a:1,xmlns:1,center:1,textarea:1,i:1,q:1,u:1};hljs.HTML_DOCTYPE={cN:"doctype",b:"<!DOCTYPE",e:">",r:10};hljs.HTML_ATTR={cN:"attribute",b:"\\s[a-zA-Z\\:-]+=",e:"^",c:["value"]};hljs.HTML_SHORT_ATTR={cN:"attribute",b:" [a-zA-Z]+",e:"^"};hljs.HTML_VALUE={cN:"value",b:"[a-zA-Z0-9]+",e:"^"};hljs.LANGUAGES.html={dM:{c:["tag","comment","doctype","vbscript"]},cI:true,m:[hljs.XML_COMMENT,hljs.HTML_DOCTYPE,{cN:"tag",l:[hljs.IR],k:hljs.HTML_TAGS,b:"<style",e:">",c:["attribute"],i:"[\\+\\.]",starts:"css"},{cN:"tag",l:[hljs.IR],k:hljs.HTML_TAGS,b:"<script",e:">",c:["attribute"],i:"[\\+\\.]",starts:"javascript"},{cN:"tag",l:[hljs.IR],k:hljs.HTML_TAGS,b:"<[A-Za-z/]",e:">",c:["attribute"],i:"[\\+\\.]"},{cN:"css",e:"</style>",rE:true,subLanguage:"css"},{cN:"javascript",e:"<\/script>",rE:true,subLanguage:"javascript"},hljs.HTML_ATTR,hljs.HTML_SHORT_ATTR,hljs.XML_VALUE_QUOT,hljs.XML_VALUE_APOS,hljs.HTML_VALUE,{cN:"vbscript",b:"<%",e:"%>",subLanguage:"vbscript"}]};hljs.LANGUAGES.javascript={dM:{l:[hljs.UIR],c:["string","comment","number","regexp_container","function"],k:{keyword:{"in":1,"if":1,"for":1,"while":1,"finally":1,"var":1,"new":1,"function":1,"do":1,"return":1,"void":1,"else":1,"break":1,"catch":1,"instanceof":1,"with":1,"throw":1,"case":1,"default":1,"try":1,"this":1,"switch":1,"continue":1,"typeof":1,"delete":1},literal:{"true":1,"false":1,"null":1}}},m:[hljs.CLCM,hljs.CBLCLM,hljs.CNM,hljs.ASM,hljs.QSM,hljs.BE,{cN:"regexp_container",b:"("+hljs.RSR+"|case|return|throw)\\s*",e:"^",nM:true,l:[hljs.IR],k:{"return":1,"throw":1,"case":1},c:["comment","regexp"],r:0},{cN:"regexp",b:"/.*?[^\\\\/]/[gim]*",e:"^"},{cN:"function",b:"\\bfunction\\b",e:"{",l:[hljs.UIR],k:{"function":1},c:["title","params"]},{cN:"title",b:"[A-Za-z$_][0-9A-Za-z$_]*",e:"^"},{cN:"params",b:"\\(",e:"\\)",c:["string","comment"]}]};hljs.LANGUAGES.css={dM:{c:["at_rule","id","class","attr_selector","pseudo","rules","comment"],k:hljs.HTML_TAGS,l:[hljs.IR],i:"="},cI:true,m:[{cN:"at_rule",b:"@",e:"[{;]",eE:true,l:[hljs.IR],k:{"import":1,page:1,media:1,charset:1,"font-face":1},c:["function","string","number","pseudo"]},{cN:"id",b:"\\#[A-Za-z0-9_-]+",e:"^"},{cN:"class",b:"\\.[A-Za-z0-9_-]+",e:"^",r:0},{cN:"attr_selector",b:"\\[",e:"\\]",i:"$"},{cN:"pseudo",b:":(:)?[a-zA-Z0-9\\_\\-\\+\\(\\)\\\"\\']+",e:"^"},{cN:"rules",b:"{",e:"}",c:["rule","comment"],i:"[^\\s]"},{cN:"rule",b:"[A-Z\\_\\.\\-]+\\s*:",e:";",eW:true,l:["[A-Za-z-]+"],k:{"play-during":1,"counter-reset":1,"counter-increment":1,"min-height":1,quotes:1,"border-top":1,pitch:1,font:1,pause:1,"list-style-image":1,"border-width":1,cue:1,"outline-width":1,"border-left":1,elevation:1,richness:1,"speech-rate":1,"border-bottom":1,"border-spacing":1,background:1,"list-style-type":1,"text-align":1,"page-break-inside":1,orphans:1,"page-break-before":1,"text-transform":1,"line-height":1,"padding-left":1,"font-size":1,right:1,"word-spacing":1,"padding-top":1,"outline-style":1,bottom:1,content:1,"border-right-style":1,"padding-right":1,"border-left-style":1,"voice-family":1,"background-color":1,"border-bottom-color":1,"outline-color":1,"unicode-bidi":1,"max-width":1,"font-family":1,"caption-side":1,"border-right-width":1,"pause-before":1,"border-top-style":1,color:1,"border-collapse":1,"border-bottom-width":1,"float":1,height:1,"max-height":1,"margin-right":1,"border-top-width":1,speak:1,"speak-header":1,top:1,"cue-before":1,"min-width":1,width:1,"font-variant":1,"border-top-color":1,"background-position":1,"empty-cells":1,direction:1,"border-right":1,visibility:1,padding:1,"border-style":1,"background-attachment":1,overflow:1,"border-bottom-style":1,cursor:1,margin:1,display:1,"border-left-width":1,"letter-spacing":1,"vertical-align":1,clip:1,"border-color":1,"list-style":1,"padding-bottom":1,"pause-after":1,"speak-numeral":1,"margin-left":1,widows:1,border:1,"font-style":1,"border-left-color":1,"pitch-range":1,"background-repeat":1,"table-layout":1,"margin-bottom":1,"speak-punctuation":1,"font-weight":1,"border-right-color":1,"page-break-after":1,position:1,"white-space":1,"text-indent":1,"background-image":1,volume:1,stress:1,outline:1,clear:1,"z-index":1,"text-decoration":1,"margin-top":1,azimuth:1,"cue-after":1,left:1,"list-style-position":1},c:["value"]},hljs.CBLCLM,{cN:"value",b:"^",eW:true,eE:true,c:["function","number","hexcolor","string"]},{cN:"number",b:hljs.NR,e:"^"},{cN:"hexcolor",b:"\\#[0-9A-F]+",e:"^"},{cN:"function",b:hljs.IR+"\\(",e:"\\)",c:["params"]},{cN:"params",b:"^",eW:true,eE:true,c:["number","string"]},hljs.ASM,hljs.QSM]};hljs.LANGUAGES.lisp=function(){var a="[a-zA-Z_\\-\\+\\*\\/\\<\\=\\>\\&\\#][a-zA-Z0-9_\\-\\+\\*\\/\\<\\=\\>\\&\\#]*";var b="(\\-|\\+)?\\d+(\\.\\d+|\\/\\d+)?((d|e|f|l|s)(\\+|\\-)?\\d+)?";return{cI:true,dM:{l:[a],c:["literal","number","string","comment","quoted","list"],i:"[^\\s]"},m:[hljs.QSM,{cN:"number",b:b,e:"^"},{cN:"number",b:"#b[0-1]+(/[0-1]+)?",e:"^"},{cN:"number",b:"#o[0-7]+(/[0-7]+)?",e:"^"},{cN:"number",b:"#x[0-9a-f]+(/[0-9a-f]+)?",e:"^"},{cN:"number",b:"#c\\("+b+" +"+b,e:"\\)"},{cN:"comment",b:";",e:"$"},{cN:"quoted",b:"['`]\\(",e:"\\)",c:["number","string","variable","keyword","quoted_list"]},{cN:"quoted",b:"\\(quote ",e:"\\)",c:["number","string","variable","keyword","quoted_list"],l:[a],k:{title:{quote:1}}},{cN:"quoted_list",b:"\\(",e:"\\)",c:["quoted_list","literal","number","string"]},{cN:"list",b:"\\(",e:"\\)",c:["title","body"]},{cN:"title",b:a,e:"^",eW:true},{cN:"body",b:"^",eW:true,eE:true,c:["quoted","list","literal","number","string","comment","variable","keyword"]},{cN:"keyword",b:"[:&]"+a,e:"^"},{cN:"variable",b:"\\*",e:"\\*"},{cN:"literal",b:"\\b(t{1}|nil)\\b",e:"^"}]}}();hljs.LANGUAGES.profile={dM:{l:[hljs.UIR],c:["number","builtin","filename","header","summary","string","function"]},m:[hljs.CNM,hljs.ASM,hljs.QSM,{cN:"summary",b:"function calls",e:"$",c:["number"],r:10},{cN:"header",b:"(ncalls|tottime|cumtime)",e:"$",l:[hljs.IR],k:{ncalls:1,tottime:10,cumtime:10,filename:1},r:10},{cN:"function",b:"\\(",e:"\\)",l:[hljs.UIR],c:["title"]},{cN:"title",b:hljs.UIR,e:"^"},{cN:"builtin",b:"{",e:"}",c:["string"],eB:true,eE:true},{cN:"filename",b:"(/w|[a-zA-Z_][\da-zA-Z_]+\\.[\da-zA-Z_]{1,3})",e:":",eE:true}]};hljs.LANGUAGES.java={dM:{l:[hljs.UIR],c:["javadoc","comment","string","class","number","annotation"],k:{"false":1,"synchronized":1,"int":1,"abstract":1,"float":1,"private":1,"char":1,"interface":1,"boolean":1,"static":1,"null":1,"if":1,"const":1,"for":1,"true":1,"while":1,"long":1,"throw":1,strictfp:1,"finally":1,"protected":1,"extends":1,"import":1,"native":1,"final":1,"implements":1,"return":1,"void":1,"enum":1,"else":1,"break":1,"transient":1,"new":1,"catch":1,"instanceof":1,"byte":1,"super":1,"class":1,"volatile":1,"case":1,assert:1,"short":1,"package":1,"default":1,"double":1,"public":1,"try":1,"this":1,"switch":1,"continue":1,"throws":1}},m:[{cN:"class",l:[hljs.UIR],b:"(class |interface )",e:"{",i:":",k:{"class":1,"interface":1},c:["inheritance","title"]},{cN:"inheritance",b:"(implements|extends)",e:"^",nM:true,l:[hljs.IR],k:{"extends":1,"implements":1},r:10},{cN:"title",b:hljs.UIR,e:"^"},{cN:"params",b:"\\(",e:"\\)",c:["string","annotation"]},hljs.CNM,hljs.ASM,hljs.QSM,hljs.BE,hljs.CLCM,{cN:"javadoc",b:"/\\*\\*",e:"\\*/",c:["javadoctag"],r:10},{cN:"javadoctag",b:"@[A-Za-z]+",e:"^"},hljs.CBLCLM,{cN:"annotation",b:"@[A-Za-z]+",e:"^"}]};hljs.LANGUAGES.php={dM:{l:[hljs.IR],c:["comment","number","string","variable","preprocessor"],k:{and:1,include_once:1,list:1,"abstract":1,global:1,"private":1,echo:1,"interface":1,as:1,"static":1,endswitch:1,array:1,"null":1,"if":1,endwhile:1,or:1,"const":1,"for":1,endforeach:1,self:1,"var":1,"while":1,isset:1,"public":1,"protected":1,exit:1,foreach:1,"throw":1,elseif:1,"extends":1,include:1,__FILE__:1,empty:1,require_once:1,"function":1,"do":1,xor:1,"return":1,"implements":1,parent:1,clone:1,use:1,__CLASS__:1,__LINE__:1,"else":1,"break":1,print:1,"eval":1,"new":1,"catch":1,__METHOD__:1,"class":1,"case":1,exception:1,php_user_filter:1,"default":1,die:1,require:1,__FUNCTION__:1,enddeclare:1,"final":1,"try":1,"this":1,"switch":1,"continue":1,endfor:1,endif:1,declare:1,unset:1}},cI:true,m:[hljs.CLCM,hljs.HCM,{cN:"comment",b:"/\\*",e:"\\*/",c:["phpdoc"]},{cN:"phpdoc",b:"\\s@[A-Za-z]+",e:"^",r:10},hljs.CNM,{cN:"string",b:"'",e:"'",c:["escape"],r:0},{cN:"string",b:'"',e:'"',c:["escape"],r:0},hljs.BE,{cN:"variable",b:"\\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*",e:"^"},{cN:"preprocessor",b:"<\\?php",e:"^",r:10},{cN:"preprocessor",b:"\\?>",e:"^"}]};hljs.LANGUAGES.python={dM:{l:[hljs.UIR],i:"(</|->)",c:["comment","string","function","class","number","decorator"],k:{keyword:{and:1,elif:1,is:1,global:1,as:1,"in":1,"if":1,from:1,raise:1,"for":1,except:1,"finally":1,print:1,"import":1,pass:1,"return":1,exec:1,"else":1,"break":1,not:1,"with":1,"class":1,assert:1,yield:1,"try":1,"while":1,"continue":1,del:1,or:1,def:1,lambda:1},built_in:{None:1,True:1,False:1,Ellipsis:1,NotImplemented:1}}},m:[{cN:"function",l:[hljs.UIR],b:"\\bdef ",e:":",i:"$",k:{def:1},c:["title","params"],r:10},{cN:"class",l:[hljs.UIR],b:"\\bclass ",e:":",i:"[${]",k:{"class":1},c:["title","params",],r:10},{cN:"title",b:hljs.UIR,e:"^"},{cN:"params",b:"\\(",e:"\\)",c:["string"]},hljs.HCM,hljs.CNM,{cN:"string",b:"u?r?'''",e:"'''",r:10},{cN:"string",b:'u?r?"""',e:'"""',r:10},hljs.ASM,hljs.QSM,hljs.BE,{cN:"string",b:"(u|r|ur)'",e:"'",c:["escape"],r:10},{cN:"string",b:'(u|r|ur)"',e:'"',c:["escape"],r:10},{cN:"decorator",b:"@",e:"$"}]};hljs.LANGUAGES.smalltalk=function(){var a="[a-z][a-zA-Z0-9_]*";return{dM:{l:[hljs.UIR],c:["comment","string","class","method","number","symbol","char","localvars","array"],k:{self:1,"super":1,nil:1,"true":1,"false":1,thisContext:1}},m:[{cN:"class",b:"\\b[A-Z][A-Za-z0-9_]*",e:"^",r:0},{cN:"symbol",b:"#"+hljs.UIR,e:"^"},hljs.CNM,hljs.ASM,{cN:"comment",b:'"',e:'"',r:0},{cN:"method",b:a+":",e:"^"},{cN:"char",b:"\\$.{1}",e:"^"},{cN:"localvars",b:"\\|\\s*(("+a+")\\s*)+\\|",e:"^",r:10},{cN:"array",b:"\\#\\(",e:"\\)",c:["string","char","number","symbol"]}]}}();hljs.LANGUAGES.sql={cI:true,dM:{l:[hljs.IR],c:["string","number","comment"],k:{keyword:{all:1,partial:1,global:1,month:1,current_timestamp:1,using:1,go:1,revoke:1,smallint:1,indicator:1,"end-exec":1,disconnect:1,zone:1,"with":1,character:1,assertion:1,to:1,add:1,current_user:1,usage:1,input:1,local:1,alter:1,match:1,collate:1,real:1,then:1,rollback:1,get:1,read:1,timestamp:1,session_user:1,not:1,integer:1,bit:1,unique:1,day:1,minute:1,desc:1,insert:1,execute:1,like:1,ilike:2,level:1,decimal:1,drop:1,"continue":1,isolation:1,found:1,where:1,constraints:1,domain:1,right:1,national:1,some:1,module:1,transaction:1,relative:1,second:1,connect:1,escape:1,close:1,system_user:1,"for":1,deferred:1,section:1,cast:1,current:1,sqlstate:1,allocate:1,intersect:1,deallocate:1,numeric:1,"public":1,preserve:1,full:1,"goto":1,initially:1,asc:1,no:1,key:1,output:1,collation:1,group:1,by:1,union:1,session:1,both:1,last:1,language:1,constraint:1,column:1,of:1,space:1,foreign:1,deferrable:1,prior:1,connection:1,unknown:1,action:1,commit:1,view:1,or:1,first:1,into:1,"float":1,year:1,primary:1,cascaded:1,except:1,restrict:1,set:1,references:1,names:1,table:1,outer:1,open:1,select:1,size:1,are:1,rows:1,from:1,prepare:1,distinct:1,leading:1,create:1,only:1,next:1,inner:1,authorization:1,schema:1,corresponding:1,option:1,declare:1,precision:1,immediate:1,"else":1,timezone_minute:1,external:1,varying:1,translation:1,"true":1,"case":1,exception:1,join:1,hour:1,"default":1,"double":1,scroll:1,value:1,cursor:1,descriptor:1,values:1,dec:1,fetch:1,procedure:1,"delete":1,and:1,"false":1,"int":1,is:1,describe:1,"char":1,as:1,at:1,"in":1,varchar:1,"null":1,trailing:1,any:1,absolute:1,current_time:1,end:1,grant:1,privileges:1,when:1,cross:1,check:1,write:1,current_date:1,pad:1,begin:1,temporary:1,exec:1,time:1,update:1,catalog:1,user:1,sql:1,date:1,on:1,identity:1,timezone_hour:1,natural:1,whenever:1,interval:1,work:1,order:1,cascade:1,diagnostics:1,nchar:1,having:1,left:1},aggregate:{count:1,sum:1,min:1,max:1,avg:1}}},m:[hljs.CNM,hljs.CBLCLM,{cN:"comment",b:"--",e:"$"},{cN:"string",b:"'",e:"'",c:["escape","squote"],r:0},{cN:"squote",b:"''",e:"^",nM:true},{cN:"string",b:'"',e:'"',c:["escape","dquote"],r:0},{cN:"dquote",b:'""',e:"^",nM:true},{cN:"string",b:"`",e:"`",c:["escape"]},hljs.BE]};hljs.LANGUAGES.ini={cI:true,dM:{c:["comment","title","setting"],i:"[^\\s]"},m:[{cN:"comment",b:";",e:"$"},{cN:"title",b:"\\[",e:"\\]"},{cN:"setting",b:"^[a-z0-9_\\[\\]]+[ \\t]*=[ \\t]*",e:"$",c:["value"]},{cN:"value",b:"^",eW:true,c:["string","number"],l:[hljs.IR],k:{on:1,off:1,"true":1,"false":1,yes:1,no:1}},hljs.QSM,hljs.BE,{cN:"number",b:"\\d+",e:"^"}]};hljs.LANGUAGES.perl=function(){var b=["comment","string","number","regexp","sub","variable","operator","pod"];var a={getpwent:1,getservent:1,quotemeta:1,msgrcv:1,scalar:1,kill:1,dbmclose:1,undef:1,lc:1,ma:1,syswrite:1,tr:1,send:1,umask:1,sysopen:1,shmwrite:1,vec:1,qx:1,utime:1,local:1,oct:1,semctl:1,localtime:1,readpipe:1,"do":1,"return":1,format:1,read:1,sprintf:1,dbmopen:1,pop:1,getpgrp:1,not:1,getpwnam:1,rewinddir:1,qq:1,fileno:1,qw:1,endprotoent:1,wait:1,sethostent:1,bless:1,s:1,opendir:1,"continue":1,each:1,sleep:1,endgrent:1,shutdown:1,dump:1,chomp:1,connect:1,getsockname:1,die:1,socketpair:1,close:1,flock:1,exists:1,index:1,shmget:1,sub:1,"for":1,endpwent:1,redo:1,lstat:1,msgctl:1,setpgrp:1,abs:1,exit:1,select:1,print:1,ref:1,gethostbyaddr:1,unshift:1,fcntl:1,syscall:1,"goto":1,getnetbyaddr:1,join:1,gmtime:1,symlink:1,semget:1,splice:1,x:1,getpeername:1,recv:1,log:1,setsockopt:1,cos:1,last:1,reverse:1,gethostbyname:1,getgrnam:1,study:1,formline:1,endhostent:1,times:1,chop:1,length:1,gethostent:1,getnetent:1,pack:1,getprotoent:1,getservbyname:1,rand:1,mkdir:1,pos:1,chmod:1,y:1,substr:1,endnetent:1,printf:1,next:1,open:1,msgsnd:1,readdir:1,use:1,unlink:1,getsockopt:1,getpriority:1,rindex:1,wantarray:1,hex:1,system:1,getservbyport:1,endservent:1,"int":1,chr:1,untie:1,rmdir:1,prototype:1,tell:1,listen:1,fork:1,shmread:1,ucfirst:1,setprotoent:1,"else":1,sysseek:1,link:1,getgrgid:1,shmctl:1,waitpid:1,unpack:1,getnetbyname:1,reset:1,chdir:1,grep:1,split:1,require:1,caller:1,lcfirst:1,until:1,warn:1,"while":1,values:1,shift:1,telldir:1,getpwuid:1,my:1,getprotobynumber:1,"delete":1,and:1,sort:1,uc:1,defined:1,srand:1,accept:1,"package":1,seekdir:1,getprotobyname:1,semop:1,our:1,rename:1,seek:1,"if":1,q:1,chroot:1,sysread:1,setpwent:1,no:1,crypt:1,getc:1,chown:1,sqrt:1,write:1,setnetent:1,setpriority:1,foreach:1,tie:1,sin:1,msgget:1,map:1,stat:1,getlogin:1,unless:1,elsif:1,truncate:1,exec:1,keys:1,glob:1,tied:1,closedir:1,ioctl:1,socket:1,readlink:1,"eval":1,xor:1,readline:1,binmode:1,setservent:1,eof:1,ord:1,bind:1,alarm:1,pipe:1,atan2:1,getgrent:1,exp:1,time:1,push:1,setgrent:1,gt:1,lt:1,or:1,ne:1,m:1};return{dM:{l:[hljs.IR],c:b,k:a},m:[{cN:"variable",b:"\\$\\d",e:"^"},{cN:"variable",b:"[\\$\\%\\@\\*](\\^\\w\\b|#\\w+(\\:\\:\\w+)*|[^\\s\\w{]|{\\w+}|\\w+(\\:\\:\\w*)*)",e:"^"},{cN:"subst",b:"[$@]\\{",e:"}",l:[hljs.IR],k:a,c:b,r:10},{cN:"number",b:"(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b",e:"^",r:0},{cN:"string",b:"q[qwxr]?\\s*\\(",e:"\\)",c:["escape","subst","variable"],r:5},{cN:"string",b:"q[qwxr]?\\s*\\[",e:"\\]",c:["escape","subst","variable"],r:5},{cN:"string",b:"q[qwxr]?\\s*\\{",e:"\\}",c:["escape","subst","variable"],r:5},{cN:"string",b:"q[qwxr]?\\s*\\|",e:"\\|",c:["escape","subst","variable"],r:5},{cN:"string",b:"q[qwxr]?\\s*\\<",e:"\\>",c:["escape","subst","variable"],r:5},{cN:"string",b:"qw\\s+q",e:"q",c:["escape","subst","variable"],r:5},{cN:"string",b:"'",e:"'",c:["escape"],r:0},{cN:"string",b:'"',e:'"',c:["escape","subst","variable"],r:0},hljs.BE,{cN:"string",b:"`",e:"`",c:["escape"]},{cN:"regexp",b:"(s|tr|y)/(\\\\.|[^/])*/(\\\\.|[^/])*/[a-z]*",e:"^",r:10},{cN:"regexp",b:"(m|qr)?/",e:"/[a-z]*",c:["escape"],r:0},{cN:"string",b:"{\\w+}",e:"^",r:0},{cN:"string",b:"-?\\w+\\s*\\=\\>",e:"^",r:0},{cN:"sub",b:"\\bsub\\b",e:"(\\s*\\(.*?\\))?[;{]",l:[hljs.IR],k:{sub:1},r:5},{cN:"operator",b:"-\\w\\b",e:"^",r:0},hljs.HCM,{cN:"comment",b:"^(__END__|__DATA__)",e:"\\n$",r:5},{cN:"pod",b:"\\=\\w",e:"\\=cut"}]}}();hljs.LANGUAGES.scala={dM:{l:[hljs.UIR],c:["javadoc","comment","string","class","number","annotation"],k:{type:1,yield:1,lazy:1,override:1,def:1,"with":1,val:1,"var":1,"false":1,"true":1,sealed:1,"abstract":1,"private":1,trait:1,object:1,"null":1,"if":1,"for":1,"while":1,"throw":1,"finally":1,"protected":1,"extends":1,"import":1,"final":1,"return":1,"else":1,"break":1,"new":1,"catch":1,"super":1,"class":1,"case":1,"package":1,"default":1,"try":1,"this":1,match:1,"continue":1,"throws":1}},m:[{cN:"class",l:[hljs.UIR],b:"((case )?class |object |trait )",e:"({|$)",i:":",k:{"case":1,"class":1,trait:1,object:1},c:["inheritance","title","params"]},{cN:"inheritance",b:"(extends|with)",e:"^",nM:true,l:[hljs.IR],k:{"extends":1,"with":1},r:10},{cN:"title",b:hljs.UIR,e:"^"},{cN:"params",b:"\\(",e:"\\)",c:["string","annotation"]},hljs.CNM,hljs.ASM,hljs.QSM,hljs.BE,hljs.CLCM,{cN:"javadoc",b:"/\\*\\*",e:"\\*/",c:["javadoctag"],r:10},{cN:"javadoctag",b:"@[A-Za-z]+",e:"^"},hljs.CBLCLM,{cN:"annotation",b:"@[A-Za-z]+",e:"^"},{cN:"string",b:'u?r?"""',e:'"""',r:10}]};hljs.LANGUAGES.django={dM:{c:["tag","comment","doctype","template_comment","template_tag","variable"]},cI:true,m:[hljs.XML_COMMENT,hljs.HTML_DOCTYPE,{cN:"tag",l:[hljs.IR],k:hljs.HTML_TAGS,b:"<[A-Za-z/]",e:">",c:["attribute","template_comment","template_tag","variable"]},hljs.HTML_ATTR,hljs.HTML_SHORT_ATTR,{cN:"value",b:'"',e:'"',c:["template_comment","template_tag","variable"]},hljs.HTML_VALUE,{cN:"template_comment",b:"\\{\\%\\s*comment\\s*\\%\\}",e:"\\{\\%\\s*endcomment\\s*\\%\\}"},{cN:"template_comment",b:"\\{#",e:"#\\}"},{cN:"template_tag",b:"\\{\\%",e:"\\%\\}",l:[hljs.IR],k:{comment:1,endcomment:1,load:1,templatetag:1,ifchanged:1,endifchanged:1,"if":1,endif:1,firstof:1,"for":1,endfor:1,"in":1,ifnotequal:1,endifnotequal:1,widthratio:1,"extends":1,include:1,spaceless:1,endspaceless:1,regroup:1,by:1,as:1,ifequal:1,endifequal:1,ssi:1,now:1,"with":1,cycle:1,url:1,filter:1,endfilter:1,debug:1,block:1,endblock:1,"else":1},c:["filter"]},{cN:"variable",b:"\\{\\{",e:"\\}\\}",c:["filter"]},{cN:"filter",b:"\\|[A-Za-z]+\\:?",e:"^",eE:true,l:[hljs.IR],k:{truncatewords:1,removetags:1,linebreaksbr:1,yesno:1,get_digit:1,timesince:1,random:1,striptags:1,filesizeformat:1,escape:1,linebreaks:1,length_is:1,ljust:1,rjust:1,cut:1,urlize:1,fix_ampersands:1,title:1,floatformat:1,capfirst:1,pprint:1,divisibleby:1,add:1,make_list:1,unordered_list:1,urlencode:1,timeuntil:1,urlizetrunc:1,wordcount:1,stringformat:1,linenumbers:1,slice:1,date:1,dictsort:1,dictsortreversed:1,default_if_none:1,pluralize:1,lower:1,join:1,center:1,"default":1,truncatewords_html:1,upper:1,length:1,phone2numeric:1,wordwrap:1,time:1,addslashes:1,slugify:1,first:1},c:["argument"]},{cN:"argument",b:'"',e:'"'}]};hljs.LANGUAGES.vbscript={dM:{l:[hljs.IR],c:["string","comment","number","built_in"],k:{keyword:{call:1,"class":1,"const":1,dim:1,"do":1,loop:1,erase:1,execute:1,executeglobal:1,exit:1,"for":1,each:1,next:1,"function":1,"if":1,then:1,"else":1,on:1,error:1,option:1,explicit:1,"new":1,"private":1,property:1,let:1,get:1,"public":1,randomize:1,redim:1,rem:1,select:1,"case":1,set:1,stop:1,sub:1,"while":1,wend:1,"with":1,end:1,to:1,elseif:1,is:1,or:1,xor:1,and:1,not:1,class_initialize:1,class_terminate:1,"default":1,preserve:1,"in":1,me:1,byval:1,byref:1,step:1,resume:1,"goto":1},built_in:{lcase:1,month:1,vartype:1,instrrev:1,ubound:1,setlocale:1,getobject:1,rgb:1,getref:1,string:1,weekdayname:1,rnd:1,dateadd:1,monthname:1,now:1,day:1,minute:1,isarray:1,cbool:1,round:1,formatcurrency:1,conversions:1,csng:1,timevalue:1,second:1,year:1,space:1,abs:1,clng:1,timeserial:1,fixs:1,len:1,asc:1,isempty:1,maths:1,dateserial:1,atn:1,timer:1,isobject:1,filter:1,weekday:1,datevalue:1,ccur:1,isdate:1,instr:1,datediff:1,formatdatetime:1,replace:1,isnull:1,right:1,sgn:1,array:1,snumeric:1,log:1,cdbl:1,hex:1,chr:1,lbound:1,msgbox:1,ucase:1,getlocale:1,cos:1,cdate:1,cbyte:1,rtrim:1,join:1,hour:1,oct:1,typename:1,trim:1,strcomp:1,"int":1,createobject:1,loadpicture:1,tan:1,formatnumber:1,mid:1,scriptenginebuildversion:1,scriptengine:1,split:1,scriptengineminorversion:1,cint:1,sin:1,datepart:1,ltrim:1,sqr:1,scriptenginemajorversion:1,time:1,derived:1,"eval":1,date:1,formatpercent:1,exp:1,inputbox:1,left:1,ascw:1,chrw:1,regexp:1,server:1,response:1,request:1,cstr:1,err:1},literal:{"true":1,"false":1,"null":1,nothing:1,empty:1}}},cI:true,m:[{cN:"string",b:'"',e:'"',i:"\\n",c:["escape"],r:0},{cN:"escape",b:'""',e:"^",nM:true},{cN:"comment",b:"'",e:"$"},hljs.CNM]};hljs.LANGUAGES.cpp=function(){var a={keyword:{"false":1,"int":1,"float":1,"while":1,"private":1,"char":1,"catch":1,"export":1,virtual:1,operator:2,sizeof:2,dynamic_cast:2,typedef:2,const_cast:2,"const":1,struct:1,"for":1,static_cast:2,union:1,namespace:1,unsigned:1,"long":1,"throw":1,"volatile":2,"static":1,"protected":1,bool:1,template:1,mutable:1,"if":1,"public":1,friend:2,"do":1,"return":1,"goto":1,auto:1,"void":2,"enum":1,"else":1,"break":1,"new":1,extern:1,using:1,"true":1,"class":1,asm:1,"case":1,typeid:1,"short":1,reinterpret_cast:2,"default":1,"double":1,register:1,explicit:1,signed:1,typename:1,"try":1,"this":1,"switch":1,"continue":1,wchar_t:1,inline:1,"delete":1},built_in:{std:1,string:1,cin:1,cout:1,cerr:1,clog:1,stringstream:1,istringstream:1,ostringstream:1,auto_ptr:1,deque:1,list:1,queue:1,stack:1,vector:1,map:1,set:1,bitset:1,multiset:1,multimap:1}};return{dM:{l:[hljs.UIR],i:"</",c:["comment","string","number","preprocessor","stl_container"],k:a},m:[hljs.CLCM,hljs.CBLCLM,hljs.CNM,hljs.QSM,hljs.BE,{cN:"string",b:"'",e:"[^\\\\]'",i:"[^\\\\][^']"},{cN:"preprocessor",b:"#",e:"$"},{cN:"stl_container",b:"\\b(deque|list|queue|stack|vector|map|set|bitset|multiset|multimap)\\s*<",e:">",c:["stl_container"],l:[hljs.UIR],k:a,r:10}]}}();