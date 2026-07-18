export type PythonStrategySample = {
  id: string;
  label: string;
  source: string;
};

export const PYTHON_STRATEGY_SAMPLES: PythonStrategySample[] = [
  {
    id: "stale-market-detector",
    label: "Stale Market Detector",
    source: `def evaluate(context):
    obs = context["selectedObservation"]
    if obs is None:
        return {"decision": "reject", "score": None, "reasons": ["No selected observation."], "metrics": {}}

    ask = obs.get("bestAskProbability") or obs.get("midpointProbability")
    mapping = context.get("selectedMapping")
    reference = None
    if mapping and mapping.get("txlineOutcomeId"):
        reference = context.get("txlineReference", {}).get(mapping["txlineOutcomeId"])

    spread = obs.get("spreadProbability")
    observed_at = obs.get("observedAt")
    evaluated_at = context.get("evaluationTimestamp")
    age_minutes = None
    if observed_at and evaluated_at:
        from datetime import datetime
        age_minutes = max(0, (datetime.fromisoformat(evaluated_at.replace("Z", "+00:00")) - datetime.fromisoformat(observed_at.replace("Z", "+00:00"))).total_seconds() / 60)
    if ask is None or reference is None:
        return {"decision": "context-only", "score": 0, "reasons": ["Need mapped ask and reference probability."], "metrics": {"ask": ask, "reference": reference}}
    if age_minutes is None or age_minutes > 10:
        return {"decision": "reject", "score": 10, "reasons": ["Quote is too stale for stale-market detection."], "metrics": {"ageMinutes": age_minutes}}
    if spread is not None and spread > 0.12:
        return {"decision": "reject", "score": 20, "reasons": ["Spread is too wide for stale-market detection."], "metrics": {"spread": spread}}

    divergence = reference - ask
    decision = "accept" if divergence >= 0.08 and mapping and mapping.get("equivalence") == "exact" else "context-only"
    return {"decision": decision, "score": round(abs(divergence) * 100, 2), "reasons": ["Reference divergence checked against mapping and spread."], "metrics": {"ask": ask, "reference": reference, "divergence": divergence, "ageMinutes": age_minutes}}`,
  },
  {
    id: "liquidity-adjusted-edge",
    label: "Top-of-book Liquidity Gate",
    source: `def evaluate(context):
    obs = context["selectedObservation"]
    if obs is None:
        return {"decision": "reject", "score": None, "reasons": ["No selected observation."], "metrics": {}}

    ask = obs.get("bestAskProbability") or obs.get("midpointProbability")
    belief = context.get("userProbability")
    depth = obs.get("availableAskSize") or obs.get("availableBidSize") or 0
    spread = obs.get("spreadProbability") or 0
    if ask is None or belief is None:
        return {"decision": "context-only", "score": 0, "reasons": ["User belief and ask probability are required."], "metrics": {"depth": depth}}

    edge = belief - ask
    adjusted_edge = edge - min(spread, 0.25) * 0.5
    stake = min(depth * 0.2, 250)
    decision = "accept" if adjusted_edge >= 0.04 and depth >= 25 else "reject"
    return {"decision": decision, "score": round(max(adjusted_edge, 0) * 100, 2), "reasons": ["Edge adjusted for spread and available depth."], "metrics": {"edge": edge, "adjustedEdge": adjusted_edge, "depth": depth}, "proposedStake": stake}`,
  },
  {
    id: "consensus-outlier",
    label: "Consensus Outlier",
    source: `def median(values):
    values = sorted(values)
    if not values:
        return None
    return values[len(values) // 2]

def evaluate(context):
    obs = context["selectedObservation"]
    if obs is None:
        return {"decision": "reject", "score": None, "reasons": ["No selected observation."], "metrics": {}}

    price = obs.get("midpointProbability") or obs.get("bestAskProbability")
    mapping = obs.get("mapping")
    group = None
    if mapping and mapping.get("equivalence") == "exact" and mapping.get("txlineFixtureId") and mapping.get("txlineOutcomeId"):
        group = mapping["txlineFixtureId"] + ":" + mapping["txlineOutcomeId"]
    peers = []
    for candidate in context["observations"]:
        candidate_price = candidate.get("midpointProbability") or candidate.get("bestAskProbability")
        candidate_mapping = candidate.get("mapping")
        candidate_group = None
        if candidate_mapping and candidate_mapping.get("equivalence") == "exact" and candidate_mapping.get("txlineFixtureId") and candidate_mapping.get("txlineOutcomeId"):
            candidate_group = candidate_mapping["txlineFixtureId"] + ":" + candidate_mapping["txlineOutcomeId"]
        if group is not None and candidate["venueId"] != obs["venueId"] and candidate_group == group and candidate_price is not None:
            peers.append(candidate_price)
    consensus = median(peers)
    if price is None or consensus is None:
        return {"decision": "context-only", "score": 0, "reasons": ["Need peer observations for consensus."], "metrics": {"peerCount": len(peers)}}

    divergence = abs(price - consensus)
    return {"decision": "accept" if divergence >= 0.06 else "reject", "score": round(divergence * 100, 2), "reasons": ["Compared selected venue to peer median."], "metrics": {"price": price, "consensus": consensus, "peerCount": len(peers), "divergence": divergence}}`,
  },
  {
    id: "contrarian-tail",
    label: "Contrarian Tail",
    source: `def evaluate(context):
    obs = context["selectedObservation"]
    if obs is None:
        return {"decision": "reject", "score": None, "reasons": ["No selected observation."], "metrics": {}}

    probability = obs.get("midpointProbability") or obs.get("bestAskProbability")
    spread = obs.get("spreadProbability")
    depth = obs.get("availableAskSize") or obs.get("availableBidSize") or 0
    passes = probability is not None and probability <= 0.25 and (spread is None or spread <= 0.15) and depth >= 10
    mapping = obs.get("mapping")
    exact = bool(mapping and mapping.get("equivalence") == "exact")
    decision = "context-only" if not exact and passes else ("accept" if passes else "reject")
    return {"decision": decision, "score": round((1 - (probability or 1)) * min(depth / 100, 1) * 100, 2), "reasons": ["Low-probability outcome checked for depth and spread."], "metrics": {"probability": probability, "spread": spread, "depth": depth}}`,
  },
  {
    id: "custom-interestingness-score",
    label: "Custom Interestingness Score",
    source: `def evaluate(context):
    observations = context["observations"]
    selected = context["selectedObservation"]
    target = selected or (observations[0] if observations else None)
    if target is None:
        return {"decision": "reject", "score": None, "reasons": ["No observations available."], "metrics": {}}

    depth = (target.get("availableAskSize") or 0) + (target.get("availableBidSize") or 0)
    spread = target.get("spreadProbability")
    probability = target.get("midpointProbability") or target.get("bestAskProbability") or 0.5
    liquidity_score = min(depth / 200, 1)
    spread_score = 0.2 if spread is None else max(0, 1 - spread / 0.2)
    tail_score = abs(probability - 0.5) * 2
    score = round((liquidity_score * 0.4 + spread_score * 0.35 + tail_score * 0.25) * 100, 2)
    return {"decision": "context-only", "score": score, "reasons": ["Custom score is informational and does not route."], "metrics": {"liquidityScore": liquidity_score, "spreadScore": spread_score, "tailScore": tail_score}}`,
  },
  {
    id: "minimal-hello-strategy",
    label: "Minimal Hello Strategy",
    source: `def evaluate(context):
    return {
        "decision": "context-only",
        "score": 1,
        "reasons": ["Hello from a trusted local strategy."],
        "metrics": {"observationCount": len(context["observations"])}
    }`,
  },
];
