# redux-actions-sequences

[![NPM](https://nodei.co/npm/redux-actions-sequences.png?downloads=true&stars=true)](https://nodei.co/npm/redux-actions-sequences/)

`redux-actions-sequences` is a library that that makes defined sequences of redux actions trigger a new action. Sequence can be comprised of a single action (`SINGLE`, `EXACT`), a series of the same action repeated n times (`TIMES`), an order-dependent series of actions (`QUEUE`), order-indenendent (`ALL`), at just one of the given list (`ANY`), or their superposition.

## Installation

```bash
$ npm install --save redux-actions-sequences
```

or

```bash
$ yarn add redux-actions-sequences
```

## Usage

### Register default export as a middleware:

```js

// Imports:
import sequential from 'redux-actions-sequences';
import thunk from 'redux-thunk';

// Register middleware:

const middleware = [ sequential, thunk /* ... */ ];

const createStoreWithMiddleware =
    applyMiddleware(...middleware)(createStore);

const store = createStoreWithMiddleware(reducer, initialState);

```

### Create action sequences with these shorthands:


```js

// Imports:

import { dispatchActionWhen } from 'redux-actions-sequences';

// may use 'redux-actions' to streamline action creation
// such action creators can be toString()-ed to get their type
// redux-actions-sequences accepts both strings (as action types), 
// FSA-actions, and FSA-action creators:
import { createAction } from 'redux-actions';

// Actions to wait for:
const appLoading = 'APP_LOADING'; // createAction('APP_LOADING');
const appLoaded = { type: 'APP_LOADED' }; //  createAction('APP_LOADED');
const appLoadingPulse = createAction('APP_PULSE');
const fetchSets = createAction('FETCH_SETS');

// Actions to dispatch if sequences are met:
const actionOne = 'ACTION_ONE';
const actionTwo = { type: 'ACTION_TWO' };
const actionThree = createAction('ACTION_THREE');

// Thinked action (receives unregister() callback to control further
// occurences)
const actionFour = (unregister) => (dispatch, getState) => {
  const starsAreRight = Math.random() < .5; // or getState()... something
  if (starsAreRight) {
    unregister();
    dispatch(actionThree());
  }
};

const actionFive = createAction('ACTION_FIVE');


// Create sequences: 

// sequence1 is a thunked action (consumable by redux-thunk middleware)
// it says that actionOne will get dispatched each time the `redux-actions-sequences`
// detects that these actions have been fired in this order (QUEUE),
// once detected and actionOne dispatched, this sequence will self-destruct
// thanks to flag ('once' === true), no further actions that match the 
// sequence will be looked for.
export const sequence1 = dispatchActionWhen(actionOne, S => 
  S.QUEUE([
    appLoading,
    appLoadingPulse,
    appLoadingPulse,
    appLoadingPulse,
    appLoadingPulse,
    appLoadingPulse,
    appLoadingPulse,
    appLoadingPulse
  ]), { once: true });

// previous example is equivalent to this one. 7 identical actions can be
// repaced by a TIMES(..) sequence, which in turn, may be treated as 
// another action we expect to happen
export const sequence2 = dispatchActionWhen(actionOne, S =>
  S.QUEUE([
    appLoading,
    S.TIMES(appLoadingPulse, 7)
  ]), { once: true });

// actionTwo will only get dispatched when all three of these
// get to be dispatched: appLoading, appLoadingPulse - 7 times, fetchSets
// irrelevant of their order. Then the sequence3 gets rewound
export const sequence3 = dispatchActionWhen(actionTwo, S => 
  S.ALL([
    appLoading,
    S.TIMES(appLoadingPulse, 7),
    fetchSets
  ]));

// will execute until unregister() in thunked action is called
export const sequence4 = dispatchActionWhen(actionFour, S => 
  S.ANY([
    fetchSets,
    appLoaded
  ]));
  
export const sequence5 = dispatchActionWhen(actionFive, S => 
  S.EXACT({
    type: 'DATA_FETCH',
    payload: S.PRESENT,
    error: S.FALSEY,
    meta: S.MISSING
  })
);

// Start using them by wrapping in a dispatch() call:
// Elsewhere:

dispatch(sequence2); // effect is the same as dispatch(sequence1) 

dispatch(sequence3); // will eventually dispatch actionTwo, and stop
 
dispatch(sequence4); // will eventually dispatch thunked actionFour

// dispatch actions the sequence depends on: appLoading, appLoadingPulse, fetchSets, appLoaded

```

### Dependencies:

Works along with these packages:

* "redux": "^3.6.0",
* "redux-thunk": "^2.1.0"
* "redux-actions": "^0.12.0",


## See also

- [redux-actions](https://github.com/acdlite/redux-actions) - FSA-compliant action creators
- [redux-promise](https://github.com/acdlite/redux-promise) - Promise middleware

## Contributing

Please use the [issues page](https://github.com/AndrewRevinsky/redux-actions-sequences/issues) to report a bug or request a feature.


## Stay in Touch

* [Twitter](https://twitter.com/andrevinsky)

## License

[MIT](LICENSE)

## Author

Andrew Revinsky