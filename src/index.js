
/**
 * Created by andrew on 10/13/16.
 */
/**
 * Schedules actions with { meta: { delay: N } } to be delayed by N milliseconds.
 * Makes `dispatch` return a function to cancel the timeout in this case.
 */
import { isFSA } from 'flux-standard-action';

const localNS = Symbol('SEQ');
const symNext = Symbol('next');
const symRestart = Symbol('restart');

export const SEQ = {

  SINGLE: function (token, opts) {
    let result = null;
    if (!token) {
      throw TypeError('Token expected for SEQ.SINGLE');
    }
    switch (typeof token) {
      case 'string':
        result = a => (a !== symRestart) && ( (a.type == token) ? symNext : false);
        break;
      case 'function':
        if ((token.tag === localNS)) {
          return token;
        }
        result = a => (a !== symRestart) && ((a.type == token.toString()) ? symNext : false);
        break;
      case 'object': // TODO: make shallow or deep comparison
        result = a => (a !== symRestart) && ((a.type == token.type) ? symNext : false);
        break;
    }
    if (!result) {
      throw TypeError('Token invalid type for SEQ.SINGLE');
    }

    result.toString = () => 'SINGLE:(' + token.toString() + ')';
    result.tag = localNS;
    return result;
  },

  TIMES: function (token, times, { strict } = {}) {
    token = SEQ.SINGLE(token);
    let count = 0;
    const result = (a) => {
      if (a === symRestart) {
        count = 0;
        token(symRestart);
        return false;
      }
      const result = token(a);
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
        token(symRestart);
        return false;
      }
      return true;
    };
    result.toString = () => 'TIMES:(' + token.toString() + ' x ' + times + ')';
    result.tag = localNS;
    return result;
  },

  TIMES_STRICT: function (token, times) {
    const result = SEQ.TIMES(token, times, { strict: true });
    result.toString = () => 'TIMES_STRICT:(' + token.toString() + ' x ' + times + ')';
    return result;
  },

  ALL: function (tokens, { strict } = {}) {
    if (!tokens || !tokens.length) {
      throw TypeError('Tokens expected for SEQ.ALL');
    }
    tokens = tokens.map(SEQ.SINGLE);
    let results = tokens.map(t => false);
    const length = tokens.length;

    const result = (a) => {
      if (a === symRestart) {
        results = tokens.map(t => false);
        tokens.forEach(t => t(symRestart));
        return false;
      }

      const nextResults = tokens.map((t, k) => {
          const result = t(a);

      if (result === symNext) {
        return symNext;
      }
      return results[k];
    }, results);

      if (nextResults.filter(i => i === symNext).length === length) {
        results = tokens.map(t => false);
        tokens.forEach(t => t(symRestart));
        return symNext;
      }

      results = nextResults;
      return true;
    };
    result.toString = () => 'ALL:(' + tokens.map(t => t.toString()).join() + ')';
    result.tag = localNS;
    return result;
  },

  ANY: function (tokens, { strict } = {}) {
    if (!tokens || !tokens.length) {
      throw TypeError('Tokens expected for SEQ.ANY');
    }
    tokens = tokens.map(SEQ.SINGLE);
    const result = (a) => {
      if (a === symRestart) {
        tokens.forEach(t => t(symRestart));
        return false;
      }
      if (tokens.filter(t => t(a) === symNext).length) {
        tokens.forEach(t => t(symRestart));
        return symNext;
      }
      if (strict) {
        tokens.forEach(t => t(symRestart));
        return false;
      }
      return true;
    };
    result.toString = () => 'ANY:(' + tokens.map(t => t.toString()).join() + ')';
    result.tag = localNS;
    return result;
  },

  SEQUENCE: function (tokens, { strict } = {}) {
    if (!tokens || !tokens.length) {
      throw TypeError('Tokens expected for SEQ.SEQUENCE');
    }
    tokens = tokens.map(SEQ.SINGLE);
    const length = tokens.length;
    let count = 0;
    const result = (a) => {
      if (a === symRestart) {
        count = 0;
        tokens.forEach(t => t(symRestart));
        return false;
      }
      const result = tokens[count](a);
      if (result === true) {
        return true;
      }

      if (result === symNext) {
        count = ++count % length;

        if (count === 0) {
          tokens.forEach(t => t(symRestart));
          return symNext;
        } else {
          return true;
        }
      }

      if (strict) {
        count = 0;
        tokens.forEach(t => t(symRestart));
        return false;
      }
      return true;
    };
    result.toString = () => 'SEQUENCE:(' + tokens.map(t => t.toString()).join() + ')';
    result.tag = localNS;
    return result;
  },
  SEQUENCE_STRICT: function (tokens) {
    if (!tokens || !tokens.length) {
      throw TypeError('Tokens expected for SEQ.SEQUENCE_STRICT');
    }

    const result = SEQ.SEQUENCE(tokens, { strict: true });
    result.toString = () => 'SEQUENCE_STRICT:(' + tokens.map(t => t.toString()).join() + ')';
    return result;
  }
};


let sequences = [];

const registerSequence = (fn) => {

  if (!fn || typeof fn !== 'function') {
    throw new TypeError('registerSequence expects function as a first parameter');
  }

  sequences.push(fn);

  // unregister
  return () => {
    const idx = sequences.indexOf(fn);
    if (idx >= 0) {
      return sequences.splice(idx, 1);
    }
  }
};

export const fireOnSequence = (action, sequence, {
  once
}) => {
  return dispatch => {

    if (Array.isArray(sequence)) {
      sequence = SEQ.SEQUENCE(sequence);
    } else {
      sequence = SEQ.SINGLE(sequence);
    }

    console.log('SEQUENCE: ' + sequence + ' => ' + (action.type || action.toString()));

    let unregister = registerSequence(a => {

        const result = sequence(a);
    if (result === symNext) {

      if (once) {
        unregister();
        unregister = null;
      } else {
        sequence(symRestart);
      }

      if (typeof action == 'function') {
        dispatch(action());
      } else {
        dispatch(action);
      }
    }

  })
  };
};

export default store => next => action => {
  const result = next(action);

  if (sequences.length && isFSA(action)) {
    sequences.forEach(s => s(action));
  }

  return result;
};