#!/usr/bin/env python3
# Minimal GenSON runtime library for the example schema.

import random
import re
from typing import Any, Dict, List

def is_object(x: Any) -> bool:
    return isinstance(x, dict)

def to_number(x: Any):
    if isinstance(x, (int, float)):
        return x
    try:
        return float(x)
    except Exception:
        return float('nan')

def tokenize_path(p: str) -> List[Any]:
    tokens = []
    i = 0
    while i < len(p):
        if p[i] == '.':
            i += 1
            continue
        if p[i] == '[':
            j = p.find(']', i)
            idx = p[i+1:j]
            tokens.append(idx)
            i = j + 1
            continue
        j = i
        while j < len(p) and re.match(r'[A-Za-z0-9_$]', p[j]):
            j += 1
        tokens.append(p[i:j])
        i = j
    return tokens

class Ctx:
    def __init__(self, scope=None, parent=None, decls=None, rng=None):
        self.scope = {} if scope is None else scope
        self.parent = parent
        self.decls = {} if decls is None else decls
        self.rng = random.random if rng is None else rng

def ctx_child(parent: Ctx) -> Ctx:
    child = Ctx(scope={}, parent=parent, decls=parent.decls, rng=parent.rng)
    child.scope.update(parent.scope)
    return child

def get_path(ctx: Ctx, path_str: str):
    if path_str == 'parent' or path_str.startswith('parent.'):
        if not ctx.parent:
            return None
        if path_str == 'parent':
            return ctx.parent.scope
        return get_path(ctx.parent, path_str[len('parent.'):])
    tokens = tokenize_path(path_str)
    cur: Any = ctx.scope
    for t in tokens:
        if cur is None:
            return None
        key = int(t) if str(t).isdigit() else t
        cur = cur.get(key) if isinstance(cur, dict) else (cur[key] if isinstance(cur, list) else None)
    return cur

def set_path(ctx: Ctx, path_str: str, value: Any):
    if path_str.startswith('parent.'):
        if not ctx.parent:
            raise RuntimeError('No parent scope for: ' + path_str)
        return set_path(ctx.parent, path_str[len('parent.'):], value)
    tokens = tokenize_path(path_str)
    cur = ctx.scope
    for t in tokens[:-1]:
        key = int(t) if str(t).isdigit() else t
        if key not in cur or not isinstance(cur[key], dict):
            cur[key] = {}
        cur = cur[key]
    last = tokens[-1]
    last_key = int(last) if str(last).isdigit() else last
    cur[last_key] = value

def random_choice(ctx: Ctx, arr: List[Any]):
    return arr[int(ctx.rng() * len(arr))]

def weighted_choice(ctx: Ctx, items: List[Dict[str, Any]]):
    def weight_of(it):
        w = it.get('weight', it.get('wt', 1))
        return float(evaluate_expr(w, ctx))
    weights = [w if not (w != w) else 1 for w in map(weight_of, items)]  # NaN check
    s = sum(weights)
    r = ctx.rng() * s
    for i, w in enumerate(weights):
        r -= w
        if r <= 0:
            return items[i]
    return items[-1]

def evaluate_expr(expr: Any, ctx: Ctx):
    if expr is None:
        return ''
    if isinstance(expr, (str, int, float, bool)):
        return expr
    if isinstance(expr, list):
        return ''.join(str(evaluate_expr(x, ctx)) for x in expr)
    if is_object(expr) and expr.get('type') == 'expr':
        return evaluate_expr(expr.get('value'), ctx)
    if is_object(expr) and expr.get('type') == 'ref':
        p = expr.get('path', expr.get('value'))
        return get_path(ctx, str(p))
    if not is_object(expr):
        return expr
    op = expr.get('op')
    if op == 'get':
        p = expr.get('path', expr.get('value'))
        return get_path(ctx, str(p))
    if op == '+':
        l = evaluate_expr(expr.get('left'), ctx)
        r = evaluate_expr(expr.get('right'), ctx)
        ln, rn = to_number(l), to_number(r)
        if ln == ln and rn == rn:  # not NaN
            return ln + rn
        return f'{l}{r}'
    if op == 'eq':
        l = evaluate_expr(expr.get('left'), ctx)
        r = evaluate_expr(expr.get('right'), ctx)
        return l == r
    if op == '>=':
        l = to_number(evaluate_expr(expr.get('left'), ctx))
        r = to_number(evaluate_expr(expr.get('right'), ctx))
        return l >= r
    if op == '?:':
        cond = evaluate_expr(expr.get('cond'), ctx)
        return evaluate_expr(expr.get('then' if cond else 'else'), ctx)
    if op == 'match':
        src = evaluate_expr(expr.get('source'), ctx)
        return str(src)
    return ''

