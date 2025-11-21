#!/usr/bin/env node
/**
 * GenSON Runtime Library
 * 
 * A runtime implementation for evaluating GenSON (GenLang Schema) AST nodes.
 * GenSON is a JSON-based intermediate representation for GenLang.
 * 
 * @module genson
 */

// ============================================================================
// Constants
// ============================================================================

const NODE_TYPES = {
    TEXT: 'text',
    SEQUENCE: 'seq',
    OPTION: 'option',
    ROULETTE: 'roulette',
    REPETITION: 'repetition',
    DELEGATE: 'delegate',
    LAYER: 'layer',
    MODULE: 'module',
    VAR: 'var',
    VEC: 'vec',
    REF: 'ref',
    EXPRESSION: 'expression',
    EXPR: 'expr',
    CALL: 'call',
    SET: 'set',
    EFFECT: 'effect',
    DOMAIN: 'domain',
    MATCH: 'match'
};

const OPERATORS = {
    ADD: '+',
    SUB: '-',
    MUL: '*',
    DIV: '/',
    MOD: '%',
    GT: '>',
    LT: '<',
    GTE: '>=',
    LTE: '<=',
    EQ: '==',
    NEQ: '!=',
    AND: 'and',
    OR: 'or',
    NOT: 'not',
    TERNARY: '?:',
    MATCH_OP: '|',
    MATCH: 'match',
    MATCH_MUT: 'match_mut',
    GET: 'get'
};

const PATH_PREFIX = {
    PARENT: 'parent',
    PARENT_DOT: 'parent.'
};

const MAX_ITERATIONS = 10000; // Safety limit for loops
const MAX_RECURSION_DEPTH = 100; // Safety limit for recursion

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a value is a plain object (not null, not array)
 */
