# promice
Promice is an Inversion of Control library for JavaScript using Promises.

## Usage

Three functions are provided:

- `one`: For creating a singleton in your application.
- `each`: For creating a factory in your application.
- `run`: For running your application.

There is one type that needs to be described:

- `InjectedPromiseCallback`:

  `!Array|function(...*): function(function(*), function(*))`
  
  The higher-order function can take 0 or more arguments. The names of these arguments indicate which things should be injected. Alternatively, this function may have a property `$inject` that is a list of strings, serving the same purpose. This `$inject` array is good when a compiler is being used and function argument names are collapsed.

  The `Array` is a list of strings followed by an `InjectedPromiseCallback` as its last element. The strings are labels of things to inject. Using this option is good when a compiler is being used and function argument names are collapsed.
  
  The higher-order function should return a function that will be passed to the Promise constructor; the arguments are a Promise `resolve` and a Promise `reject`, respectively.

### Singletons with `one(string, (InjectedPromiseCallback|*))`

The first argument names our singleton for injection by other things.
In addition to taking an InjectedPromiseCallback, singletons can be created with a constant value of any object type except `Array` and `Function`. Only the _first_ time a singleton is injected is its code run. All subsequent injections will use the value from the _first_ injection.

```js
promice.one('pageLoadedTime', new Date().getTime());
promice.one('ipAddress', () => (resolve) => resolve(
    fetch('http://ip.jsontest.com/')
      .then(result => result.json())
      .then(json => json.ip)));
```

### Factories with `each(string, InjectedPromiseCallback)`

The first argument names our factory for injection by other things.
Each time a factory is injected, it is re-evaluated.

```js
promice.each('networkTime', () => (resolve) => resolve(
    fetch('http://time.jsontest.com/')
      .then(result => result.json())
      .then(json => json.milliseconds_since_epoch)));
```

### Running with `run(Function)`

The function passed to `run` will be injected and executed when the dependencies resolve.

```js
promice.run((pageLoadedTime, ipAddress, networkTime) => {
  const timeDrift = Math.abs(networkTime - pageLoadedTime);
  console.log("Your IP address: %s", ipAddress);
  console.log("It took %dms to load the time.", timeDrift);
});
```
