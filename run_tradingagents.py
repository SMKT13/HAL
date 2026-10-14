#!/usr/bin/env python3
"""Optional manual runner for the *official* TauricResearch/TradingAgents v0.6.0.

No server endpoint invokes this file. Use a trusted desktop/VM with a supported
LLM (free local Ollama or separately billed hosted model). Only HAL.NS is used.
The output is a sanitized, static public-company report, not private holdings.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parent
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
OUT = ROOT / "reports" / "hal-tradingagents-latest.json"


def run(argv=None):
    parser = argparse.ArgumentParser(description="Run official TradingAgents for HAL.NS")
    parser.add_argument("--date", default=dt.datetime.now(IST).date().isoformat(),
                        help="Analysis date YYYY-MM-DD, not after today in IST")
    parser.add_argument("--provider", default=os.getenv("TRADINGAGENTS_LLM_PROVIDER", "ollama"),
                        help="TradingAgents LLM provider (default: ollama, locally hosted)")
    parser.add_argument("--confirm-run", action="store_true",
                        help="Acknowledge model, network, compute and potential API costs")
    args = parser.parse_args(argv)
    if not args.confirm_run:
        parser.error("Pass --confirm-run after checking your selected provider, model and costs.")
    try:
        parsed = dt.date.fromisoformat(args.date)
        if parsed.isoformat() != args.date or parsed > dt.datetime.now(IST).date():
            raise ValueError("invalid or future analysis date")
    except ValueError:
        parser.error("--date must be a real YYYY-MM-DD date, not in the future (IST).")

    try:
        from tradingagents.graph.trading_graph import TradingAgentsGraph
        from tradingagents.default_config import DEFAULT_CONFIG
    except ImportError as exc:
        parser.error("Install the official TradingAgents v0.6.0 optional dependency first. " + str(exc))

    config = DEFAULT_CONFIG.copy()
    config["data_vendors"] = dict(config["data_vendors"])
    config["data_vendors"]["core_stock_apis"] = "yfinance"
    config["data_vendors"]["technical_indicators"] = "yfinance"
    config["llm_provider"] = args.provider
    if args.provider == "ollama":
        config["quick_think_llm"] = os.getenv("TRADINGAGENTS_QUICK_THINK_LLM", "qwen3:8b")
        config["deep_think_llm"] = os.getenv("TRADINGAGENTS_DEEP_THINK_LLM", "qwen3:8b")
    elif not (os.getenv("TRADINGAGENTS_QUICK_THINK_LLM") and
              os.getenv("TRADINGAGENTS_DEEP_THINK_LLM")):
        parser.error("Set TRADINGAGENTS_QUICK_THINK_LLM and TRADINGAGENTS_DEEP_THINK_LLM for the hosted provider.")

    config["max_tool_rounds"] = 8
    graph = TradingAgentsGraph(
        selected_analysts=("market", "news"), debug=False, config=config)
    state, decision = graph.propagate("HAL.NS", args.date)

    def get_text(key):
        value = state.get(key, "") if isinstance(state, dict) else ""
        return str(value)[:12000] if value else ""

    report = {
        "framework": "TauricResearch/TradingAgents",
        "framework_version_target": "0.6.0",
        "ticker": "HAL.NS",
        "analysis_date": args.date,
        "generated_at": dt.datetime.now(IST).isoformat(),
        "provider": args.provider,
        "decision": str(decision)[:120],
        "market_report": get_text("market_report"),
        "news_report": get_text("news_report"),
        "final_trade_decision": get_text("final_trade_decision"),
        "notice": "External market/AI data may be incomplete; no F&O quote verification or automatic trading.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=OUT.parent, encoding="utf-8",
                                         prefix=".ta-report-", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(report, handle, ensure_ascii=False, allow_nan=False, indent=2)
        os.replace(temporary, OUT)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    print(f"Saved stock-only TradingAgents report: {OUT}")
    print("Set HAL_TA_PUBLISH_REPORT=1 on a trusted dashboard server to display it.")
    return report


if __name__ == "__main__":
    run()