function isObject(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Convert a value to a number, returning NaN if conversion fails
 */
function toNumber(x) {
    if (typeof x === 'number') return x;
    if (typeof x === 'string' && x.trim() !== '' && !isNaN(Number(x))) {
        return Number(x);
    }
    return NaN;
}

/**
 * Check if a string represents a numeric index
 */
function isNumericIndex(str) {
    return /^\d+$/.test(String(str));
}

/**
 * Normalize node type (handle aliases like 'seq' for 'sequence')
 */
function normalizeNodeType(type) {
    if (type === 'seq') return NODE_TYPES.SEQUENCE;
    if (type === 'Roulette') return NODE_TYPES.ROULETTE;
    return type;
}

// ============================================================================
// Context Management
// ============================================================================

/**
 * Create a child context with inherited scope and declarations
 */
function createChildContext(parent) {
    return {
        scope: Object.create(parent.scope),
        parent: parent,
        decls: Object.create(parent.decls || null),
        rng: parent.rng,
        recursionDepth: parent.recursionDepth || 0
    };
}

/**
 * Create the root context for evaluation
 */
function createRootContext(seed) {
    // TODO: Implement seeded RNG when seed is provided
    return {
        scope: Object.create(null),
        parent: null,
        decls: Object.create(null),
        rng: Math.random,
        recursionDepth: 0
    };
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Tokenize a path string into an array of tokens
 * Supports: a.b.c, names[0], snake_case.member, parent.var
 */
function tokenizePath(pathStr) {
    const tokens = [];
    let i = 0;
    
    while (i < pathStr.length) {
        // Skip dots
        if (pathStr[i] === '.') {
            i++;
            continue;
        }
        
        // Handle array index notation: [index]
        if (pathStr[i] === '[') {
            const end = pathStr.indexOf(']', i);
            if (end === -1) break; // Malformed, skip
            const index = pathStr.slice(i + 1, end);
            tokens.push(index);
            i = end + 1;
            continue;
        }
        
        // Extract identifier (alphanumeric, underscore, dollar sign)
        let j = i;
        while (j < pathStr.length && /[A-Za-z0-9_$]/.test(pathStr[j])) {
            j++;
        }
        if (j > i) {
            tokens.push(pathStr.slice(i, j));
        }
        i = j;
    }
    
    return tokens;
}

/**
 * Resolve the target scope for a set operation
 * Handles 'parent.' prefix to access parent scope
 */
function resolveScopeForSet(ctx, pathStr) {
    if (pathStr.startsWith(PATH_PREFIX.PARENT_DOT)) {
        if (!ctx.parent) {
            throw new Error(`No parent scope available for path: ${pathStr}`);
        }
        const remainingPath = pathStr.slice(PATH_PREFIX.PARENT_DOT.length);
        return {
            target: ctx.parent.scope,
            tokens: tokenizePath(remainingPath)
        };
    }
    return {
        target: ctx.scope,
        tokens: tokenizePath(pathStr)
    };
}

/**
 * Get a value from context by path
 * Supports 'parent' and 'parent.xxx' paths for accessing parent scope
 */
function getPath(ctx, pathStr) {
    // Handle parent scope access
    if (pathStr === PATH_PREFIX.PARENT || pathStr.startsWith(PATH_PREFIX.PARENT_DOT)) {
        if (!ctx.parent) return undefined;
        if (pathStr === PATH_PREFIX.PARENT) return ctx.parent.scope;
        return getPath(ctx.parent, pathStr.slice(PATH_PREFIX.PARENT_DOT.length));
    }
    
    // Resolve path in current scope
    const tokens = tokenizePath(pathStr);
    let current = ctx.scope;
    
    for (const token of tokens) {
        if (current == null) return undefined;
        const key = isNumericIndex(token) ? Number(token) : token;
        current = current[key];
    }
    
    return current;
}

/**
 * Set a value in context by path
 * Creates intermediate objects as needed
 */
function setPath(ctx, pathStr, value) {
    const { target, tokens } = resolveScopeForSet(ctx, pathStr);
    if (tokens.length === 0) return;
    
    let current = target;
    
    // Navigate to parent of target, creating objects as needed
    for (let i = 0; i < tokens.length - 1; i++) {
        const token = tokens[i];
        const key = isNumericIndex(token) ? Number(token) : token;
        
        if (!isObject(current[key])) {
            current[key] = {};
        }
        current = current[key];
    }
    
    // Set the final value
    const lastToken = tokens[tokens.length - 1];
    const lastKey = isNumericIndex(lastToken) ? Number(lastToken) : lastToken;
    current[lastKey] = value;
}

// ============================================================================
// Random Selection
// ============================================================================

/**
 * Randomly select an item from an array
 */
function randomChoice(ctx, arr) {
    if (!arr || arr.length === 0) return undefined;
    const random = ctx.rng();
    const index = Math.floor(random * arr.length);
    return arr[index];
}

/**
 * Select an item from an array based on weights
 */
function weightedChoice(ctx, items) {
    if (!items || items.length === 0) return undefined;
    
    // Calculate weights for each item
    const weights = items.map(item => {
        // Support both 'weight' and 'wt' (short form)
        const weightExpr = item.weight !== undefined ? item.weight : 
                          (item.wt !== undefined ? item.wt : 1);
        const weight = Number(evaluateExpr(weightExpr, ctx));
        return isNaN(weight) || weight < 0 ? 1 : weight;
    });
    
    // Calculate total weight
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) return items[0]; // Fallback
    
    // Select based on weighted random
    let random = ctx.rng() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return items[i];
        }
    }
    
    // Fallback to last item
    return items[items.length - 1];
}

// ============================================================================
// Domain Evaluation
// ============================================================================

/**
 * Check if a number belongs to a Domain
 */
