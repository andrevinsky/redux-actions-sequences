
/**
 * Created by andrew on 10/13/16.
 */
/**
 * Schedules actions with { meta: { delay: N } } to be delayed by N milliseconds.
 * Makes `dispatch` return a function to cancel the timeout in this case.
 */
// @flow
import { isFSA } from 'flux-standard-action';
import invariant from 'invariant';

import check from './type';

const symTag = Symbol('SEQ');
const symRegistryId = Symbol('registry');
const symOnce = Symbol('once');

const symNext  = Symbol('next');
const symRestart = Symbol('restart');

const symRequired = Symbol('required');
const symEmpty = Symbol('empty');
const symTruthy = Symbol('truthy');
const symFalsey = Symbol('falsey');

const registry = {};
let sequences = [];

function register(fn, action) {
  const id = Math.random().toString().substr(2);
  fn[symRegistryId] = id;

  sequences.push(fn);

  registry[id] = {
    unregister: () => {
      const idx = sequences.indexOf(fn);
      if (idx >= 0) {
        return sequences.splice(idx, 1);
      }
      delete registry[id];
    },
    action
  };

  return fn;
}

function unregister(fn) {
  const registryId = fn[symRegistryId];
  if (registryId) {
    if (registry[registryId]) {
      registry[registryId].unregister();
    } else {
      delete registry[registryId];
    }
    delete fn[symRegistryId];
  }
  return fn;
}

function getAction(fn) {
  const registryId = fn[symRegistryId];
  if (registryId) {
    if (registry[registryId]) {
      return registry[registryId].action;
    }
  }
}

function isTagged(input) {
  return !!input[symTag];
}
function tag(input, description) {
  if (check.isUndefined(description)) {
    return input[symTag];
  } else {
    input[symTag] = description;
    return input;
  }
}
function tokenToString() {
  return this[symTag];
}
function isOnce(fn) {
  return fn[symOnce];
}
function setOnce(fn) {
  fn[symOnce] = true;
  return fn;
}

/**
 * Internal utility function that wraps result function
 * @param fn
 * @param tokenDescription
 * @param replacement
 * @returns {*}
 */
function tagResultFunction(fn, tokenDescription, replacement) {
  const description = tag(fn);
  if (description) {
    tag(fn, description.replace(tokenDescription, replacement));
  } else {
    tag(fn, tokenDescription);
  }
  fn.toString = tokenToString;
  return fn;
}

function restart(tokens)  {
  tokens.forEach(t => t(symRestart));
}

function compare(template, obj) {
  if (check.isObject(template) && check.isObject(obj)) {
    return Object.keys(template).reduce((m, key) => {
      return m && compare(template[key], obj[key]);
    }, true);
  } else {
    switch (template) {
      case symEmpty:
        return check.isUndefined(obj);
      case symRequired:
        return !check.isUndefined(obj);
      case symTruthy:
        return !!obj;
      case symFalsey:
        return !obj;
      default:
        return template === obj;
    }
  }
}

const single = (token) => {
  invariant(token, 'Token expected for <SINGLE>');

  let tokenStr = null;

  if (check.isArray(token)) {
    return queue(token);
  }

  switch (typeof token) {
    case 'string':
      tokenStr = token;
      break;

    case 'function':
      if (isTagged(token)) {
        return token;
      }
      tokenStr = token.toString();
      break;

    case 'object': {
      if (check.isString(token.type) && (Object.keys(token).length == 1)) {
        tokenStr = token.type;
      } else {
        return exact(token);
      }
      break;
    }
  }

  invariant(tokenStr, 'Token invalid type for <SINGLE>');

  return tagResultFunction(
    a => (a !== symRestart) && ( (a.type == tokenStr) ? symNext : false),
    '<SINGLE>:(' + tokenStr + ')'
  );
};

/**
 * exactObjectSequenceCreator
 * @param token
 * @returns {*}
 */
