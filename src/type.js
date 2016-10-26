/**
 * Created by andrew on 4/21/16.
 */

/**
 *
 * @type {{isFunction(),isArray(),isBoolean(),isNumber(),isString(),isUndefined(),isObject()}}
 */
const type = {};
export default type;

let   fullName,
  originalName; // PhantomJS bug

const
  __toString = Object.prototype.toString,
  _undef = undefined,
  sourceTypes = [true, 1, [], 'str', function () {}, _undef, {}],
  classNamePattern = /\s+(\w+)]/;

for (let i = 0, maxI = sourceTypes.length; i < maxI; i++) {
  fullName = (originalName = __toString.call(sourceTypes[i])).replace('DOMWindow', 'Undefined'); // PhantomJS bug
  type['is' + fullName.match(classNamePattern)[1]] = getTestFor(originalName);
}

export function getType(input) {
  return (__toString.call(input)).replace('DOMWindow', 'Undefined').match(classNamePattern)[1].toLowerCase();
}

export function groupByType(args) {
  return args.reduce((memo, arg) => {
    memo[getType(arg)] = arg;
    return memo;
  }, {});
}

function getTestFor(fullName) {
  return function (val) {
    return __toString.call(val) === fullName;
  };
}
