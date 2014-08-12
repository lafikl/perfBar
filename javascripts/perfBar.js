(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function () {

  if (typeof window.Element === "undefined" || "classList" in document.documentElement) return;

  var prototype = Array.prototype,
      push = prototype.push,
      splice = prototype.splice,
      join = prototype.join;

  function DOMTokenList(el) {
    this.el = el;
    // The className needs to be trimmed and split on whitespace
    // to retrieve a list of classes.
    var classes = el.className.replace(/^\s+|\s+$/g,'').split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
      push.call(this, classes[i]);
    }
  }

  DOMTokenList.prototype = {
    add: function(token) {
      if(this.contains(token)) return;
      push.call(this, token);
      this.el.className = this.toString();
    },
    contains: function(token) {
      return this.el.className.indexOf(token) != -1;
    },
    item: function(index) {
      return this[index] || null;
    },
    remove: function(token) {
      if (!this.contains(token)) return;
      for (var i = 0; i < this.length; i++) {
        if (this[i] == token) break;
      }
      splice.call(this, i, 1);
      this.el.className = this.toString();
    },
    toString: function() {
      return join.call(this, ' ');
    },
    toggle: function(token) {
      if (!this.contains(token)) {
        this.add(token);
      } else {
        this.remove(token);
      }

      return this.contains(token);
    }
  };

  window.DOMTokenList = DOMTokenList;

  function defineElementGetter (obj, prop, getter) {
      if (Object.defineProperty) {
          Object.defineProperty(obj, prop,{
              get : getter
          });
      } else {
          obj.__defineGetter__(prop, getter);
      }
  }

  defineElementGetter(Element.prototype, 'classList', function () {
    return new DOMTokenList(this);
  });

}



},{}],2:[function(require,module,exports){
window.perfBar = window.perfBar || {};


(function() {
  

  perfBar.init = function(config) {
    var classList = require('./classList.js')
    var barTemplate = require('./templates/bar.hbs')

    document.body.innerHTML += barTemplate()


    // classList polyfill
    classList()

    // caching elements
    this.el = document.getElementById('perfBar')
    this.metricsContainer = this.el.querySelector('.perfBar-cf')

    this.disabledMetrics = {}

    config = config || {}
    

    this.config = config

    _handleClick()

    // no window.performance? no partyy :( – I'm looking at you Safari!
    this.perf = window.performance || window.msPerformance || window.webkitPerformance || window.mozPerformance;

    // if perfBar is lazy loaded then ignore onload
    if ( config.lazy ) {
      this.__runner()
      return
    }
    window.onload = this.__runner

  }

  perfBar.__runner = function() {
    setTimeout(function() {
      if ( perfBar.perf )  {
        perfBar.runPerfMetrics('perf')
      }

      perfBar.runPerfMetrics('others')
    }, 1000)
  }



  perfBar.metricTemplate = function(metric) {
    var template = require('./templates/stat.hbs')

    var budget = metric.budget

    if ( budget && Object.keys(budget).length ) {
      createHint(metric)
      if ( budget.max >= metric.value || budget.min <= metric.value ) metric.isGood = true
      if ( budget.max <= metric.value || budget.min >= metric.value ) metric.isBad = true
    }

    return template(metric)
  }

  perfBar.metrics = {}


  perfBar.addMetric = function(metric) {
    if ( typeof metric !== 'object' ) return new Error('metric is not an Object.')
    if ( !metric.id )    return new Error('Id can\'t be empty.')
    if ( !metric.label ) return new Error('Label can\'t be empty.')
    if ( !metric.hasOwnProperty('value') ) return new Error('Value can\'t be empty.')

    // if metric is disabled do nothing
    if ( this.disabledMetrics[metric.id] ) return;

    this.mergeBudget(metric)

    var el = document.getElementById("perfBar-metric-" + metric.id)

    // if metric is already created with the same id, then overwrite it.
    if ( this.metrics[metric.id] && el ) {
      el.outerHTML = this.metricTemplate(metric)
      this.metrics[metric.id] = metric
      return
    }

    this.metricsContainer.innerHTML += this.metricTemplate(metric)

    this.metrics[metric.id] = metric


  }

  perfBar.updateMetric = function(id, update) {
    if ( typeof update !== 'object' ) return new Error('update is not an Object.')

    if ( !Object.keys(update).length ) return;

    if ( !this.metrics[id] ) {
      update.id = id;
      return this.addMetric(update);
    }

    for ( var key in update ) {
      if ( !update.hasOwnProperty(key) ) return;

      switch (key) {
        case "value":
          this.metrics[id].value = update[key]
          break
        case "label":
          this.metrics[id].label = update[key]
          break
        case "unit":
          this.metrics[id].unit  = update[key]
          break
        case "budget":
          this.metrics[id].budget  = update[key]
          break
      }
    }

    document.getElementById("perfBar-metric-" + id).outerHTML = this.metricTemplate(this.metrics[id])
  }

  perfBar.deleteMetric = function(id) {
    if ( !id || !this.metrics[id] ) return;

    (document.getElementById("perfBar-metric-" + id)).remove()
    return delete this.metrics[id];
  }

  perfBar.enable = function(id) {
    if ( !id ) return;
    if ( !this.disabledMetrics[id] ) return true;

    delete this.disabledMetrics[id]

    if ( this.metrics[id] ) this.addMetric(this.metrics[id])

    return true
  }

  perfBar.disable = function(id) {
    if ( !id ) return;
    if ( this.disabledMetrics[id] ) return true;

    this.disabledMetrics[id] = this.metrics[id]

    return (document.getElementById("perfBar-metric-" + id)).remove()
  }

  var perfMetrics = { perf: [], others: [] }
  perfBar.runPerfMetrics = function(type) {
    for (var i = 0; i < perfMetrics[type].length; i++) {
      perfMetrics[type][i]()
    }

    delete perfMetrics[type];
  }


  perfMetrics.perf.push(function() {
    perfBar.addMetric({
      id: 'loadTime',
      value: ( perfBar.perf.timing.loadEventStart - perfBar.perf.timing.navigationStart ),
      unit: 'ms',
      label: 'Load Time',
      budget: {
        max: 5000
      }
    })
  })
  

  perfMetrics.perf.push(function () {
    perfBar.addMetric({
      id: 'latency',
      value: ( perfBar.perf.timing.responseStart - perfBar.perf.timing.connectStart ) ,
      unit: 'ms',
      label: 'Latency',
      budget: {
        max: 50
      }
    })
  })

  perfMetrics.perf.push(function () {
    var max = Math.round( ( perfBar.perf.timing.loadEventStart - perfBar.perf.timing.navigationStart ) * 0.8 )

    perfBar.addMetric({
      id: 'frontEnd',
      value: (perfBar.perf.timing.loadEventStart - perfBar.perf.timing.responseEnd ),
      unit: 'ms',
      label: 'Front End',
      budget: {
        max: max
      }
    })
  })

  perfMetrics.perf.push(function () {
    var max = Math.round( ( perfBar.perf.timing.loadEventStart - perfBar.perf.timing.navigationStart ) * 0.2 )

    perfBar.addMetric({
      id: 'backEnd',
      value: (perfBar.perf.timing.responseEnd - perfBar.perf.timing.navigationStart ),
      unit: 'ms',
      label: 'Back End',
      budget: {
        max: max
      }
    })

  })

  perfMetrics.perf.push(function() {
    perfBar.addMetric({
      id: 'respnseDuration',
      value: (perfBar.perf.timing.responseEnd - perfBar.perf.timing.responseStart ),
      unit: 'ms',
      label: 'Response Duration',
    })
  })

  perfMetrics.perf.push(function() {
    perfBar.addMetric({
      id: 'requestDuration',
      value: (perfBar.perf.timing.responseStart - perfBar.perf.timing.requestStart ),
      unit: 'ms',
      label: 'Request Duration',
    })
  })

  perfMetrics.perf.push(function() {
    if ( !perfBar.perf.navigation ) return
    perfBar.addMetric({
      id: 'redirectCount',
      value: perfBar.perf.navigation.redirectCount,
      label: 'Redirects',
    })
  })

  perfMetrics.perf.push(function() {
    perfBar.addMetric({
      id: 'loadEventTime',
      value: (perfBar.perf.timing.loadEventEnd - perfBar.perf.timing.loadEventStart ),
      unit: 'ms',
      label: 'Load Event duration',
    })
  })

  perfMetrics.perf.push(function() {
    perfBar.addMetric({
      id: 'domContentLoaded',
      value: (perfBar.perf.timing.domContentLoadedEventStart - perfBar.perf.timing.domInteractive ),
      unit: 'ms',
      label: 'DOM Content loaded',
    })
  })


  perfMetrics.perf.push(function() {
    perfBar.addMetric({
      id: 'processing',
      value: perfBar.perf.timing.loadEventStart - perfBar.perf.timing.domLoading,
      unit: 'ms',
      label: 'Processing Duration',
    })
  })

  perfMetrics.others.push(function() {
    perfBar.addMetric({
      id: 'numOfEl',
      value: document.documentElement.querySelectorAll('*').length,
      label: 'DOM elements',
    })
  })

  perfMetrics.others.push(function() {
    perfBar.addMetric({
      id: 'cssCount',
      value: document.querySelectorAll('link[rel="stylesheet"]').length,
      label: 'CSS',
    })
  })

  perfMetrics.others.push(function() {
    perfBar.addMetric({
      id: 'jsCount',
      value: document.querySelectorAll('script').length,
      label: 'JavaScript',
    })
  })

  perfMetrics.others.push(function() {
    perfBar.addMetric({
      id: 'imgCount',
      value: document.querySelectorAll('img').length,
      label: 'Images',
    })
  })

  perfMetrics.others.push(function() {
    var count = 0
    var images = document.querySelectorAll('img[src]')

    for (var i = 0; i < images.length; i++) {
      if ( images[i].src.match(/^data:+/) ) count++
    }
    perfBar.addMetric({
      id: 'dataURIImagesCount',
      value: count,
      label: 'Data URI images',
    })
  })

  perfMetrics.others.push(function() {
    perfBar.addMetric({
      id: 'inlineCSSCount',
      value: document.querySelectorAll('style').length,
      label: 'Inline CSS',
    })

  })

  perfMetrics.others.push(function() {
    var js = document.querySelectorAll('script')
    var count = 0
    for (var i = 0; i < js.length; i++) {
      if ( !js[i].src ) count++
    }

    perfBar.addMetric({
      id: 'inlineJSCount',
      value: count,
      label: 'Inline JavaScript',
    })
  })

  perfMetrics.others.push(function() {
    var css = document.querySelectorAll('link[rel="stylesheet"]')
    var links = []
    for (var i = 0; i < css.length; i++) {
      links.push(css[i].href)
    }
    var count = isThirdParty(links)

    perfBar.addMetric({
      id: 'thirdCSS',
      value: count,
      label: '3rd Party CSS',
    })
  })

  perfMetrics.others.push(function() {
    var js = document.querySelectorAll('script[src]')
    var links = []
    for (var i = 0; i < js.length; i++) {
      links.push(js[i].src)
    }
    var count = isThirdParty(links)
    perfBar.addMetric({
      id: 'thirdJS',
      value: count,
      label: '3rd Party JavaScript',
    })
  })

  perfMetrics.others.push(function() {
    var count = countGlobals()
    perfBar.addMetric({
      id: 'globalJS',
      value: count,
      label: 'JavaScript Globals',
    })
  })

  perfBar.mergeBudget = function(metric) {
    if ( !this.config.budget ) return
    if ( !this.config.budget[metric.id] ) return

    var budget = this.config.budget

    if ( !metric.budget || typeof metric.budget != "object" ) {
      metric.budget = budget[metric.id]
      return
    }

    if ( budget[metric.id].max ) metric.budget.max = budget[metric.id].max
    if ( budget[metric.id].min ) metric.budget.min = budget[metric.id].min

  }

  function createHint(metric) {
    var budget = metric.budget
    var minText = "Min Value is "
    var maxText = "Max Value is "
    var unitText = metric.unit || ""
    var hint = []

    if ( budget.hasOwnProperty('min') ) 
      hint.push(minText + budget.min + unitText + ".")

    if ( budget.hasOwnProperty('max') ) 
      hint.push(maxText + budget.max + unitText + ".")

    metric.hint = hint.join(" ")
  }

  function countGlobals() {
    var differences = {},
        exceptions, 
        globals = {},
        i,
        iframe = document.createElement('iframe');

    for (i in window) {
      differences[i] = {
        'type': typeof window[i],
        'val': window[i]
      }
    }
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.src = 'about:blank';
    iframe = iframe.contentWindow || iframe.contentDocument;
    for (i in differences) {
      if (typeof iframe[i] != 'undefined') delete differences[i];
      else if (globals[differences[i].type]) delete differences[i]
    }
    exceptions = 'addEventListener,document,location,navigator,window,perfBar'.split(',');
    i = exceptions.length;
    while (--i) {
      delete differences[exceptions[i]]
    }
    return Object.keys(differences).length
  }

  
  function isThirdParty(links) {
    var a = document.createElement('a')
    var counter = 0

    for (var i = 0; i < links.length; i++) {
      a.href = links[i]
      if ( a.hostname != window.location.hostname ) counter++
    }

    return counter
  }

  

  // private method that handles clicks on #perfBar (show/hide) stuff.
  function _handleClick() {
    perfBar.el.querySelector('.perfBar-bar').addEventListener('click', function(e) {
      perfBar.el.classList.toggle('perfBar-is-active')
    })
  }

})()
},{"./classList.js":1,"./templates/bar.hbs":3,"./templates/stat.hbs":4}],3:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<style>\n/* \nto make sure perfBar doesn't overlap \nwith the content when you reach the bottom of the page\n*/\nbody {\n  padding-bottom: 40px;\n}\n\n\n#perfBar, #perfBar:before, #perfBar:after, #perfBar *, #perfBar *:before, #perfBar *:after {\n  -moz-box-sizing: border-box; -webkit-box-sizing: border-box; box-sizing: border-box;\n }\n\n#perfBar {\n  position: fixed;\n  width: 100%;\n  bottom: 0;\n  left: 0;\n  padding: 0;\n  z-index: 999;\n  \n\n  color: #333;\n  font-weight: 200;\n  font-size: 16px;\n  background: #EFEFEF;\n  border-top: 1px solid #dedede;\n  font-family: \"helvetica\", arial;\n}\n#perfBar:hover {\n  background: #EFEFEF;\n}\n#perfBar.perfBar-is-active {\n  background: #EFEFEF;\n  height: 250px;\n}\n#perfBar.perfBar-is-active .perfBar-bar:hover {\n  background: #ededed;\n}\n.perfBar-bar {\n  height: 40px;\n  padding: 0 30px;\n  margin: 0 auto;\n  padding-bottom: 10px;\n  padding-top: 10px;\n\n  line-height: 20px;\n  text-align: center;\n  color: #fff;\n  cursor: pointer;\n}\n\n.perfBar-is-active .perfBar-bar {\n  border-bottom: 1px solid #ededed;\n  box-shadow: 0 1px 0 #dedede;\n}\n\n.perfBar-bar-circle {\n  display: inline-block;\n  height: 5px;\n  width: 5px;\n\n  background: #999;\n  border-radius: 50%;\n}\n\n.perfBar-stats {\n  display: none;\n}\n\n\n.perfBar-is-active .perfBar-stats {\n  display: block;\n  overflow: auto;\n  max-height: 200px;\n}\n\n.perfBar-stats ul {\n  list-style: none;\n  padding: 0;\n  margin: 20px auto 0;\n  display: block;\n  width: 90%;\n}\n.perfBar-stats li {\n  padding: 15px;\n  width: 50%;\n  height: 100px;\n  float: left;\n}\n\n.perfBar-stat {\n  text-align: center;  \n}\n.perfBar-valueUnit {\n  -webkit-font-smoothing: antialiased;\n}\n.perfBar-valueUnit.is-good {\n  color: #00AD61;\n}\n.perfBar-valueUnit.is-bad {\n  color: #FF3535;\n}\n.perfBar-value {\n  font-size: 2em;\n  font-weight: 600;\n}\n.perfBar-unit {\n  font-size: 1.2em;\n  font-weight: 500;\n}\n.perfBar-label {\n  margin-top: 5px;\n\n  color: #999;\n  font-weight: 200;\n  font-size: .8em;\n}\n\n.perfBar-cf:before,\n.perfBar-cf:after {\n    content: \" \"; /* 1 */\n    display: table; /* 2 */\n}\n\n.perfBar-cf:after {\n    clear: both;\n}\n\n/**\n * For IE 6/7 only\n * Include this rule to trigger hasLayout and contain floats.\n */\n.perfBar-cf {\n    *zoom: 1;\n}\n\n\n@media screen and (min-width: 700px) {\n  .perfBar-stats li {\n    width: 20%;\n  }\n}\n</style>\n<div id=\"perfBar\">\n  <div class=\"perfBar-bar\">\n    <span class=\"perfBar-bar-circle\"></span>\n    <span class=\"perfBar-bar-circle\"></span>\n    <span class=\"perfBar-bar-circle\"></span>\n  </div>\n  <div class=\"perfBar-stats\">\n    <ul class=\"perfBar-cf\">\n    </ul>\n  </div>\n</div>";
  });

},{"hbsfy/runtime":12}],4:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  
  return " is-good ";
  }