const exact = (token) => {
  invariant(token && check.isObject(token), 'Token of plain object type expected for <EXACT>');

  return tagResultFunction(
    a => (a !== symRestart) && ( compare(token, a) ? symNext : false),
    '<SINGLE>:(' + JSON.stringify(token) + ')'
  );
};

const once = (token) => {
  const normalizedToken = single(token);
  return tagResultFunction(
    setOnce(a => normalizedToken(a)),
    '<ONCE>:(' + normalizedToken.toString() + ')'
  );
};

const times = (token, times, { strict } = {}) => {
  invariant(token, 'Token expected for <TIMES>');

  const normalizedToken = single(token);
  const tokenDescription = '<TIMES>:(' + normalizedToken.toString() + ' x ' + times + ')';

  let count = 0;
  const result = (a) => {
    if (a === symRestart) {
      count = 0;
      normalizedToken(symRestart);
      return false;
    }
    const result = normalizedToken(a);
    if (result === true) {
      return true;
    }

    if (result === symNext) {
      count = ++count % times;
      if (count === 0) {
        return symNext;
      } else {
        return true;
      }
    }

    if (strict) {
      count = 0;
      normalizedToken(symRestart);
      return false;
    }
    return true;
  };

  return tagResultFunction(result, tokenDescription);
};

const timesStrict = (token, times) => {
  invariant(token, 'Token expected for <TIMES_STRICT>');

  return tagResultFunction(
    times(token, times, { strict: true }),
    '<TIMES>', '<TIMES_STRICT>');
};

const all = (tokens, { strict } = {}) => {
  invariant(tokens && tokens.length, 'Tokens expected for <ALL>');

  const normalizedTokens = tokens.map(single);
  const tokenDescription =  '<ALL>:(' + normalizedTokens.map(t => t.toString()).join() + ')';

  let results = normalizedTokens.map(t => false);
  const length = normalizedTokens.length;

  const result = (a) => {
    if (a === symRestart) {
      results = normalizedTokens.map(t => false);
      restart(normalizedTokens);
      return false;
    }

    const nextResults = normalizedTokens.map((t, k) => {
      const result = t(a);

      if (result === symNext) {
        return symNext;
      }
      return results[k];
    }, results);

    const nextResultsReadyCount = nextResults.filter(i => i === symNext).length;
    if (nextResultsReadyCount === length) {
      results = normalizedTokens.map(t => false);
      restart(normalizedTokens);
      return symNext;
    } else if (strict && (nextResultsReadyCount - results.length !== 1)) {
      restart(normalizedTokens);
      return false;
    }

    results = nextResults;
    return true;
  };
  return tagResultFunction(result, tokenDescription);
};

const any = (tokens, { strict } = {}) => {
  invariant(tokens && tokens.length, 'Tokens expected for <ANY>');

  const normalizedTokens = tokens.map(single);
  const tokenDescription =  '<ANY>:(' + normalizedTokens.map(t => t.toString()).join() + ')';

  const result = (a) => {
    if (a === symRestart) {
      restart(normalizedTokens);
      return false;
    }
    if (normalizedTokens.filter(t => t(a) === symNext).length) {
      restart(normalizedTokens);
      return symNext;
    }
    if (strict) {
      restart(normalizedTokens);
      return false;
    }
    return true;
  };
  return tagResultFunction(result, tokenDescription);
};

const queue = (tokens, { strict } = {}) => {
  invariant(tokens && tokens.length, 'Tokens expected for <QUEUE>');

  const normalizedTokens = tokens.map(single);
  const tokenDescription =  '<QUEUE>:(' + normalizedTokens.map(t => t.toString()).join() + ')';

  const length = normalizedTokens.length;
  let count = 0;

  const result = (a) => {
    if (a === symRestart) {
      count = 0;
      restart(normalizedTokens);
      return false;
    }
    const result = normalizedTokens[count](a);
    if (result === true) {
      return true;
    }

    if (result === symNext) {
      count = ++count % length;

      if (count === 0) {
        restart(normalizedTokens);
        return symNext;
      } else {
        return true;
      }
    }

    if (strict) {
      count = 0;
      restart(normalizedTokens);
      return false;
    }
    return true;
  };
  return tagResultFunction(result, tokenDescription);
};

