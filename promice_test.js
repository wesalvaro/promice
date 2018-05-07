const assertEqual = (act, exp, opt_msg) => {
  return new Promise((resolve, reject) => {
    //console.assert(act == exp, opt_msg || `${act} != ${exp}`);
    if (act == exp) resolve(act);
    reject(opt_msg || `${act} != ${exp}`);
  });
};


const tests = {
  testConstantOne(pass, fail) {
    promice.one('foo', 42);
    promice.run((foo) => assertEqual(foo, 42)).then(pass, fail);
  },
  testConstantEachIsInvalid(pass, fail) {
    new Promise((resolve) => {
      promice.each('foo', 22);
      resolve();
    }).then(fail, pass);
  },
  testContexts(pass, fail) {
    const context = Symbol('context test')
    promice.one('foo', function() {
      assertEqual(this, context, 'inject context was wrong').catch(fail);
      return function(resolve) {
        assertEqual(this, context, 'promise context was wrong').then(resolve, fail);
      };
    }, context);
    promice.run(function(foo) {
      return assertEqual(this, context, 'run context was wrong');
    }, context).then(pass, fail);
  },
  testOne(pass, fail) {
    let i = 0;
    promice.one('foo', () => (resolve) => resolve(++i))
    promice
      .run((foo) => assertEqual(foo, 1))
      .then(() => promice.run((foo) => assertEqual(foo, 1)))
      .then(() => promice.run((foo) => assertEqual(foo, 1)))
      .then(() => promice.run((foo) => assertEqual(foo, 1)))
      .then(pass, fail);
  },
  testEach(pass, fail) {
    let i = 0;
    promice.each('foo', () => (resolve) => resolve(++i));
    promice
      .run((foo) => assertEqual(foo, 1))
      .then(() => promice.run((foo) => assertEqual(foo, 2)))
      .then(() => promice.run((foo) => assertEqual(foo, 3)))
      .then(() => promice.run((foo) => assertEqual(foo, 4)))
      .then(pass, fail);
  },
  testLagged(pass, fail) {
    promice.one('foo', () => (_, reject) => reject('I failed'));
    promice
      .run((lags_foo) => assertEqual(lags_foo[promice.rejected], true))
      .then(pass, fail);
  },
  testLazy(pass, fail) {
    promice.one('foo', () => (resolve) => resolve(42));
    promice
      .run((lazy_foo) => lazy_foo())
      .then((foo) => assertEqual(foo, 42))
      .then(pass, fail);
  },
  testPrepped(pass, fail) {
    let i = 0;
    promice.each('foo', () => (resolve) => resolve(i));
    const prepped = promice.prepped((foo) => assertEqual(foo, 0));
    prepped().then(() => ++i).then(prepped).then(pass, fail);
  },
  testEvery(pass, fail) {
    let i = 0;
    promice.each('foo', () => (resolve) => resolve(i));
    const prepped = promice.every((foo) => assertEqual(foo, i));
    prepped().then(() => ++i).then(prepped).then(pass, fail);
  },
};


const testDeps = [];
for (const test in tests) {
  if (!test.startsWith('test')) continue;
  testDeps.push(test);
}

// Allow 1 second for all tests to execute:
setTimeout(() => {
  assertEqual(0, testDeps.length, `${testDeps.length} test(s) did not finish.`);
}, 1000);

const popTest = () => {
  const test = testDeps.pop();
  if (!test) return;
  promice.testing.stash();
  promice.one(test, () => tests[test]);
  promice
    .get(test)
    .then(
        () => console.log(`[OK] %s`, test),
        (reason) => console.error(`[!!] %s %s`, test, reason ? reason.toString() : ''))
    .then(popTest);
};
popTest();