function program3(depth0,data) {
  
  
  return " is-bad ";
  }

function program5(depth0,data) {
  
  var buffer = "", stack1, helper;
  buffer += "\n      <abbr title=\"";
  if (helper = helpers.hint) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.hint); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "\">\n        <span class=\"perfBar-value\">";
  if (helper = helpers.value) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.value); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n        <span class=\"perfBar-unit\">";
  if (helper = helpers.unit) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.unit); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n      </abbr>\n      ";
  return buffer;
  }

function program7(depth0,data) {
  
  var buffer = "", stack1, helper;
  buffer += "\n        <span class=\"perfBar-value\">";
  if (helper = helpers.value) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.value); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n        <span class=\"perfBar-unit\">";
  if (helper = helpers.unit) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.unit); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n      ";
  return buffer;
  }

  buffer += "<li id=\"perfBar-metric-";
  if (helper = helpers.id) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.id); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "\">\n  <div class=\"perfBar-stat\">\n    <div class=\"perfBar-valueUnit ";
  stack1 = helpers['if'].call(depth0, (depth0 && depth0.isGood), {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += " ";
  stack1 = helpers['if'].call(depth0, (depth0 && depth0.isBad), {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n      ";
  stack1 = helpers['if'].call(depth0, (depth0 && depth0.hint), {hash:{},inverse:self.program(7, program7, data),fn:self.program(5, program5, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </div>\n    <h3 class=\"perfBar-label\">";
  if (helper = helpers.label) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.label); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</h3>\n  </div>\n</li>";
  return buffer;
  });

},{"hbsfy/runtime":12}],5:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var base = require("./handlebars/base");

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
var SafeString = require("./handlebars/safe-string")["default"];
var Exception = require("./handlebars/exception")["default"];
var Utils = require("./handlebars/utils");
var runtime = require("./handlebars/runtime");

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
var create = function() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = SafeString;
  hb.Exception = Exception;
  hb.Utils = Utils;

  hb.VM = runtime;
  hb.template = function(spec) {
    return runtime.template(spec, hb);
  };

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

exports["default"] = Handlebars;
},{"./handlebars/base":6,"./handlebars/exception":7,"./handlebars/runtime":8,"./handlebars/safe-string":9,"./handlebars/utils":10}],6:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];

