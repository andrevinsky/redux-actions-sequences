
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

const localNS : Symbol = Symbol('SEQ');
const symNext : Symbol = Symbol('next');
const symRestart : Symbol = Symbol('restart');
const symRequired : Symbol = Symbol('required');
const symEmpty : Symbol = Symbol('empty');
const symTruthy : Symbol = Symbol('truthy');
const symFalsey : Symbol = Symbol('falsey');

type tokenType = string | { toString : () => string } | { type: string } | RunnableSequenceFnType;
type tokenListType = Array<tokenType>;
type internalTokenType = RunnableSequenceFnType;
type internalTokenListType = Array<internalTokenType>;
type optionsType = { strict? : boolean };
type singleOptionsType = { exact? : boolean } ;

type deprecatedSequenceInputType = tokenType | tokenListType;

type dispatchedOptionsType = { once? : boolean }

type SequenceRunResultType = boolean | Symbol;
type FSALightType = Symbol | string | { type: string };
type FSAOrFSACreatorType = FSALightType | ({ (...rest: Array<void>) : FSALightType });

type RunnableSequenceFnType = {(action : FSAOrFSACreatorType) : SequenceRunResultType; toString: (x: void) => string; tag: Symbol};

type singleSequenceMakerType = (token : tokenType) => RunnableSequenceFnType;
type singleExactSequenceMakerType = (token : Object) => RunnableSequenceFnType;
type timesSequenceMakerType = (token : tokenType, times: number, opts? : optionsType) => RunnableSequenceFnType;
type timesStrictSequenceMakerType = (token : tokenType, times: number) => RunnableSequenceFnType;
type multiSequenceMakerType = (tokens : tokenListType, opts? : optionsType) => RunnableSequenceFnType;
type multiStrictSequenceMakerType = (tokens : tokenListType) => RunnableSequenceFnType;

type sequenceMakingApiType = {
  SINGLE: singleSequenceMakerType,
  TIMES: timesSequenceMakerType,
  TIMES_STRICT: timesStrictSequenceMakerType,
  ALL: multiSequenceMakerType,
  ANY: multiSequenceMakerType,
  QUEUE: multiSequenceMakerType,
  QUEUE_STRICT: multiStrictSequenceMakerType,
  /**
   * @deprecated
   */
  SEQUENCE: multiSequenceMakerType,
  /**
   * @deprecated
   */
  SEQUENCE_STRICT: multiStrictSequenceMakerType,

  PRESENT: Symbol,
  MISSING: Symbol,
  TRUTHY: Symbol,
  FALSEY: Symbol
};

type sequenceBuilderCallbackType = (x: sequenceMakingApiType) => RunnableSequenceFnType;

type middlewareType = (store : any) => ((next : any) => ((action : any ) => any));

type thunkedAction = (dispatch : Function, getState? : Function) => any;

/**
 * Internal utility function that wraps result function
 * @param fn
 * @param tokenDescription
 * @param replacement
 * @returns {*}
 */
function tagResultFunction(fn, tokenDescription: string, replacement? : string) : internalTokenType {
  fn.tag = localNS;
  if (replacement) {
    tokenDescription = fn.toString().replace(tokenDescription, replacement)
  }
  fn.toString = () => tokenDescription;
  return fn;
}

function restart(tokens : internalTokenListType) : void {
  tokens.forEach(t => t(symRestart));
}

