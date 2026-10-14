'use strict';
const byId = id => document.getElementById(id);

function textElement(tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = String(content == null ? 'Not available' : content);
  if (className) element.className = className;
  return element;
}

function renderAgents(data) {
  const metadata = byId('market');
  metadata.replaceChildren();
  [
    'Symbol: ' + data.symbol,
    'Spot: ' + (typeof data.market_price === 'number' ? '₹' + data.market_price.toLocaleString('en-IN') : '—'),
    'Status: ' + data.data_status,
    'Quote time: ' + (data.quote_as_of || 'not supplied'),
    'Last daily session: ' + (data.last_session || 'not supplied'),
    'Source: ' + data.source
  ].forEach(value => metadata.appendChild(textElement('span', value, 'pill')));
  byId('summary').textContent = data.assessment + ' Source may be delayed. ' +
    (data.stale ? 'Cached market data is stale.' : 'Review the quote timestamp before acting.');

  const list = byId('agent-cards');
  list.replaceChildren();
  for (const agent of data.agents) {
    const article = document.createElement('article');
    article.className = 'card';
    article.appendChild(textElement('h3', agent.name));
    article.appendChild(textElement('span', agent.stance, 'pill'));
    const bullets = document.createElement('ul');
    for (const sentence of agent.evidence) {
      bullets.appendChild(textElement('li', sentence));
    }
    article.appendChild(bullets);
    list.appendChild(article);
  }
}

async function loadAgents() {
  byId('refresh').disabled = true;
  try {
    const response = await fetch('/api/agents', {cache:'no-store'});
    if (!response.ok) throw new Error('Market feed unavailable (HTTP ' + response.status + ')');
    const data = await response.json();
    if (!Array.isArray(data.agents) || data.mode !== 'deterministic_rules_not_llm') throw new Error('Invalid agent response');
    renderAgents(data);
  } catch (error) {
    byId('market').textContent = 'Could not load validated market data.';
    byId('summary').textContent = error.message;
    byId('agent-cards').replaceChildren();
  } finally {
    byId('refresh').disabled = false;
  }
}

async function loadOfficial() {
  const status = byId('official-status');
  try {
    const response = await fetch('/api/tradingagents/report', {cache:'no-store'});
    if (response.status === 404) {
      status.textContent = 'No published report. The free research panels above remain available. See the setup in README.md.';
      return;
    }
    if (!response.ok) throw new Error('Report not available');
    const report = await response.json();
    if (report.framework !== 'TauricResearch/TradingAgents' || !report.analysis_date)
      throw new Error('Report has an unrecognized format');
    const metadata = byId('official-meta');
    metadata.replaceChildren();
    ['Ticker: ' + report.ticker, 'Analysis date: ' + report.analysis_date,
     'Generated: ' + report.generated_at, 'Model provider: ' + report.provider]
      .forEach(value => metadata.appendChild(textElement('span', value, 'pill')));
    byId('official-decision').textContent = report.decision || 'No parseable rating (review report)';
    const sections = byId('official-sections');
    sections.replaceChildren();
    for (const key of ['market_report','news_report','final_trade_decision']) {
      const content = report[key];
      if (!content) continue;
      sections.appendChild(textElement('h3', key.replace(/_/g,' ')));
      sections.appendChild(textElement('pre', content));
    }
    status.textContent = 'Published report loaded. This is a separate run; dates and source data may differ from the free panels.';
    byId('official-report').hidden = false;
  } catch (error) {
    status.textContent = 'Unable to load TradingAgents report: ' + error.message;
  }
}

byId('refresh').addEventListener('click', loadAgents);
loadAgents();
loadOfficial();
