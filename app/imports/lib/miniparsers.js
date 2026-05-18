/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * General parser combinator library. Useful if you happen to need
 * to parse a non-trivial string into a javascript object.
 *
 * A parser:
 *   - Takes a string as input
 *   - Returns a 2-elem array where:
 *       1. First element is produced value
 *       2. Second is unconsumed input
 */

/**
 * Trivial parser not consuming input and always succeeding.
 */
const empty = str => ['', str];

/**
 * Parser expecting input starting with a given string.
 * Fails is that doesn't hold. Returns the given string.
 *
 * Examples: string('aa')('aabb') returns: ['aa, 'bb']
 *           string('aa')('bbbb') throws Error
 *
 * @param {string} s expected string
 */
const string = s => (str) => {
  if (!str.startsWith(s)) {
    throw new Error(`Expecting: ${s}, found: ${str}`);
  }
  return [s, str.slice(s.length)];
};

/**
 * Specialization of string parser to single characters.
 *
 * Examples: char('a')('ab') = ['a', 'b']
 *           char('a')('bb') throws Error
 *
 * @param {char} c expected character
 */
const char = (c) => {
  if (c.length != 1) {
    throw new Error(`Not a character: ${c}`);
  }
  return string(c);
};

/**
 * Matches the beginning of the input with a given regular expression. If the
 * regular expression matches, returns the matching portion. Otherwise throws.
 * Example:
 *
 *   re(/[^,]/)('some text, another text') = ['some text', ', another text']
 *   re(/[0-9]+/)('123 abc') = ['123', ' abc']
 *   re(/[0-9]+/)('abc 123') throws (digits match, but not at the beggining of the string)
 *
 * @param {regexp|string} r regular expression to match
 */
const re = r => (str) => {
  const regexp = new RegExp(r);
  const m = regexp.exec(str);
  if (!m || m.index != 0) {
    throw new Error(`Unexpected input: ${str}`);
  }
  const [match] = m;
  return [match, str.slice(match.length)];
};

/**
 * High order parser: given a list of parsers, return a new one
 * executing each of the given parsers in sequence. Each parser
 * will get the unconsumed input of the former. Return a list
 * with the results of each parser. Example:
 *
 *   chain(re(/[a-zA-Z_]+/), char(':'), re(/[0-9]+/))('x:12') = [['x',':','12'], '']
 *
 * @param  {array} ps parsers to chain
 */
const chain = (...ps) => str => (
  ps.reduce(([results, input], p) => {
    const [result, rest] = p(input);
    return [[...results, result], rest];
  }, [[], str])
);

/**
 * High order parser: given a list of parsers, try them in order
 * until one succeeds. Throws if all fail. Example:
 *
 *   oneOf(char('x'), re(/[0-9]+/))
 *
 * Given input 'xaaa' returns: ['x', 'aaa']
 * Given input '123a' returns: ['123', 'a']
 * Given input 'aaaa' throws
 *
 * @param {array} ps parser to try
 */
const oneOf = (...ps) => (str) => {
  for (const p of ps) {
    try {
      return p(str);
    } catch (e) {
      // Nothing to do: keep on the loop, try next parser.
    }
  }
  throw new Error(`Unexpected input: ${str}`);
};

/**
 * High order parser: given a parser p and an separator char sep, returns
 * a new parser appling p and then expecting a separator as many times as
 * possible. Zero repetitions are allowed. Example:
 *
 *   many(re(/[0-9]+/), ',')('12,34,56 rest') = [['12', '34', '56'], ' rest']
 *   many(char(a), ',')('b') = [[], 'b']
 *
 * @param {parser} p parser
 * @param {char} sep separator char
 */
const many = (p, sep) => (str) => {
  const acc = [];
  let v;
  let rest = str;
  try {
    [v, rest] = p(str);
    acc.push(v);
  } catch (e) {
    return [acc, str];
  }
  while (rest) {
    try {
      [ , rest] = char(sep)(rest);
      [v, rest] = p(rest);
      acc.push(v);
    } catch (e) {
      break;
    }
  }
  return [acc, rest];
};

/**
 * High order parser transforming the output of a given parser. Example:
 *
 *   re(/[0-9]+/)('123 hi') = ['123', ' hi']
 *   pmap(Number, re(/[0-9]+/)) = [123, ' hi'] // 123 as number, not string
 *
 * @param {func} f transformer function
 * @param {parser} p parser
 */
const pmap = (f, p) => (str) => {
  const [v, rest] = p(str);
  return [f(v), rest];
};

/**
 * High order parser that given a parser p, parses
 * whatever p does, but surrounded by parens. Example:
 *
 *   parens(many(re(/[0-9]+/), ',')))('(1,2,3) rest') = [[1,2,3], ' rest']
 *
 * @param {parser} p parser
 */
const parens = p => (str) => {
  const [ , rest0] = char('(')(str);
  const [v, rest1] = p(rest0);
  const [ , rest2] = char(')')(rest1);
  return [v, rest2];
};

export { empty, char, string, re, chain, oneOf, many, pmap, parens };
