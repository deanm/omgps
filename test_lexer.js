// (c) 2014 Dean McNamee (dean@gmail.com)

var fs = require('fs');

// Instead of dealing with exporting, just load it into this context...
eval(fs.readFileSync('./omgps.js', 'utf8'));

function assert_eq(a, b) {
  if (a !== b) {
    var m = 'assert_eq: ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b);
    console.trace(m); throw m;
  }
}

function test_string_literals() {
  var strs = ['(yo yo)', '(yo(yo))', '(oo(())(()))'];
  var p = new PSLexer(new Buffer(strs.join('')));
  for (var i = 0, il = strs.length; i < il; ++i) {
    var t = p.consume_token();
    assert_eq('str', t.t);
    assert_eq(strs[i].substr(1, strs[i].length - 2), t.v);
  }

  p = new PSLexer(new Buffer("(blah \\063\\173 blah)"));
  var t = p.consume_token();
  assert_eq('str', t.t);
  assert_eq("blah 3{ blah", t.v);
}

function test_numbers() {
  var nums = [
    '123', 123, '-98', -98, '43445', 43445, '0', 0, '+17', 17,
    '-.002', -0.002, '34.5', 34.5, '-3.62', -3.62, '123.6e10',123.6e10,
    '1.0E-5', 1.0E-5, '1E6', 1E6, '-1.', -1., '0.0', 0,
    '8#1777', 1023, '16#FFFE', 65534, '2#1000', 8,
    '+0.', 0, '+.0', 0];

  for (var i = 1, il = nums.length; i < il; i += 2) {
    var p = new PSLexer(new Buffer(nums[i-1]));
    var t = p.consume_token();
    assert_eq('num', t.t);
    assert_eq(nums[i], t.v);
  }

  var p = new PSLexer(new Buffer('+.'));  // Missing digits.
  var t = p.consume_token();
  assert_eq('name', t.t);
  assert_eq('+.', t.v);

  var p = new PSLexer(new Buffer('+1E'));  // Missing exponent.
  var t = p.consume_token();
  assert_eq('name', t.t);
  assert_eq('+1E', t.v);
}

test_string_literals();
test_numbers();
