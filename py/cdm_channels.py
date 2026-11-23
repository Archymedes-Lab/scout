"""Scout's bridge to cdm: a channel problem as JSON on stdin, cdm's decision as JSON on stdout.

    uv run --project ~/creative-decision python -I py/cdm_channels.py < problem.json

`"mock": true` uses cdm's deterministic MockJudge (offline, for tests); otherwise Jev via TYPESAFE_API_KEY.
"""

import asyncio
import json
import sys
from typing import Any

from cdm import (
    Constraint,
    Dimension,
    JevJudge,
    MockJudge,
    Option,
    Problem,
    decide,
    judge_problem,
)


def build(spec: dict[str, Any]) -> Problem:
    return Problem(
        goal=spec["goal"],
        context=spec["context"],
        precedents=spec.get("precedents", []),
        options=[Option(o["id"], o["text"], baseline=bool(o.get("baseline"))) for o in spec["options"]],
        dimensions=[Dimension(d["id"], d["question"], tuple(d["levels"]), weight=d["weight"]) for d in spec["dimensions"]],
        constraints=[Constraint(c["id"], c["violation"], hard=bool(c["hard"])) for c in spec.get("constraints", [])],
        niches=spec.get("niches", {}),
    )


async def main() -> None:
    spec = json.load(sys.stdin)
    problem = build(spec)
    judge = MockJudge() if spec.get("mock") else JevJudge()
    d = decide(problem, await judge_problem(problem, [judge]))
    stats = [
        {"id": s.id, "mean": s.mean, "std": s.std, "cvar": s.cvar, "novelty": s.novelty, "p_best": s.p_best,
         "ei": s.ei, "reliable": s.reliable, "status": s.status, "niche": s.niche, "checks": s.checks}
        for s in sorted(d.stats, key=lambda s: -s.mean)
    ]
    out = {"commit": d.commit, "innovation": d.innovation, "portfolio": d.portfolio, "evpi": d.evpi,
           "escalate": d.escalate, "stats": stats, "judge": judge.name}
    json.dump(out, sys.stdout, default=float)


if __name__ == "__main__":
    asyncio.run(main())
