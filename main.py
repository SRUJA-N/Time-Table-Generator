"""University Timetable Generator: FastAPI + OR-Tools CP-SAT.

Run with:  uvicorn main:app --reload --port 8000

What the solver enforces (hard rules)
  * every task (theory period / lab batch session) is placed exactly once
  * a teacher (main or co) is never in two places at once
  * a room is never double-booked
  * a semester never has two theory classes at once, and never a theory class
    during a lab block (labs for different batches may run side by side)
  * a lab batch is never in two labs at once
  * all labs of one rotation start together, so every batch has a different lab
  * nothing is placed in a break slot, and a class never crosses a break
  * teacher unavailability, teacher max periods/day, locked slots
  * a theory subject has at most N periods per day (spread over the week)
Co-teachers for labs are picked automatically after solving.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ortools.sat.python import cp_model
from pydantic import BaseModel, Field


app = FastAPI(title="University Timetable Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
DEFAULT_SLOTS = 8
DEFAULT_BREAK_SLOTS = [5]


# --------------------------------------------------------------------------
# Request models
# --------------------------------------------------------------------------
class SemesterConfig(BaseModel):
    """Grid for one semester. Slots are numbered 1..slots (P1..Pn in the UI).
    A break slot is a slot of its own, e.g. breakSlots=[3] means P3 is the break
    and classes can use P1-P2 or P4-onwards, but never cross P3."""

    days: list[str] = Field(default_factory=lambda: ALL_DAYS[:5])
    slots: int = DEFAULT_SLOTS
    breakSlots: list[int] = Field(default_factory=lambda: list(DEFAULT_BREAK_SLOTS))


class Rules(BaseModel):
    maxTeacherPerDay: int = 0  # 0 = no limit (a teacher's own "max" overrides)
    maxSubjectPerDay: int = 1  # raised automatically if the week needs more
    autoCoTeacher: bool = True
    timeLimit: int = 30  # seconds


class TimetableRequest(BaseModel):
    sems: list[str] = Field(default_factory=list)
    section: str = "A"
    teachers: list[dict[str, Any]] = Field(default_factory=list)
    rooms: list[dict[str, Any]] = Field(default_factory=list)
    semSubjects: list[dict[str, Any]] = Field(default_factory=list)
    labs: list[dict[str, Any]] = Field(default_factory=list)
    locks: list[dict[str, Any]] = Field(default_factory=list)
    semRoom: dict[str, Any] = Field(default_factory=dict)
    semConfig: dict[str, SemesterConfig] = Field(default_factory=dict)
    rules: Rules = Field(default_factory=Rules)


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------
def first_value(item: dict[str, Any], *keys: str, default: Any = None) -> Any:
    """Return the first non-empty value found for the supplied keys."""
    for key in keys:
        value = item.get(key)
        if value is not None and value != "":
            return value
    return default


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def as_positive_int(value: Any, field_name: str, default: int = 1) -> int:
    if value is None or value == "":
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422, detail=f"{field_name} must be a positive integer"
        ) from exc
    if parsed < 1:
        raise HTTPException(
            status_code=422, detail=f"{field_name} must be a positive integer"
        )
    return parsed


def canonical_day(text: str) -> str | None:
    t = str(text or "").strip().lower()
    if len(t) < 3:
        return None
    for day in ALL_DAYS:
        if day.lower() == t or day.lower()[:3] == t[:3]:
            return day
    return None


def slot_number(text: Any) -> int | None:
    t = str(text or "").strip().upper().lstrip("P")
    return int(t) if t.isdigit() else None


def parse_unavailable(text: Any) -> set[tuple[str, int]]:
    """'Monday/P1;Wednesday/P3' -> {('Monday', 1), ('Wednesday', 3)}"""
    out: set[tuple[str, int]] = set()
    for part in str(text or "").split(";"):
        if "/" not in part:
            continue
        day_text, slot_text = part.split("/", 1)
        day = canonical_day(day_text)
        slot = slot_number(slot_text)
        if day and slot:
            out.add((day, slot))
    return out


def normalize_teacher_names(value: Any) -> list[str]:
    """Accept "Alice", {"name": "Alice"}, ["Alice", {"name": "Bob"}]."""
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    names: list[str] = []
    for teacher in values:
        if isinstance(teacher, dict):
            name = first_value(teacher, "name", "teacher", "id")
        else:
            name = str(teacher)
        if name:
            names.append(str(name))
    return list(dict.fromkeys(names))


# --------------------------------------------------------------------------
# Semester grids (days, slots, breaks)
# --------------------------------------------------------------------------
def build_grid(config: SemesterConfig, sem: str) -> dict[str, Any]:
    days: list[str] = []
    for raw in config.days:
        day = canonical_day(raw)
        if day and day not in days:
            days.append(day)
    if not days:
        raise HTTPException(
            status_code=422, detail=f"Semester {sem} has no valid working days"
        )
    if config.slots < 1:
        raise HTTPException(
            status_code=422, detail=f"Semester {sem} needs at least one slot per day"
        )

    breaks = set(config.breakSlots)
    blocks: list[list[int]] = []
    current: list[int] = []
    for slot in range(1, config.slots + 1):
        if slot in breaks:
            if current:
                blocks.append(current)
                current = []
        else:
            current.append(slot)
    if current:
        blocks.append(current)
    if not blocks:
        raise HTTPException(
            status_code=422, detail=f"Semester {sem} has no teaching slots"
        )
    return {"days": days, "slots": config.slots, "blocks": blocks}


def valid_starts(grid: dict[str, Any], duration: int) -> list[tuple[str, int]]:
    """(day, start_slot) pairs where a task of this duration fits inside one block."""
    starts: list[tuple[str, int]] = []
    for day in grid["days"]:
        for block in grid["blocks"]:
            for offset in range(len(block) - duration + 1):
                starts.append((day, block[offset]))
    return starts


# --------------------------------------------------------------------------
# Turning the UI data into tasks
# --------------------------------------------------------------------------
def normalize_batches(lab: dict[str, Any]) -> list[dict[str, Any]]:
    raw_batches = first_value(
        lab, "subBatches", "sub_batches", "batches", "batch", default=[]
    )
    if not raw_batches:
        return [{"name": "", "teachers": [], "room": ""}]
    if not isinstance(raw_batches, list):
        raw_batches = [raw_batches]

    normalized: list[dict[str, Any]] = []
    for index, batch in enumerate(raw_batches, start=1):
        if isinstance(batch, dict):
            name = first_value(
                batch, "name", "batch", "id", "label", default=f"Batch {index}"
            )
            teachers = normalize_teacher_names(
                first_value(
                    batch,
                    "teachers",
                    "teacher",
                    "main",
                    "mainTeacher",
                    "coTeacher",
                    default=[],
                )
            )
            normalized.append(
                {
                    "name": str(name),
                    "teachers": teachers,
                    "room": str(first_value(batch, "room", "roomName", default="")),
                }
            )
        else:
            normalized.append({"name": str(batch), "teachers": [], "room": ""})

    # The UI always stores 3 batch rows; "division" says how many are really used.
    division = str(lab.get("division", "")).strip().lower()
    if "entire" in division:
        normalized = normalized[:1]
    elif division.startswith("2"):
        normalized = normalized[:2]
    elif division.startswith("3"):
        normalized = normalized[:3]
    return normalized


def build_tasks(payload: TimetableRequest) -> list[dict[str, Any]]:
    """Flatten theory sessions and lab batches into independent scheduling tasks."""
    wanted_sems = {str(s) for s in payload.sems}

    def in_scope(sem: str) -> bool:
        return not wanted_sems or sem in wanted_sems

    tasks: list[dict[str, Any]] = []

    for subject in payload.semSubjects:
        subject_type = (
            str(first_value(subject, "type", "subjectType", default="Theory"))
            .strip()
            .lower()
        )
        if subject_type in {"lab", "laboratory"}:
            continue

        semester = str(first_value(subject, "sem", "semester", default=""))
        if not in_scope(semester):
            continue

        subject_name = str(first_value(subject, "subject", "name", default="Unnamed"))
        sessions = as_positive_int(
            first_value(subject, "sessions", "credits", "periods", default=1),
            "theory sessions",
        )
        main = normalize_teacher_names(
            first_value(subject, "main", "mainTeacher", "teacher", default=[])
        )
        co = normalize_teacher_names(
            first_value(subject, "coTeacher", "co_teacher", "assistants", default=[])
        )

        for session_number in range(1, sessions + 1):
            tasks.append(
                {
                    "semester": semester,
                    "subject": subject_name,
                    "type": "Theory",
                    "duration": 1,
                    "batch": "",
                    "main_teacher": main,
                    "co_teacher": co,
                    "teachers": list(dict.fromkeys(main + co)),
                    "room_name": "",
                    "session_number": session_number,
                }
            )

    labs_by_semester: dict[str, list[dict[str, Any]]] = {}
    for lab in payload.labs:
        semester = str(first_value(lab, "sem", "semester", default=""))
        if in_scope(semester):
            labs_by_semester.setdefault(semester, []).append(lab)

    for semester, semester_labs in labs_by_semester.items():
        batch_count = len(normalize_batches(semester_labs[0]))
        if len(semester_labs) % batch_count:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Semester {semester} has {len(semester_labs)} lab subject(s) but "
                    f"{batch_count} batches. The number of labs must be a multiple of "
                    "the number of batches so every batch can rotate through every lab."
                ),
            )

        for set_index in range(0, len(semester_labs), batch_count):
            lab_set = semester_labs[set_index : set_index + batch_count]
            batch_lists = [normalize_batches(lab) for lab in lab_set]
            if any(len(b) != batch_count for b in batch_lists):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"All lab subjects in semester {semester} must use "
                        f"{batch_count} batches."
                    ),
                )

            for rotation in range(batch_count):
                group = f"lab:{semester}:{set_index // batch_count}:{rotation}"
                for lab_index, (lab, batches) in enumerate(zip(lab_set, batch_lists)):
                    subject_name = str(
                        first_value(lab, "subject", "name", default="Unnamed Lab")
                    )
                    duration = as_positive_int(
                        first_value(lab, "duration", "periods", default=2),
                        "lab duration",
                    )
                    lab_main = normalize_teacher_names(
                        first_value(lab, "main", "mainTeacher", "teacher", default=[])
                    )
                    lab_co = normalize_teacher_names(
                        first_value(lab, "coTeacher", "co_teacher", default=[])
                    )
                    batch = batches[(lab_index + rotation) % batch_count]
                    main = batch["teachers"] or lab_main

                    tasks.append(
                        {
                            "semester": semester,
                            "subject": subject_name,
                            "type": "Lab",
                            "duration": duration,
                            "batch": batch["name"],
                            "main_teacher": main,
                            "co_teacher": lab_co,
                            "teachers": list(dict.fromkeys(main + lab_co)),
                            "room_name": batch["room"],
                            "rotation_group": group,
                            "session_number": rotation + 1,
                        }
                    )

    return tasks


# --------------------------------------------------------------------------
# Rooms
# --------------------------------------------------------------------------
LAB_TYPES = {"lab", "laboratory", "computer lab", "computer-lab"}


def room_info(room: dict[str, Any]) -> dict[str, Any]:
    kind = str(first_value(room, "type", "roomType", default="")).strip().lower()
    return {
        "name": str(first_value(room, "name", "id", default="")),
        "can_lab": kind in LAB_TYPES or kind == "any",
        "can_theory": kind not in LAB_TYPES,
    }


def eligible_rooms(
    task: dict[str, Any], rooms: list[dict[str, Any]], sem_rooms: dict[str, Any]
) -> list[int]:
    """Theory uses the semester's fixed theory room(s); a lab uses its batch's
    room, else the semester's fixed lab rooms, else any lab."""
    cfg = sem_rooms.get(task["semester"]) or {}

    if task["type"] == "Lab":
        fixed = [n for n in (cfg.get("lab") or []) if n]
        if task.get("room_name"):
            wanted: set[str] | None = {task["room_name"]}
        else:
            wanted = set(fixed) if fixed else None
        return [
            i
            for i, r in enumerate(rooms)
            if r["can_lab"] and (wanted is None or r["name"] in wanted)
        ]

    fixed = [n for n in (cfg.get("theory") or []) if n]
    wanted = set(fixed) if fixed else None
    return [
        i
        for i, r in enumerate(rooms)
        if r["can_theory"] and (wanted is None or r["name"] in wanted)
    ]


