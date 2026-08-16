# Four-week beginner training program

## Decision

ChristianGetsFit remains the focused workout player. HealthTrack receives a
read-only summary of its current program and completed sessions. The new plan is
three full-body sessions per training week, using only a Smith machine,
dumbbells and bodyweight.

A training week advances after three completed sessions, rather than after a
calendar deadline. This prevents a break, illness or holiday from dropping a
returning beginner into the heaviest week.

| Training week | Sets | Effort target | Load step |
| --- | ---: | --- | --- |
| 1 · Technique | 2 | Stop with about 4 good reps available | 3 equipment increments below the strong-week target |
| 2 · Build | 3 | About 3 good reps available | 2 increments below |
| 3 · Progress | 3 | About 2 good reps available | 1 increment below |
| 4 · Strong week | 3 | About 2 good reps available; never a max test | Stored strong-week target |

After 12 completed sessions, the exercise block changes and Week 1 begins
again. Three blocks rotate: Foundation, Control and Build. Each A/B/C session
contains a knee-dominant leg movement, push, pull, hip-dominant movement and
core exercise, so all major muscle groups are trained throughout the week.

## Why this is deliberately simple

The 2026 American College of Sports Medicine position stand synthesised 137
systematic reviews. It found the largest benefit comes from doing resistance
training consistently, recommends engaging all major muscle groups at least
twice weekly, supports home-based and free-weight training, and concludes that
complex periodisation and training to failure are not consistently necessary
for healthy adults. It also reports that 2–3 repetitions in reserve can provide
sufficient effort. The program therefore uses a visible, conservative loading
wave for adherence and progressive overload—not because a four-week cycle is
claimed to be medically superior.

The Australian 24-Hour Movement Guidelines recommend muscle-strengthening
activity on at least two days each week. Three short full-body sessions meet
that floor while preserving a straightforward A/B/C workflow.

Primary sources:

- [ACSM 2026 position stand (PubMed/PMC)](https://pubmed.ncbi.nlm.nih.gov/41843416/)
- [ACSM summary of the 2026 evidence review](https://acsm.org/resistance-training-guidelines-update-2026/)
- [Australian Government recommendations for adults 18–64](https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians/recommendations-for-adults-18-to-64-years)

## Progression rules

`ExercisePreference.currentWeightKg` stores the Week 4 target for that
exercise. Earlier weeks subtract one physical equipment increment at a time.
After each exercise, the performed load is converted back to its Week 4
equivalent:

- **On target:** retain the equivalent target.
- **Too light:** add one equipment increment.
- **Too heavy:** subtract one increment.

There is no automatic increase based only on time, no one-repetition-max test,
and no instruction to train to failure. Actual reps are recorded for every set;
volume is no longer estimated using invented midpoint reps.

## Safety boundaries

- Smith safety stops are included in pressing and squat instructions.
- The old “Smith machine leg press” was removed because a standard Smith
  machine does not provide the required leg-press platform or back support.
- Pain, dizziness, chest pressure, unusual breathlessness or a loss of movement
  control are stop signals, not progression inputs.
- Active injury preferences continue to substitute or omit affected exercises.
- This is general fitness programming for an apparently healthy beginner, not
  medical clearance or rehabilitation advice.