function evaluateDomain(domain, value, ctx) {
    if (!domain || !domain.branch) return null;
    
    const numValue = Number(value);
    if (isNaN(numValue)) return null;
    
    for (const branch of domain.branch) {
        const range = branch.range;
        if (range === undefined) continue;
        
        // Handle single number
        if (typeof range === 'number') {
            if (numValue === range) return branch.string;
        }
        // Handle array of ranges
        else if (Array.isArray(range)) {
            for (const r of range) {
                if (typeof r === 'number') {
                    if (numValue === r) return branch.string;
                } else if (Array.isArray(r) && r.length === 2) {
                    const [min, max] = r;
                    if (numValue >= min && numValue <= max) return branch.string;
                }
            }
        }
    }
    
    return null;
}

/**
 * Get Domain from context by name
 */
function getDomain(ctx, name) {
    // Search in current and parent contexts
    let current = ctx;
    while (current) {
        if (current.decls && current.decls[name]) {
            const decl = current.decls[name];
            if (decl.type === NODE_TYPES.DOMAIN) {
                return decl;
            }
        }
        current = current.parent;
    }
    return null;
}

// ============================================================================
// Match Evaluation
// ============================================================================

/**
 * Evaluate a match requirement
 */
function evaluateMatchReq(req, argValue, ctx) {
    // Check domain
    if (req.domain) {
        const domain = getDomain(ctx, req.domain);
        if (domain) {
            const domainResult = evaluateDomain(domain, argValue, ctx);
            if (!domainResult) return false;
        }
    }
    
    // Check index (for accessing array/struct fields)
    if (req.index !== undefined) {
        // TODO: Implement struct/array field access
    }
    
    // Check expression
    if (req.expr) {
        // Evaluate expression with argValue in context
        const exprCtx = createChildContext(ctx);
        exprCtx.scope._arg = argValue;
        const result = evaluateExpr(req.expr, exprCtx);
        // Simple equality check for now
        if (Array.isArray(req.expr) && req.expr[0] === 'eq') {
            return result === req.expr[1];
        }
        return Boolean(result);
    }
    
    return true; // No requirements means always match
}

/**
 * Evaluate a Match node
 */
function evaluateMatchNode(match, args, ctx) {
    if (!match || !match.branch) return null;
    
    // Evaluate each branch in order
    for (const branch of match.branch) {
        if (!branch.req || !Array.isArray(branch.req)) continue;
        
        // Check if all requirements are satisfied
        let allMatch = true;
        for (let i = 0; i < branch.req.length; i++) {
            const req = branch.req[i];
            const argValue = i < args.length ? args[i] : undefined;
            
            if (!evaluateMatchReq(req, argValue, ctx)) {
                allMatch = false;
                break;
            }
        }
        
        if (allMatch) {
            return branch.to;
        }
    }
    
    return null; // No branch matched
}

/**
 * Get Match from context by name
 */
function getMatch(ctx, name) {
    // Search in current and parent contexts
    let current = ctx;
    while (current) {
        if (current.decls && current.decls[name]) {
            const decl = current.decls[name];
            if (decl.type === NODE_TYPES.MATCH) {
                return decl;
            }
        }
        current = current.parent;
    }
    return null;
}

// ============================================================================
// Expression Evaluation
// ============================================================================

/**
 * Evaluate an expression node
 * Supports literals, arrays, operators, references, and function calls
 */
function evaluateExpr(expr, ctx) {
    // Handle null/undefined
    if (expr === null || expr === undefined) return '';
    
    // Handle primitive literals
    if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean') {
        return expr;
    }
    
    // Handle arrays (join as strings)
    if (Array.isArray(expr)) {
        return expr.map(x => evaluateExpr(x, ctx)).join('');
    }
    
    // Handle wrapped expression nodes
    if (isObject(expr)) {
        const type = normalizeNodeType(expr.type);
        
        if (type === NODE_TYPES.EXPR || type === NODE_TYPES.EXPRESSION) {
            return evaluateExpr(expr.value ?? expr.expr, ctx);
        }
        
        if (type === NODE_TYPES.REF) {
            const path = expr.to ?? expr.path ?? expr.value ?? '';
            return getPath(ctx, String(path));
        }
        
        if (type === NODE_TYPES.CALL) {
            return evaluateCall(expr, ctx);
        }
        
        // Handle operator expressions
        if (expr.op) {
            return evaluateOperator(expr, ctx);
        }
        
        // Handle expr array format: [1, "+", 2] or ["ref", "x"]
        if (expr.expr && Array.isArray(expr.expr)) {
            return evaluateExprArray(expr.expr, ctx);
        }
    }
    
    return expr;
}