# --------------------------------------------------------------------------
# Quick sanity checks that give a readable error before the solver runs
# --------------------------------------------------------------------------
def check_capacity(tasks: list[dict[str, Any]], grids: dict[str, dict[str, Any]]) -> None:
    demand: dict[str, int] = defaultdict(int)
    group_duration: dict[str, tuple[str, int]] = {}

    for task in tasks:
        if task["type"] == "Lab":
            group = task["rotation_group"]
            sem, best = group_duration.get(group, (task["semester"], 0))
            group_duration[group] = (sem, max(best, task["duration"]))
        else:
            demand[task["semester"]] += task["duration"]
    for sem, duration in group_duration.values():
        demand[sem] += duration

    for sem, need in demand.items():
        grid = grids[sem]
        capacity = len(grid["days"]) * sum(len(b) for b in grid["blocks"])
        if need > capacity:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Semester {sem} needs {need} periods per week (theory + one "
                    f"slot per lab rotation) but only {capacity} teaching periods "
                    "exist. Reduce sessions/lab count or add days/slots."
                ),
            )

    max_capacity = max(
        len(g["days"]) * sum(len(b) for b in g["blocks"]) for g in grids.values()
    )
    load: dict[str, int] = defaultdict(int)
    for task in tasks:
        for teacher in task["teachers"]:
            load[teacher] += task["duration"]
    for teacher, hours in load.items():
        if hours > max_capacity:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Teacher {teacher} is assigned {hours} periods per week but a "
                    f"week only has {max_capacity} teaching periods."
                ),
            )


