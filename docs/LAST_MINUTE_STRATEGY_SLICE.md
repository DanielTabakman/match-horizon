# Last-Minute Strategy Slice

Authorized before final recording as a narrow presentation improvement only.

## Included

- Standard, Conservative, and Custom strategy presets over existing required-edge and Kelly controls.
- One optional manually entered paper prediction-market quote.
- A concise `Prediction-market connections — coming soon` explanation.

## Boundaries

- Standard remains the default and preserves the existing demo route.
- The paper quote is off by default and clearly labeled as manually entered, not live data.
- No API connection, wallet, authentication, order placement, custody, automatic market mapping, or new settlement logic.
- Any preset or paper-quote change clears a previously built route.
- Replay freezes the resulting route exactly as it does today.

## Required validation

- Preset unit tests.
- Existing tests, replay validation, typecheck, lint, and build.
- Desktop and mobile smoke tests.
- Production remains frozen unless the complete slice passes.
