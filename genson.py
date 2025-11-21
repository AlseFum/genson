#!/usr/bin/env python3
"""
GenSON Runtime Library

A runtime implementation for evaluating GenSON (GenLang Schema) AST nodes.
GenSON is a JSON-based intermediate representation for GenLang.
"""

import random
import re
import math
from typing import Any, Dict, List, Optional, Union, Callable

# ============================================================================
# Constants
# ============================================================================

NODE_TYPES = {
    'TEXT': 'text',
    'SEQUENCE': 'seq',
    'OPTION': 'option',
    'ROULETTE': 'roulette',
    'REPETITION': 'repetition',
    'DELEGATE': 'delegate',
    'LAYER': 'layer',
    'MODULE': 'module',
    'VAR': 'var',
    'VEC': 'vec',
    'REF': 'ref',
    'EXPRESSION': 'expression',
    'EXPR': 'expr',
    'CALL': 'call',
    'SET': 'set',
    'EFFECT': 'effect',
    'DOMAIN': 'domain',
    'MATCH': 'match'
}

OPERATORS = {
    'ADD': '+',
    'SUB': '-',
    'MUL': '*',
    'DIV': '/',
    'MOD': '%',
    'GT': '>',
    'LT': '<',
    'GTE': '>=',
    'LTE': '<=',
    'EQ': '==',
    'NEQ': '!=',
    'AND': 'and',
    'OR': 'or',
    'NOT': 'not',
    'TERNARY': '?:',
    'MATCH_OP': '|',
    'MATCH': 'match',
    'MATCH_MUT': 'match_mut',
    'GET': 'get'
}

PATH_PREFIX = {
    'PARENT': 'parent',
    'PARENT_DOT': 'parent.'
}

MAX_ITERATIONS = 10000  # Safety limit for loops
MAX_RECURSION_DEPTH = 100  # Safety limit for recursion

# ============================================================================
# Utility Functions
# ============================================================================

def is_object(x: Any) -> bool:
    """Check if a value is a dictionary (object)."""
    return isinstance(x, dict)

def to_number(x: Any) -> float:
    """Convert a value to a number, returning NaN if conversion fails."""
    if isinstance(x, (int, float)):
        return float(x)
    if isinstance(x, str) and x.strip():
        try:
            return float(x)
        except ValueError:
            return float('nan')
        return float('nan')

def is_numeric_index(s: str) -> bool:
    """Check if a string represents a numeric index."""
    return s.isdigit()

def normalize_node_type(node_type: str) -> str:
    """Normalize node type (handle aliases like 'seq' for 'sequence')."""
    if node_type == 'seq':
        return NODE_TYPES['SEQUENCE']
    if node_type == 'Roulette':
        return NODE_TYPES['ROULETTE']
    return node_type

def is_nan(x: float) -> bool:
    """Check if a number is NaN."""
    return math.isnan(x)

# ============================================================================
# Context Management
# ============================================================================

class Ctx:
    """Evaluation context containing scope, declarations, and RNG."""
    
    def __init__(self, scope: Optional[Dict] = None, parent: Optional['Ctx'] = None, 
                 decls: Optional[Dict] = None, rng: Optional[Callable] = None,
                 recursion_depth: int = 0):
        self.scope = {} if scope is None else scope.copy()
        self.parent = parent
        self.decls = {} if decls is None else decls.copy()
        self.rng = rng if rng is not None else random.random
        self.recursion_depth = recursion_depth

def create_child_context(parent: Ctx) -> Ctx:
    """Create a child context with inherited scope and declarations."""
    child = Ctx(
        scope={},
        parent=parent,
        decls=parent.decls,
        rng=parent.rng,
        recursion_depth=parent.recursion_depth
    )
    child.scope.update(parent.scope)
    return child

def create_root_context(seed: Optional[int] = None) -> Ctx:
    """Create the root context for evaluation."""
    # TODO: Implement seeded RNG when seed is provided
    rng = random.random
    if seed is not None:
        random.seed(seed)
    return Ctx(
        scope={},
        parent=None,
        decls={},
        rng=rng,
        recursion_depth=0
    )

