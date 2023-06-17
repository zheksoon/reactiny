let context = null;
let reactionsScheduled = false;
let reactions = [];
let subscriberChecks = new Set();

function runReactions() {
  let i = 100;
  while (reactions.length > 0 && --i) {
    const currentReactions = reactions;
    reactions = [];

    currentReactions.forEach((reaction) => {
      reaction._runIfScheduled();
    });
  }

  reactions = [];

  subscriberChecks.forEach((check) => check());
  subscriberChecks.clear();

  reactionsScheduled = false;

  if (!i) {
    throw new Error("infinite loop");
  }
}

function observable(value) {
  const subscribers = new Set();

  const self = {
    _removeSubscriber(subs) {
      subscribers.delete(subs);
    }
  };

  function getter(newValue, asIs) {
    if (!arguments.length) {
      if (context !== null) {
        context._addSubscription(self);
        subscribers.add(context);
      }
    } else {
      if (typeof newValue === "function" && !asIs) {
        newValue = newValue(value);
      }

      value = newValue;

      subscribers.forEach((subs) => subs._notify());

      if (!reactionsScheduled) {
        reactionsScheduled = true;
        Promise.resolve().then(runReactions).catch(console.log);
      }
    }

    return value;
  }

  return getter;
}

const CLEAN = 0;
const DIRTY = 1;
const SCHEDULED = 1;

function computed(fn) {
  let value;
  const subscribers = new Set();
  const subscriptions = new Set();
  let state = DIRTY;

  const self = {
    _removeSubscriber(subs) {
      subscribers.delete(subs);
      if (!subscribers.size) {
        subscriberChecks.add(() => {
          if (!subscribers.size && state == CLEAN) destroy();
        });
      }
    },
    _notify() {
      if (state === CLEAN) {
        state = DIRTY;
        subscribers.forEach((subs) => subs._notify());
      }
    },
    _addSubscription(subs) {
      subscriptions.add(subs);
    }
  };

  const destroy = () => {
    subscriptions.forEach((subs) => subs._removeSubscriber(self));
    subscriptions.clear();
    state = DIRTY;
  };

  const get = () => {
    if (context !== null) {
      context._addSubscription(self);
      subscribers.add(context);
    }

    const oldContext = context;
    context = self;
    try {
      if (state === DIRTY) {
        destroy();
        value = fn();
        state = CLEAN;
      }
      return value;
    } finally {
      context = oldContext;
    }
  };

  return get;
}

function reaction(fn, deferRun) {
  const subscriptions = new Set();
  let state = CLEAN;
  let children = [];
  let destructor;

  const self = {
    _notify() {
      if (state === CLEAN) {
        state = SCHEDULED;
        reactions.push(self);
      }
    },
    _addSubscription(subs) {
      subscriptions.add(subs);
    },
    _addChild(child) {
      children.push(child);
    },
    _destroy() {
      subscriptions.forEach((subs) => subs._removeSubscriber(self));
      subscriptions.clear();

      children.forEach((child) => child._destroy());
      children = [];

      destructor && destructor();
      destructor = null;

      state = CLEAN;
    },
    _runIfScheduled() {
      if (state === SCHEDULED) run();
    }
  };

  if (context && context._addChild) {
    context._addChild(self);
  }

  const run = () => {
    const oldContext = context;
    context = self;
    try {
      self._destroy();
      destructor = fn();
    } finally {
      context = oldContext;
    }
  };

  self._destroy.run = run;

  !deferRun && run();

  return self._destroy;
}

function action(fn) {
  return function () {
    const oldContext = context;
    context = null;
    try {
      fn.apply(this, arguments);
    } finally {
      context = oldContext;
    }
  };
}

function untracked(fn) {
  const oldContext = context;
  context = null;
  try {
    return fn();
  } finally {
    context = oldContext;
  }
}

function makeNode(elem) {
  if (elem == null || elem === false) {
    return document.createComment("");
  }

  if (!(elem instanceof Node)) {
    return document.createTextNode("" + elem);
  }

  return elem;
}

function render(fn, context) {
  const anchorNode = document.createComment("");
  context.appendChild(anchorNode);

  reaction(() => {
    let nodes = fn();
    if (!Array.isArray(nodes)) {
      nodes = [nodes];
    }

    nodes = nodes.map(makeNode);

    nodes.forEach((node) => {
      context.insertBefore(node, anchorNode);
    });

    return () => {
      nodes.forEach((node) => {
        context.removeChild(node);
      });
    };
  });
}

function createClass(obj) {
  let out = "";

  if (typeof obj === "string") return obj;

  if (Array.isArray(obj)) {
    for (let k = 0, tmp; k < obj.length; k++) {
      if ((tmp = createClass(obj[k]))) {
        out += (out && " ") + tmp;
      }
    }
  } else {
    for (let k in obj) {
      if (obj[k]) out += (out && " ") + k;
    }
  }

  return out;
}

function h(tag, props, children = []) {
  if (Array.isArray(props)) {
    children = props;
    props = null;
  }

  const elem = document.createElement(tag);

  if (props) {
    Object.keys(props).forEach((key) => {
      let prop = props[key];

      const setProp = (prop) => {
        if (key === "style") {
          if (!prop) {
            elem[key] = undefined;
          } else {
            Object.keys(prop).forEach((styleKey) => {
              const styleValue = prop[styleKey];

              if (styleKey[0] === "-") {
                elem[key].setProperty(styleKey, styleValue);
              } else {
                elem[key][styleKey] = styleValue;
              }
            });
          }
        } else {
          if (key === "class") {
            prop = createClass(prop);
          }
          if (prop == null || prop === false) {
            elem.removeAttribute(key);
          } else {
            elem.setAttribute(key, prop);
          }
        }
      };

      if (key[0] === "o" && key[1] === "n") {
        elem.addEventListener(key.slice(2), prop);
      } else if (typeof prop === "function") {
        reaction(() => {
          setProp(prop());
        });
      } else {
        setProp(prop);
      }
    });
  }

  children.forEach((child) => {
    if (typeof child === "function") {
      render(child, elem);
    } else {
      const childElem = makeNode(child);
      elem.appendChild(childElem);
    }
  });

  return elem;
}

export { observable, computed, reaction, action, untracked, render, h };
