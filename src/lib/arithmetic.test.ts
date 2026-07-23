import { describe, expect, it } from 'vitest';

import { evaluateArithmetic } from './arithmetic';

describe('evaluateArithmetic — safe expression evaluation (no eval)', () => {
  it('evaluates the four operators, precedence, and parentheses', () => {
    expect(evaluateArithmetic('3+4')).toBe(7);
    expect(evaluateArithmetic('1200*3')).toBe(3600);
    expect(evaluateArithmetic('3400+1200')).toBe(4600);
    expect(evaluateArithmetic('(2+3)*4')).toBe(20);
    expect(evaluateArithmetic('2+3*4')).toBe(14); // precedence
    expect(evaluateArithmetic('12.5-2.5')).toBe(10);
    expect(evaluateArithmetic('10/4')).toBe(2.5);
  });

  it('handles decimals and unary minus/plus', () => {
    expect(evaluateArithmetic('1.5+2.5')).toBe(4);
    expect(evaluateArithmetic('-3+5')).toBe(2);
    expect(evaluateArithmetic('-(2+3)')).toBe(-5);
    expect(evaluateArithmetic('+42')).toBe(42);
    expect(evaluateArithmetic('.5+.5')).toBe(1);
  });

  it('a plain number evaluates to itself', () => {
    expect(evaluateArithmetic('42')).toBe(42);
    expect(evaluateArithmetic('12.5')).toBe(12.5);
    expect(evaluateArithmetic('  7  ')).toBe(7);
  });

  it('tolerates thousands-separator commas', () => {
    expect(evaluateArithmetic('1,200')).toBe(1200);
    expect(evaluateArithmetic('1,200*3')).toBe(3600);
    expect(evaluateArithmetic('1,000,000')).toBe(1000000);
  });

  it('does not round the result', () => {
    expect(evaluateArithmetic('1/3')).toBeCloseTo(0.3333333, 6);
    expect(evaluateArithmetic('123456.789')).toBe(123456.789);
  });

  it('rejects invalid expressions', () => {
    expect(() => evaluateArithmetic('1+')).toThrow();
    expect(() => evaluateArithmetic('abc')).toThrow();
    expect(() => evaluateArithmetic('(2+3')).toThrow(); // unmatched
    expect(() => evaluateArithmetic('2+3)')).toThrow(); // trailing
    expect(() => evaluateArithmetic('2^3')).toThrow(); // ^ unsupported
    expect(() => evaluateArithmetic('')).toThrow(); // empty
    expect(() => evaluateArithmetic('2 3')).toThrow(); // two numbers, no op
  });

  it('rejects a non-finite result (divide by zero)', () => {
    expect(() => evaluateArithmetic('1/0')).toThrow();
    expect(() => evaluateArithmetic('5/(2-2)')).toThrow();
  });
});