# --------------------------------------------------------------------------
# Co-teacher selection (after the solver has fixed all times)
# --------------------------------------------------------------------------
def assign_co_teachers(
    tasks: list[dict[str, Any]],
    chosen: dict[int, tuple[str, int, int]],
    teacher_names: list[str],
    unavailable: dict[str, set[tuple[str, int]]],
    caps: dict[str, int],
    default_cap: int,
) -> dict[int, str]:
    busy: dict[tuple[str, str], set[int]] = defaultdict(set)
    per_day: dict[tuple[str, str], int] = defaultdict(int)
    load: dict[str, int] = defaultdict(int)

    for t, (day, start, _room) in chosen.items():
        for teacher in tasks[t]["teachers"]:
            for slot in range(start, start + tasks[t]["duration"]):
                busy[(teacher, day)].add(slot)
                per_day[(teacher, day)] += 1
                load[teacher] += 1

    result: dict[int, str] = {}
    for t, task in enumerate(tasks):
        if task["type"] != "Lab" or task["co_teacher"]:
            continue
        day, start, _room = chosen[t]
        slots = list(range(start, start + task["duration"]))

        candidates = sorted(
            (n for n in teacher_names if n not in task["main_teacher"]),
            key=lambda n: load[n],  # least-loaded teacher first
        )
        for name in candidates:
            if any(s in busy[(name, day)] for s in slots):
                continue
            if any((day, s) in unavailable.get(name, set()) for s in slots):
                continue
            cap = caps.get(name, default_cap)
            if cap > 0 and per_day[(name, day)] + len(slots) > cap:
                continue
            result[t] = name
            for s in slots:
                busy[(name, day)].add(s)
            per_day[(name, day)] += len(slots)
            load[name] += len(slots)
            break

    return result


