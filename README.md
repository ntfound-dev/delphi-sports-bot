# Delphi Sports Trading Agent

> Autonomous sports-market trading agent built for the Delphi Agent Arena.

An autonomous trading agent that continuously monitors sports prediction markets, detects potential pricing inefficiencies, evaluates signals with an LLM-assisted probability model, applies risk controls, and executes trades when the expected edge is sufficiently strong.

The project was built with a focus on **autonomous decision-making, market analysis, risk management, and production deployment**.

## Why This Project?

Prediction markets continuously aggregate information into prices, but those prices can still contain behavioral biases.

This project explores one specific hypothesis:

> Can an autonomous agent identify potential longshot/favorite pricing biases, validate them with additional reasoning, and trade only when the estimated edge justifies the risk?

Instead of attempting to predict every sports event, the agent focuses on finding **specific situations where the market price may be inefficient**.

## Key Features

- 🤖 Autonomous market monitoring
- 📊 Sports prediction-market analysis
- 🎯 Longshot/favorite bias strategy
- 🧠 LLM-assisted probability estimation
- 🛡️ Configurable risk management
- 💰 Dynamic position sizing
- ⏱️ Settlement-window filtering
- 📉 Slippage protection
- 🔄 Continuous polling and execution
- ☁️ Railway-compatible production deployment
- 🔐 Environment-based secret management
- 🧩 Modular TypeScript architecture

## System Architecture

