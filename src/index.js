
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

const localNS : Symbol = Symbol('SEQ');
const symNext : Symbol = Symbol('next');
const symRestart : Symbol = Symbol('restart');

type tokenType = string | { toString : () => string } | { type: string } | RunnableSequenceFnType;
type tokenListType = Array<tokenType>;
type internalTokenType = RunnableSequenceFnType;
type internalTokenListType = Array<internalTokenType>;
type optionsType = { strict? : boolean };

type deprecatedSequenceInputType = tokenType | tokenListType;

type dispatchedOptionsType = { once? : boolean }

type SequenceRunResultType = boolean | Symbol;
type FSALightType = Symbol | { type: string };
type FSAOrFSACreatorType = FSALightType | ({ (...rest: Array<void>) : FSALightType });

type RunnableSequenceFnType = {(action : FSAOrFSACreatorType) : SequenceRunResultType; toString: (x: void) => string; tag: Symbol};

type singleSequenceMakerType = (token : tokenType) => RunnableSequenceFnType;
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
  SEQUENCE_STRICT: multiStrictSequenceMakerType
};

type sequenceBuilderCallbackType = (x: sequenceMakingApiType) => RunnableSequenceFnType;

type middlewareType = (store : any) => ((next : any) => ((action : any ) => any));

type thunkedAction = (dispatch : Function, getState? : Function) => any;

function tagResultFunction(fn, tokenDescription: string, replacement? : string) : internalTokenType{
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

const singleSequenceCreator : singleSequenceMakerType = (token) : internalTokenType => {
  invariant(token, 'Token expected for SEQ.SINGLE');

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

    case 'object': { // TODO: make shallow or deep comparison
        if (typeof token.type == 'string') {
          tokenStr = token.type;
        }
      }
      break;
  }

  invariant(tokenStr, 'Token invalid type for SEQ.SINGLE');

  const result = a => (a !== symRestart) && ( (a.type == tokenStr) ? symNext : false);
  const tokenDescription = 'SINGLE:(' + tokenStr + ')';
  return tagResultFunction(result, tokenDescription);
};

const timesSequenceCreator : timesSequenceMakerType = (token, times, { strict } = {}) : internalTokenType => {
  invariant(token, 'Token expected for SEQ.TIMES');

  const normalizedToken = singleSequenceCreator(token);

  const tokenDescription = 'TIMES:(' + normalizedToken.toString() + ' x ' + times + ')';

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
  invariant(token, 'Token expected for SEQ.TIMES_STRICT');

  return tagResultFunction(
    timesSequenceCreator(token, times, { strict: true }),
    'TIMES', 'TIMES_STRICT');
};

const allSequenceCreator : multiSequenceMakerType = (tokens, { strict } = {}) : internalTokenType => {
  invariant(tokens && tokens.length, 'Tokens expected for SEQ.ALL');

  const normalizedTokens = tokens.map(singleSequenceCreator);
  const tokenDescription =  'ALL:(' + normalizedTokens.map(t => t.toString()).join() + ')';

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
  invariant(tokens && tokens.length, 'Tokens expected for SEQ.ANY');

  const normalizedTokens = tokens.map(singleSequenceCreator);
  const tokenDescription =  'ANY:(' + normalizedTokens.map(t => t.toString()).join() + ')';

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
  invariant(tokens && tokens.length, 'Tokens expected for SEQ.QUEUE');

  const normalizedTokens = tokens.map(singleSequenceCreator);
  const tokenDescription =  'QUEUE:(' + normalizedTokens.map(t => t.toString()).join() + ')';

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
  invariant(tokens && tokens.length, 'Tokens expected for SEQ.QUEUE_STRICT');

  return tagResultFunction(
    queueSequenceCreator(tokens, { strict: true }),
    'QUEUE', 'QUEUE_STRICT');
};

const sequenceApi : sequenceMakingApiType = {

  SINGLE: singleSequenceCreator,
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
  QUEUE_STRICT: queueStrictSequenceCreator
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

export const dispatchActionWhen = (action : FSAOrFSACreatorType, sequenceBuilderCb : sequenceBuilderCallbackType, { once } : dispatchedOptionsType) : thunkedAction => {
  return dispatch => {
    const sequence = sequenceBuilderCb(sequenceApi);
    invariant(sequence && (typeof sequence === 'function'), 'dispatchWhen expects sequenceBuilderCb to return compiled sequence (function)');

    const seqKey = ('SEQUENCE: ' + sequence + ' => ' + (action.type || action.toString()));

    let unregister = registerSequence(a => {

      const result = sequence(a);
      if (result !== symNext) {
        return;
      }

      console.log(seqKey + ': RESOLVED'); // closure

      let unregisterFn = () => {
        unregister && unregister();
        unregister = null;
      };

      if (!once) {
        sequence(symRestart);
      }

      if (typeof action == 'function') {
        dispatch(action(unregisterFn));
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
  return dispatchActionWhen(action, SEQ => Array.isArray(sequence) ? SEQ.SEQUENCE(sequence) : SEQ.SINGLE(sequence), { once });
};

export default (store => next => action => {
  const result = next(action);

  if (sequences.length && isFSA(action)) {
    sequences.forEach(s => s(action));
  }

  return result;
} : middlewareType);