var VERSION = "1.3.0";
exports.VERSION = VERSION;var COMPILER_REVISION = 4;
exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};
exports.REVISION_CHANGES = REVISION_CHANGES;
var isArray = Utils.isArray,
    isFunction = Utils.isFunction,
    toString = Utils.toString,
    objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials) {
  this.helpers = helpers || {};
  this.partials = partials || {};

  registerDefaultHelpers(this);
}

exports.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: logger,
  log: log,

  registerHelper: function(name, fn, inverse) {
    if (toString.call(name) === objectType) {
      if (inverse || fn) { throw new Exception('Arg not supported with multiple helpers'); }
      Utils.extend(this.helpers, name);
    } else {
      if (inverse) { fn.not = inverse; }
      this.helpers[name] = fn;
    }
  },

  registerPartial: function(name, str) {
    if (toString.call(name) === objectType) {
      Utils.extend(this.partials,  name);
    } else {
      this.partials[name] = str;
    }
  }
};

function registerDefaultHelpers(instance) {
  instance.registerHelper('helperMissing', function(arg) {
    if(arguments.length === 2) {
      return undefined;
    } else {
      throw new Exception("Missing helper: '" + arg + "'");
    }
  });

  instance.registerHelper('blockHelperMissing', function(context, options) {
    var inverse = options.inverse || function() {}, fn = options.fn;

    if (isFunction(context)) { context = context.call(this); }

    if(context === true) {
      return fn(this);
    } else if(context === false || context == null) {
      return inverse(this);
    } else if (isArray(context)) {
      if(context.length > 0) {
        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      return fn(context);
    }
  });

  instance.registerHelper('each', function(context, options) {
    var fn = options.fn, inverse = options.inverse;
    var i = 0, ret = "", data;

    if (isFunction(context)) { context = context.call(this); }

    if (options.data) {
      data = createFrame(options.data);
    }

    if(context && typeof context === 'object') {
      if (isArray(context)) {
        for(var j = context.length; i<j; i++) {
          if (data) {
            data.index = i;
            data.first = (i === 0);
            data.last  = (i === (context.length-1));
          }
          ret = ret + fn(context[i], { data: data });
        }
      } else {
        for(var key in context) {
          if(context.hasOwnProperty(key)) {
            if(data) { 
              data.key = key; 
              data.index = i;
              data.first = (i === 0);
            }
            ret = ret + fn(context[key], {data: data});
            i++;
          }
        }
      }
    }

    if(i === 0){
      ret = inverse(this);
    }

    return ret;
  });

  instance.registerHelper('if', function(conditional, options) {
    if (isFunction(conditional)) { conditional = conditional.call(this); }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function(conditional, options) {
    return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
  });

  instance.registerHelper('with', function(context, options) {
    if (isFunction(context)) { context = context.call(this); }

    if (!Utils.isEmpty(context)) return options.fn(context);
  });

  instance.registerHelper('log', function(context, options) {
    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
    instance.log(level, context);
  });
}

var logger = {
  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

  // State enum
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 3,

  // can be overridden in the host environment
  log: function(level, obj) {
    if (logger.level <= level) {
      var method = logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};
exports.logger = logger;
function log(level, obj) { logger.log(level, obj); }

exports.log = log;var createFrame = function(object) {
  var obj = {};
  Utils.extend(obj, object);
  return obj;
};
exports.createFrame = createFrame;
},{"./exception":7,"./utils":10}],7:[function(require,module,exports){
"use strict";

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var line;
  if (node && node.firstLine) {
    line = node.firstLine;

    message += ' - ' + line + ':' + node.firstColumn;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  if (line) {
    this.lineNumber = line;
    this.column = node.firstColumn;
  }
}

Exception.prototype = new Error();

exports["default"] = Exception;
},{}],8:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];
var COMPILER_REVISION = require("./base").COMPILER_REVISION;
var REVISION_CHANGES = require("./base").REVISION_CHANGES;

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = REVISION_CHANGES[currentRevision],
          compilerVersions = REVISION_CHANGES[compilerRevision];
      throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
            "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
            "Please update your runtime to a newer version ("+compilerInfo[1]+").");
    }
  }
}

