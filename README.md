# HAL — Market & Position Desk (React)

A personal web application for Hindustan Aeronautics (NSE: HAL), rewritten in React, TypeScript, Tailwind CSS, and Vite, with an Express backend for market data retrieval and technical calculations.

## Overview

HAL Desk provides delayed NSE market quotes, advanced technical indicator analytics, TradingView candlestick charts, a comprehensive F&O position desk, scenario simulations, a protective put hedge screener, rule-based research analyst panels, and newsroom tracking for Hindustan Aeronautics Limited.

## Features

### 1. Market Overview & Quote
- Real-time and delayed market quote for **NSE: HAL**: Last Traded Price (LTP), session change & percentage, day open/high/low/volume, 52-week high & low.
- Moving averages: SMA 20, SMA 50, SMA 200, Wilder RSI (14), ATR (14), MFI (14), MACD histogram, and 20-day annualized realized volatility.
- NIFTY 50 macro context: NIFTY spot, 20-DMA, 200-DMA, HAL 60-day beta, and 60-day correlation.

### 2. Position Desk (Book, Risk & Scenarios)
- **Book**: Multi-leg long futures and protective puts portfolio with lot verification, entry prices, expiry dates, IV assumptions, and optional manual broker marks.
- **Risk**: Portfolio delta, theta (₹/calendar day), quantity coverage percentage, expiry timeline, and calendar rollover comparison spread.
- **Scenarios**: What-if price simulation across spot shifts (-5%, -3%, -1%, current, +3%, +5% or custom price), days ahead, and IV shift. Exact intrinsic payoff at shared expiry.
- **Find a Hedge**: Quantitative protective-put screener that compares listed put contracts against saved long HAL futures, evaluates gross outlay, budget constraints, stress losses in sampled market drops (-10%, -5%, -3%, 0%), and generates a transparent shortlist ("Lower cost", "Stronger protection", "Balanced").
- **Journal & Portability**: Record closed trades, brokerage/exchange charges, and settlement cash entries. Full JSON backup export/import (halpos3 schema) and CSV export.

### 3. Markets & Derivatives View
- High-performance Candlestick Chart powered by TradingView Lightweight Charts™.
- Calculated Reference Levels: Floor pivot, R1, S1, R2, S2, 52W Fibonacci retracements (23.6%, 38.2%, 50%, 61.8%), SMA 20 Gate, and SMA 50 Stop.
- Recent 6-session OHLCV breakdown.
- HAL stock futures book and Option Chain with strike filter and Greeks.

### 4. HAL Research Desk
- **Agent Analyst Panels**: Transparent, deterministic rule-based analyst reports (Technical Analyst, Bull Researcher, Bear Researcher, Risk Manager, Fundamental Analyst, News Analyst).
- **Fundamentals**: Revenue, EBITDA, margins, order book depth (₹2.54 L Cr backlog), guidance, ROE, ROCE, and institutional shareholding breakdown.
- **Business Journal**: Track thesis accountability with sourced notes on order book, deliveries, guidance, and official NSE corporate disclosures.

### 5. Newsroom
- Filterable news feed (Official announcements, Orders & contracts, Results, Operations, Bookmarks).

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React icons, TradingView Lightweight Charts.
- **Backend**: Node.js 22, Express, TypeScript (`server.ts`).
- **Dev Server**: Vite integrated with Express on `0.0.0.0:3000`.

## Running the App

```bash
# Install dependencies
npm install

# Run dev server on port 3000
npm run dev

# Build for production
npm run build

# Start production server
npm start
```