# --------------------------------------------------------------------------
# The endpoint
# --------------------------------------------------------------------------
@app.post("/generate-timetable")
def generate_timetable(payload: TimetableRequest) -> list[dict[str, Any]]:
    if not payload.rooms:
        raise HTTPException(status_code=422, detail="At least one room is required")

    tasks = build_tasks(payload)
    if not tasks:
        return []

    rooms = [room_info(r) for r in payload.rooms]
    if any(not r["name"] for r in rooms):
        raise HTTPException(status_code=422, detail="Every room must have a name")

    semesters = sorted({t["semester"] for t in tasks})
    grids = {
        sem: build_grid(payload.semConfig.get(sem) or SemesterConfig(), sem)
        for sem in semesters
    }
    check_capacity(tasks, grids)

    rules = payload.rules

    # Teacher data: availability and per-day caps.
    unavailable: dict[str, set[tuple[str, int]]] = {}
    caps: dict[str, int] = {}
    teacher_names: list[str] = []
    for teacher in payload.teachers:
        name = str(first_value(teacher, "name", default="")).strip()
        if not name:
            continue
        teacher_names.append(name)
        unavailable[name] = parse_unavailable(teacher.get("unavailable"))
        own_cap = to_int(teacher.get("max"), 0)
        caps[name] = own_cap if own_cap > 0 else rules.maxTeacherPerDay
    for task in tasks:
        for name in task["teachers"]:
            if name not in teacher_names:
                teacher_names.append(name)

    # Locks: no subject = slot is blocked; with subject = subject must be there.
    blocked_slots: set[tuple[str, str, int]] = set()
    subject_locks: list[tuple[str, str, int, str]] = []
    for lock in payload.locks:
        sem = str(first_value(lock, "sem", "semester", default=""))
        day = canonical_day(str(lock.get("day", "")))
        slot = slot_number(lock.get("period"))
        if sem not in grids or not day or not slot:
            continue
        subject = str(lock.get("subject") or "").strip()
        if subject:
            subject_locks.append((sem, day, slot, subject))
        else:
            blocked_slots.add((sem, day, slot))

    model = cp_model.CpModel()

    assignment: dict[tuple[int, str, int, int], cp_model.IntVar] = {}
    # by_start[task][(day, start)] -> variables (one per eligible room)
    by_start: dict[int, dict[tuple[str, int], list[cp_model.IntVar]]] = {}

    for t, task in enumerate(tasks):
        grid = grids[task["semester"]]
        duration = task["duration"]

        room_options = eligible_rooms(task, rooms, payload.semRoom)
        if not room_options:
            kind = "lab" if task["type"] == "Lab" else "theory"
            raise HTTPException(
                status_code=422,
                detail=(
                    f'No suitable {kind} room exists for "{task["subject"]}" '
                    f"(semester {task['semester']}). Check the semester's fixed rooms."
                ),
            )

        candidates: list[tuple[str, int]] = []
        for day, start in valid_starts(grid, duration):
            covered = range(start, start + duration)
            if any((task["semester"], day, s) in blocked_slots for s in covered):
                continue
            if any(
                (day, s) in unavailable.get(teacher, set())
                for teacher in task["teachers"]
                for s in covered
            ):
                continue
            candidates.append((day, start))

        if not candidates:
            raise HTTPException(
                status_code=422,
                detail=(
                    f'No time slot is possible for "{task["subject"]}" '
                    f"(semester {task['semester']}, {duration} period(s)). It may be "
                    "longer than a break-free block, or teacher unavailability / "
                    "locked slots rule out every slot."
                ),
            )

        by_start[t] = {}
        all_vars: list[cp_model.IntVar] = []
        for day, start in candidates:
            for room_index in room_options:
                var = model.NewBoolVar(f"t{t}_{day}_{start}_r{room_index}")
                assignment[(t, day, start, room_index)] = var
                by_start[t].setdefault((day, start), []).append(var)
                all_vars.append(var)

        model.AddExactlyOne(all_vars)

    # Lab rotation: every task in a rotation group starts at the same time.
    rotation_members: dict[str, list[int]] = defaultdict(list)
    for t, task in enumerate(tasks):
        if task.get("rotation_group"):
            rotation_members[task["rotation_group"]].append(t)

    for members in rotation_members.values():
        anchor = members[0]
        for other in members[1:]:
            keys = set(by_start[anchor]) | set(by_start[other])
            for key in keys:
                model.Add(
                    sum(by_start[anchor].get(key, []))
                    == sum(by_start[other].get(key, []))
                )

    # Occupancy tables, built in a single pass over all variables.
    room_use: dict[tuple[int, str, int], list] = defaultdict(list)
    teacher_use: dict[tuple[str, str, int], list] = defaultdict(list)
    sem_theory: dict[tuple[str, str, int], list] = defaultdict(list)
    sem_lab: dict[tuple[str, str, int], list] = defaultdict(list)
    batch_use: dict[tuple[str, str, str, int], list] = defaultdict(list)
    subject_use: dict[tuple[str, str, str, int], list] = defaultdict(list)

    for (t, day, start, room_index), var in assignment.items():
        task = tasks[t]
        sem = task["semester"]
        for slot in range(start, start + task["duration"]):
            room_use[(room_index, day, slot)].append(var)
            for teacher in task["teachers"]:
                teacher_use[(teacher, day, slot)].append(var)
            subject_use[(sem, task["subject"], day, slot)].append(var)
            if task["type"] == "Lab":
                sem_lab[(sem, day, slot)].append(var)
                batch_use[(sem, task["batch"], day, slot)].append(var)
            else:
                sem_theory[(sem, day, slot)].append(var)

    # Rooms: one class at a time.
    for variables in room_use.values():
        if len(variables) > 1:
            model.Add(sum(variables) <= 1)

    # Teachers: one place at a time, plus optional max periods per day.
    teacher_day: dict[tuple[str, str], list] = defaultdict(list)
    for (teacher, day, _slot), variables in teacher_use.items():
        if len(variables) > 1:
            model.Add(sum(variables) <= 1)
        teacher_day[(teacher, day)].extend(variables)
    for (teacher, day), variables in teacher_day.items():
        cap = caps.get(teacher, rules.maxTeacherPerDay)
        if cap > 0:
            model.Add(sum(variables) <= cap)

    # Semester: one theory class at a time, and no theory during a lab block.
    for variables in sem_theory.values():
        if len(variables) > 1:
            model.Add(sum(variables) <= 1)
    for key, lab_variables in sem_lab.items():
        active = model.NewBoolVar(f"lab_active_{key}")
        for var in lab_variables:
            model.AddImplication(var, active)
        theory_variables = sem_theory.get(key)
        if theory_variables:
            model.Add(sum(theory_variables) + active <= 1)

    # A lab batch cannot be in two labs at once.
    for variables in batch_use.values():
        if len(variables) > 1:
            model.Add(sum(variables) <= 1)

    # Spread each theory subject across the week + break symmetry.
    theory_groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for t, task in enumerate(tasks):
        if task["type"] == "Theory":
            theory_groups[(task["semester"], task["subject"])].append(t)

    for (sem, _subject), members in theory_groups.items():
        grid = grids[sem]
        per_day_cap = max(
            rules.maxSubjectPerDay, math.ceil(len(members) / len(grid["days"]))
        )
        for day in grid["days"]:
            day_vars = [
                v
                for t in members
                for (d, _s), vs in by_start[t].items()
                if d == day
                for v in vs
            ]
            if len(day_vars) > per_day_cap:
                model.Add(sum(day_vars) <= per_day_cap)

        if len(members) > 1:
            day_index = {d: i for i, d in enumerate(grid["days"])}
            positions = [
                sum(
                    (day_index[d] * grid["slots"] + s) * v
                    for (d, s), vs in by_start[t].items()
                    for v in vs
                )
                for t in members
            ]
            for first, second in zip(positions, positions[1:]):
                model.Add(first < second)

    # Locked subjects.
    for sem, day, slot, subject in subject_locks:
        variables = subject_use.get((sem, subject, day, slot))
        if not variables:
            raise HTTPException(
                status_code=422,
                detail=(
                    f'Lock cannot be satisfied: "{subject}" cannot be placed on '
                    f"{day} P{slot} in semester {sem}."
                ),
            )
        model.Add(sum(variables) >= 1)

    # Soft goal: use earlier periods first, so free periods fall at the end of
    # the day instead of leaving gaps. (No day bias, so the week stays spread.)
    model.Minimize(sum(start * var for (_t, _d, start, _r), var in assignment.items()))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(5, rules.timeLimit)
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    if status == cp_model.INFEASIBLE:
        raise HTTPException(
            status_code=409,
            detail=(
                "No timetable satisfies all the rules. Likely causes: too few rooms "
                "or labs, a teacher shared across too many classes, a teacher's "
                "max/day or unavailability too tight, or too few teaching periods."
            ),
        )
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise HTTPException(
            status_code=409,
            detail=(
                "The solver ran out of time before finding a timetable. "
                "Try again with a larger time limit or fewer semesters per run."
            ),
        )

    chosen: dict[int, tuple[str, int, int]] = {}
    for (t, day, start, room_index), var in assignment.items():
        if solver.Value(var):
            chosen[t] = (day, start, room_index)

    if len(chosen) != len(tasks):
        raise HTTPException(
            status_code=500, detail="The solver returned an incomplete timetable"
        )

    auto_co: dict[int, str] = {}
    if rules.autoCoTeacher:
        auto_co = assign_co_teachers(
            tasks, chosen, teacher_names, unavailable, caps, rules.maxTeacherPerDay
        )

    schedule: list[dict[str, Any]] = []
    row_id = 0
    for t, task in enumerate(tasks):
        day, start, room_index = chosen[t]
        main_teacher = ", ".join(task["main_teacher"])
        co_teacher = ", ".join(task["co_teacher"]) or auto_co.get(t, "")

        # One row per occupied period so multi-period labs fill the grid.
        for slot in range(start, start + task["duration"]):
            row_id += 1
            schedule.append(
                {
                    "id": f"r{row_id}",
                    "Semester": task["semester"],
                    "Section": payload.section,
                    "Day": day,
                    "Period": f"P{slot}",
                    "PeriodNo": slot,
                    "Subject": task["subject"],
                    "Type": task["type"],
                    "Batch": task["batch"] or "Whole Class",
                    "MainTeacher": main_teacher,
                    "CoTeacher": co_teacher,
                    "Room": rooms[room_index]["name"],
                }
            )

    schedule.sort(
        key=lambda x: (
            x["Semester"],
            ALL_DAYS.index(x["Day"]),
            x["PeriodNo"],
            x["Batch"],
        )
    )
    return schedule