/**
 * Evaluate expression in array format: [1, "+", 2] or ["ref", "x"]
 */
function evaluateExprArray(exprArray, ctx) {
    if (!Array.isArray(exprArray) || exprArray.length === 0) return '';
    
    // Handle reference: ["ref", "x"]
    if (exprArray[0] === 'ref' && exprArray.length >= 2) {
        return getPath(ctx, String(exprArray[1]));
    }
    
    // Handle variable: ["var", "$x"]
    if (exprArray[0] === 'var' && exprArray.length >= 2) {
        return getPath(ctx, String(exprArray[1]));
    }
    
    // Handle operators: [left, op, right]
    if (exprArray.length === 3) {
        const left = evaluateExpr(exprArray[0], ctx);
        const op = exprArray[1];
        const right = evaluateExpr(exprArray[2], ctx);
        return evaluateOperator({ op, left, right }, ctx);
    }
    
    // Fallback: evaluate all and join
    return exprArray.map(x => evaluateExpr(x, ctx)).join('');
}

/**
 * Evaluate an operator expression
 */
function evaluateOperator(expr, ctx) {
    const op = expr.op;
    const left = expr.left !== undefined ? evaluateExpr(expr.left, ctx) : undefined;
    const right = expr.right !== undefined ? evaluateExpr(expr.right, ctx) : undefined;
    
    switch (op) {
        case OPERATORS.GET: {
            const path = expr.path ?? expr.value;
            return getPath(ctx, String(path));
        }
        
        case OPERATORS.ADD: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum)) {
                return leftNum + rightNum;
            }
            return String(left ?? '') + String(right ?? '');
        }
        
        case OPERATORS.SUB: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum)) {
                return leftNum - rightNum;
            }
            return NaN;
        }
        
        case OPERATORS.MUL: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum)) {
                return leftNum * rightNum;
            }
            return NaN;
        }
        
        case OPERATORS.DIV: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum) && rightNum !== 0) {
                return leftNum / rightNum;
            }
            return NaN;
        }
        
        case OPERATORS.MOD: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum) && rightNum !== 0) {
                return leftNum % rightNum;
            }
            return NaN;
        }
        
        case OPERATORS.GT: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum)) {
                return leftNum > rightNum;
            }
            return String(left) > String(right);
        }
        
        case OPERATORS.LT: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum)) {
                return leftNum < rightNum;
            }
            return String(left) < String(right);
        }
        
        case OPERATORS.GTE: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum)) {
                return leftNum >= rightNum;
            }
            return String(left) >= String(right);
        }
        
        case OPERATORS.LTE: {
            const leftNum = toNumber(left);
            const rightNum = toNumber(right);
            if (!isNaN(leftNum) && !isNaN(rightNum)) {
                return leftNum <= rightNum;
            }
            return String(left) <= String(right);
        }
        
        case OPERATORS.EQ:
        case '==': {
            return left === right;
        }
        
        case OPERATORS.NEQ:
        case '!=': {
            return left !== right;
        }
        
        case OPERATORS.AND: {
            return Boolean(left) && Boolean(right);
        }
        
        case OPERATORS.OR: {
            return Boolean(left) || Boolean(right);
        }
        
        case OPERATORS.NOT: {
            return !Boolean(left);
        }
        
        case OPERATORS.TERNARY: {
            const condition = evaluateExpr(expr.cond, ctx);
            return condition ? 
                evaluateExpr(expr.then, ctx) : 
                evaluateExpr(expr.else, ctx);
        }
        
        case OPERATORS.MATCH_OP: {
            // left | right1, right2, ...
            // right is array: [matcherName, arg1, arg2, ...]
            const rightArray = Array.isArray(expr.right) ? expr.right : [expr.right];
            if (rightArray.length === 0) return '';
            
            const matcherName = evaluateExpr(rightArray[0], ctx);
            const match = getMatch(ctx, String(matcherName));
            if (!match) return '';
            
            const args = [left, ...rightArray.slice(1).map(arg => evaluateExpr(arg, ctx))];
            const result = evaluateMatchNode(match, args, ctx);
            return result !== null ? evaluateNode(result, ctx) : '';
        }
        
        case OPERATORS.MATCH: {
            // instance.matchfn(args...)
            const instance = left;
            const matcherName = evaluateExpr(expr.right, ctx);
            const match = getMatch(ctx, String(matcherName));
            if (!match) return '';
            
            const args = [instance, ...(expr.args || []).map(arg => evaluateExpr(arg, ctx))];
            const result = evaluateMatchNode(match, args, ctx);
            return result !== null ? evaluateNode(result, ctx) : '';
        }
        
        case OPERATORS.MATCH_MUT: {
            // instance->matchfn(args...) - mutates instance
            // TODO: Implement mutation
            return evaluateOperator({ ...expr, op: OPERATORS.MATCH }, ctx);
        }
        
        default:
            return '';
    }
}

