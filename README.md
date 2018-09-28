# hogan-var

Analyzes variable usages in [Hogan.js](http://twitter.github.io/hogan.js/) templates.
Useful for static analysis, documentation generation, and sample rendering of arbitrary templates.

## Installation

```sh
npm install hogan-var
```

## Usage

```js
const hogan = require('hogan.js');
const scanVariables = require('hogan-var').default;

const text = `Welcome to {{{placeHtml}}}!
  {{#names.length}}
  Greetings to:
  {{#names}}
  - {{.}} {{>icon}}
  {{/names}}
  {{/names.length}}`;
const tree = hogan.parse(hogan.scan(text), text);
const vars = scanVariables(tree);
console.log(JSON.stringify(vars));
```

The code above outputs the following:

```json
{
  "placeHtml": {
    "scalar": true,
    "unescaped": true
  },
  "names": {
    "array": true,
    "members": {
      "length": {
        "scalar": true,
        "section": true,
        "noninverted": true
      }
    },
    "section": true,
    "noninverted": true,
    "elements": {
      "scalar": true,
      "escaped": true
    }
  },
  "icon": {
    "partial": true
  }
}
```

## API Reference

<a name="scanVariables"></a>

### scanVariables(tokens, options, context, parentContexts) ⇒
Walks an array or tree of Hogan.js tokens (returned by `scan` or `parse`, respectively)
and returns a mapping of variable references to objects describing the contexts in which
they are used. Using a parsed token tree is recommended for obtaining the most accurate
interpretation.

Each variable maps to an object that may contain the following properties:

- `name` (string): The name of the variable, if `includeName` is `true` in the options
- `scalar` (boolean): The variable was used in a scalar context: `{{v}}`, `{{{v}}}`, `{{&v}}`
- `escaped` (boolean): The variable was used in an escaped reference: `{{v}}`
- `unescaped` (boolean): The variable was used in an unescaped reference: `{{{v}}}`, `{{&v}}`
- `section` (boolean): The variable was used in a section: `{{#v}}`, `{{^v}}`
- `noninverted` (boolean): The variable was used in a normal/non-inverted section: `{{#v}}`
- `inverted` (boolean): The variable was used in an inverted section: `{{^v}}`
- `partial` (boolean): The variable/filename was used in a partial: `{{>v}}` (top-level context only)
- `array` (boolean): The variable was used as an array in a section (containing `{{.}}`)
- `members` (Object): An object mapping member variable references to usage context
- `nested` (Object): An object mapping nested variable references to usage context

The difference between `members` and `nested` is that members are known to be members of the
containing variable, generally because they were referenced using dot-notation. Nested references
may be references to members of the containing variable or references to members of any containing
scope, including the top-level scope.

The following options can be used to control interpretation:

- `arrayLengthMember` (string): name of member reference assumed to be an array length, default `length`
- `collapseNested` (boolean): whether to assume section references with same name as an outer
    variable refer to the same variable, default `true`
- `includeName` (boolean): whether to (redundantly) include the name of the variable in its
    property map, default `false`

**Kind**: global function  
**Returns**: the populated `context` argument  

| Param | Type | Description |
| --- | --- | --- |
| tokens | <code>Array</code> | an array or tree of Hogan.js tokens |
| options | <code>Object</code> | options controlling interpretation |
| context | <code>Object</code> | receives variables for the current scope, defaults to an empty object |
| parentContexts | <code>Array</code> | an array of containing scopes, starting with the root |


## License

`hogan-var` is available under the [ISC license](LICENSE).
