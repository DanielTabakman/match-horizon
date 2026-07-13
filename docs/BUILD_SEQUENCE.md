# Build Sequence

No phase begins until the prior phase passes its gate.

## Phase 0 — Repository setup

### Deliverables

- Minimal Next.js TypeScript application
- Development, test, lint, typecheck, and build commands
- `.env.example`
- Charter documents
- `AGENTS.md`

### Gate

A clean checkout installs and runs locally. The repository remains independent from MSOS and Autobuilder.

---

## Phase 1 — TxLINE connectivity probe

### Deliverable

A command such as:

```bash
npm run txline:probe
```

### Required behavior

- Validate required environment variables.
- Fetch fixture data.
- Select a configured or discoverable World Cup fixture.
- Fetch fixture-specific odds data.
- Fetch current or historical score data.
- Print record counts and representative field names.
- Save sanitized samples under a test-fixture directory.
- Return clear errors for missing configuration, authentication failure, empty results, and malformed payloads.

### Gate

The terminal shows a real fixture, a real odds response, and score data or a documented reason the selected fixture lacks it.

No product UI begins before this passes.

---

## Phase 2 — Narrow normalization layer

### Deliverables

- Raw TxLINE schemas
- Fixture normalizer
- Match-result odds normalizer
- Score-event normalizer
- Fixture-based tests using sanitized real samples

### Gate

A captured real payload produces:

- one normalized fixture;
- exactly three match-result outcomes;
- probabilities totaling approximately 100%;
- normalized score events.

Unsupported markets fail explicitly.

---

## Phase 3 — Core vertical slice

### Deliverables

- Fixture selector or a single configured fixture
- Market probability display
- User belief editor
- Validation that user probabilities total 100%
- Disagreement engine
- Strongest-disagreement card
- Plain-language expression recommendation

### Gate

A user can complete the entire belief-comparison flow locally with real normalized TxLINE data.

---

## Phase 4 — Deterministic replay capture

### Deliverables

- Capture script for one completed fixture
- Combined ordered timeline of score and odds events
- Versioned replay JSON
- Replay validation script

### Gate

The saved timeline:

- is based on real TxLINE data;
- is chronologically ordered;
- starts from a valid market state;
- reaches a finalized match result;
- can be loaded without external network access.

---

## Phase 5 — Replay UI

### Deliverables

- Play
- Pause
- Restart
- Accelerated playback
- Score updates
- Market probability updates where captured data permits
- Recalculated disagreement
- Event timeline
- Final state

### Gate

The same replay produces the same visible sequence after restart.

---

## Phase 6 — Result and verification receipt

### Deliverables

- Final score
- Finalization status
- Original user belief
- Initial market snapshot
- Selected expression result
- Proof availability and validation-state labels

### Gate

Every verification claim matches the actual implemented level.

---

## Phase 7 — Deployment

### Deliverables

- Public deployed application
- Separate deployment from MSOS
- Server-side credential handling
- Loading, empty, and failure states
- Incognito smoke test

### Gate

The deployed captured replay works without a live match and without exposing secrets.

---

## Phase 8 — Submission package

### Deliverables

- Public repository
- README with architecture and TxLINE usage
- Working URL
- Demo video under five minutes
- API feedback
- Submission text
- License

### Gate

A person unfamiliar with the project can open the README, run the app, and understand the demo path.

## Fallback ladder

### Level 1 — Target

- Current snapshots
- Historical odds and score replay
- Verification receipt
- Optional live mode

### Level 2 — Strong submission

- Current snapshot
- Historical score replay
- Captured odds timeline
- Verification receipt

### Level 3 — Submission-safe

- Real captured fixture
- Real captured odds snapshot
- Belief comparison
- Deterministic score replay
- Transparent documentation

### Level 4 — Minimum working build

- Real TxLINE snapshot
- Belief comparison
- Deployed application

Never substitute invented data for a TxLINE-powered core flow.