/**
 * Evaluate a function call
 */
function evaluateCall(callNode, ctx) {
    const path = callNode.path;
    if (!path) return '';
    
    const args = (callNode.args || []).map(arg => evaluateExpr(arg, ctx));
    
    // Built-in functions
    if (path === 'rand_int' || path === 'randint') {
        if (args.length >= 2) {
            const min = Math.floor(Number(args[0]));
            const max = Math.floor(Number(args[1]));
            return Math.floor(ctx.rng() * (max - min + 1)) + min;
        }
    }
    
    // TODO: Support module functions
    
    return '';
}

// ============================================================================
// Node Evaluation
// ============================================================================

/**
 * Evaluate a GenSON node and return its string representation
 */
function evaluateNode(node, ctx) {
    // Check recursion depth
    if (ctx.recursionDepth >= MAX_RECURSION_DEPTH) {
        throw new Error(`Maximum recursion depth (${MAX_RECURSION_DEPTH}) exceeded`);
    }
    
    const newCtx = { ...ctx, recursionDepth: ctx.recursionDepth + 1 };
    
    // Handle null/undefined
    if (node === null || node === undefined) return '';
    
    // Handle primitive literals
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
        return String(node);
    }
    
    // Handle arrays (evaluate each and join)
    if (Array.isArray(node)) {
        return node.map(n => evaluateNode(n, newCtx)).join('');
    }
    
    // Handle non-objects
    if (!isObject(node)) return String(node);
    
    // Handle typed nodes
    const nodeType = normalizeNodeType(node.type);
    
    switch (nodeType) {
        case NODE_TYPES.TEXT:
            return evaluateText(node, newCtx);
        case NODE_TYPES.SEQUENCE:
            return evaluateSequence(node, newCtx);
        case NODE_TYPES.OPTION:
            return evaluateOption(node, newCtx);
        case NODE_TYPES.ROULETTE:
            return evaluateRoulette(node, newCtx);
        case NODE_TYPES.REPETITION:
            return evaluateRepetition(node, newCtx);
        case NODE_TYPES.DELEGATE:
            return evaluateDelegate(node, newCtx);
        case NODE_TYPES.LAYER:
            return evaluateLayer(node, newCtx);
        case NODE_TYPES.MODULE:
            return evaluateModule(node, newCtx);
        case NODE_TYPES.VEC:
            return evaluateVec(node, newCtx);
        case NODE_TYPES.REF:
            return evaluateRef(node, newCtx);
        case NODE_TYPES.EXPRESSION:
        case NODE_TYPES.EXPR:
            return evaluateExprNode(node, newCtx);
        case NODE_TYPES.CALL:
            return String(evaluateCall(node, newCtx));
        case NODE_TYPES.SET:
            return evaluateSet(node, newCtx);
        case NODE_TYPES.EFFECT:
            return evaluateEffect(node, newCtx);
        default:
            return '';
    }
}

