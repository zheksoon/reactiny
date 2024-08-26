import { useState, useSyncExternalStore } from "react";

type Subscriber = {
  _notify: () => void;
  _subscribe: (subs: Subscription) => void;
};

type Subscription = {
  _addSubscriber: (subs: Subscriber) => void;
  _removeSubscriber: (subs: Subscriber) => void;
  _revision: () => {};
};

type Reaction = {
  _run: () => void;
  _runManager: () => void;
  _subscribeToAll: () => void;
  _unsubscribeFromAll: () => void;
};

type Computed<T> = {
  _recompute: () => T;
  _checkAndDestroy: () => void;
};

let context: Subscriber | null = null;

let queue = new Set<Reaction>();

let checkQueue = new Set<Computed<any>>();

export const observable = <T>(
  valueOrComputed: T | (() => T),
  equals = Object.is
) => {
  if (typeof valueOrComputed === "function") {
    return computed(valueOrComputed as () => T, equals);
  }

  let value = valueOrComputed;
  let subscribers = new Set<Subscriber>();
  let revision = {};

  let self: Subscription = {
    _revision() {
      return revision;
    },
    _addSubscriber(subs) {
      subscribers.add(subs);
    },
    _removeSubscriber(subs) {
      subscribers.delete(subs);
    },
  };

  return <T>(...args: [] | [T] | [(old: T) => T]) => {
    if (!args.length) {
      if (context) {
        subscribers.add(context);
        context._subscribe(self);
      }

      return value;
    }

    let newValue = args[0] as any;

    if (typeof newValue === "function") {
      newValue = newValue(value);
    }

    if (equals(value, newValue)) {
      return;
    }

    value = newValue;

    revision = {};

    subscribers.forEach((subs) => subs._notify());
  };
};

const computed = <T>(fn: () => T, equals: typeof Object.is) => {
  let revision = {};
  let dirty = true;
  let subscribers = new Set<Subscriber>();
  let subscriptions = new Map<Subscription, {}>();
  let value: T | undefined = undefined;

  let self: Subscriber & Subscription & Computed<T> = {
    _addSubscriber(subs) {
      subscribers.add(subs);
    },
    _removeSubscriber(subs) {
      subscribers.delete(subs);

      if (!subscribers.size) {
        checkQueue.add(self);
      }
    },
    _subscribe(subs) {
      subscriptions.set(subs, subs._revision());
    },
    _notify() {
      dirty = true;

      subscribers.forEach((subs) => subs._notify());
    },
    _checkAndDestroy() {
      if (!subscribers.size) {
        subscriptions.forEach((revision, subs) => subs._removeSubscriber(self));
      }
    },
    _revision() {
      if (dirty) {
        let check = true;

        subscriptions.forEach((revision, subs) => {
          check = check && subs._revision() === revision;
        });

        if (!check) {
          let result = self._recompute();

          if (!equals(value, result)) {
            value = result;
            revision = {};
          }
        }
      }

      return revision;
    },
    _recompute(): T {
      subscriptions.forEach((revision, subs) => subs._removeSubscriber(self));
      subscriptions.clear();

      let oldContext = context;

      context = self;

      try {
        return fn();
      } finally {
        dirty = false;
        context = oldContext;
      }
    },
  };

  return () => {
    if (context) {
      subscribers.add(context);
      context._subscribe(self);
    }

    if (dirty) {
      revision = {};
      value = self._recompute();
    }

    return value;
  };
};

export const reaction = (
  fn: () => void,
  immediate = true,
  manager: (() => void) | undefined
) => {
  let subscriptions = new Map<Subscription, {}>();

  let self: Subscriber & Reaction = {
    _notify() {
      if (!queue.size) {
        Promise.resolve().then(() => {
          queue.forEach((_reaction) => _reaction._runManager());
          queue.clear();

          checkQueue.forEach((comp) => comp._checkAndDestroy());
          checkQueue.clear();
        });
      }

      queue.add(self);
    },
    _subscribe(subs) {
      subscriptions.set(subs, subs._revision());
    },
    _subscribeToAll() {
      subscriptions.forEach((revision, subs) => {
        subs._addSubscriber(self);
        subscriptions.set(subs, subs._revision());
      });
    },
    _unsubscribeFromAll() {
      subscriptions.forEach((revision, subs) => {
        subs._removeSubscriber(self);
      });
    },
    _runManager() {
      let check = true;

      subscriptions.forEach((revision, subs) => {
        check = check && subs._revision() === revision;
      });

      if (!check || !subscriptions.size) {
        if (manager) {
          manager();
        } else {
          self._run();
        }
      }
    },
    _run() {
      destroy();

      let oldContext = context;

      context = self;

      try {
        return fn();
      } finally {
        context = oldContext;
      }
    },
  };

  const destroy = () => {
    subscriptions.forEach((revision, subs) => subs._removeSubscriber(self));
    subscriptions.clear();
  };

  destroy.run = self._run;
  destroy.self = self;

  immediate && self._run();

  return destroy;
};

export const untracked = <T>(fn: () => T): T => {
  let oldContext = context;

  context = null;

  try {
    return fn();
  } finally {
    context = oldContext;
  }
};

export const useObserver = <T>(fn: () => T): T => {
  const [self] = useState(() => {
    let revision = {};

    let subs = new Set<() => void>();

    let destroy = reaction(fn, false, () => {
      revision = {};

      subs.forEach((sub) => sub());
    });

    let self = {
      _revision() {
        return revision;
      },
      _subscribe(_sub) {
        if (!subs.size) {
          destroy.self._subscribeToAll();
        }

        subs.add(_sub);

        return () => {
          subs.delete(_sub);

          if (!subs.size) {
            destroy.self._unsubscribeFromAll();
          }
        };
      },
      _destroy: destroy,
      _subs: subs,
    };

    return self;
  });

  useSyncExternalStore(self._subscribe, self._revision);

  const result = self._destroy.run() as T;

  if (!self._subs.size) {
    self._destroy.self._unsubscribeFromAll();
  }

  return result;
};
