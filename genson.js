#!/usr/bin/env node
/**
 * Minimal GenSON runtime library for the example schema.
 */

function isObject(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function toNumber(x) {
    if (typeof x === 'number') return x;
    if (typeof x === 'string' && x.trim() !== '' && !isNaN(Number(x))) return Number(x);
    return NaN;
}

function ctxChild(parent) {
    return { scope: Object.create(parent.scope), parent, decls: parent.decls, rng: parent.rng };
}

function tokenizePath(p) {
    // supports a.b.c, names[0], snake1.member2, parent.var
    const tokens = [];
    let i = 0;
    while (i < p.length) {
        if (p[i] === '.') { i++; continue; }
        if (p[i] === '[') {
            const end = p.indexOf(']', i);
            const idx = p.slice(i + 1, end);
            tokens.push(idx);
            i = end + 1;
            continue;
        }
        let j = i;
        while (j < p.length && /[A-Za-z0-9_$]/.test(p[j])) j++;
        tokens.push(p.slice(i, j));
        i = j;
    }
    return tokens;
}

function resolveScopeForSet(ctx, pathStr) {
    if (pathStr.startsWith('parent.')) {
        if (!ctx.parent) throw new Error('No parent scope for path: ' + pathStr);
        return { target: ctx.parent.scope, tokens: tokenizePath(pathStr.slice('parent.'.length)) };
    }
    return { target: ctx.scope, tokens: tokenizePath(pathStr) };
}

function getPath(ctx, pathStr) {
    if (pathStr === 'parent' || pathStr.startsWith('parent.')) {
        if (!ctx.parent) return undefined;
        if (pathStr === 'parent') return ctx.parent.scope;
        return getPath(ctx.parent, pathStr.slice('parent.'.length));
    }
    const tokens = tokenizePath(pathStr);
    let cur = ctx.scope;
    for (const t of tokens) {
        if (cur == null) return undefined;
        const key = /^\d+$/.test(String(t)) ? Number(t) : t;
        cur = cur[key];
    }
    return cur;
}

function setPath(ctx, pathStr, value) {
    const { target, tokens } = resolveScopeForSet(ctx, pathStr);
    let cur = target;
    for (let i = 0; i < tokens.length - 1; i++) {
        const t = tokens[i];
        const key = /^\d+$/.test(String(t)) ? Number(t) : t;
        if (!isObject(cur[key])) cur[key] = {};
        cur = cur[key];
    }
    const last = tokens[tokens.length - 1];
    const lastKey = /^\d+$/.test(String(last)) ? Number(last) : last;
    cur[lastKey] = value;
}

function randomChoice(ctx, arr) {
    const r = ctx.rng();
    return arr[Math.floor(r * arr.length)];
}

function weightedChoice(ctx, items) {
    const weights = items.map(it => {
        const w = it.weight !== undefined ? it.weight : (it.wt !== undefined ? it.wt : 1);
        return Number(evaluateExpr(w, ctx));
    }).map(x => (isNaN(x) ? 1 : x));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = ctx.rng() * sum;
    for (let i = 0; i < items.length; i++) {
        if ((r -= weights[i]) <= 0) return items[i];
    }
    return items[items.length - 1];
}

function evaluateExpr(expr, ctx) {
    if (expr === null || expr === undefined) return '';
    if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean') return expr;
    if (Array.isArray(expr)) return expr.map(x => evaluateExpr(x, ctx)).join('');
    if (isObject(expr) && expr.type === 'expr') return evaluateExpr(expr.value, ctx);
    if (isObject(expr) && expr.type === 'ref') return getPath(ctx, String(expr.path ?? expr.value ?? ''));
    if (!isObject(expr)) return expr;
    // operator object
    const op = expr.op;
    switch (op) {
        case 'get': {
            const p = expr.path ?? expr.value;
            return getPath(ctx, String(p));
        }
        case '+': {
            const l = evaluateExpr(expr.left, ctx);
            const r = evaluateExpr(expr.right, ctx);
            const ln = toNumber(l), rn = toNumber(r);
            if (!isNaN(ln) && !isNaN(rn)) return ln + rn;
            return String(l) + String(r);
        }
        case 'eq': {
            const l = evaluateExpr(expr.left, ctx);
            const r = evaluateExpr(expr.right, ctx);
            return l === r;
        }
        case '>=': {
            const l = toNumber(evaluateExpr(expr.left, ctx));
            const r = toNumber(evaluateExpr(expr.right, ctx));
            return l >= r;
        }
        case '?:': {
            const c = evaluateExpr(expr.cond, ctx);
            return c ? evaluateExpr(expr.then, ctx) : evaluateExpr(expr.else, ctx);
        }
        case 'match': {
            // Simplified: return String(source) for now
            const src = evaluateExpr(expr.source, ctx);
            return String(src);
        }
        default:
            return '';
    }
}

function evaluateNode(node, ctx) {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return String(node);
    if (Array.isArray(node)) return node.map(n => evaluateNode(n, ctx)).join('');
    if (!isObject(node)) return String(node);

    // Generic node by type
    const t = node.type;
    switch (t) {
        case 'module': {
            const items = node.items || [];
            const def = node.default;
            if (typeof def === 'string' && /^\$\d+$/.test(def)) {
                const idx = Number(def.slice(1));
                const chosen = items[idx];
                return evaluateNode(chosen, ctx);
            }
            return items.map(it => evaluateNode(it, ctx)).join('\n');
        }
        case 'seq': {
            return (node.items || []).map(it => evaluateNode(it, ctx)).join('');
        }
        case 'option': {
            const choice = randomChoice(ctx, node.items || []);
            return evaluateNode(choice, ctx);
        }
        case 'Roulette':
        case 'roulette': {
            const choice = weightedChoice(ctx, node.items || []);
            return evaluateNode(choice.value ?? choice, ctx);
        }
        case 'repeat': {
            const time = Number(evaluateExpr(node.time, ctx) ?? node.time ?? 0);
            const parts = [];
            for (let i = 0; i < time; i++) {
                parts.push(evaluateNode(node.items, ctx));
            }
            let sep = '';
            if (node.separator !== undefined) sep = evaluateNode(node.separator, ctx);
            return parts.join(sep);
        }
        case 'delegate': {
            const time = Number(evaluateExpr(node.time, ctx) ?? node.time ?? 0);
            const idxName = node.index || 'i';
            const parts = [];
            for (let i = 1; i <= time; i++) {
                const c = ctxChild(ctx);
                c.scope[idxName] = i;
                parts.push(evaluateNode(node.items, c));
            }
            let sep = '';
            if (node.separator !== undefined) sep = evaluateNode(node.separator, ctx);
            return parts.join(sep);
        }
        case 'layer': {
            const c = ctxChild(ctx);
            // load props as initial scope values (simple assignment / unwrap .value if present)
            if (isObject(node.props)) {
                for (const [k, v] of Object.entries(node.props)) {
                    if (isObject(v) && Object.prototype.hasOwnProperty.call(v, 'value')) {
                        c.scope[k] = v.value;
                    } else {
                        c.scope[k] = v;
                    }
                }
            }
            // decls kept for future (not fully implemented)
            c.decls = Object.create(ctx.decls || null);
            for (const d of (node.decls || [])) {
                if (d && d.name) c.decls[d.name] = d;
            }
            // before: execute for side effects
            for (const b of (node.before || [])) {
                // allow set/effect only
                if (isObject(b) && b.type === 'set') {
                    const val = evaluateExpr(b.value, c);
                    setPath(c, b.path, val);
                } else if (isObject(b) && b.type === 'effect') {
                    evaluateNode(b, c);
                }
            }
            // items: generate each and join by newline
            const list = node.items || [];
            return list.map(it => evaluateNode(it, c)).join('\n');
        }
        case 'effect': {
            for (const it of (node.items || [])) {
                if (isObject(it) && it.type === 'set') {
                    const val = evaluateExpr(it.value, ctx);
                    setPath(ctx, it.path, val);
                } else if (isObject(it) && it.type === 'effect') {
                    evaluateNode(it, ctx);
                }
            }
            return '';
        }
        case 'set': {
            const val = evaluateExpr(node.value, ctx);
            setPath(ctx, node.path, val);
            return '';
        }
        case 'expr': {
            const v = evaluateExpr(node.value, ctx);
            return String(v);
        }
        default:
            return '';
    }
}

function createRoot(seed) {
    // simple RNG wrapper; can accept fixed seed in future
    return {
        scope: Object.create(null),
        parent: null,
        decls: Object.create(null),
        rng: Math.random
    };
}

function evaluate(schema, options) {
    const root = createRoot(options && options.seed);
    return evaluateNode(schema, root);
}

module.exports = {
    evaluate,
    evaluateNode,
    evaluateExpr,
    createRoot
};


