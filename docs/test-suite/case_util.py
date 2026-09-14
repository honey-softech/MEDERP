"""Shared helper for manual test case dicts."""


def c(
    id: str,
    sub: str,
    title: str,
    priority: str,
    typ: str,
    pre: str,
    role: str,
    data: str,
    steps: str,
    expected: str,
    route: str,
) -> dict:
    return {
        "id": id,
        "sub": sub,
        "title": title,
        "priority": priority,
        "type": typ,
        "pre": pre,
        "role": role,
        "data": data,
        "steps": steps,
        "expected": expected,
        "actual": "",
        "status": "Not Run",
        "by": "",
        "date": "",
        "route": route,
        "defect": "",
    }