const queueStrict = (tokens) => {
  invariant(tokens && tokens.length, 'Tokens expected for <QUEUE_STRICT>');

  return tagResultFunction(
    queue(tokens, { strict: true }),
    '<QUEUE>', '<QUEUE_STRICT>');
};

const sequenceApi = {
  /**
   * @deprecated
   */
  SINGLE: single,
  single,
  /**
   * @deprecated
   */
  EXACT: exact,
  exact,
  /**
   * @deprecated
   */
  ONCE: once,
  once,
  /**
   * @deprecated
   */
  TIMES: times,
  times,
  /**
   * @deprecated
   */
  TIMES_STRICT: timesStrict,
  timesStrict,
  /**
   * @deprecated
   */
  ALL: all,
  all,
  /**
   * @deprecated
   */
  ANY: any,
  any,
  /**
   * @deprecated
   */
  SEQUENCE: queue,
  /**
   * @deprecated
   */
  QUEUE: queue,
  queue,
  /**
   * @deprecated
   */
  SEQUENCE_STRICT: queueStrict,
  QUEUE_STRICT: queueStrict,
  /**
   * @deprecated
   */
  queueStrict,

  PRESENT: symRequired,
  MISSING: symEmpty,
  TRUTHY: symTruthy,
  FALSEY: symFalsey

};

/**
 * @deprecated: use 'sequenceBuilderCb(s => ...) 'callback in 'dispatchWhen'
 * @type {{SINGLE: single, TIMES: times, TIMES_STRICT: timesStrict, ALL: all, ANY: any, SEQUENCE: queue, QUEUE: queue, SEQUENCE_STRICT: queueStrict, QUEUE_STRICT: queueStrict}}
 */
export const SEQ = sequenceApi;

export const dispatchActionWhen = (action, sequenceBuilderCb) => {
  // let once = (opts && opts.once);
  const sequenceRaw = sequenceBuilderCb(sequenceApi);
  const sequence = single(sequenceRaw);

  invariant(sequence && check.isFunction(sequence),
    'dispatchActionWhen expects *Sequence Builder* to return compiled sequence (a function)');

  return dispatch => register(sequence, action, dispatch);

};

/**
 * @deprecated: use dispatchWhen
 * @param action
 * @param sequence
 * @param once
 * @returns {function(*)}
 */
export const fireOnSequence = (action , sequence , {
  once
}) => {
  return dispatchActionWhen(action, single(sequence));
};

export const clearAll = () => {
  sequences = [];
};

/**
 * Redux middleware to support redux-actions-sequences
 */
export default store => next => action => {
  const result = next(action);

  if (sequences.length && isFSA(action)) {
    const triggered = [...sequences].filter(s => s(action) === symNext);
    const unreg = triggered.map(sequence => {
      const action = getAction(sequence);
      let isUnregistered = false;

      let unregisterFn = () => {
        unregister(sequence);
        isUnregistered = true;
      };

      if (check.isFunction(action)) {
        store.dispatch(action(unregisterFn));
      } else if (check.isString(action)) {
        const seqKey = ('Sequence: ' + sequence.toString() + ' => ' + ((action.type : string) || action.toString()));
        store.dispatch({
          type: action,
          payload: seqKey,
          meta: {
            sequence: unregisterFn
          }
        })
      } else {
        store.dispatch(action);
      }

      return isUnregistered ? null : (isOnce(sequence) ? sequence : null) ;
    }).filter(s => s).map(unregister);
    // console.log(unreg);
  }

  return result;
};