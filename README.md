# redux-actions-sequences
Make sequences of redux actions trigger a new action

## Install

```bash
$ npm install --save redux-actions-sequences
```

or

```bash
$ yarn add redux-actions-sequences
```

## Usage:

1. Register default export as a middleware:

```javascript

// Imports:
import thunk from 'redux-thunk';
import sequential from 'redux-actions-sequences';

// Register middleware:

const middleware = [ sequential, thunk /* ... */ ];

const createStoreWithMiddleware =
    applyMiddleware(...middleware)(createStore);

const store = createStoreWithMiddleware(reducer, initialState);

```

2. Create action sequences with these shorthands:


```javascript

// Imports:

import { createAction } from 'redux-actions';
import { dispatchActionWhen } from 'redux-actions-sequences';

const appLoading = createAction('APP_LOADING');
const appLoaded = createAction('APP_LOADED');
const appLoadingPulse = createAction('APP_PULSE');
const fetchSets = createAction('FETCH_SETS');


const actionOne = createAction('ACTION_ONE');
const actionTwo = createAction('ACTION_TWO');
const actionThree = (unregister) => (dispatch, getState) => {
  const starsAreRight = Math.random() < .5; // or getState()... something
  if (starsAreRight) {
    unregister();
    dispatch(actionFour());
  }
};
const actionFour = createAction('ACTION_FOUR');


// Create sequences

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

// previous example is equivalent to this:
export const sequence2 = dispatchActionWhen(actionOne, SEQ =>
  SEQ.SEQUENCE([
    appLoading,
    SEQ.TIMES(appLoadingPulse, 7)
  ]), { once: true });

export const sequence3 = dispatchActionWhen(actionTwo, SEQ => 
  SEQ.ALL([
    appLoading,
    SEQ.TIMES(appLoadingPulse, 7),
    fetchSets
  ]), { once: true });

// will execute until unregister() in thunked action is called
export const sequence4 = dispatchActionWhen(actionThree, SEQ => 
  SEQ.ANY([
    fetchSets,
    appLoaded
  ]));

// Start using them with dispatch():
// Elsewhere:

dispatch(sequence2); // effect is the same as dispatch(sequence1) 

dispatch(sequence3); // will eventually dispatch actionTwo, and stop
 
dispatch(sequence4); // will eventually dispatch thunked actionThree 

// dispatch actions the sequence depends on: appLoading, appLoadingPulse, fetchSets, appLoaded

```


### Dependencies:

Works along with these packages:

* "redux": "^3.6.0",
* "redux-actions": "^0.12.0",
* "redux-thunk": "^2.1.0"