/**
 * Evaluate a Text node
 */
function evaluateText(node, ctx) {
    return String(node.text ?? '');
}

/**
 * Evaluate a Sequence node (concatenate items)
 */
function evaluateSequence(node, ctx) {
    const items = node.items || [];
    return items.map(item => evaluateNode(item, ctx)).join('');
}

/**
 * Evaluate an Option node (random choice)
 */
function evaluateOption(node, ctx) {
    const items = node.items || [];
    const chosen = randomChoice(ctx, items);
    return evaluateNode(chosen, ctx);
}

/**
 * Evaluate a Roulette node (weighted choice)
 */
function evaluateRoulette(node, ctx) {
    const items = node.items || [];
    const chosen = weightedChoice(ctx, items);
    // Support both {value: node} and direct node format
    const value = chosen.value ?? chosen;
    return evaluateNode(value, ctx);
}

/**
 * Evaluate a Repetition node (fixed times)
 */
function evaluateRepetition(node, ctx) {
    const times = Number(node.times ?? 0);
    const value = node.value;
    const separator = node.separator;
    
    const parts = [];
    for (let i = 0; i < times; i++) {
        parts.push(evaluateNode(value, ctx));
    }
    
    const sep = separator !== undefined ? evaluateNode(separator, ctx) : '';
    return parts.join(sep);
}

/**
 * Evaluate a Delegate node (expression-controlled repetition)
 * Weight expression is re-evaluated on each iteration with access to loop variables
 */
function evaluateDelegate(node, ctx) {
    const weightExpr = node.weight;
    const value = node.value;
    const indexName = node.index || 'i';
    const separator = node.separator;
    
    const parts = [];
    let iteration = 1;
    
    // Weight expression is re-evaluated on each iteration
    while (iteration <= MAX_ITERATIONS) {
        // Create child context for this iteration with injected index variable
        const iterCtx = createChildContext(ctx);
        iterCtx.scope[indexName] = iteration;
        
        // Re-evaluate weight expression with current iteration context
        const weightValue = evaluateExpr(weightExpr, iterCtx);
        const targetTimes = Number(weightValue);
        
        // If weight evaluates to invalid number, stop the loop
        if (isNaN(targetTimes) || targetTimes <= 0) {
            break;
        }
        
        // If current iteration exceeds target, stop
        if (iteration > targetTimes) {
            break;
        }
        
        // Evaluate items with current iteration context (injected with index variable)
        parts.push(evaluateNode(value, iterCtx));
        iteration++;
    }
    
    const sep = separator !== undefined ? evaluateNode(separator, ctx) : '';
    return parts.join(sep);
}

/**
 * Evaluate a Layer node (context with props and decls)
 */
