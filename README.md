<p align="center">
  <img src="https://github.com/zheksoon/reactiny/blob/main/assets/reactiny-logo.avif?raw=true" alt="reactiny" width="250" />
</p>

<p align="center">
  <img alt="NPM package gzipped size" src="https://img.shields.io/bundlephobia/minzip/reactiny?style=flat-square&logoColor=a57be8&color=a57be8" />
</p>

**Reactiny** is a small and efficient library for reactive state management in React. With a size of **less than 1KB**, it offers a straightforward approach to managing state with reactivity. Whether you're building a simple app or something more complex, Reactiny is designed to keep your state management clean and efficient.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [Examples](#examples)
- [API Reference](#api-reference)

---

## Just see it

Simplest counter example shows how to create an observable state and a reactive component:

```tsx
import { observable, useObserver } from "reactiny";

// reactive observable value
const counter = observable(0);

// reactive component
const Counter = () => {
  // useObserver re-renders the component when the inner observables change
  return useObserver(() => (
    <button onClick={() => counter((c) => c + 1)}>
      Clicked {counter()} times
    </button>
  ));
};
```

Computed value example shows how to create a computed value that automatically updates when its dependencies change:

```tsx
// computed value
const double = observable(() => counter() * 2);

// also updates when counter changes
const Double = () => {
  return useObserver(() => <div>Double: {double()}</div>);
};
```

## Introduction

**Reactiny** is designed to make state management in React a breeze. With Reactiny, you can create observable states, define computed values that automatically update, and manage side effects using reactions. It's minimal, performant, and easy to integrate into your projects.

## Installation

```bash
npm install reactiny
yarn add reactiny
```

## Basic Usage

### Observable

The `observable` function is the heart of Reactiny. It lets you create a piece of state that your components can react to. Here’s a quick example:

```javascript
import { observable } from "reactiny";

// Create an observable state
const counter = observable(0);

// Access the current value
console.log(counter()); // 0

// Update the value
counter(1);
console.log(counter()); // 1

// Update with a function
counter((c) => c + 1);
console.log(counter()); // 2
```

#### Computed Values

Need some logic to automatically update based on your state? Computed values in Reactiny are perfect for that. They recalculate when their dependencies change:

```javascript
const double = observable(() => counter() * 2);

console.log(double()); // 4

counter(3);

console.log(double()); // 6
```

## Advanced Usage

### Custom equality functions

Reactiny also allows you to define custom equality functions, which can be really handy when you need fine-grained control over when a computed value should update. For example, let's say you only care about the first two items in an array and want to recompute your state only if these two items change:

```javascript
const arraysEqual = (a, b) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const items = observable([1, 2, 3], arraysEqual);

// This computed value depends on the first two elements of `items`
// It will only recompute if these first two elements change
const firstTwoItems = observable(() => items().slice(0, 2), arraysEqual);

items([1, 2, 3]); // No change, so `firstTwoItems` does not recompute

items([1, 2, 4]); // No change in the first two elements, so `firstTwoItems` does not recompute

items([1, 3, 4]); // Change detected in the second element, `firstTwoItems` recomputes
console.log(firstTwoItems()); // [1, 3]
```

In this example, `firstTwoItems` is a computed value that only updates when the first or second element of `items` changes. If you update `items` but the first two elements stay the same, `firstTwoItems` remains unchanged. This ensures that Reactiny does just what you need—no more, no less.

### Reactions

Reactions in Reactiny allow you to define side effects that run whenever an observable changes. These are great for tasks like logging, triggering updates, or integrating with non-React systems.

```javascript
const destroy = reaction(() => {
  console.log("Counter:", counter());
});

counter(3); // Logs 'Counter: 3'

// Stop the reaction
destroy();

// Restart the reaction
destroy.run();
```

### Examples

#### Counter example

Here’s a simple counter component that automatically updates when the observable changes:

```javascript
import React from "react";
import { observable, useObserver } from "reactiny";

const counter = observable(0);

const Counter = () => {
  return useObserver(() => <div>{counter()}</div>);
};

export default Counter;
```

#### Computed value example

If you need something a bit more dynamic, try this example where a computed value automatically updates based on the state:

```javascript
import React from "react";
import { observable, useObserver } from "reactiny";

const counter = observable(0);
const double = observable(() => counter() * 2);

const Double = () => {
  return useObserver(() => <div>{double()}</div>);
};

export default Double;
```

### Complex example: independent components with different update speeds

Let's take it up a notch with a more complex example. Imagine you have two components that need to update at different rates based on the same source. For instance, `FastComponent` updates every second, while `SlowComponent` updates every two seconds. The trick is that `SlowComponent` only updates when its dependent computed value changes.

```javascript
import React, { useEffect } from "react";
import { observable, useObserver } from "reactiny";

// Observable state
const counter = observable(0);

// Computed values for different speeds
const fastValue = observable(() => counter());
const slowValue = observable(() => Math.floor(counter() / 2));

const FastComponent = () => {
  return useObserver(() => <div>Fast: {fastValue()}</div>);
};

const SlowComponent = () => {
  return useObserver(() => <div>Slow: {slowValue()}</div>);
};

const App = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      counter((c) => c + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <FastComponent />
      <SlowComponent />
    </div>
  );
};

export default App;
```

In this setup, the `FastComponent` updates every second, while the `SlowComponent` only updates every two seconds—specifically when `slowValue` changes. This shows how you can use Reactiny to manage more complex state-dependent logic with ease.

## API Reference

### `observable(initialValue, equals)`

- **Parameters:**
  - `initialValue`: The initial value or a function for computed observables.
  - `equals`: (Optional) A custom equality function.
- **Returns:** A function to get or set the observable value.

**Example:**

```javascript
// Simple observable
const counter = observable(0);

// Access the value
counter();

// Update the observable
counter(5);

// Update with a function
counter((c) => c + 1);

// Computed observable
const double = observable(() => counter() * 2);

// Custom equality function
const arraysEqual = (a, b) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// Observable with custom equality function
const items = observable([1, 2, 3], arraysEqual);

// Computed observable with custom equality function
const firstTwoItems = observable(() => items().slice(0, 2), arraysEqual);
```

### `reaction(effect, immediate = true, manager)`

- **Parameters:**
  - `effect`: The effect function to run when observables change.
  - `immediate`: (Optional) If `true`, runs the reaction immediately. Defaults to `true`.
  - `manager`: (Optional) A function to control when the reaction runs, useful for deferred execution.
- **Returns:** A function to destroy or rerun the reaction.

**Example:**

```javascript
// Create a reaction that logs the counter value
const logCounter = reaction(() => {
  console.log("Counter:", counter());
});

// Change the observable, triggering the reaction
counter(10); // Logs 'Counter: 10'

// Stop the reaction
logCounter();

// Restart the reaction
logCounter.run(); // Logs 'Counter: 10'

// Using the `immediate` parameter
const logDouble = reaction(() => {
  console.log("Double:", double());
}, false); // Will not run immediately

// Manually run the reaction
logDouble.run(); // Logs 'Double: 20'

// Using a `manager` function to defer execution
const deferredReaction = reaction(
  () => {
    console.log("Deferred Counter:", counter());
  },
  false,
  () => {
    setTimeout(deferredReaction.run, 1000); // Run after 1 second delay
  }
);

deferredReaction.run();

counter(15); // Logs 'Deferred Counter: 15' after 1 second
```

### `useObserver(observer)`

- **Parameters:**
  - `observer`: A function returning a React component.
- **Returns:** A React component that re-renders when observables inside the observer change.

**Example:**

```javascript
import React from "react";
import { observable, useObserver } from "reactiny";

// Observable state
const counter = observable(0);

// Component using the observable
const CounterDisplay = () => {
  return useObserver(() => <div>{counter()}</div>);
};

// Update counter somewhere in the app
counter(20);
```

## Author

Eugene Daragan

## License

MIT
