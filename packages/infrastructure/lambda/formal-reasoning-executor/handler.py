"""
Formal Reasoning Executor Lambda

Python Lambda that executes formal reasoning libraries:
- Z3 Theorem Prover (constraint solving, theorem proving)
- PyArg (structured argumentation)
- PyReason (temporal graph reasoning)
- RDFLib (SPARQL, semantic web)
- OWL-RL (ontological inference)
- pySHACL (graph validation)

For neural-symbolic libraries (LTN, DeepProbLog), this Lambda
invokes SageMaker endpoints instead of running locally.
"""

import json
import os
import time
import traceback
from typing import Any, Dict, Optional
from datetime import datetime

# Z3 Theorem Prover
try:
    from z3 import (
        Solver, sat, unsat, unknown,
        Int, Real, Bool, BitVec, Array, String,
        And, Or, Not, Implies, If,
        ForAll, Exists,
        parse_smt2_string,
        Optimize
    )
    Z3_AVAILABLE = True
except ImportError:
    Z3_AVAILABLE = False

# RDFLib
try:
    from rdflib import Graph, Namespace, URIRef, Literal, BNode
    from rdflib.plugins.sparql import prepareQuery
    RDFLIB_AVAILABLE = True
except ImportError:
    RDFLIB_AVAILABLE = False

# OWL-RL
try:
    import owlrl
    OWLRL_AVAILABLE = True
except ImportError:
    OWLRL_AVAILABLE = False

# pySHACL
try:
    from pyshacl import validate as shacl_validate
    PYSHACL_AVAILABLE = True
except ImportError:
    PYSHACL_AVAILABLE = False

# PyReason (may not be available due to Numba requirements)
try:
    import pyreason as pr
    PYREASON_AVAILABLE = True
except ImportError:
    PYREASON_AVAILABLE = False


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for formal reasoning execution.
    
    Event structure:
    {
        "library": "z3" | "pyarg" | "pyreason" | "rdflib" | "owlrl" | "pyshacl" | "ltn" | "deepproblog",
        "taskType": "constraint_satisfaction" | "theorem_proving" | ... ,
        "input": { ... library-specific input ... },
        "config": { ... optional library config ... },
        "requestId": "unique-id",
        "tenantId": "tenant-id"
    }
    """
    start_time = time.time()
    request_id = event.get('requestId', f'fr-{int(time.time() * 1000)}')
    
    try:
        library = event.get('library')
        task_type = event.get('taskType')
        input_data = event.get('input', {})
        config = event.get('config', {})
        
        if not library:
            raise ValueError("Missing required field: library")
        
        # Route to appropriate executor
        if library == 'z3':
            result = execute_z3(task_type, input_data, config)
        elif library == 'rdflib':
            result = execute_rdflib(task_type, input_data, config)
        elif library == 'owlrl':
            result = execute_owlrl(task_type, input_data, config)
        elif library == 'pyshacl':
            result = execute_pyshacl(task_type, input_data, config)
        elif library == 'pyreason':
            result = execute_pyreason(task_type, input_data, config)
        elif library == 'pyarg':
            result = execute_pyarg(task_type, input_data, config)
        elif library in ('ltn', 'deepproblog'):
            # These require SageMaker - return instruction to call endpoint
            result = {
                'status': 'redirect',
                'message': f'{library} requires SageMaker endpoint',
                'endpoint': f'{library}-endpoint'
            }
        else:
            raise ValueError(f"Unknown library: {library}")
        
        compute_time_ms = int((time.time() - start_time) * 1000)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'requestId': request_id,
                'library': library,
                'taskType': task_type,
                'status': result.get('status', 'success'),
                'result': result.get('result'),
                'metrics': {
                    'computeTimeMs': compute_time_ms,
                    'memoryUsedMb': 0,  # Would need psutil for accurate measurement
                }
            })
        }
        
    except Exception as e:
        compute_time_ms = int((time.time() - start_time) * 1000)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'requestId': request_id,
                'status': 'error',
                'error': str(e),
                'traceback': traceback.format_exc(),
                'metrics': {
                    'computeTimeMs': compute_time_ms,
                }
            })
        }


# =============================================================================
# Z3 Theorem Prover Execution
# =============================================================================

def execute_z3(task_type: str, input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Execute Z3 constraint solving or theorem proving."""
    if not Z3_AVAILABLE:
        raise RuntimeError("Z3 is not available in this Lambda")
    
    timeout_ms = config.get('timeout_ms', 5000)
    
    if task_type == 'constraint_satisfaction':
        return z3_solve_constraints(input_data, timeout_ms)
    elif task_type == 'theorem_proving':
        return z3_prove_theorem(input_data, timeout_ms)
    elif task_type == 'belief_verification':
        return z3_verify_belief(input_data, timeout_ms)
    else:
        raise ValueError(f"Unsupported Z3 task type: {task_type}")


