# redux-actions-sequences

[![NPM](https://nodei.co/npm/redux-actions-sequences.png?downloads=true&stars=true)](https://nodei.co/npm/redux-actions-sequences/)

`redux-actions-sequences` is a library that that makes defined sequences of redux actions trigger a new action. Sequence can be comprised of a single action (`simple`, `exact`), a series of the same action repeated n times (`times`, `timesStrict`), an order-dependent series of actions (`queue`, `queueStrict`), order-indenendent (`all`), just one of from the given list (`any`), or their superposition. 

Elemental block of the sequence description is an instance of a FSA-compliant action, an action creator function (by `redux-actions`), a string that represents the type of an action, or an exact object-based description of the action (if used with `exact`; four wildcard values are provided for this case: `present`/ `missing`, `truthy`/`falsey` to better describe an expected action's properties). Or just another sequence. Which means, sequence definitions can be nested.

Sequences are built using a helper object lent in a callback inside a `dispatchActionWhen` call. See examples below.


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

### Define action sequences:

#### These lines will be referred to in the examples:

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
const reactionOne = 'REACTION_ONE';
const reactionTwo = { type: 'REACTION_TWO' };
const reactionThree = createAction('REACTION_THREE');

// Thinked action (receives unregister() callback to control further
// occurences)
const actionFour = (unregister) => (dispatch, getState) => {
  const starsAreRight = Math.random() < .5; // or getState()... something
  if (starsAreRight) {
    unregister();
    dispatch(reactionThree());
  }
};

const actionFive = createAction('ACTION_FIVE');

```


```javascript

// Create sequences: 

// sequence1 is a thunked action (consumable by redux-thunk middleware)
// it says that reactionOne will get dispatched each time the `redux-actions-sequences`
// detects that these actions have been fired in this order (queue),
// once detected and reactionOne dispatched, this sequence will self-destruct
// thanks to flag ('once' === true), no further actions that match the 
// sequence will be looked for.
export const sequence1 = dispatchActionWhen(reactionOne, ({
      once, queue
    }) => once(queue([
      appLoading, // a string, action's type
      appLoadingPulse, // several identical actions to wait for
      appLoadingPulse,
      appLoadingPulse,
      appLoadingPulse,
      appLoadingPulse,
      appLoadingPulse,
      appLoadingPulse
    ])));

// previous example is equivalent to this one. 7 identical actions can be
// repaced by a TIMES(..) sequence, which in turn, may be treated as 
// another action we expect to happen
export const sequence2 = dispatchActionWhen(reactionOne, ({
  once, queue, times, simple
}) => once(queue([
  simple(appLoading),
  times(appLoadingPulse, 7)
])));

// reactionTwo will only get dispatched when all three of these
// get to be dispatched: appLoading, appLoadingPulse - 7 times, fetchSets
// irrelevant of their order. Then the sequence3 gets rewound
export const sequence3 = dispatchActionWhen(reactionTwo, ({
  all, simple, times
}) => 
  all([
    simple(appLoading),
    times(appLoadingPulse, 7),
    simple(fetchSets)
  ]));

// will execute until unregister() in thunked action is called
export const sequence4 = dispatchActionWhen(actionFour, ({ any }) =>
  any([
    fetchSets,
    appLoaded
  ]));
  
export const sequence5 = dispatchActionWhen(actionFive, ({ 
    exact, present, missing, truthy, falsey 
  }) => exact({
      type: 'DATA_FETCH',
      payload: present,
      error: falsey,
      meta: missing
    })
  );

```

Defined sequences are not active until they are dispatched:

```javascript
// Start using them by wrapping in a dispatch() call:
// Elsewhere:

const unregSequence2 = dispatch(sequence2); // effect is the same as dispatch(sequence1) 

const unregSequence3 = dispatch(sequence3); // will eventually dispatch reactionTwo, and stop
 
const unregSequence4 = dispatch(sequence4); // will eventually dispatch thunked actionFour


```

The result of dispatching is a function to unregister the sequence:

```javascript
unregSequence2();
unregSequence3();
unregSequence4();

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