# ============================================================================
# Path Resolution
# ============================================================================

def tokenize_path(path_str: str) -> List[str]:
    """
    Tokenize a path string into an array of tokens.
    Supports: a.b.c, names[0], snake_case.member, parent.var
    """
    tokens = []
    i = 0
    
    while i < len(path_str):
        # Skip dots
        if path_str[i] == '.':
            i += 1
            continue
        
        # Handle array index notation: [index]
        if path_str[i] == '[':
            j = path_str.find(']', i)
            if j == -1:
                break  # Malformed, skip
            index = path_str[i+1:j]
            tokens.append(index)
            i = j + 1
            continue
        
        # Extract identifier (alphanumeric, underscore, dollar sign)
        j = i
        while j < len(path_str) and re.match(r'[A-Za-z0-9_$]', path_str[j]):
            j += 1
        if j > i:
            tokens.append(path_str[i:j])
        i = j
    
    return tokens

def resolve_scope_for_set(ctx: Ctx, path_str: str) -> Dict[str, Any]:
    """Resolve the target scope for a set operation."""
    if path_str.startswith(PATH_PREFIX['PARENT_DOT']):
        if not ctx.parent:
            raise RuntimeError(f'No parent scope available for path: {path_str}')
        remaining_path = path_str[len(PATH_PREFIX['PARENT_DOT']):]
        return {
            'target': ctx.parent.scope,
            'tokens': tokenize_path(remaining_path)
        }
    return {
        'target': ctx.scope,
        'tokens': tokenize_path(path_str)
    }

def get_path(ctx: Ctx, path_str: str) -> Any:
    """
    Get a value from context by path.
    Supports 'parent' and 'parent.xxx' paths for accessing parent scope.
    """
    # Handle parent scope access
    if path_str == PATH_PREFIX['PARENT'] or path_str.startswith(PATH_PREFIX['PARENT_DOT']):
        if not ctx.parent:
            return None
        if path_str == PATH_PREFIX['PARENT']:
            return ctx.parent.scope
        return get_path(ctx.parent, path_str[len(PATH_PREFIX['PARENT_DOT']):])
    
    # Resolve path in current scope
    tokens = tokenize_path(path_str)
    current = ctx.scope
    
    for token in tokens:
        if current is None:
            return None
        key = int(token) if is_numeric_index(token) else token
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list):
            try:
                current = current[key] if 0 <= key < len(current) else None
            except (IndexError, TypeError):
                return None
        else:
            return None
    
    return current

def set_path(ctx: Ctx, path_str: str, value: Any) -> None:
    """Set a value in context by path. Creates intermediate objects as needed."""
    resolved = resolve_scope_for_set(ctx, path_str)
    target = resolved['target']
    tokens = resolved['tokens']
    
    if not tokens:
        return
    
    current = target
    
    # Navigate to parent of target, creating objects as needed
    for token in tokens[:-1]:
        key = int(token) if is_numeric_index(token) else token
        if key not in current or not isinstance(current[key], dict):
            current[key] = {}
        current = current[key]
    
    # Set the final value
    last_token = tokens[-1]
    last_key = int(last_token) if is_numeric_index(last_token) else last_token
    current[last_key] = value

# ============================================================================
# Random Selection
# ============================================================================

def random_choice(ctx: Ctx, arr: List[Any]) -> Any:
    """Randomly select an item from an array."""
    if not arr or len(arr) == 0:
        return None
    index = int(ctx.rng() * len(arr))
    return arr[index]