exports.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

function template(templateSpec, env) {
  if (!env) {
    throw new Exception("No environment passed to template");
  }

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  var invokePartialWrapper = function(partial, name, context, helpers, partials, data) {
    var result = env.VM.invokePartial.apply(this, arguments);
    if (result != null) { return result; }

    if (env.compile) {
      var options = { helpers: helpers, partials: partials, data: data };
      partials[name] = env.compile(partial, { data: data !== undefined }, env);
      return partials[name](context, options);
    } else {
      throw new Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    }
  };

  // Just add water
  var container = {
    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,
    programs: [],
    program: function(i, fn, data) {
      var programWrapper = this.programs[i];
      if(data) {
        programWrapper = program(i, fn, data);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = program(i, fn);
      }
      return programWrapper;
    },
    merge: function(param, common) {
      var ret = param || common;

      if (param && common && (param !== common)) {
        ret = {};
        Utils.extend(ret, common);
        Utils.extend(ret, param);
      }
      return ret;
    },
    programWithDepth: env.VM.programWithDepth,
    noop: env.VM.noop,
    compilerInfo: null
  };

  return function(context, options) {
    options = options || {};
    var namespace = options.partial ? options : env,
        helpers,
        partials;

    if (!options.partial) {
      helpers = options.helpers;
      partials = options.partials;
    }
    var result = templateSpec.call(
          container,
          namespace, context,
          helpers,
          partials,
          options.data);

    if (!options.partial) {
      env.VM.checkRevision(container.compilerInfo);
    }

    return result;
  };
}

