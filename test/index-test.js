const chai = require('chai');
const expect = chai.expect;
const hogan = require('hogan.js');
const scanVariables = require('../index').default;

describe('scanVariables', function() {
  it('returns expected demo result', function() {
    const text = `Welcome to {{{placeHtml}}}!
    {{#names.length}}
    Greetings to:
    {{#names}}
    - {{.}}
    {{/names}}
    {{/names.length}}`;
    const tree = hogan.parse(hogan.scan(text), text);
    const vars = scanVariables(tree);
    expect(vars).to.eql({
      placeHtml: {
        scalar: true,
        unescaped: true
      },
      names: {
        array: true,
        elements: {
          scalar: true,
          escaped: true
        },
        members: {
          length: {
            scalar: true,
            section: true,
            noninverted: true
          }
        },
        section: true,
        noninverted: true
      }
    });
  });
});