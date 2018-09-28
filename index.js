'use strict';

const assignDeep = require('assign-deep');

const defaultOptions = {
  arrayLengthMember: 'length',
  collapseNested: true,
  includeName: false
};

/**
 * Walks an array or tree of Hogan.js tokens (returned by `scan` or `parse`, respectively)
 * and returns a mapping of variable references to objects describing the contexts in which
 * they are used. Using a parsed token tree is recommended for obtaining the most accurate
 * interpretation.
 * 
 * Each variable maps to an object that may contain the following properties:
 * 
 * - `name` (string): The name of the variable, if `includeName` is `true` in the options
 * - `scalar` (boolean): The variable was used in a scalar context: `{{v}}`, `{{{v}}}`, `{{&v}}`
 * - `escaped` (boolean): The variable was used in an escaped reference: `{{v}}`
 * - `unescaped` (boolean): The variable was used in an unescaped reference: `{{{v}}}`, `{{&v}}`
 * - `section` (boolean): The variable was used in a section: `{{#v}}`, `{{^v}}`
 * - `noninverted` (boolean): The variable was used in a normal/non-inverted section: `{{#v}}`
 * - `inverted` (boolean): The variable was used in an inverted section: `{{^v}}`
 * - `partial` (boolean): The variable/filename was used in a partial: `{{>v}}` (top-level context only)
 * - `array` (boolean): The variable was used as an array in a section (containing `{{.}}`)
 * - `members` (Object): An object mapping member variable references to usage context
 * - `nested` (Object): An object mapping nested variable references to usage context
 * 
 * The difference between `members` and `nested` is that members are known to be members of the
 * containing variable, generally because they were referenced using dot-notation. Nested references
 * may be references to members of the containing variable or references to members of any containing
 * scope, including the top-level scope.
 * 
 * The following options can be used to control interpretation:
 * 
 * - `arrayLengthMember` (string): name of member reference assumed to be an array length, default `length`
 * - `collapseNested` (boolean): whether to assume section references with same name as an outer
 *     variable refer to the same variable, default `true`
 * - `includeName` (boolean): whether to (redundantly) include the name of the variable in its
 *     property map, default `false`
 * 
 * @param {Array} tokens an array or tree of Hogan.js tokens
 * @param {Object} options options controlling interpretation
 * @param {Object} context receives variables for the current scope, defaults to an empty object
 * @param {Array} parentContexts an array of containing scopes, starting with the root
 * @returns the populated `context` argument
 */
function scanVariables(tokens, options = defaultOptions, context = {}, parentContexts = []) {
  for (const token of tokens) {
    // categorize the token
    let scalar; // scalar variable reference, does not have members
    let escaped; // only applies to substituted scalars
    let unescaped; // only applies to substituted scalars
    let section; // normal or inverted
    let noninverted; // only applies to sections
    let inverted; // only applies to sections
    let partial;
    let varRef = true;
    switch (token.tag) {
      case '_v': // escaped substitution
        scalar = true;
        escaped = true;
        break;
      case '{': // unescaped substitution
      case '&':
        scalar = true;
        unescaped = true;
        break;
      case '#': // section start
        section = true;
        noninverted = true;
        break;
      case '^': // inverted section start
        section = true;
        inverted = true;
        break;
      case '>': // partial
        partial = true;
        break;
      default: // text, newline, comment, section end, set delimiter, subroutine
        varRef = false;
    }

    let nestedContext = context;
    let nestedParentContexts = parentContexts.slice();
    if (partial) {
      const rootContext = parentContexts.length ? parentContexts[0] : context;
      const varContext = rootContext[token.n] || (rootContext[token.n] = {});
      varContext.partial = true;
    } else if (varRef) {
      // get context for referenced variable
      let varContext = context;
      const name = token.n;
      if (name === '.') {
        // dot implies that immediate context is an array
        if (!varContext.array) {
          varContext.array = true;
          liftNested(varContext, parentContexts);
        }
        nestedParentContexts.push(varContext);
        varContext = varContext.elements || (varContext.elements = {});
      } else {
        // scalars and arrays don't generally have members, so skip them when nesting
        while ((varContext.scalar || varContext.array) && nestedParentContexts.length > 0) {
          varContext = nestedParentContexts.pop();
        }
        const parts = name.split('.');
        for (let i = 0, l = parts.length; i < l; ++i) {
          const part = parts[i];
          const isLastPart = i === l - 1;

          // x.length or length in an array context implies that x is an array and length is a scalar
          const isArrayLength = isLastPart && part === options.arrayLengthMember && (i > 0 || varContext.array);
          if (isArrayLength) {
            varContext.array = true;
            scalar = true;
          }

          let scope;
          if (i > 0 || isArrayLength) {
            // dot-prefixed names are known to resolve against the immediate context
            scope = varContext.members || (varContext.members = {});
          } else if (nestedParentContexts.length > 0) {
            // initial names can resolve against any containing context;
            // however, we may wish to assume any duplicate names
            // from a containing context are the same variable
            if (options.collapseNested && !(varContext.nested && part in varContext.nested)) {
              scope = findInParents(part, nestedParentContexts);
            }
            if (!scope) {
              scope = varContext.nested || (varContext.nested = {});
            }
          } else {
            // the root context directly contains its names
            scope = varContext;
          }
          nestedParentContexts.push(varContext);
          varContext = scope[part] || (scope[part] = {});
          if (options.includeName) {
            varContext.name = part;
          }
        }
      }

      // write categories to referenced variable context
      if (scalar) {
        if (!varContext.scalar) {
          varContext.scalar = true;
          liftNested(varContext, parentContexts);
        }
        if (escaped) {
          varContext.escaped = escaped;
        }
        if (unescaped) {
          varContext.unescaped = unescaped;
        }
      }
      if (section) {
        varContext.section = true;
        if (noninverted) {
          varContext.noninverted = true;
        }        
        if (inverted) {
          varContext.inverted = true;
        }        
      }

      nestedContext = varContext;
    }

    if (token.nodes) { // section or subroutine
      scanVariables(token.nodes, options, nestedContext, nestedParentContexts);
    }
  }
  return context;
}

function findInParents(name, parents) {
  for (let i = parents.length - 1; i >= 0; --i) {
    const parent = parents[i];
    if (i === 0) {
      // names are stored directly in root context
      if (name in parent) {
        return parent;
      }
    } else {
      // section contexts may have both members and nested references
      if (parent.members && name in parent.members) {
        return parent.members;
      }
      if (parent.nested && name in parent.nested) {
        return parent.nested;
      }
    }
  }
}

function liftNested(context, parents) {
  // if we've just discovered a scalar or array reference to a section variable with
  // nested fields, lift them out to the nearest non-scalar, non-array context
  if (context.nested) {
    const scope = findNestingScope(parents);
    if (scope) {
      assignDeep(scope, context.nested);
      delete context.nested;
    }
  }
}

function findNestingScope(parents) {
  for (let i = parents.length - 1; i >= 0; --i) {
    const parent = parents[i];
    if (i === 0) {
      return parent;
    } else if (!parent.scalar && !parent.array) {
      return parent.nested || (parent.nested = {});
    }
  }
}

module.exports = {
  default: scanVariables,
  scanVariables
};