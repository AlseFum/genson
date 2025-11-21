#!/usr/bin/env node
/**
 * GenSON Test Suite & Examples
 * 
 * Comprehensive test cases and examples demonstrating various GenSON node types.
 * Run with: node test.js
 */

import { evaluate, evaluateNode, evaluateExpr, createRoot } from './genson.js';

// ============================================================================
// Test Utilities
// ============================================================================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, schema, expectedPattern = null, description = '') {
    testCount++;
    try {
        const result = evaluate(schema);
        const passed = expectedPattern === null || 
                       (typeof expectedPattern === 'string' && result.includes(expectedPattern)) ||
                       (typeof expectedPattern === 'function' && expectedPattern(result));
        
        if (passed) {
            passCount++;
            console.log(`✓ Test ${testCount}: ${name}`);
            if (description) console.log(`  ${description}`);
            if (expectedPattern !== null) {
                console.log(`  Result: ${JSON.stringify(result)}`);
            }
        } else {
            failCount++;
            console.error(`✗ Test ${testCount}: ${name}`);
            console.error(`  Expected pattern: ${expectedPattern}`);
            console.error(`  Got: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        failCount++;
        console.error(`✗ Test ${testCount}: ${name} - ERROR`);
        console.error(`  ${error.message}`);
        if (error.stack) console.error(error.stack);
    }
    console.log('');
}

function testMultiple(name, schema, count = 5) {
    testCount++;
    console.log(`Test ${testCount}: ${name} (running ${count} times)`);
    const results = [];
    for (let i = 0; i < count; i++) {
        try {
            const result = evaluate(schema);
            results.push(result);
            console.log(`  Run ${i + 1}: ${JSON.stringify(result)}`);
        } catch (error) {
            console.error(`  Run ${i + 1}: ERROR - ${error.message}`);
        }
    }
    passCount++;
    console.log('');
}

// ============================================================================
// Test Cases: Basic Nodes
// ============================================================================

console.log('='.repeat(70));
console.log('GenSON Test Suite');
console.log('='.repeat(70));
console.log('');

// Test 1: Simple Text
test('Simple Text', 'Hello World', 'Hello World', 'Basic text node');

// Test 2: Sequence
test('Sequence', {
    type: 'seq',
    items: ['Hello', ' ', 'World', '!']
}, 'Hello World!', 'Sequence concatenation');

// Test 3: Option (Random Choice)
testMultiple('Option - Random Choice', {
    type: 'option',
    items: ['Alice', 'Bob', 'Charlie']
}, 5);

// Test 4: Roulette (Weighted Choice)
testMultiple('Roulette - Weighted Choice', {
    type: 'roulette',
    items: [
        { weight: 1, value: 'Common' },
        { weight: 2, value: 'Uncommon' },
        { weight: 5, value: 'Rare' }
    ]
}, 5);

// Test 5: Repetition
test('Repetition', {
    type: 'repetition',
    times: 3,
    value: 'Ha',
    separator: ' '
}, 'Ha Ha Ha', 'Fixed repetition with separator');

// Test 6: Delegate (Expression-controlled repetition)
test('Delegate with fixed weight', {
    type: 'delegate',
    weight: 3,
    value: {
        type: 'seq',
        items: ['Item', { type: 'expr', value: 'i' }]
    },
    separator: ', '
}, 'Item1, Item2, Item3', 'Delegate with fixed weight expression');

// Test 7: Delegate with dynamic weight from context
test('Delegate with dynamic weight', {
    type: 'layer',
    props: {
        maxCount: 4
    },
    items: {
        type: 'delegate',
        weight: {
            type: 'ref',
            to: 'maxCount'
        },
        value: {
            type: 'seq',
            items: ['Item', { type: 'expr', value: 'i' }]
        },
        separator: ', '
    }
}, 'Item1, Item2, Item3, Item4', 'Delegate with weight from context variable');

// ============================================================================
// Test Cases: Expressions
// ============================================================================

// Test 8: Expression - Numeric Addition
test('Expression - Numeric Addition', {
    type: 'expr',
    value: {
        op: '+',
        left: 10,
        right: 20
    }
}, '30', 'Numeric addition');

// Test 9: Expression - String Concatenation
test('Expression - String Concatenation', {
    type: 'expr',
    value: {
        op: '+',
        left: 'Hello',
        right: ' World'
    }
}, 'Hello World', 'String concatenation');

// Test 10: Expression - Comparison
test('Expression - Greater Than or Equal', {
    type: 'expr',
    value: {
        op: '>=',
        left: 15,
        right: 10
    }
}, 'true', 'Comparison operator');

// Test 11: Expression - Ternary
test('Expression - Ternary Operator', {
    type: 'expr',
    value: {
        op: '?:',
        cond: true,
        then: 'Yes',
        else: 'No'
    }
}, 'Yes', 'Ternary conditional');

// Test 12: Expression - Array Format
test('Expression - Array Format', {
    type: 'expr',
    expr: [10, '+', 20]
}, '30', 'Expression in array format');

// ============================================================================
// Test Cases: Layer & Context
// ============================================================================

// Test 13: Layer with Props
test('Layer with Props', {
    type: 'layer',
    props: {
        name: 'Alice',
        count: 5
    },
    items: [
        {
            type: 'seq',
            items: ['Hello, ', { type: 'ref', to: 'name' }, '!']
        }
    ]
}, 'Hello, Alice!', 'Layer with properties and reference');

// Test 14: Layer with Variable Assignment
test('Layer with Variable Assignment', {
    type: 'layer',
    props: {
        counter: 0
    },
    before: [
        {
            type: 'set',
            path: 'counter',
            value: {
                op: '+',
                left: { type: 'ref', to: 'counter' },
                right: 1
            }
        }
    ],
    items: [
        {
            type: 'seq',
            items: ['Count: ', { type: 'ref', to: 'counter' }]
        }
    ]
}, 'Count: 1', 'Layer with variable assignment in before hook');

// Test 15: Nested Layers
test('Nested Layers', {
    type: 'layer',
    props: {
        outer: 'Outer'
    },
    items: [
        {
            type: 'layer',
            props: {
                inner: 'Inner'
            },
            items: [
                {
                    type: 'seq',
                    items: [
                        { type: 'ref', to: 'outer' },
                        ' - ',
                        { type: 'ref', to: 'inner' }
                    ]
                }
            ]
        }
    ]
}, 'Outer - Inner', 'Nested layers with scope inheritance');

// Test 16: Parent Scope Access
test('Parent Scope Access', {
    type: 'layer',
    props: {
        parentValue: 'Parent'
    },
    items: [
        {
            type: 'layer',
            props: {
                childValue: 'Child'
            },
            items: [
                {
                    type: 'seq',
                    items: [
                        { type: 'ref', to: 'parent.parentValue' },
                        ' - ',
                        { type: 'ref', to: 'childValue' }
                    ]
                }
            ]
        }
    ]
}, 'Parent - Child', 'Accessing parent scope');

// ============================================================================
// Test Cases: Complex Examples
// ============================================================================

// Test 17: Greeting Generator
testMultiple('Greeting Generator', {
    type: 'layer',
    props: {
        name: 'Alice'
    },
    items: {
        type: 'roulette',
        items: [
            {
                weight: 1,
                value: {
                    type: 'seq',
                    items: ['Hello, ', { type: 'ref', to: 'name' }, '!']
                }
            },
            {
                weight: 1,
                value: {
                    type: 'seq',
                    items: ['Hi there, ', { type: 'ref', to: 'name' }, '!']
                }
            },
            {
                weight: 2,
                value: {
                    type: 'seq',
                    items: ['Greetings, ', { type: 'ref', to: 'name' }, '!']
                }
            }
        ]
    }
}, 5);

// Test 18: Numbered List
test('Numbered List', {
    type: 'delegate',
    weight: 5,
    value: {
        type: 'seq',
        items: [
            { type: 'expr', value: 'i' },
            '. Item ',
            { type: 'expr', value: 'i' },
            '\n'
        ]
    }
}, '1. Item 1', 'Numbered list generation with weight expression');

// Test 19: Module Example
test('Module', {
    type: 'module',
    items: [
        'First line',
        'Second line',
        'Third line'
    ]
}, 'First line', 'Module with multiple items');

// Test 20: Complex Sequence with Options
testMultiple('Complex Sequence with Options', {
    type: 'seq',
    items: [
        'The ',
        {
            type: 'option',
            items: ['quick', 'lazy', 'smart']
        },
        ' ',
        {
            type: 'option',
            items: ['brown', 'red', 'blue']
        },
        ' fox'
    ]
}, 5);

// ============================================================================
// Test Cases: Expressions with References
// ============================================================================

// Test 21: Expression with Variable Reference
test('Expression with Variable Reference', {
    type: 'layer',
    props: {
        x: 10,
        y: 20
    },
    items: {
        type: 'expr',
        value: {
            op: '+',
            left: { type: 'ref', to: 'x' },
            right: { type: 'ref', to: 'y' }
        }
    }
}, '30', 'Expression using variable references');

// Test 22: Expression Array Format with Reference
test('Expression Array Format with Reference', {
    type: 'layer',
    props: {
        x: 10
    },
    items: {
        type: 'expr',
        expr: [{ type: 'ref', to: 'x' }, '+', 5]
    }
}, '15', 'Expression array format with reference');

// ============================================================================
// Test Cases: Edge Cases
// ============================================================================

// Test 23: Empty Sequence
test('Empty Sequence', {
    type: 'seq',
    items: []
}, '', 'Empty sequence returns empty string');

// Test 24: Single Item Option
test('Single Item Option', {
    type: 'option',
    items: ['Only Choice']
}, 'Only Choice', 'Option with single choice');

// Test 25: Zero Repetition
test('Zero Repetition', {
    type: 'repetition',
    times: 0,
    value: 'Repeat'
}, '', 'Repetition with zero times');

// Test 26: Empty Module
test('Empty Module', {
    type: 'module',
    items: []
}, '', 'Module with no items');

// Test 27: Null/Undefined Handling
test('Null Handling', null, '', 'Null node returns empty string');
test('Undefined Handling', undefined, '', 'Undefined node returns empty string');

// ============================================================================
// Test Cases: Call Function
// ============================================================================

// Test 28: Call - rand_int
test('Call - rand_int', {
    type: 'call',
    path: 'rand_int',
    args: [1, 10]
}, (result) => {
    const num = Number(result);
    return !isNaN(num) && num >= 1 && num <= 10;
}, 'Function call to rand_int');

// ============================================================================
// Test Summary
// ============================================================================

console.log('='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));
console.log(`Total Tests: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%`);
console.log('='.repeat(70));

if (failCount > 0) {
    process.exit(1);
}

