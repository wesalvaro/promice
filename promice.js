
const promice = {};

(() => {

// Adapted from AngularJS dependency annotator.
const FN_ARGS = /^(?:function)?\s*[^\(]*\(\s*([^\)]*)\s*\)/m;
const FN_ARG_SPLIT = /\s*,\s*/;
const DEP = /^(?<lazy>lazy_)?(?<lags>lags_)?(?<name>.+?)$/;
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
const parseDep = (dep) => dep.match(DEP).groups;
const annotate = (fn) => {
  if (typeof fn == 'function' && !fn.$inject) {
    fn.$inject = fn.toString()
      .replace(STRIP_COMMENTS, '')
      .match(FN_ARGS)[1]
      .split(FN_ARG_SPLIT)
      .filter(arg => arg)
      .map(parseDep);
  } else if (Array.isArray(fn)) {
    const last = fn.length - 1;
    fn = Object.assign(fn[last], {$inject: fn.slice(0, last).map(parseDep)});
  }
  return fn;
};

// Checks if a value is injectable, i.e. a function or an array.
const isInjectable = (fn) => typeof fn == 'function' || Array.isArray(fn);
// Warns if a name is already in the magic bag of injectables.
const checkBagContents =
    (name) => bag.get(name) && console.warn(`Promice bag already contains a '${name}'.`);
// Map to contain all of the injectables
const bag = new Map();
// Sentinel value for a laggy dependency having rejected.
promice.rejected = Symbol('promice.rejected');

/**
 * Prepare a Promise array of the required dependencies.
 * @param {!Array<{lazy: boolean, lags: boolean, name: string}>} deps required
 * @return {!Promise<!Array<*>>} of all the required dependencies
 */
const prepDeps = (deps) => {
  return Promise.all(deps.map((dep) => {
    const {lazy, lags, name} = dep;
    let value = bag.get(name);
    if (typeof value == 'function') {
      if (lags) {
        const laggy = value;
        value = () => laggy()
          .then((result) => result,
                (reason) => Object.assign(reason || {}, {[promice.rejected]: true}));
      }
      if (!lazy) {
        value = value();
      }
    }
    return value;
  }));
};


/**
 * Gets one or more depedencies by name.
 * The first argumement may be an Array.
 * Otherwise, all arguments are treated as individual dependency names.
 * @param {string|!Array<string>} deps by name
 */
promice.get = (...deps) => prepDeps(
    (Array.isArray(deps[0]) ? deps[0] : deps).map(parseDep));


/**
 * Creates a function that has its dependencies computed and cached.
 * If a dependency value changes between preparation and invocation, it is ignored.
 * This effectively creates a promise branch of the dependencies at preparation time.
 *
 * Example:
 *  - Number `i` is set to 42.
 *  - Factory `foo` is defined to return `i`.
 *  - A function dependent on `foo` is prepared.
 *  - Number `i` is changed to 13.
 *  - The prepared function is invoked, its argument `foo` == 42.
 * @param {Function} fn to prepare
 * @param {*} context to use with the function
 */
promice.prepped = (fn, context) => {
  const preppedDeps = prepDeps(annotate(fn).$inject);
  return () => preppedDeps.then((deps) => fn.apply(context, deps));
};

/**
 * Creates a function that will have its dependencies re-evaluated on each invocation.
 * This works opposite of `prepped`.
 *
 * Example:
 *  - Number `i` is set to 42.
 *  - Factory `foo` is defined to return `i`.
 *  - A function dependent on `foo` is prepared.
 *  - Number `i` is changed to 13.
 *  - The prepared function is invoked, its argument `foo` == 13.
 * @param {Function} fn to prepare
 * @param {*} context to use with the function
 */
promice.every = (fn, context) => {
  annotate(fn);
  return () => prepDeps(fn.$inject).then((deps) => fn.apply(context, deps));
};

/**
 * Immediately invoke a function with injected dependencies.
 * @param {Function} fn
 * @param {*} context
 */
promice.run = (fn, context) => promice.prepped(fn, context)();


const depPromise = (fn, context) => prepDeps(fn.$inject)
  .then((deps) => new Promise(fn.apply(context, deps).bind(context)));

/**
 * Create a dependency that is recomputed each time it is used.
 * @param {string} name
 * @param {Function} fn
 * @param {*} context
 */
promice.each = (name, fn, context) => {
  if (!isInjectable(fn)) {
    throw `Promice each value '${name}' is not injectable.`;
  }
  checkBagContents(name);
  annotate(fn);
  bag.set(name, () => depPromise(fn, context));
};

/**
 * Create a dependency that is computed once the first time it is used.
 * @param {string} name
 * @param {Function} fn
 * @param {*} context
 */
promice.one = (name, fn, context) => {
  checkBagContents(name);
  if (isInjectable(fn)) {
    annotate(fn);
    bag.set(name, () => bag.set(name, depPromise(fn, context)).get(name));
  } else {
    bag.set(name, fn);
  }
};


/**
 * Helper methods for testing injected code.
 */
promice.testing = {
  /**
   * Stashes the dependency bag for testing.
   * Actual dependencies should not be used in testing.
   * Fetch needed dependencies under test, then `stash` the bag.
   * You may then add dependencies for testing only.
   * Afterward, `restore` the bag to clear test dependencies.
   * `stash` may be called more than once, effectively discarding the bag.
   */
  stash() {
    this.bag = new Map();
    for (const [key, value] of bag) {
      this.bag.set(key, value);
    }
    bag.clear();
  },
  /**
   * Restores a stashed bag after a test.
   * @see promice.testing.stash for more information.
   */
  restore() {
    if (!this.bag) throw 'Bag is not stashed.';
    for (const [key, value] of this.bag) {
      bag.set(key, value);
    }
    this.bag = null;
  },
};

Object.freeze(promice);

})();
