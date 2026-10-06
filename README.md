# VULNFORGE

VULNFORGE

Build. Break. Defend.

## Overview

VULNFORGE is a cybersecurity education and CTF platform designed to help students and learners practice discovering, exploiting, and fixing vulnerabilities in controlled environments. The project is intentionally built to be safe and educational, with future modules focused on challenge creation, user flows, and platform functionality.

## Problem Statement

Many cybersecurity learners need hands-on experience to understand how vulnerabilities work in real web applications. Traditional theory-only education often leaves gaps between concept and execution. VULNFORGE is designed to provide a structured way to study vulnerabilities through a professional platform built around safe, controlled learning flows.

## Objectives

- Create a professional foundation for a cybersecurity learning platform
- Offer a public-facing landing page for the project
- Establish a scalable architecture for future modules
- Prepare the platform for future challenge, auth, scoring, and analytics features
- Maintain secure, production-minded infrastructure without exposing sensitive credentials or unsafe services

## Planned Major Features

- Public landing page and product messaging
- Learning pathways for security fundamentals
- Controlled challenge environments
- CTF-style flag submission flows
- User progress tracking and scoring
- Security explanations and remediation guidance
- Leaderboards and challenge analytics
- Admin controls for challenge management

## Technology Stack

- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Infrastructure: Docker, Docker Compose
- Version control: Git

## High-Level Architecture

- `frontend/` contains the React/Vite application and public-facing pages
- `backend/` contains the Express API foundation, middleware, and health checks
- `database/` is reserved for database and migration-related work
- `docker/` is reserved for runtime and environment-specific files
- `docs/` contains project and module documentation
- `prisma/` contains Prisma configuration and schema foundation

## Development Setup

1. Copy `.env.example` to `.env` and adjust values as needed.
2. Install frontend dependencies:
   - `cd frontend && npm install`
3. Install backend dependencies:
   - `cd backend && npm install`
4. Start PostgreSQL with Docker Compose:
   - `docker compose up -d postgres`
5. Start the backend:
   - `cd backend && npm run dev`
6. Start the frontend:
   - `cd frontend && npm run dev`

## How to Run the Project

- Frontend development server: `npm --prefix frontend run dev`
- Backend development server: `npm --prefix backend run dev`
- Docker environment: `docker compose up --build`

## Current Implementation Status

### Module 1 — Foundation and Landing Page

This module establishes the platform foundation and public landing page. It includes the project structure, environment configuration, secure default middleware, Prisma setup, health endpoint, Docker Compose development environment, and a modern cybersecurity landing page.

This module does not include authentication, challenge logic, scoring, vulnerable labs, or future module functionality.

## Notes

The platform itself is intentionally built securely. Future vulnerable challenge environments will remain isolated from the main application foundation.