def weighted_choice(ctx: Ctx, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Select an item from an array based on weights."""
    if not items or len(items) == 0:
        return None
    
    # Calculate weights for each item
    weights = []
    for item in items:
        # Support both 'weight' and 'wt' (short form)
        weight_expr = item.get('weight', item.get('wt', 1))
        weight = float(evaluate_expr(weight_expr, ctx))
        if is_nan(weight) or weight < 0:
            weight = 1
        weights.append(weight)
    
    # Calculate total weight
    total_weight = sum(weights)
    if total_weight <= 0:
        return items[0]  # Fallback
    
    # Select based on weighted random
    r = ctx.rng() * total_weight
    for i, weight in enumerate(weights):
        r -= weight
        if r <= 0:
            return items[i]
    
    # Fallback to last item
    return items[-1]

# ============================================================================
# Domain Evaluation
# ============================================================================

def evaluate_domain(domain: Dict[str, Any], value: Any, ctx: Ctx) -> Optional[str]:
    """Check if a number belongs to a Domain."""
    if not domain or 'branch' not in domain:
        return None
    
    num_value = to_number(value)
    if is_nan(num_value):
        return None
    
    for branch in domain.get('branch', []):
        range_val = branch.get('range')
        if range_val is None:
            continue
        
        # Handle single number
        if isinstance(range_val, (int, float)):
            if num_value == range_val:
                return branch.get('string')
        # Handle array of ranges
        elif isinstance(range_val, list):
            for r in range_val:
                if isinstance(r, (int, float)):
                    if num_value == r:
                        return branch.get('string')
                elif isinstance(r, list) and len(r) == 2:
                    min_val, max_val = r[0], r[1]
                    if min_val <= num_value <= max_val:
                        return branch.get('string')
    
    return None

def get_domain(ctx: Ctx, name: str) -> Optional[Dict[str, Any]]:
    """Get Domain from context by name."""
    current = ctx
    while current:
        if current.decls and name in current.decls:
            decl = current.decls[name]
            if decl.get('type') == NODE_TYPES['DOMAIN']:
                return decl
        current = current.parent
    return None

# ============================================================================
# Match Evaluation
# ============================================================================

def evaluate_match_req(req: Dict[str, Any], arg_value: Any, ctx: Ctx) -> bool:
    """Evaluate a match requirement."""
    # Check domain
    if 'domain' in req:
        domain = get_domain(ctx, req['domain'])
        if domain:
            domain_result = evaluate_domain(domain, arg_value, ctx)
            if domain_result is None:
                return False
    
    # Check index (for accessing array/struct fields)
    # TODO: Implement struct/array field access
    
    # Check expression
    if 'expr' in req:
        # Evaluate expression with argValue in context
        expr_ctx = create_child_context(ctx)
        expr_ctx.scope['_arg'] = arg_value
        result = evaluate_expr(req['expr'], expr_ctx)
        # Simple equality check for now
        if isinstance(req['expr'], list) and len(req['expr']) >= 2 and req['expr'][0] == 'eq':
            return result == req['expr'][1]
        return bool(result)
    
    return True  # No requirements means always match

def evaluate_match_node(match: Dict[str, Any], args: List[Any], ctx: Ctx) -> Optional[Any]:
    """Evaluate a Match node."""
    if not match or 'branch' not in match:
        return None
    
    # Evaluate each branch in order
    for branch in match.get('branch', []):
        reqs = branch.get('req', [])
        if not isinstance(reqs, list):
            continue
        
        # Check if all requirements are satisfied
        all_match = True
        for i, req in enumerate(reqs):
            arg_value = args[i] if i < len(args) else None
            if not evaluate_match_req(req, arg_value, ctx):
                all_match = False
                break
        
        if all_match:
            return branch.get('to')
    
    return None  # No branch matched

def get_match(ctx: Ctx, name: str) -> Optional[Dict[str, Any]]:
    """Get Match from context by name."""
    current = ctx
    while current:
        if current.decls and name in current.decls:
            decl = current.decls[name]
            if decl.get('type') == NODE_TYPES['MATCH']:
                return decl
        current = current.parent
    return None

# ============================================================================
# Expression Evaluation
# ============================================================================

def evaluate_expr_array(expr_array: List[Any], ctx: Ctx) -> Any:
    """Evaluate expression in array format: [1, '+', 2] or ['ref', 'x']."""
    if not isinstance(expr_array, list) or len(expr_array) == 0:
        return ''
    
    # Handle reference: ['ref', 'x']
    if expr_array[0] == 'ref' and len(expr_array) >= 2:
        return get_path(ctx, str(expr_array[1]))
    
    # Handle variable: ['var', '$x']
    if expr_array[0] == 'var' and len(expr_array) >= 2:
        return get_path(ctx, str(expr_array[1]))
    
    # Handle operators: [left, op, right]
    if len(expr_array) == 3:
        left = evaluate_expr(expr_array[0], ctx)
        op = expr_array[1]
        right = evaluate_expr(expr_array[2], ctx)
        return evaluate_operator({'op': op, 'left': left, 'right': right}, ctx)
    
    # Fallback: evaluate all and join
    return ''.join(str(evaluate_expr(x, ctx)) for x in expr_array)

def evaluate_operator(expr: Dict[str, Any], ctx: Ctx) -> Any:
    """Evaluate an operator expression."""
    op = expr.get('op')
    left = evaluate_expr(expr.get('left'), ctx) if 'left' in expr else None
    right = evaluate_expr(expr.get('right'), ctx) if 'right' in expr else None
    
    if op == OPERATORS['GET']:
        path = expr.get('path', expr.get('value'))
        return get_path(ctx, str(path))
    
    elif op == OPERATORS['ADD']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num):
            return left_num + right_num
        return f'{left or ""}{right or ""}'
    
    elif op == OPERATORS['SUB']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num):
            return left_num - right_num
        return float('nan')
    
    elif op == OPERATORS['MUL']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num):
            return left_num * right_num
        return float('nan')
    
    elif op == OPERATORS['DIV']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num) and right_num != 0:
            return left_num / right_num
        return float('nan')
    
    elif op == OPERATORS['MOD']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num) and right_num != 0:
            return left_num % right_num
        return float('nan')
    
    elif op == OPERATORS['GT']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num):
            return left_num > right_num
        return str(left) > str(right)
    
    elif op == OPERATORS['LT']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num):
            return left_num < right_num
        return str(left) < str(right)
    
    elif op == OPERATORS['GTE']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num):
            return left_num >= right_num
        return str(left) >= str(right)
    
    elif op == OPERATORS['LTE']:
        left_num = to_number(left)
        right_num = to_number(right)
        if not is_nan(left_num) and not is_nan(right_num):
            return left_num <= right_num
        return str(left) <= str(right)
    
    elif op == OPERATORS['EQ'] or op == '==':
        return left == right
    
    elif op == OPERATORS['NEQ'] or op == '!=':
        return left != right
    
    elif op == OPERATORS['AND']:
        return bool(left) and bool(right)
    
    elif op == OPERATORS['OR']:
        return bool(left) or bool(right)
    
    elif op == OPERATORS['NOT']:
        return not bool(left)
    
    elif op == OPERATORS['TERNARY']:
        condition = evaluate_expr(expr.get('cond'), ctx)
        return evaluate_expr(expr.get('then' if condition else 'else'), ctx)
    
    elif op == OPERATORS['MATCH_OP']:
        # left | right1, right2, ...
        # right is array: [matcherName, arg1, arg2, ...]
        right_array = right if isinstance(right, list) else [right]
        if not right_array:
            return ''
        
        matcher_name = evaluate_expr(right_array[0], ctx)
        match = get_match(ctx, str(matcher_name))
        if not match:
            return ''
        
        args = [left] + [evaluate_expr(arg, ctx) for arg in right_array[1:]]
        result = evaluate_match_node(match, args, ctx)
        return evaluate_node(result, ctx) if result is not None else ''
    
    elif op == OPERATORS['MATCH']:
        # instance.matchfn(args...)
        instance = left
        matcher_name = evaluate_expr(expr.get('right'), ctx)
        match = get_match(ctx, str(matcher_name))
        if not match:
            return ''
        
        args = [instance] + [evaluate_expr(arg, ctx) for arg in expr.get('args', [])]
        result = evaluate_match_node(match, args, ctx)
        return evaluate_node(result, ctx) if result is not None else ''
    
    elif op == OPERATORS['MATCH_MUT']:
        # instance->matchfn(args...) - mutates instance
        # TODO: Implement mutation
        return evaluate_operator({**expr, 'op': OPERATORS['MATCH']}, ctx)
    
    return ''

def evaluate_call(call_node: Dict[str, Any], ctx: Ctx) -> Any:
    """Evaluate a function call."""
    path = call_node.get('path')
    if not path:
        return ''
    
    args = [evaluate_expr(arg, ctx) for arg in call_node.get('args', [])]
    
    # Built-in functions
    if path == 'rand_int' or path == 'randint':
        if len(args) >= 2:
            min_val = int(args[0])
            max_val = int(args[1])
            return int(ctx.rng() * (max_val - min_val + 1)) + min_val
    
    # TODO: Support module functions
    
    return ''

def evaluate_expr(expr: Any, ctx: Ctx) -> Any:
    """
    Evaluate an expression node.
    Supports literals, arrays, operators, references, and function calls.
    """
    # Handle null/undefined
    if expr is None:
        return ''
    
    # Handle primitive literals
    if isinstance(expr, (str, int, float, bool)):
        return expr
    
    # Handle arrays (join as strings)
    if isinstance(expr, list):
        return ''.join(str(evaluate_expr(x, ctx)) for x in expr)
    
    # Handle wrapped expression nodes
    if is_object(expr):
        node_type = normalize_node_type(expr.get('type', ''))
        
        if node_type == NODE_TYPES['EXPR'] or node_type == NODE_TYPES['EXPRESSION']:
            return evaluate_expr(expr.get('value') or expr.get('expr'), ctx)
        
        if node_type == NODE_TYPES['REF']:
            path = expr.get('to') or expr.get('path') or expr.get('value') or ''
            return get_path(ctx, str(path))
        
        if node_type == NODE_TYPES['CALL']:
            return evaluate_call(expr, ctx)
        
        # Handle operator expressions
        if 'op' in expr:
            return evaluate_operator(expr, ctx)
        
        # Handle expr array format: [1, '+', 2] or ['ref', 'x']
        if 'expr' in expr and isinstance(expr['expr'], list):
            return evaluate_expr_array(expr['expr'], ctx)
    
        return expr

# ============================================================================
# Node Evaluation
# ============================================================================

def evaluate_node(node: Any, ctx: Ctx) -> str:
    """Evaluate a GenSON node and return its string representation."""
    # Check recursion depth
    if ctx.recursion_depth >= MAX_RECURSION_DEPTH:
        raise RuntimeError(f'Maximum recursion depth ({MAX_RECURSION_DEPTH}) exceeded')
    
    new_ctx = Ctx(
        scope=ctx.scope.copy(),
        parent=ctx.parent,
        decls=ctx.decls.copy(),
        rng=ctx.rng,
        recursion_depth=ctx.recursion_depth + 1
    )
    
    # Handle null/undefined
    if node is None:
        return ''
    
    # Handle primitive literals
    if isinstance(node, (str, int, float, bool)):
        return str(node)
    
    # Handle arrays (evaluate each and join)
    if isinstance(node, list):
        return ''.join(evaluate_node(n, new_ctx) for n in node)
    
    # Handle non-objects
    if not is_object(node):
        return str(node)
    
    # Handle typed nodes
    node_type = normalize_node_type(node.get('type', ''))
    
    if node_type == NODE_TYPES['TEXT']:
        return evaluate_text(node, new_ctx)
    elif node_type == NODE_TYPES['SEQUENCE']:
        return evaluate_sequence(node, new_ctx)
    elif node_type == NODE_TYPES['OPTION']:
        return evaluate_option(node, new_ctx)
    elif node_type == NODE_TYPES['ROULETTE']:
        return evaluate_roulette(node, new_ctx)
    elif node_type == NODE_TYPES['REPETITION']:
        return evaluate_repetition(node, new_ctx)
    elif node_type == NODE_TYPES['DELEGATE']:
        return evaluate_delegate(node, new_ctx)
    elif node_type == NODE_TYPES['LAYER']:
        return evaluate_layer(node, new_ctx)
    elif node_type == NODE_TYPES['MODULE']:
        return evaluate_module(node, new_ctx)
    elif node_type == NODE_TYPES['VEC']:
        return str(evaluate_vec(node, new_ctx))
    elif node_type == NODE_TYPES['REF']:
        return evaluate_ref(node, new_ctx)
    elif node_type == NODE_TYPES['EXPRESSION'] or node_type == NODE_TYPES['EXPR']:
        return evaluate_expr_node(node, new_ctx)
    elif node_type == NODE_TYPES['CALL']:
        return str(evaluate_call(node, new_ctx))
    elif node_type == NODE_TYPES['SET']:
        return evaluate_set(node, new_ctx)
    elif node_type == NODE_TYPES['EFFECT']:
        return evaluate_effect(node, new_ctx)
    else:
        return ''

def evaluate_text(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Text node."""
    return str(node.get('text', ''))

def evaluate_sequence(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Sequence node (concatenate items)."""
    items = node.get('items', [])
    return ''.join(evaluate_node(item, ctx) for item in items)

def evaluate_option(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate an Option node (random choice)."""
    items = node.get('items', [])
    chosen = random_choice(ctx, items)
    return evaluate_node(chosen, ctx) if chosen is not None else ''

def evaluate_roulette(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Roulette node (weighted choice)."""
    items = node.get('items', [])
    chosen = weighted_choice(ctx, items)
    if chosen is None:
        return ''
    # Support both {value: node} and direct node format
    value = chosen.get('value', chosen)
    return evaluate_node(value, ctx)

def evaluate_repetition(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Repetition node (fixed times)."""
    times = int(node.get('times', 0))
    value = node.get('value')
    separator = node.get('separator')
    
    parts = []
    for _ in range(times):
        parts.append(evaluate_node(value, ctx))
    
    sep = evaluate_node(separator, ctx) if separator is not None else ''
    return sep.join(parts)

def evaluate_delegate(node: Dict[str, Any], ctx: Ctx) -> str:
    """
    Evaluate a Delegate node (expression-controlled repetition).
    Weight expression is re-evaluated on each iteration with access to loop variables.
    """
    weight_expr = node.get('weight')
    value = node.get('value')
    index_name = node.get('index', 'i')
    separator = node.get('separator')
    
    parts = []
    iteration = 1
    
    # Weight expression is re-evaluated on each iteration
    while iteration <= MAX_ITERATIONS:
        # Create child context for this iteration with injected index variable
        iter_ctx = create_child_context(ctx)
        iter_ctx.scope[index_name] = iteration
        
        # Re-evaluate weight expression with current iteration context
        weight_value = evaluate_expr(weight_expr, iter_ctx)
        target_times = int(to_number(weight_value))
        
        # If weight evaluates to invalid number, stop the loop
        if is_nan(weight_value) or target_times <= 0:
            break
        
        # If current iteration exceeds target, stop
        if iteration > target_times:
            break
        
        # Evaluate items with current iteration context (injected with index variable)
        parts.append(evaluate_node(value, iter_ctx))
        iteration += 1
    
    sep = evaluate_node(separator, ctx) if separator is not None else ''
    return sep.join(parts)

def evaluate_layer(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Layer node (context with props and decls)."""
    child_ctx = create_child_context(ctx)
    
    # Load props as initial scope values
    props = node.get('prop') or node.get('props', {})
    if is_object(props):
        for key, value in props.items():
            # Unwrap .value if present, otherwise use directly
            if is_object(value) and 'value' in value:
                child_ctx.scope[key] = value['value']
            else:
                child_ctx.scope[key] = value
    
    # Load declarations (Match, Domain, etc.)
    decls = node.get('decl') or node.get('decls', {})
    if isinstance(decls, list):
        for decl in decls:
            if decl and decl.get('name'):
                child_ctx.decls[decl['name']] = decl
    elif is_object(decls):
        # Support object form of decls
        child_ctx.decls.update(decls)
    
    # Execute 'before' hooks for side effects
    before_hooks = node.get('before', [])
    for hook in before_hooks:
        if is_object(hook):
            if hook.get('type') == NODE_TYPES['SET']:
                value = evaluate_expr(hook.get('value'), child_ctx)
                set_path(child_ctx, hook.get('path'), value)
            elif hook.get('type') == NODE_TYPES['EFFECT']:
                evaluate_node(hook, child_ctx)
    
    # Evaluate items
    # Layer's evaluate behavior is similar to Roulette
    items = node.get('items', [])
    if isinstance(items, list):
        # If items is an array, treat as Roulette
        items_with_weight = [{'weight': 1, 'value': item} for item in items]
        chosen = weighted_choice(child_ctx, items_with_weight)
        return evaluate_node(chosen.get('value', chosen), child_ctx) if chosen else ''
    elif is_object(items):
        # If items is an object, evaluate it as a node
        return evaluate_node(items, child_ctx)
    
        return ''

def evaluate_module(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Module node."""
    items = node.get('items', [])
    default_item = node.get('default')
    
    # If default is a string like "$0", "$1", treat as index
    if isinstance(default_item, str) and default_item.startswith('$') and default_item[1:].isdigit():
        index = int(default_item[1:])
        chosen = items[index] if 0 <= index < len(items) else None
        return evaluate_node(chosen, ctx) if chosen is not None else ''
    
    # If default is specified, evaluate it
    if default_item is not None:
        return evaluate_node(default_item, ctx)
    
    # Otherwise, evaluate all items and join with newlines
    return '\n'.join(evaluate_node(item, ctx) for item in items)

def evaluate_vec(node: Dict[str, Any], ctx: Ctx) -> List[Any]:
    """Evaluate a Vec node."""
    # Vec returns the array itself, not converted to string
    items = node.get('items', [])
    return [evaluate_node(item, ctx) for item in items]

def evaluate_ref(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Ref node."""
    path = node.get('to') or node.get('path') or ''
    target = get_path(ctx, str(path))
    
    if target is None:
        # If else is provided, use it
        if 'else' in node:
            return evaluate_node(node['else'], ctx)
        return ''
    
    # If target is a node, evaluate it
    if is_object(target) and 'type' in target:
        return evaluate_node(target, ctx)
    
    # Otherwise return as string
    return str(target)

def evaluate_expr_node(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate an Expr node (expression wrapper)."""
    value = evaluate_expr(node.get('value') or node.get('expr'), ctx)
    return str(value)

def evaluate_set(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate a Set node (assign value to path)."""
    value = evaluate_expr(node.get('value'), ctx)
    set_path(ctx, node.get('path'), value)
    return ''  # Set operations don't produce output

def evaluate_effect(node: Dict[str, Any], ctx: Ctx) -> str:
    """Evaluate an Effect node (side effects only, no output)."""
    items = node.get('items', [])
    for item in items:
        if is_object(item):
            if item.get('type') == NODE_TYPES['SET']:
                value = evaluate_expr(item.get('value'), ctx)
                set_path(ctx, item.get('path'), value)
            elif item.get('type') == NODE_TYPES['EFFECT']:
                evaluate_node(item, ctx)
    return ''  # Effects don't produce output

# ============================================================================
# Public API
# ============================================================================

def evaluate(schema: Any, options: Optional[Dict[str, Any]] = None) -> str:
    """
    Evaluate a GenSON schema and return the generated text.
    
    Args:
        schema: GenSON schema (AST)
        options: Evaluation options
            - seed: Optional random seed
    
    Returns:
        Generated text
    """
    seed = options.get('seed') if options else None
    root_ctx = create_root_context(seed)
    return evaluate_node(schema, root_ctx)

__all__ = [
    'Ctx',
    'evaluate',
    'evaluate_node',
    'evaluate_expr',
    'create_root_context',
]