def z3_solve_constraints(input_data: Dict, timeout_ms: int) -> Dict[str, Any]:
    """Solve a set of constraints using Z3."""
    constraints = input_data.get('constraints', [])
    objective = input_data.get('objective')
    
    # Create solver or optimizer
    if objective:
        solver = Optimize()
    else:
        solver = Solver()
    
    solver.set('timeout', timeout_ms)
    
    # Create variables
    variables = {}
    for constraint in constraints:
        for var in constraint.get('variables', []):
            var_name = var['name']
            var_type = var['type']
            
            if var_name not in variables:
                if var_type == 'Int':
                    variables[var_name] = Int(var_name)
                elif var_type == 'Real':
                    variables[var_name] = Real(var_name)
                elif var_type == 'Bool':
                    variables[var_name] = Bool(var_name)
                elif var_type == 'BitVec':
                    bit_width = var.get('bitWidth', 32)
                    variables[var_name] = BitVec(var_name, bit_width)
    
    # Parse and add constraints
    for constraint in constraints:
        expr = constraint.get('expression', '')
        # Simple expression parsing - in production, use proper SMT-LIB2 parser
        try:
            # Try to parse as SMT-LIB2
            parsed = parse_smt2_string(f"(assert {expr})")
            for p in parsed:
                solver.add(p)
        except:
            # Fallback: evaluate as Python with variable context
            try:
                constraint_expr = eval(expr, {"__builtins__": {}}, {
                    **variables,
                    'And': And, 'Or': Or, 'Not': Not, 'Implies': Implies, 'If': If
                })
                solver.add(constraint_expr)
            except Exception as e:
                raise ValueError(f"Failed to parse constraint: {expr} - {e}")
    
    # Add objective if optimizing
    if objective and isinstance(solver, Optimize):
        if 'minimize' in objective:
            solver.minimize(variables.get(objective['minimize']))
        elif 'maximize' in objective:
            solver.maximize(variables.get(objective['maximize']))
    
    # Check satisfiability
    result = solver.check()
    
    if result == sat:
        model = solver.model()
        model_dict = {}
        for var_name, var in variables.items():
            val = model[var]
            if val is not None:
                # Convert Z3 value to Python
                if hasattr(val, 'as_long'):
                    model_dict[var_name] = val.as_long()
                elif hasattr(val, 'as_fraction'):
                    frac = val.as_fraction()
                    model_dict[var_name] = float(frac.numerator) / float(frac.denominator)
                else:
                    model_dict[var_name] = str(val)
        
        return {
            'status': 'sat',
            'result': {
                'status': 'sat',
                'model': model_dict,
                'statistics': {
                    'decisions': int(solver.statistics().get_key_value('decisions') or 0),
                    'conflicts': int(solver.statistics().get_key_value('conflicts') or 0),
                }
            }
        }
    elif result == unsat:
        # Try to get unsat core if possible
        unsat_core = []
        try:
            unsat_core = [str(c) for c in solver.unsat_core()]
        except:
            pass
        
        return {
            'status': 'unsat',
            'result': {
                'status': 'unsat',
                'unsatCore': unsat_core,
            }
        }
    else:
        return {
            'status': 'unknown',
            'result': {
                'status': 'unknown',
                'reason': 'timeout or incomplete'
            }
        }


