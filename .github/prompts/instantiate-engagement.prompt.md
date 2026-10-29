---
description: Create a new customer engagement from this repo (data, assumptions, decks, optional Azure deploy).
agent: customer-onboarding
---
Instantiate this repo for a new engagement.

Inputs (ask if missing): customer name, programme, airport IATA and name, IANA timezone, currency, cost per delay minute, SLA breach penalty, blocked task cost, manual vs agent response minutes, disruptions per month, MVP and build start dates, and whether to deploy to Azure.

Then: create and validate the customer file, run the tests, build the decks, and, if requested, run preflight and the Azure deployment. End with a list of assumptions that still need customer validation.