function evaluateLayer(node, ctx) {
    const childCtx = createChildContext(ctx);
    
    // Load props as initial scope values
    if (isObject(node.prop) || isObject(node.props)) {
        const props = node.prop || node.props;
        for (const [key, value] of Object.entries(props)) {
            // Unwrap .value if present, otherwise use directly
            if (isObject(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
                childCtx.scope[key] = value.value;
            } else {
                childCtx.scope[key] = value;
            }
        }
    }
    
    // Load declarations (Match, Domain, etc.)
    if (isObject(node.decl) || isObject(node.decls)) {
        const decls = node.decl || node.decls;
        if (Array.isArray(decls)) {
            for (const decl of decls) {
                if (decl && decl.name) {
                    childCtx.decls[decl.name] = decl;
                }
            }
        } else if (isObject(decls)) {
            // Support object form of decls
            Object.assign(childCtx.decls, decls);
        }
    }
    
    // Execute 'before' hooks for side effects
    const beforeHooks = node.before || [];
    for (const hook of beforeHooks) {
        if (isObject(hook)) {
            if (hook.type === NODE_TYPES.SET) {
                const value = evaluateExpr(hook.value, childCtx);
                setPath(childCtx, hook.path, value);
            } else if (hook.type === NODE_TYPES.EFFECT) {
                evaluateNode(hook, childCtx);
            }
        }
    }
    
    // Evaluate items
    // Layer's evaluate behavior is similar to Roulette
    if (Array.isArray(node.items)) {
        // If items is an array, treat as Roulette
        const items = node.items.map(item => ({
            weight: 1,
            value: item
        }));
        const chosen = weightedChoice(childCtx, items);
        return evaluateNode(chosen.value ?? chosen, childCtx);
    } else if (isObject(node.items)) {
        // If items is an object, evaluate it as a node
        return evaluateNode(node.items, childCtx);
    }
    
    return '';
}

/**
 * Evaluate a Module node
 */
function evaluateModule(node, ctx) {
    const items = node.items || [];
    const defaultItem = node.default;
    
    // If default is a string like "$0", "$1", treat as index
    if (typeof defaultItem === 'string' && /^\$\d+$/.test(defaultItem)) {
        const index = Number(defaultItem.slice(1));
        const chosen = items[index];
        return evaluateNode(chosen, ctx);
    }
    
    // If default is specified, evaluate it
    if (defaultItem !== undefined) {
        return evaluateNode(defaultItem, ctx);
    }
    
    // Otherwise, evaluate all items and join with newlines
    return items.map(item => evaluateNode(item, ctx)).join('\n');
}

/**
 * Evaluate a Vec node
 */
function evaluateVec(node, ctx) {
    // Vec returns the array itself, not converted to string
    // This is typically used in expressions, not directly in output
    const items = node.items || [];
    return items.map(item => evaluateNode(item, ctx));
}

/**
 * Evaluate a Ref node
 */
function evaluateRef(node, ctx) {
    const path = node.to ?? node.path ?? '';
    const target = getPath(ctx, String(path));
    
    if (target === undefined) {
        // If else is provided, use it
        if (node.else !== undefined) {
            return evaluateNode(node.else, ctx);
        }
        return '';
    }
    
    // If target is a node, evaluate it
    if (isObject(target) && target.type) {
        return evaluateNode(target, ctx);
    }
    
    // Otherwise return as string
    return String(target);
}

/**
 * Evaluate an Expr node (expression wrapper)
 */
function evaluateExprNode(node, ctx) {
    const value = evaluateExpr(node.value ?? node.expr, ctx);
    return String(value);
}

/**
 * Evaluate a Set node (assign value to path)
 */
function evaluateSet(node, ctx) {
    const value = evaluateExpr(node.value, ctx);
    setPath(ctx, node.path, value);
    return ''; // Set operations don't produce output
}

/**
 * Evaluate an Effect node (side effects only, no output)
 */
function evaluateEffect(node, ctx) {
    const items = node.items || [];
    for (const item of items) {
        if (isObject(item)) {
            if (item.type === NODE_TYPES.SET) {
                const value = evaluateExpr(item.value, ctx);
                setPath(ctx, item.path, value);
            } else if (item.type === NODE_TYPES.EFFECT) {
                evaluateNode(item, ctx);
            }
        }
    }
    return ''; // Effects don't produce output
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Evaluate a GenSON schema and return the generated text
 * @param {Object} schema - GenSON schema (AST)
 * @param {Object} options - Evaluation options
 * @param {number} options.seed - Optional random seed (not yet implemented)
 * @returns {string} Generated text
 */
function evaluate(schema, options) {
    const rootCtx = createRootContext(options && options.seed);
    return evaluateNode(schema, rootCtx);
}

export {
    evaluate,
    evaluateNode,
    evaluateExpr,
    createRootContext as createRoot
};
