# redux-actions-sequences
Make sequences of redux actions trigger a new action

## Install

```
$ npm install --save redux-actions-sequences
```

or

```
$ yarn add redux-actions-sequences
```

## Usage:

1. Register default export as a middleware:

```
// Imports:
import sequential from 'redux-actions-sequences';

// Register middleware:

const middleware = [ sequential, thunk /* ... */ ];

const createStoreWithMiddleware =
    applyMiddleware(...middleware)(createStore);

const store = createStoreWithMiddleware(reducer, initialState);

```

2. Create action sequences with these shorthands:

```
// Imports:

import { fireOnSequence, SEQ } from 'redux-actions-sequences';

// Create sequences

export const sequence1 = fireOnSequence(appLoaded.bind(null, 'seq1'), [
  appLoading,
  appLoadingPulse,
  appLoadingPulse,
  appLoadingPulse,
  appLoadingPulse,
  appLoadingPulse,
  appLoadingPulse,
  appLoadingPulse
], { once: true });

export const sequence2 = fireOnSequence(appLoaded.bind(null, 'seq2'),
  SEQ.SEQUENCE([
    appLoading,
    SEQ.TIMES(appLoadingPulse, 7)]), { once: true });

export const sequence3 = fireOnSequence(appLoaded.bind(null, 'seq3'), SEQ.ALL(
  [ appLoading,
    SEQ.TIMES(appLoadingPulse, 7),
    fetchSets
  ]), { once: true });

export const sequence4 = fireOnSequence(appLoaded.bind(null, 'seq4'), SEQ.ANY(
  [fetchSets,
    appLoaded]
), { once: true });

// Start using them with dispatch():
```


### Dependencies:

Works along with these packages:

* "redux": "^3.6.0",
* "redux-actions": "^0.12.0",
* "redux-thunk": "^2.1.0"