// (c) 2014 Dean McNamee (dean@gmail.com)

function PSLexer(buf) {
  var bufp = 0;
  var buflen = buf.length;

  this.cur_pos = function() { return bufp; };
  this.set_pos = function(p) { return bufp = p; };
  this.end_pos = function() { return buflen; };
  this.is_eof = function() { return bufp >= buflen; };
  this.cur_byte = function() { return buf[bufp]; }
  this.adv_byte = function() { bufp++; };
  this.adv_bytes = function(n) { bufp += n; };

  function ascii_substr(start, end) {
    return buf.toString('ascii', start, end);
  }

  this.consume_token_including_cmt_and_ws = function() {
    var startp = bufp;

    // 3.3.4 - Boolean Objects.
    if (buf[bufp+0] === 116 &&  /* t */
        buf[bufp+1] === 114 &&  /* r */
        buf[bufp+2] === 117 &&  /* u */
        buf[bufp+3] === 101) {  /* e */
      bufp += 4;
      return {v: true, t: 'bool'};
    }
    if (buf[bufp+0] === 102 &&  /* f */
        buf[bufp+1] ===  97 &&  /* a */
        buf[bufp+2] === 108 &&  /* l */
        buf[bufp+3] === 115 &&  /* s */
        buf[bufp+4] === 101) {  /* e */
      bufp += 5;
      return {v: false, t: 'bool'};
    }

    // 3.3.13 - Null Object.
    if (buf[bufp+0] === 110 &&  /* n */
        buf[bufp+1] === 117 &&  /* u */
        buf[bufp+2] === 108 &&  /* l */
        buf[bufp+3] === 108) {  /* l */
      bufp += 4;
      return {v: null, t: 'null'};
    }

    // "The delimiter characters (, ), <, >, [, ], {, }, /, and % are special."
    // "All characters besides the white-space characters and delimiters are
    //  referred to as regular characters."
    // "The characters carriage return (CR) and line feed (LF) are also called
    //  newline characters. The combination of a carriage return followed
    //  immediately by a line feed is treated as one newline."

    var c = buf[bufp];

    switch (c) {
      // Whitespace.
      case 0: case 9: case 10: case 12: case 13: case 32:
        do {
          c = buf[++bufp];
        } while (c ===  0 || c ===  9 || c === 10 ||
                 c === 12 || c === 13 || c === 32);
        return {v: null, t: 'ws'};
      // Comments.
      case 37: /* % */
        // "The comment consists of all characters between the % and the next
        //  newline or form feed, including regular, delimiter, space, and tab
        //  characters."
        while (c !== 10 && c !== 13 && c !== 12) c = buf[++bufp];
        // Just let the tokenization handle the remaining newline as whitespace.
        return {v: null, t: 'cmt'};
      // String literals.
      case 40:  /* ( */
        var chars = [ ];
        var nest = 0;  // Literal strings support "balanced paranthesis".
        while (bufp < buflen) {
          ++bufp;
          if (buf[bufp] === 92) { /* \ */
            ++bufp;
            switch (buf[bufp]) {
              case 110:  /* n */  chars.push("\n"); break;
              case 114:  /* r */  chars.push("\r"); break;
              case 116:  /* t */  chars.push("\t"); break;
              case  98:  /* b */  chars.push("\b"); break;
              case 102:  /* f */  chars.push("\f"); break;
              case  40:  /* ( */  chars.push("(");  break;
              case  41:  /* ) */  chars.push(")");  break;
              case  92:  /* \ */  chars.push("\\"); break;
              case  48:  /* 0 */ case  49:  /* 1 */
              case  50:  /* 2 */ case  51:  /* 3 */
                chars.push(String.fromCharCode(
                    parseInt(ascii_substr(bufp, bufp+3), 8)));
                bufp += 2;
                break;
              default:
                --bufp; break;
            }
          } else if (buf[bufp] === 41 && nest === 0) {  /* ) */
            ++bufp;
            break;
          } else {
            if (buf[bufp] === 40) ++nest;  /* ( */
            if (buf[bufp] === 41) --nest;  /* ) */
            chars.push(String.fromCharCode(buf[bufp]));
          }
        }
        return {v: chars.join(''), t: 'str'};
      case 47: /* / */
        // "The name may include any regular characters, but not delimiter or
        //  white-space characters"
        // "Note: The token / (a slash followed by no regular characters) is a
        //  valid name."
        var typ = 'lname';  // Literal name.
        if (buf[bufp+1] === 47) {
          typ = 'immname';  // Immediately evaluated name.
          ++bufp;
        }
        while (true) {
          ++bufp;
          if (buf[bufp] ===   0 ||  /* \000 */
              buf[bufp] ===   9 ||  /* \t */
              buf[bufp] ===  10 ||  /* \n */
              buf[bufp] ===  12 ||  /* \f */
              buf[bufp] ===  13 ||  /* \r */
              buf[bufp] ===  32 ||  /*   */
              buf[bufp] ===  40 ||  /* ( */
              buf[bufp] ===  41 ||  /* ) */
              buf[bufp] ===  60 ||  /* < */
              buf[bufp] ===  62 ||  /* > */
              buf[bufp] ===  91 ||  /* [ */
              buf[bufp] ===  93 ||  /* ] */
              buf[bufp] === 123 ||  /* { */
              buf[bufp] === 125 ||  /* } */
              buf[bufp] ===  47 ||  /* / */
              buf[bufp] ===  37) {  /* % */
            break;
          }
        }
        return {v: buf.slice(startp, bufp).toString('ascii'), t: typ};
      // Array Objects.
      case 91:  /* [ */
        ++bufp;
        return {v: null, t: '['};
      case 93:  /* ] */
        ++bufp;
        return {v: null, t: ']'};
      // Dictionary Objects.
      // String Objects (Hexadecimal Strings).
      case 60:  /* < */
        ++bufp;
        if (buf[bufp] === 60) {
          ++bufp;
          return {v: null, t: '<<'};
        } else {
          while (buf[bufp] != 62) ++bufp;
          var str = ascii_substr(startp+1, bufp)
          if (str.length & 1) throw "Odd number of characters in hex string";
          ++bufp;  // Skip over last >
          return {v: str, t: 'hexstr'};
        }
      case 62:  /* > */
        if (buf[bufp+1] !== 62) throw "Unexpected single > in lexer."
        bufp += 2;
        return {v: null, t: '>>'};
    }

    // Radix numbers
    var c1 = buf[bufp+1];  // Look ahead.
    if (c1 === 35 && c >= 50 && c <= 57) {  /* [2-9]# */
      var base = c - 48;
      var lastalp = c - 1;
      bufp += 2;
      c = buf[bufp];
      var s = bufp;
      while (c >= 48 && c <= lastalp) c = buf[++bufp];
      return {v: parseInt(ascii_substr(s, bufp), base), t: 'num'};
    }


    var c2 = buf[bufp+2];  // Look ahead.
    if (c2 === 35 &&
        ((c >= 49 && c <= 50 && c1 >= 48 && c1 <= 57) ||  /* [1-2][0-9]# */
         (c == 51 && c1 >= 48 && c1 <= 54))) {            /*     3[0-6]# */
      var base = (c - 48) * 10 + (c1 - 48);
      var lastalp = base === 10 ? 0 : 65 + (base - 11);
      bufp += 3;
      c = buf[bufp];
      var s = bufp;
      while ((c >= 48 && c <= 57) ||            /* [0-9] */
             (c >= 65 && c <= lastalp) ||       /* [A-lastalp] */
             (c >= 97 && c <= (lastalp+32))) {  /* [a-lastalp] */
        c = buf[++bufp];
      }
      return {v: parseInt(ascii_substr(s, bufp), base), t: 'num'};
    }

    var savepos = bufp;
    while (true) {  // Try as a number...
      // As regex: [+-]?(?:[0-9]*\.[0-9]+|[0-9]+\.?)(?:[eE][+-]?[0-9]+)?

      if (c === 43 || c === 45)  /* [+-]? */
        c = buf[++bufp];

      var as = bufp;  // Keep track of after-sign position
      while (c >= 48 && c <= 57) c = buf[++bufp];  /* [0-9]* */
      if (c === 46) {  /* . */
        c = buf[++bufp];
        while (c >= 48 && c <= 57) c = buf[++bufp];  /* [0-9]* */
        if (as + 1 === bufp)
          break;  // Had just a decimal point, without digits before or after.
      } else if (as === bufp) {  // No decimal point and no digits.
          break;
      }
      if (c === 101 || c == 69) {  /* [eE]? */
        c = buf[++bufp];
        if (c === 43 || c === 45)  /* [+-]? */
          c = buf[++bufp];
        var be = bufp;  // Keep track of before exponent digits
        while (c >= 48 && c <= 57) c = buf[++bufp];  /* [0-9]* */
        if (bufp === be)  // No exponent digits.
          break;
      }

      // All of that work and in the end just pass it off to parseFloat and
      // hope it handles everything correctly.
      return {v: parseFloat(ascii_substr(startp, bufp)), t: 'num'};
    }
    bufp = savepos;  // Couldn't parse as a number, restore and go on.

    // "Any token that consists entirely of regular characters and cannot be
    //  interpreted as a number is treated as a name object"
    while (bufp < buflen &&
           c !==   0 &&  /* \000 */
           c !==   9 &&  /* \t */
           c !==  10 &&  /* \n */
           c !==  12 &&  /* \f */
           c !==  13 &&  /* \r */
           c !==  32 &&  /*   */
           c !==  40 &&  /* ( */
           c !==  41 &&  /* ) */
           c !==  60 &&  /* < */
           c !==  62 &&  /* > */
           c !==  91 &&  /* [ */
           c !==  93 &&  /* ] */
           c !== 123 &&  /* { */
           c !== 125 &&  /* } */
           c !==  47 &&  /* / */
           c !==  37) {  /* % */
      c = buf[++bufp];
    }

    if (bufp === startp)
      return null;  // Nothing consumed by lexer.

    return {v: ascii_substr(startp, bufp), t: 'name'};
  };

  this.consume_token = function() {
    while (true) {
      var token = this.consume_token_including_cmt_and_ws();
      if (token.t !== 'ws' && token.t !== 'cmt') return token;
    }
  };
}
try {
} catch(e) { };