```text
                    ┌─────────────────────┐
                    │   Delphi Markets    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Market Scanner    │
                    │                     │
                    │ • Open markets      │
                    │ • Live prices       │
                    │ • Settlement time   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Signal Detection    │
                    │                     │
                    │ Longshot / Favorite │
                    │ Price Analysis      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ LLM Evaluation      │
                    │                     │
                    │ Market probability  │
                    │ vs estimated odds   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Risk Manager      │
                    │                     │
                    │ • Edge threshold    │
                    │ • Position limits   │
                    │ • Slippage          │
                    │ • Balance limits    │
                    └──────────┬──────────┘
                               │
                     ┌─────────┴─────────┐
                     │                   │
                   SKIP                TRADE
                     │                   │
                     ▼                   ▼
                  Ignore             Executor
                                         │
                                         ▼
                                Delphi Prediction
                                    Market

Decision Pipeline

For every candidate market:

Market Price
      ↓
Price-Based Signal
      ↓
Probability Estimation
      ↓
LLM Sanity Check
      ↓
Expected Edge
      ↓
Risk Validation
      ↓
Trade / Skip

Example runtime decision:

marketPrice = 0.845
llmProb     = 0.730
finalEdge   = -0.115

Decision: SKIP
Reason: edge below configured threshold

The agent is intentionally allowed to do nothing when a signal is weak.

Project Structure

delphi-sports-bot/
│
├── src/
│   ├── config.ts
│   ├── delphiClient.ts
│   ├── executor.ts
│   ├── index.ts
│   ├── longshotFade.ts
│   ├── marketScanner.ts
│   ├── newsSignal.ts
│   └── riskManager.ts
│
├── .env.example
├── package.json
├── package-lock.json
├── tsconfig.json
├── skills-lock.json
└── README.md

Core Components

Component	Responsibility

marketScanner.ts	Discovers and filters sports markets
longshotFade.ts	Generates price-based trading signals
newsSignal.ts	Performs LLM-assisted signal evaluation
riskManager.ts	Controls exposure and position sizing
executor.ts	Handles trade execution and settlement
delphiClient.ts	Delphi API/client integration
config.ts	Centralized configuration
index.ts	Autonomous agent loop


Technology Stack

Language

TypeScript

Node.js


Trading / Market Infrastructure

Delphi prediction-market infrastructure

Autonomous wallet signing

API-based market interaction


AI

LLM-assisted probability assessment

Groq API


Deployment

Railway

Node.js worker process


Development

npm

TypeScript compiler

Git / GitHub


Configuration

The agent is controlled through environment variables.

Important parameters include:

DELPHI_NETWORK=
DELPHI_SIGNER_TYPE=

WALLET_PRIVATE_KEY=
DELPHI_API_ACCESS_KEY=

GROQ_API_KEY=
LLM_MODEL=

LONGSHOT_MIN_PRICE=
LONGSHOT_MAX_PRICE=

FAVORITE_MIN_PRICE=
FAVORITE_MAX_PRICE=

MIN_EDGE=
MAX_POSITION_FRACTION=
MAX_TOKENS_PER_TRADE=

MAX_HOURS_TO_SETTLEMENT=
POLL_INTERVAL_SECONDS=
SLIPPAGE_BPS=

Sensitive values should only be provided through local or cloud environment variables.

Risk Management

Trading logic is separated from risk management.

The risk layer considers:

Available balance

Maximum position fraction

Maximum tokens per trade

Minimum required edge

Maximum settlement horizon

Slippage tolerance


This separation makes it possible to modify the trading strategy without bypassing the safety constraints.

Autonomous Operation

The agent continuously polls the market.

Example:

Starting Delphi sports trading agent
Poll interval: 120s

Scanning sports markets...
Found 4 open markets

Signals detected: 1

Evaluating candidate...
Applying risk controls...

Decision: SKIP

The agent then waits for the next polling interval and repeats the process.

Production Deployment

The application is designed as a long-running worker rather than a web server.

It can be deployed to Railway using:

npm install
npm run build
npm start

Railway automatically detects the Node.js project and builds the TypeScript application before starting the worker.

Secrets are configured through Railway environment variables rather than stored in the repository.

Local Development

Install dependencies:

npm install

Create the local configuration:

cp .env.example .env

Run the development version:

npm run dev

Build the project:

npm run build

Run the compiled application:

npm start

Security

Sensitive credentials are intentionally excluded from the repository.

Never commit:

.env
WALLET_PRIVATE_KEY
DELPHI_API_ACCESS_KEY
GROQ_API_KEY

Production deployments should use environment variables for secret management.

Current Status

Implemented

[x] Delphi market integration

[x] Sports market discovery

[x] Live market price analysis

[x] Longshot/favorite signal detection

[x] LLM probability evaluation

[x] Edge calculation

[x] Position sizing

[x] Risk controls

[x] Trade execution

[x] Settlement handling

[x] Continuous autonomous loop

[x] Railway deployment

[x] GitHub repository


Future Improvements

[ ] Live sports-news integration

[ ] Historical strategy backtesting

[ ] Probability calibration using competition data

[ ] Improved sports-specific models

[ ] Adaptive position sizing

[ ] Performance analytics dashboard

[ ] More advanced event detection


Engineering Goals

This project is designed as more than a simple trading script.

The main engineering goals are:

1. Autonomy
Continuously discover opportunities and make decisions without manual intervention.


2. Modularity
Keep market discovery, signal generation, AI evaluation, risk management, and execution separated.


3. Safety
Require explicit risk validation before executing a trade.


4. Observability
Produce useful runtime information for monitoring decisions and skipped opportunities.


5. Deployability
Run the same application locally or as a persistent cloud worker.



What I Learned

Building this project involved working across several areas of modern software engineering:

Autonomous agent design

Prediction-market mechanics

Probabilistic reasoning

LLM integration

Risk management

Blockchain wallet signing

API integration

TypeScript architecture

Environment-based configuration

Cloud worker deployment

Git/GitHub workflows


The architecture is intentionally modular so individual components can be improved independently as more market data becomes available.

Limitations

This is an experimental trading system.

The strategy is not guaranteed to be profitable.

The current priorEdge model uses assumptions derived from general longshot/favorite bias research rather than a large Delphi-specific historical dataset.

The LLM is an additional reasoning layer, not a source of guaranteed predictions.

Future versions should use historical competition data to calibrate the probability model and evaluate the strategy statistically.

Disclaimer

This project was developed for experimentation and participation in the Delphi Agent Arena.

It is not financial advice and does not guarantee trading profits.

License

See the repository and included Delphi skill documentation for licensing information.
