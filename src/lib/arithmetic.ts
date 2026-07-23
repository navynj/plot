/**
 * A tiny, safe arithmetic evaluator — for number fields that accept a typed
 * expression (`1200*3`, `(2+3)*4`, `12.5-2.5`) and store the RESULT.
 *
 * Supports `+ - * /`, parentheses, unary +/-, and decimals; tolerates
 * thousands-separator commas (stripped). It NEVER uses `eval`/`Function` or any
 * dynamic execution — a hand-written recursive-descent parser that rejects any
 * character that is not a digit, `.`, an operator, or a paren. Throws on an
 * invalid expression or a non-finite result (e.g. divide by zero); the result
 * is exact (rounding is a display concern, CLAUDE.md §6).
 */

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: '('; }
  | { t: ')'; };

class ArithmeticError extends Error {}

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      tokens.push({ t: c });
      i++;
      continue;
    }
    if ((c >= '0' && c <= '9') || c === '.') {
      const m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) throw new ArithmeticError(`invalid number near '${c}'`);
      const v = Number(m[0]);
      if (!Number.isFinite(v)) throw new ArithmeticError(`invalid number '${m[0]}'`);
      tokens.push({ t: 'num', v });
      i += m[0].length;
      continue;
    }
    throw new ArithmeticError(`unexpected character '${c}'`);
  }
  return tokens;
}

/** Grammar: expr = term (('+'|'-') term)*; term = factor (('*'|'/') factor)*;
 *  factor = ('+'|'-') factor | primary; primary = num | '(' expr ')'. */
class Parser {
  private pos = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token | undefined {
    return this.toks[this.pos];
  }
  private next(): Token | undefined {
    return this.toks[this.pos++];
  }

  parseExpression(): number {
    let value = this.parseTerm();
    for (let tk = this.peek(); tk?.t === 'op' && (tk.v === '+' || tk.v === '-'); tk = this.peek()) {
      this.next();
      const rhs = this.parseTerm();
      value = tk.v === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    for (let tk = this.peek(); tk?.t === 'op' && (tk.v === '*' || tk.v === '/'); tk = this.peek()) {
      this.next();
      const rhs = this.parseFactor();
      value = tk.v === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  private parseFactor(): number {
    const tk = this.peek();
    if (tk?.t === 'op' && (tk.v === '+' || tk.v === '-')) {
      this.next();
      const operand = this.parseFactor();
      return tk.v === '-' ? -operand : operand;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tk = this.next();
    if (!tk) throw new ArithmeticError('unexpected end of expression');
    if (tk.t === 'num') return tk.v;
    if (tk.t === '(') {
      const value = this.parseExpression();
      const close = this.next();
      if (!close || close.t !== ')') throw new ArithmeticError('unmatched parenthesis');
      return value;
    }
    throw new ArithmeticError(`unexpected '${tk.t === 'op' ? tk.v : tk.t}'`);
  }

  expectEnd(): void {
    if (this.pos !== this.toks.length) throw new ArithmeticError('unexpected trailing input');
  }
}

/**
 * Evaluate an arithmetic expression to a finite number. Throws (an Error) on an
 * empty/invalid expression or a non-finite result. A plain number evaluates to
 * itself.
 */
export function evaluateArithmetic(input: string): number {
  const src = input.replace(/,/g, '').trim(); // tolerate thousands separators
  if (src === '') throw new ArithmeticError('empty expression');
  const parser = new Parser(tokenize(src));
  const value = parser.parseExpression();
  parser.expectEnd();
  if (!Number.isFinite(value)) throw new ArithmeticError('non-finite result');
  return value;
}