def evaluate_node(node: Any, ctx: Ctx) -> str:
    if node is None:
        return ''
    if isinstance(node, (str, int, float, bool)):
        return str(node)
    if isinstance(node, list):
        return ''.join(evaluate_node(x, ctx) for x in node)
    if not is_object(node):
        return str(node)
    t = node.get('type')
    if t == 'module':
        items = node.get('items', [])
        default = node.get('default')
        if isinstance(default, str) and default.startswith('$') and default[1:].isdigit():
            idx = int(default[1:])
            chosen = items[idx] if 0 <= idx < len(items) else None
            return evaluate_node(chosen, ctx) if chosen is not None else ''
        results = [evaluate_node(it, ctx) for it in items]
        return '\n'.join(results)
    if t == 'seq':
        return ''.join(evaluate_node(it, ctx) for it in node.get('items', []))
    if t == 'option':
        choice = random_choice(ctx, node.get('items', []))
        return evaluate_node(choice, ctx)
    if t in ('Roulette', 'roulette'):
        choice = weighted_choice(ctx, node.get('items', []))
        return evaluate_node(choice.get('value', choice), ctx)
    if t == 'repeat':
        time = node.get('time', 0)
        time = int(evaluate_expr(time, ctx) if is_object(time) or isinstance(time, (str, int, float)) else 0)
        parts = [evaluate_node(node.get('items'), ctx) for _ in range(time)]
        sep = evaluate_node(node.get('separator'), ctx) if node.get('separator') is not None else ''
        return sep.join(parts)
    if t == 'delegate':
        time = node.get('time', 0)
        time = int(evaluate_expr(time, ctx) if is_object(time) or isinstance(time, (str, int, float)) else 0)
        idx_name = node.get('index', 'i')
        parts = []
        for i in range(1, time + 1):
            c = ctx_child(ctx)
            c.scope[idx_name] = i
            parts.append(evaluate_node(node.get('items'), c))
        sep = evaluate_node(node.get('separator'), ctx) if node.get('separator') is not None else ''
        return sep.join(parts)
    if t == 'layer':
        c = ctx_child(ctx)
        props = node.get('props', {})
        for k, v in props.items():
            if is_object(v) and 'value' in v:
                c.scope[k] = v['value']
            else:
                c.scope[k] = v
        c.decls = dict(ctx.decls or {})
        for d in node.get('decls', []):
            name = d.get('name')
            if name:
                c.decls[name] = d
        for b in node.get('before', []):
            if is_object(b) and b.get('type') == 'set':
                val = evaluate_expr(b.get('value'), c)
                set_path(c, b.get('path'), val)
            elif is_object(b) and b.get('type') == 'effect':
                evaluate_node(b, c)
        results = [evaluate_node(it, c) for it in node.get('items', [])]
        return '\n'.join(results)
    if t == 'effect':
        for it in node.get('items', []):
            if is_object(it) and it.get('type') == 'set':
                val = evaluate_expr(it.get('value'), ctx)
                set_path(ctx, it.get('path'), val)
            elif is_object(it) and it.get('type') == 'effect':
                evaluate_node(it, ctx)
        return ''
    if t == 'set':
        val = evaluate_expr(node.get('value'), ctx)
        set_path(ctx, node.get('path'), val)
        return ''
    if t == 'expr':
        return str(evaluate_expr(node.get('value'), ctx))
    return ''

def evaluate(schema: Any, rng=None) -> str:
    root = Ctx(scope={}, parent=None, decls={}, rng=rng or random.random)
    return evaluate_node(schema, root)

__all__ = [
    'Ctx',
    'evaluate',
    'evaluate_node',
    'evaluate_expr',
]


