# Trading Skills Coach — source and adaptation

The HAL Skills Coach is an **Android-native adaptation of checklist concepts**, not a copy
of the Python/Claude skill runtime. Original repository:
https://github.com/dr-pabs/Agent-claude-trading-skills
(forked from https://github.com/tradermonty/claude-trading-skills)

Referenced source skills:
- `skills/options-strategy-advisor/SKILL.md` — long protective puts, option risk and modelling limits;
- `skills/pre-trade-discipline-gate/SKILL.md` — input completeness, review gates, and no automated execution;
- `skills/position-sizer/SKILL.md` — strictest-risk-constraint logic, adapted conservatively for futures;
- `skills/trader-memory-core/SKILL.md` — thesis, review, and journal discipline.

The original skills target US stocks and sometimes Python, FMP, FINVIZ, or Alpaca.
**None** of those services or Python scripts run in HAL Desk. HAL continues to use
its read-only market evidence and app-calculated options/futures positions. In
the Skills Coach tab, a pure local checklist runs at no provider cost. The user
may separately consent to a **single direct Google Gemini request** for a
structured interpretation. No confidence probabilities, market prices, margin
figures, or P&L are produced by the adapted skill engine.

The review is intentionally not a "GO" trading signal or broker permission.
Items marked CHECKED mean the corresponding app evidence is currently present,
not that a position is suitable or safe. HAL does not place orders.

## Upstream license

MIT License

Copyright (c) 2026 TraderMonty

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