function compare(template: any, obj: any) : boolean {
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

const singleSequenceCreator : singleSequenceMakerType = (token, { exact } : singleOptionsType = {} ) : internalTokenType => {
  invariant(token, 'Token expected for <SINGLE>');

  let tokenStr = null;

  switch (typeof token) {
    case 'string':
      tokenStr = token;
      break;

    case 'function':
      if ((token.tag === localNS)) {
        return token;
      }
      tokenStr = token.toString();
      break;

    case 'object': {
        if (exact) {
          return exactObjectSequenceCreator(token);
        } else if (check.isString(token.type)) {
          tokenStr = token.type;
        }
      }
      break;
  }

  invariant(tokenStr, 'Token invalid type for <SINGLE>');

  const result = a => (a !== symRestart) && ( (a.type == tokenStr) ? symNext : false);
  const tokenDescription = '<SINGLE>:(' + tokenStr + ')';
  return tagResultFunction(result, tokenDescription);
};

const singleExactSequenceCreator : singleExactSequenceMakerType = (token: tokenType) : internalTokenType => {
  invariant(token && check.isObject(token), 'Token of plain object type expected for <EXACT>');

  return exactObjectSequenceCreator(token);
};

const exactObjectSequenceCreator : singleExactSequenceMakerType = (token) : internalTokenType => {
  const result = a => (a !== symRestart) && ( compare(token, a) ? symNext : false);
  const tokenDescription = '<SINGLE>:(' + JSON.stringify(token) + ')';
  return tagResultFunction(result, tokenDescription);
};

const timesSequenceCreator : timesSequenceMakerType = (token, times, { strict } = {}) : internalTokenType => {
  invariant(token, 'Token expected for <TIMES>');

  const normalizedToken = singleSequenceCreator(token);
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

const timesStrictSequenceCreator : timesStrictSequenceMakerType = (token, times) : internalTokenType => {
  invariant(token, 'Token expected for <TIMES_STRICT>');

  return tagResultFunction(
    timesSequenceCreator(token, times, { strict: true }),
    '<TIMES>', '<TIMES_STRICT>');
};

const allSequenceCreator : multiSequenceMakerType = (tokens, { strict } = {}) : internalTokenType => {
  invariant(tokens && tokens.length, 'Tokens expected for <ALL>');

  const normalizedTokens = tokens.map(singleSequenceCreator);
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

const anySequenceCreator : multiSequenceMakerType = (tokens, { strict } = {}) : internalTokenType => {
  invariant(tokens && tokens.length, 'Tokens expected for <ANY>');

  const normalizedTokens = tokens.map(singleSequenceCreator);
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

const queueSequenceCreator : multiSequenceMakerType = (tokens, { strict } = {}) : internalTokenType => {
  invariant(tokens && tokens.length, 'Tokens expected for <QUEUE>');

  const normalizedTokens = tokens.map(singleSequenceCreator);
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

const queueStrictSequenceCreator : multiStrictSequenceMakerType = (tokens) : internalTokenType => {
  invariant(tokens && tokens.length, 'Tokens expected for <QUEUE_STRICT>');

  return tagResultFunction(
    queueSequenceCreator(tokens, { strict: true }),
    '<QUEUE>', '<QUEUE_STRICT>');
};

const sequenceApi : sequenceMakingApiType = {

  SINGLE: singleSequenceCreator,
  EXACT: singleExactSequenceCreator,
  TIMES: timesSequenceCreator,
  TIMES_STRICT: timesStrictSequenceCreator,
  ALL: allSequenceCreator,
  ANY: anySequenceCreator,
  /**
   * @deprecated
   */
  SEQUENCE: queueSequenceCreator,
  QUEUE: queueSequenceCreator,
  /**
   * @deprecated
   */
  SEQUENCE_STRICT: queueStrictSequenceCreator,
  QUEUE_STRICT: queueStrictSequenceCreator,

  PRESENT: symRequired,
  MISSING: symEmpty,
  TRUTHY: symTruthy,
  FALSEY: symFalsey
};

/**
 * @deprecated: use 'sequenceBuilderCb(s => ...) 'callback in 'dispatchWhen'
 * @type {{SINGLE: singleSequenceCreator, TIMES: timesSequenceCreator, TIMES_STRICT: timesStrictSequenceCreator, ALL: allSequenceCreator, ANY: anySequenceCreator, SEQUENCE: queueSequenceCreator, QUEUE: queueSequenceCreator, SEQUENCE_STRICT: queueStrictSequenceCreator, QUEUE_STRICT: queueStrictSequenceCreator}}
 */
export const SEQ : sequenceMakingApiType = sequenceApi;

let sequences = [];

const registerSequence = (fn) => {

  sequences.push(fn);

  // unregister
  return () => {
    const idx = sequences.indexOf(fn);
    if (idx >= 0) {
      return sequences.splice(idx, 1);
    }
  }
};

export const dispatchActionWhen = (action : FSAOrFSACreatorType, sequenceBuilderCb : sequenceBuilderCallbackType, { once } : dispatchedOptionsType = {}) : thunkedAction => {
  return dispatch => {
    const sequenceRaw = sequenceBuilderCb(sequenceApi);
    let sequence = null;
    if (check.isArray(sequenceRaw)) {
      sequence = queueSequenceCreator(sequenceRaw);
      once = true;
    } else if (check.isObject(sequenceRaw)) {
      sequence = singleSequenceCreator(sequenceRaw);
      once = true;
    } else {
      sequence = singleSequenceCreator(sequenceRaw);
    }

    invariant(sequence && check.isFunction(sequence), 'dispatchWhen expects sequenceBuilderCb to return compiled sequence (function)');

    const seqKey = ('Sequence: ' + sequence.toString() + ' => ' + ((action.type : string) || action.toString()));

    let unregister = registerSequence(a => {

      const result = sequence(a);
      if (result !== symNext) {
        return;
      }

      // console.log(seqKey + ': RESOLVED');

      let unregisterFn = () => {
        unregister && unregister();
        unregister = null;
      };

      if (!once) {
        sequence(symRestart);
      }

      if (check.isFunction(action)) {
        dispatch(action(unregisterFn));
      } else if (check.isString(action)) {
        dispatch({
          type: action,
          payload: seqKey,
          meta: {
            sequence: unregisterFn
          }
        })
      } else {
        dispatch(action);
      }

      if (once && unregister) {
        unregisterFn();
        unregisterFn = null;
      }

    })

  }
};

/**
 * @deprecated: use dispatchWhen
 * @param action
 * @param sequence
 * @param once
 * @returns {function(*)}
 */
export const fireOnSequence = (action : FSAOrFSACreatorType, sequence : deprecatedSequenceInputType, {
  once
} : dispatchedOptionsType) : thunkedAction => {
  return dispatchActionWhen(action, () => check.isArray(sequence) ? queueSequenceCreator(sequence) : singleSequenceCreator(sequence), { once });
};

export default (store => next => action => {
  const result = next(action);

  if (sequences.length && isFSA(action)) {
    sequences.forEach(s => s(action));
  }

  return result;
} : middlewareType);