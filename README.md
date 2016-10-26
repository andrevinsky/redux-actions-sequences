# redux-actions-sequences
Make sequences of redux actions trigger a new action

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

```javascript

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


```javascript

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

// Start using them by wrapping in a dispatch() call:
// Elsewhere:

dispatch(sequence2); // effect is the same as dispatch(sequence1) 

dispatch(sequence3); // will eventually dispatch actionTwo, and stop
 
dispatch(sequence4); // will eventually dispatch thunked actionFour

// dispatch actions the sequence depends on: appLoading, appLoadingPulse, fetchSets, appLoaded

```

### Participate

Your input to this library is welcome. Please participate.


### Dependencies:

Works along with these packages:

* "redux": "^3.6.0",
* "redux-actions": "^0.12.0",
* "redux-thunk": "^2.1.0"