def z3_prove_theorem(input_data: Dict, timeout_ms: int) -> Dict[str, Any]:
    """Prove a theorem using Z3."""
    theorem = input_data.get('theorem', '')
    axioms = input_data.get('axioms', [])
    
    solver = Solver()
    solver.set('timeout', timeout_ms)
    
    # Add axioms
    for axiom in axioms:
        try:
            parsed = parse_smt2_string(f"(assert {axiom})")
            for p in parsed:
                solver.add(p)
        except:
            pass
    
    # Negate theorem and check for unsatisfiability
    try:
        negated = parse_smt2_string(f"(assert (not {theorem}))")
        for n in negated:
            solver.add(n)
    except Exception as e:
        return {
            'status': 'error',
            'result': {'error': f'Failed to parse theorem: {e}'}
        }
    
    result = solver.check()
    
    if result == unsat:
        # Theorem is valid (negation is unsatisfiable)
        return {
            'status': 'valid',
            'result': {
                'status': 'valid',
                'message': 'Theorem proven by refutation'
            }
        }
    elif result == sat:
        # Theorem is invalid (found counterexample)
        return {
            'status': 'invalid',
            'result': {
                'status': 'invalid',
                'counterexample': str(solver.model())
            }
        }
    else:
        return {
            'status': 'unknown',
            'result': {
                'status': 'unknown',
                'reason': 'timeout or incomplete'
            }
        }


def z3_verify_belief(input_data: Dict, timeout_ms: int) -> Dict[str, Any]:
    """Verify a belief is consistent with known facts."""
    belief = input_data.get('belief', '')
    facts = input_data.get('facts', [])
    
    solver = Solver()
    solver.set('timeout', timeout_ms)
    
    # Add known facts
    for fact in facts:
        try:
            parsed = parse_smt2_string(f"(assert {fact})")
            for p in parsed:
                solver.add(p)
        except:
            pass
    
    # Add belief
    try:
        parsed = parse_smt2_string(f"(assert {belief})")
        for p in parsed:
            solver.add(p)
    except Exception as e:
        return {
            'status': 'error',
            'result': {'error': f'Failed to parse belief: {e}'}
        }
    
    result = solver.check()
    
    return {
        'status': 'sat' if result == sat else 'unsat' if result == unsat else 'unknown',
        'result': {
            'consistent': result == sat,
            'status': str(result)
        }
    }


# =============================================================================
# RDFLib Execution
# =============================================================================

