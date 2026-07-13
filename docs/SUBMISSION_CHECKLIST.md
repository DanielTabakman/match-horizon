# Submission Checklist

## Product

- [ ] Real TxLINE fixture loads
- [ ] Real TxLINE match-result probabilities load
- [ ] Probabilities are correctly normalized
- [ ] User belief input totals 100%
- [ ] Disagreement calculation is tested
- [ ] Strongest disagreement is explained
- [ ] Expression recommendation is accurate and modest
- [ ] Historical replay reaches final result
- [ ] Result receipt is based on real TxLINE data
- [ ] No live match is required for the core demo

## Reliability

- [ ] Build passes
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] Replay validation passes
- [ ] Empty state works
- [ ] Authentication failure state works
- [ ] Unsupported market state works
- [ ] Incognito browser smoke test passes
- [ ] Mobile-width smoke test passes

## Isolation

- [ ] No imports or dependencies from MSOS
- [ ] No imports or dependencies from Autobuilder
- [ ] No MSOS or Autobuilder files were modified
- [ ] Separate deployment configured
- [ ] Separate environment variables configured
- [ ] Autobuilder was not used without Daniel's explicit approval

## Security

- [ ] No credentials committed
- [ ] No credentials exposed to browser
- [ ] `.env*` ignored except `.env.example`
- [ ] Logs contain no tokens
- [ ] Captured samples are sanitized
- [ ] Public repository history contains no secrets

## Documentation

- [ ] README explains problem and product
- [ ] README explains architecture
- [ ] README lists specific TxLINE data used
- [ ] README explains local setup
- [ ] README explains replay mode
- [ ] README distinguishes captured, locally checked, and on-chain validated data
- [ ] License included
- [ ] Known limitations documented
- [ ] TxLINE feedback drafted

## Deployment

- [ ] Public URL works
- [ ] Default route leads to the demo
- [ ] Environment variables configured
- [ ] Captured replay bundled
- [ ] Server API routes respond
- [ ] No development-only paths
- [ ] No broken links

## Demo video

- [ ] Under five minutes
- [ ] States the problem in under 20 seconds
- [ ] Shows real TxLINE-powered market data
- [ ] Shows user belief entry
- [ ] Shows disagreement result
- [ ] Shows replay
- [ ] Shows final receipt
- [ ] Explains architecture briefly
- [ ] Mentions deterministic replay because matches may not be live
- [ ] Ends with deployed URL and repository

## Submission form

- [ ] Demo video link
- [ ] Public repository link
- [ ] Working application link
- [ ] Short product description
- [ ] Technical overview
- [ ] TxLINE endpoints or data categories used
- [ ] Business or future-use explanation
- [ ] TxLINE positive feedback
- [ ] TxLINE friction or bug feedback
- [ ] Team and eligibility information