exports.template = template;function programWithDepth(i, fn, data /*, $depth */) {
  var args = Array.prototype.slice.call(arguments, 3);

  var prog = function(context, options) {
    options = options || {};

    return fn.apply(this, [context, options.data || data].concat(args));
  };
  prog.program = i;
  prog.depth = args.length;
  return prog;
}

exports.programWithDepth = programWithDepth;function program(i, fn, data) {
  var prog = function(context, options) {
    options = options || {};

    return fn(context, options.data || data);
  };
  prog.program = i;
  prog.depth = 0;
  return prog;
}

exports.program = program;function invokePartial(partial, name, context, helpers, partials, data) {
  var options = { partial: true, helpers: helpers, partials: partials, data: data };

  if(partial === undefined) {
    throw new Exception("The partial " + name + " could not be found");
  } else if(partial instanceof Function) {
    return partial(context, options);
  }
}

exports.invokePartial = invokePartial;function noop() { return ""; }

exports.noop = noop;
},{"./base":6,"./exception":7,"./utils":10}],9:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],10:[function(require,module,exports){
"use strict";
/*jshint -W004 */
var SafeString = require("./safe-string")["default"];

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

function escapeChar(chr) {
  return escape[chr] || "&amp;";
}

function extend(obj, value) {
  for(var key in value) {
    if(Object.prototype.hasOwnProperty.call(value, key)) {
      obj[key] = value[key];
    }
  }
}

exports.extend = extend;var toString = Object.prototype.toString;
exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
var isFunction = function(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
if (isFunction(/x/)) {
  isFunction = function(value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
var isFunction;
exports.isFunction = isFunction;
var isArray = Array.isArray || function(value) {
  return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
};
exports.isArray = isArray;

function escapeExpression(string) {
  // don't escape SafeStrings, since they're already safe
  if (string instanceof SafeString) {
    return string.toString();
  } else if (!string && string !== 0) {
    return "";
  }

  // Force a string conversion as this will be done by the append regardless and
  // the regex test will do this transparently behind the scenes, causing issues if
  // an object's to string has escaped characters in it.
  string = "" + string;

  if(!possible.test(string)) { return string; }
  return string.replace(badChars, escapeChar);
}

exports.escapeExpression = escapeExpression;function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

exports.isEmpty = isEmpty;
},{"./safe-string":9}],11:[function(require,module,exports){
// Create a simple path alias to allow browserify to resolve
// the runtime on a supported path.
module.exports = require('./dist/cjs/handlebars.runtime');

},{"./dist/cjs/handlebars.runtime":5}],12:[function(require,module,exports){
module.exports = require("handlebars/runtime")["default"];

},{"handlebars/runtime":11}]},{},[2])