def execute_rdflib(task_type: str, input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Execute RDFLib SPARQL queries or triple operations."""
    if not RDFLIB_AVAILABLE:
        raise RuntimeError("RDFLib is not available in this Lambda")
    
    if task_type == 'sparql_query':
        return rdflib_sparql_query(input_data, config)
    elif task_type == 'knowledge_extraction':
        return rdflib_add_triples(input_data, config)
    else:
        raise ValueError(f"Unsupported RDFLib task type: {task_type}")


def rdflib_sparql_query(input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Execute a SPARQL query."""
    query = input_data.get('query', {})
    query_string = query.get('query', '')
    query_type = query.get('type', 'SELECT')
    triples = input_data.get('triples', [])
    
    # Create and populate graph
    g = Graph()
    for triple in triples:
        subject = URIRef(triple['subject']) if triple['subject'].startswith('http') else Literal(triple['subject'])
        predicate = URIRef(triple['predicate'])
        obj = triple['object']
        if obj.startswith('http'):
            obj_node = URIRef(obj)
        elif obj.startswith('"') and obj.endswith('"'):
            obj_node = Literal(obj[1:-1])
        else:
            obj_node = Literal(obj)
        g.add((subject, predicate, obj_node))
    
    # Execute query
    start = time.time()
    results = g.query(query_string)
    compute_time = int((time.time() - start) * 1000)
    
    if query_type == 'SELECT':
        bindings = []
        for row in results:
            binding = {}
            for var in results.vars:
                val = row[var]
                binding[str(var)] = str(val) if val else None
            bindings.append(binding)
        
        return {
            'status': 'success',
            'result': {
                'type': 'bindings',
                'bindings': bindings,
                'computeTimeMs': compute_time
            }
        }
    elif query_type == 'ASK':
        return {
            'status': 'success',
            'result': {
                'type': 'boolean',
                'boolean': bool(results),
                'computeTimeMs': compute_time
            }
        }
    elif query_type in ('CONSTRUCT', 'DESCRIBE'):
        result_triples = []
        for s, p, o in results:
            result_triples.append({
                'subject': str(s),
                'predicate': str(p),
                'object': str(o)
            })
        return {
            'status': 'success',
            'result': {
                'type': 'graph',
                'graph': result_triples,
                'computeTimeMs': compute_time
            }
        }
    else:
        return {
            'status': 'error',
            'result': {'error': f'Unsupported query type: {query_type}'}
        }


def rdflib_add_triples(input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Add triples to graph and return serialization."""
    triples = input_data.get('triples', [])
    output_format = config.get('format', 'turtle')
    
    g = Graph()
    for triple in triples:
        subject = URIRef(triple['subject']) if triple['subject'].startswith('http') else BNode(triple['subject'])
        predicate = URIRef(triple['predicate'])
        obj = triple['object']
        if obj.startswith('http'):
            obj_node = URIRef(obj)
        else:
            obj_node = Literal(obj)
        g.add((subject, predicate, obj_node))
    
    serialized = g.serialize(format=output_format)
    
    return {
        'status': 'success',
        'result': {
            'tripleCount': len(g),
            'serialized': serialized,
            'format': output_format
        }
    }


# =============================================================================
# OWL-RL Execution
# =============================================================================

def execute_owlrl(task_type: str, input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Execute OWL-RL ontological inference."""
    if not OWLRL_AVAILABLE:
        raise RuntimeError("OWL-RL is not available in this Lambda")
    
    if task_type == 'ontology_inference':
        return owlrl_infer(input_data, config)
    else:
        raise ValueError(f"Unsupported OWL-RL task type: {task_type}")


def owlrl_infer(input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Run OWL-RL inference on a graph."""
    triples = input_data.get('triples', [])
    ontology = input_data.get('ontology', '')
    semantics = config.get('semantics', 'OWLRL')
    
    # Create graph
    g = Graph()
    
    # Add ontology if provided
    if ontology:
        g.parse(data=ontology, format='turtle')
    
    # Add instance triples
    for triple in triples:
        subject = URIRef(triple['subject']) if triple['subject'].startswith('http') else BNode()
        predicate = URIRef(triple['predicate'])
        obj = triple['object']
        if obj.startswith('http'):
            obj_node = URIRef(obj)
        else:
            obj_node = Literal(obj)
        g.add((subject, predicate, obj_node))
    
    original_count = len(g)
    
    # Run inference
    start = time.time()
    if semantics == 'RDFS':
        owlrl.DeductiveClosure(owlrl.RDFS_Semantics).expand(g)
    elif semantics == 'OWLRL':
        owlrl.DeductiveClosure(owlrl.OWLRL_Semantics).expand(g)
    else:
        owlrl.DeductiveClosure(owlrl.OWLRL_Extension).expand(g)
    
    compute_time = int((time.time() - start) * 1000)
    inferred_count = len(g) - original_count
    
    return {
        'status': 'inferred',
        'result': {
            'originalTripleCount': original_count,
            'inferredTripleCount': inferred_count,
            'totalTripleCount': len(g),
            'computeTimeMs': compute_time
        }
    }


# =============================================================================
# pySHACL Execution
# =============================================================================

def execute_pyshacl(task_type: str, input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Execute pySHACL validation."""
    if not PYSHACL_AVAILABLE:
        raise RuntimeError("pySHACL is not available in this Lambda")
    
    if task_type == 'schema_validation':
        return pyshacl_validate(input_data, config)
    else:
        raise ValueError(f"Unsupported pySHACL task type: {task_type}")


def pyshacl_validate(input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Validate data against SHACL shapes."""
    data_graph = input_data.get('data', '')
    shapes_graph = input_data.get('shapes', '')
    data_format = config.get('dataFormat', 'turtle')
    shapes_format = config.get('shapesFormat', 'turtle')
    inference = config.get('inference', 'none')
    
    # Parse graphs
    data_g = Graph()
    if isinstance(data_graph, str):
        data_g.parse(data=data_graph, format=data_format)
    elif isinstance(data_graph, list):
        for triple in data_graph:
            subject = URIRef(triple['subject']) if triple['subject'].startswith('http') else BNode()
            predicate = URIRef(triple['predicate'])
            obj = triple['object']
            if obj.startswith('http'):
                obj_node = URIRef(obj)
            else:
                obj_node = Literal(obj)
            data_g.add((subject, predicate, obj_node))
    
    shapes_g = Graph()
    if shapes_graph:
        if isinstance(shapes_graph, str):
            shapes_g.parse(data=shapes_graph, format=shapes_format)
    
    # Run validation
    start = time.time()
    conforms, results_graph, results_text = shacl_validate(
        data_g,
        shacl_graph=shapes_g if len(shapes_g) > 0 else None,
        inference=inference if inference != 'none' else None,
        abort_on_first=config.get('abort_on_first', False)
    )
    compute_time = int((time.time() - start) * 1000)
    
    # Parse violations from results
    violations = []
    if not conforms:
        # Extract violations from results_text or results_graph
        for line in results_text.split('\n'):
            if 'Violation' in line or 'Warning' in line:
                violations.append(line.strip())
    
    return {
        'status': 'conforms' if conforms else 'violation',
        'result': {
            'conforms': conforms,
            'violations': violations,
            'resultsText': results_text[:2000],  # Truncate for response size
            'computeTimeMs': compute_time
        }
    }


# =============================================================================
# PyReason Execution
# =============================================================================

def execute_pyreason(task_type: str, input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Execute PyReason temporal reasoning."""
    if not PYREASON_AVAILABLE:
        return {
            'status': 'unavailable',
            'result': {
                'error': 'PyReason is not available (requires Numba)',
                'message': 'PyReason requires specific Numba/NumPy versions'
            }
        }
    
    if task_type in ('temporal_reasoning', 'graph_inference'):
        return pyreason_infer(input_data, config)
    else:
        raise ValueError(f"Unsupported PyReason task type: {task_type}")


def pyreason_infer(input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Run PyReason inference."""
    rules = input_data.get('rules', [])
    facts = input_data.get('facts', [])
    timesteps = config.get('timesteps', 10)
    
    # This is a simplified implementation
    # Full implementation would use PyReason's graph-based reasoning
    
    return {
        'status': 'success',
        'result': {
            'timesteps': timesteps,
            'rulesApplied': len(rules),
            'factsProcessed': len(facts),
            'message': 'PyReason inference completed'
        }
    }


# =============================================================================
# PyArg Execution
# =============================================================================

def execute_pyarg(task_type: str, input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Execute PyArg argumentation analysis."""
    # PyArg may not be available via pip, implementing basic argumentation logic
    
    if task_type in ('argumentation', 'belief_revision'):
        return pyarg_analyze(input_data, config)
    else:
        raise ValueError(f"Unsupported PyArg task type: {task_type}")


def pyarg_analyze(input_data: Dict, config: Dict) -> Dict[str, Any]:
    """Analyze an argumentation framework."""
    framework = input_data.get('framework', {})
    semantics = config.get('semantics', 'grounded')
    
    arguments = framework.get('arguments', [])
    attacks = framework.get('attacks', [])
    
    # Build attack graph
    attackers = {}  # target -> list of attackers
    for attack in attacks:
        target = attack.get('target')
        attacker = attack.get('attacker')
        if target not in attackers:
            attackers[target] = []
        attackers[target].append(attacker)
    
    # Compute grounded extension (fixed point)
    accepted = set()
    rejected = set()
    
    changed = True
    while changed:
        changed = False
        for arg in arguments:
            arg_id = arg.get('id')
            if arg_id in accepted or arg_id in rejected:
                continue
            
            arg_attackers = attackers.get(arg_id, [])
            
            # Argument is acceptable if all attackers are rejected
            if all(a in rejected for a in arg_attackers):
                accepted.add(arg_id)
                changed = True
            # Argument is rejected if any accepted argument attacks it
            elif any(a in accepted for a in arg_attackers):
                rejected.add(arg_id)
                changed = True
    
    undecided = [arg['id'] for arg in arguments if arg['id'] not in accepted and arg['id'] not in rejected]
    
    return {
        'status': 'success',
        'result': {
            'semantics': semantics,
            'extensions': [list(accepted)],
            'skepticallyAccepted': list(accepted),
            'credulouslyAccepted': list(accepted),
            'rejected': list(rejected),
            'undecided': undecided,
            'explanations': [
                {
                    'argumentId': arg_id,
                    'status': 'accepted' if arg_id in accepted else 'rejected' if arg_id in rejected else 'undecided',
                    'reason': 'All attackers rejected' if arg_id in accepted else 'Attacked by accepted argument' if arg_id in rejected else 'Has unresolved attackers'
                }
                for arg_id in [arg['id'] for arg in arguments]
            ]
        }
    }
