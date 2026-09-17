# Product definition

## One-line definition

**Jano is a local bilingual academic reader that aligns an original scholarly document with a working translation so both can be read as one synchronized document.**

## Problem

Long academic reading in a second language can become cognitively tiring. A full translation reduces that burden, but reading only the translation separates the researcher from the canonical source.

Jano is intended to preserve both advantages:

- use the translation for reading comfort;
- keep the original continuously available as the source of truth.

## Core product model

Jano is not conceptually:

```text
PDF A <-> PDF B
```

Its core model is:

```text
Document
  -> pages / source positions
  -> text blocks
  -> segments
  -> alignments
  -> reader
```

The visible documents are views over a structured relationship.

## Canonical-source principle

The **original document is canonical**.

A translation is a reading aid and may later carry provenance such as:

- working translation;
- machine translation;
- self-translation;
- reviewed translation;
- published translation.

Future research integrations must preserve this distinction.

## Local-first principle

The reading core must work entirely offline.

The project must not require:

- a Jano account;
- a Jano server;
- mandatory telemetry;
- cloud storage controlled by Jano.

Future optional services or remote translation providers may use the network only when the user explicitly chooses them.

## User-file principle

Jano must not trap the user's documents in a proprietary container.

A user who stops using Jano should still retain normal files in normal folders.

## Product boundary

Jano is primarily a **reading environment**, not:

- a PDF authoring application;
- a page-layout reconstruction system;
- a full bibliographic manager;
- a cloud document service;
- an AI platform.

Future integrations can connect those systems without changing Jano's central responsibility.
