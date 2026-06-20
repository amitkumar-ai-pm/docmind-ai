# DocMind AI — Learn using AI and Expand your knowledge

Learn using AI and expand your knowledge — upload documents, ask questions, and explore cited sources in depth.

## Features

- **User authentication** — Register and sign in with email/password
- **Document upload** — Up to 5 documents, 20MB each (PDF, DOCX, DOC, XLSX, XLS, CSV)
- **RAG-powered Q&A** — Hybrid BM25 + vector search with reranking
- **Clickable citations** — Open referenced lines in a dedicated viewer; PDFs open inline with text search
- **Conversation history** — Last 10 conversations saved and resumable
- **Document categories** — Organize by data science, novel, news, business, legal, and more
- **Production-ready** — Docker, PostgreSQL + pgvector, optional S3 storage
- **Metadata extraction** — Title, author, sections, pages stored per document
- **Structure-aware chunking (v5)** — Chapter → Section → Paragraph → Chunk with line offsets
- **Query rewrite + expansion** — Synonym expansion and optional LLM rewrite before retrieval
- **Context compression** — Top 5 chunks compressed before GPT to reduce token cost
- **Retrieval evaluation** — Grounding check and quality metrics logged per response
- **Observability** — Structured latency and usage logs across upload, retrieval, and chat

## Production RAG Pipeline

DocMind AI uses a multi-stage pipeline designed for accuracy, cost efficiency, and production observability. Current chunk version: **v5**.

### Pipeline stages overview

| Stage | Module | What it does |
|-------|--------|--------------|
| Parse | `document-parser.ts` | Extract text from PDF, Word, Excel, CSV |
| Extract Metadata | `metadata.ts` | Title, author, file type, sections, pages, upload date |
| Chunk | `chunking.ts` | Structure-aware v5 chunking with line offsets |
| Embed | `embeddings.ts` | Batch `text-embedding-3-small` vectors |
| Query Analysis | `query-analysis.ts` | Classify query, expand synonyms, optional LLM rewrite |
| Retrieve | `rag.ts` + `bm25.ts` + `vector-store.ts` | BM25 + vector hybrid (RRF top 20) |
| Rerank | `reranker.ts` | Score and select top 5 chunks |
| Compress | `context-compression.ts` | Trim excerpts, preserve `[1][2]` anchors |
| Generate | `ai.ts` | GPT-4o-mini answer with inline citations |
| Evaluate | `evaluation.ts` | Grounding check + quality metrics |
| Observe | `observability.ts` | Latency and usage structured logs |

### 1. Metadata Extraction

**Flow:** Parse → **Extract Metadata** → Chunk → Embed

On upload, `metadata.ts` extracts and stores document-level metadata as JSON on `Document.metadata`:

| Field | Source | Used for |
|-------|--------|----------|
| Document Title | PDF info / filename | BM25 boost, display |
| File Type | MIME / extension | Filtering, display |
| Author | PDF metadata | BM25 boost |
| Section Headers | `chunking.ts` header detection | Retrieval boost |
| Page Count | PDF pages / form-feed estimate | Reference context |
| Upload Date | Server timestamp | Audit / display |
| Category | User-selected tag | Workspace filtering |

Metadata text is prepended during BM25 retrieval to improve keyword matching on titles and section names.

### 2. Structure-Aware Chunking (v5)

**Hierarchy:** Chapter → Section → Paragraph → Chunk

Implemented in `chunking.ts` (`CURRENT_CHUNK_VERSION = 5`):

- **Chapter detection** — `Chapter N`, `Part I`, `Book 1` patterns
- **Section detection** — Headers, numbered sections, TOC blocks
- **Paragraph grouping** — Splits on blank lines before size limits
- **Semantic boundaries** — Breaks at sentences/paragraphs, not mid-word
- **Overlap** — 250-character overlap between adjacent chunks
- **Line offsets** — `startOffset`, `endOffset`, `lineStart`, `lineEnd` for clickable citations
- **Page numbers** — `pageNumber` estimated from PDF form-feed positions
- **Chapter title** — `chapterTitle` stored per chunk

Each chunk stores: `content`, `chapterTitle`, `sectionTitle`, `chunkType` (toc/section/body), offsets, and `pageNumber`.

### 3. Query Expansion & Rewrite

**Flow:** Query Analysis → Query Rewrite → Keyword + Vector search

`query-analysis.ts` handles query understanding before retrieval:

1. **Classify** — structure, coverage, summary, factual, comparison, general
2. **Extract phrases** — quoted terms, domain phrases (e.g. "time series", "severance")
3. **Synonym expansion** — e.g. `severance` → termination benefits, separation pay
4. **LLM rewrite (optional)** — When expanded terms are sparse, GPT rewrites the query for better retrieval

Expanded query feeds both BM25 keyword search and vector embedding search.

### 4. Context Compression

**Flow:** Top 20 → Rerank → Top 5 → **Context Compression** → GPT

`context-compression.ts` reduces token cost before sending context to GPT-4o-mini:

- Keeps citation headers `[1] Document — Section` intact
- For long chunks: keeps first 500 + last 250 characters with `[... excerpt compressed ...]`
- Logs compression savings via observability (`originalChars` vs `compressedChars`)

Typical savings: 30–50% on large document excerpts.

### 5. Retrieval Evaluation

`evaluation.ts` runs after each GPT response to validate answer quality:

| Metric | Description |
|--------|-------------|
| **Hit Rate** | Whether any chunks were retrieved |
| **MRR** | Mean reciprocal rank of first relevant chunk |
| **Precision@5** | Share of top-5 chunks matching query terms |
| **Citation Coverage** | How many retrieved citations appear in the answer |
| **Faithfulness** | Whether answer words are supported by cited excerpts |
| **Answer Relevance** | Overlap between question terms and answer |
| **Grounding Check** | Validates `[n]` citations map to retrieved chunks only |

Metrics are logged as structured JSON (`logEvaluation`) for future dashboards and A/B testing.

### 6. Multi-Document Workspace

The dashboard supports a multi-document workspace:

- **Multiple documents** — Up to 5 per user, organized by category tabs
- **Category tags** — data-science, novel, news, business, legal, other
- **Document-scoped chat** — Select one document to scope all questions
- **Workspace-wide chat** — Ask across all documents when no scope selected
- **Category filtering** — Retrieval can filter by `category` in `rag.ts`

Conversations store `documentId` so chat history reflects the scoped document.

### 7. Observability

`observability.ts` instruments the full request lifecycle with structured JSON logs:

| Event | When | Data logged |
|-------|------|-------------|
| `upload_total` | File upload complete | File count, duration |
| `upload_parse` | Text extraction | Filename, text length |
| `metadata_extract` | Metadata step | Section count, page count |
| `upload_index` | Chunking + embedding | Document ID, duration |
| `embedding` | OpenAI embed batch | Chunk count, embedded count |
| `retrieval` | Hybrid search | Chunk count, result count, query type |
| `context_compression` | Before GPT | Original vs compressed chars, savings % |
| `gpt_completion` | GPT-4o-mini call | Query type, duration |
| `chat_response` | Evaluation complete | Grounding, hit rate, citation count |
| `citation_click` | User opens reference | Document ID, chunk ID |

View logs in the server console during `npm run dev` or Docker container output in production.

### Reindexing after chunk version bumps

When `CURRENT_CHUNK_VERSION` changes (currently **v5**), existing documents must be reindexed:

```bash
cd C:\Users\1036506\document-reader
node scripts/reindex-all.js
```

This runs `scripts/reindex-all.ts` which calls the app's full pipeline: structure-aware chunking, line offsets, and OpenAI embeddings. Expect **~20–30 seconds per large PDF** (400 chunks × embedding API batches). On corporate networks, allow extra time for OpenAI API latency.

## Architecture

DocMind AI is a Next.js full-stack app with a production-grade RAG pipeline: metadata extraction, structure-aware chunking, hybrid retrieval with query expansion, context compression, grounding evaluation, and observability hooks.

### System overview

```mermaid
flowchart TB
    subgraph Users["User flows"]
        U1[Register / Login]
        U2[Upload document]
        U3[Ask question]
        U4[Click citation]
    end

    subgraph Workspace["Multi-document workspace"]
        W1[Doc A / B / C]
        W2[Category tags]
        W3[Per-document chat scope]
    end

    subgraph Frontend["Next.js frontend"]
        F1[Login / Register]
        F2[Dashboard + Chat overlay]
        F3[Chat panel]
        F4["Reference viewer"]
    end

    subgraph API["API routes"]
        A1["/api/auth"]
        A2["/api/documents/upload"]
        A3["/api/chat"]
        A4["/api/documents/id/file"]
        A5["/api/documents/id/reference/chunkId"]
    end

    subgraph Upload["Upload pipeline"]
        P1[Parse PDF / Word / Excel / CSV]
        P2[Extract metadata<br/>title, author, sections, pages]
        P3["Structure-aware chunking<br/>Chapter → Section → Paragraph → Chunk"]
        P4[Embed chunks<br/>text-embedding-3-small]
    end

    subgraph RAG["RAG pipeline"]
        R1[Query analysis]
        R2[Query rewrite + expansion]
        R3[BM25 + metadata boost]
        R4[Vector search]
        R5[Hybrid RRF top 20]
        R6[Reranker top 5]
        R7[Context compression]
        R8[GPT-4o-mini + citations]
    end

    subgraph Eval["Retrieval evaluation"]
        E1[Grounding check]
        E2[Citation coverage]
        E3[Hit Rate / MRR / Precision@5]
        E4[Faithfulness score]
    end

    subgraph Observability["Observability"]
        O1[Upload latency]
        O2[Embedding latency]
        O3[Retrieval latency]
        O4[Token / compression savings]
        O5[Citation click rate]
    end

    subgraph Storage["Storage"]
        S1[("SQLite dev")]
        S2[("PostgreSQL + pgvector prod")]
        S3[Local uploads / S3]
    end

    OAI[(OpenAI API)]

    U1 --> F1 --> A1
    U2 --> W1 --> F2 --> A2 --> P1 --> P2 --> P3 --> P4
    P4 --> S1 & S2 & OAI
    A2 --> S3

    U3 --> W3 --> F3 --> A3 --> R1 --> R2
    R2 --> R3 & R4 --> R5 --> R6 --> R7 --> R8 --> OAI
    R8 --> E1 --> E2 --> E3 --> E4 --> F3
    W2 --> R3

    U4 --> F4 --> A5
    A5 --> O5
    A3 --> O1 & O2 & O3 & O4
```

### Upload & indexing pipeline

```mermaid
flowchart LR
    A[Raw file] --> B[Parse text]
    B --> C[Extract metadata]
    C --> D[Structure-aware chunking]
    D --> E[Attach line offsets + page numbers]
    E --> F[Batch embeddings]
    F --> G[(Document + Chunks DB)]

    C -.- C1[Title / Author / File type]
    C -.- C2[Section headers / Upload date]
    D -.- D1[Chapter → Section → Paragraph]
```

### Q&A & evaluation pipeline

```mermaid
flowchart LR
    Q[User question] --> QA[Query analysis]
    QA --> QR[Query rewrite optional]
    QR --> KE[Keyword BM25]
    QR --> VE[Vector search]
    KE --> RRF[RRF fusion top 20]
    VE --> RRF
    RRF --> RK[Rerank top 5]
    RK --> CC[Context compression]
    CC --> GPT[GPT-4o-mini]
    GPT --> ANS[Answer + citations]
    ANS --> GC[Grounding check]
    GC --> MET[Metrics logged]
```

### Request sequence

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as API routes
    participant IDX as Indexing
    participant RAG as RAG + Eval
    participant OBS as Observability
    participant OAI as OpenAI

    User->>UI: Upload document
    UI->>API: POST /api/documents/upload
    API->>OBS: Start upload timer
    API->>IDX: Parse → metadata → chunk → embed
    IDX->>OAI: Embed chunks
    API->>OBS: Log parse + embedding latency

    User->>UI: Ask question (scoped doc or workspace)
    UI->>API: POST /api/chat
    API->>RAG: Analyze → rewrite → retrieve → compress
    RAG->>OAI: GPT-4o-mini
    RAG->>OBS: Log retrieval + token metrics
    RAG->>RAG: Grounding check + citation coverage
    API->>UI: Answer + citations

    User->>UI: Click citation
    UI->>API: GET /reference/chunkId
    API->>OBS: Log citation click
```

### Production & Docker

```mermaid
flowchart LR
    subgraph Dev["Local development"]
        D1[npm run dev]
        D2[("SQLite<br/>file:./dev.db")]
        D3[uploads/ folder]
    end

    subgraph Prod["docker-compose.prod.yml"]
        C1["app container<br/>Dockerfile multi-stage<br/>standalone Next.js"]
        C2[("postgres container<br/>pgvector/pgvector:pg16")]
        V1["volume: docmind_uploads"]
        V2["volume: docmind_pg_data"]
    end

    subgraph Env["Key env vars"]
        E1[DATABASE_URL]
        E2[USE_PGVECTOR=true]
        E3[NEXTAUTH_URL / NEXTAUTH_SECRET]
        E4[OPENAI_API_KEY]
        E5[STORAGE_TYPE local or s3]
    end

    D1 --> D2
    D1 --> D3
    C1 --> C2
    C1 --> V1
    C2 --> V2
    Env --> C1
```

| Layer | Development | Production (Docker) |
|-------|-------------|----------------------|
| **App** | `next dev` on port 3000 | Multi-stage `Dockerfile` → standalone `node server.js` |
| **Database** | SQLite (`prisma/dev.db`) | PostgreSQL 16 + pgvector extension |
| **Vector search** | In-memory cosine (JSON embeddings) | pgvector when `USE_PGVECTOR=true` |
| **File storage** | `uploads/` on disk | `docmind_uploads` Docker volume (or S3) |
| **Schema** | `prisma/schema.prisma` (SQLite) | Copy `schema.postgresql.prisma` before deploy |

On container start, the app runs `prisma db push` then serves on port **3000**. Postgres is health-checked before the app starts.

### Flow summary

| Flow | Path | Outcome |
|------|------|---------|
| **Auth** | Register/login → NextAuth session | User lands on dashboard |
| **Upload** | Parse → metadata → chunk v5 → embed | Document indexed with structure + line offsets |
| **Workspace** | Multi-doc dashboard, category tags, per-doc chat scope | Filter retrieval by document or category |
| **Q&A** | Query rewrite → hybrid RAG → compress → GPT-4o-mini | Answer with `[1][2]` citations |
| **Evaluation** | Grounding check → citation coverage → metrics log | Hit rate, MRR, Precision@5, faithfulness |
| **Citation** | Click source → reference viewer | Exact lines highlighted; PDF opens in new tab |
| **Observability** | Structured JSON logs per request | Upload, embedding, retrieval, token, click metrics |
| **Production** | `docker compose -f docker-compose.prod.yml up` | App + Postgres + persistent volumes |

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **NextAuth.js** for authentication
- **Prisma** + SQLite (dev) / PostgreSQL (prod)
- **OpenAI** GPT-4o-mini + text-embedding-3-small
- **Tailwind CSS**

## Quick Start (Local)

```bash
cd document-reader
npm install
copy .env.example .env
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Set `OPENAI_API_KEY` and `NEXTAUTH_SECRET` in `.env`.

## Clickable References

When the AI cites a source `[1]`, click it to open `/documents/{id}/reference/{chunkId}` in a new tab:

- **Line-accurate view** — Highlighted excerpt with line numbers, auto-scrolled into view
- **Original document** — Open PDF or file in a new tab from the reference page
- **PDF search** — Browser PDF viewer receives a search snippet for the cited passage

## Production Deployment

### Option A: Docker Compose (recommended)

```bash
# Set secrets in .env
NEXTAUTH_SECRET=your-secret
OPENAI_API_KEY=sk-...

# Use PostgreSQL schema
copy prisma\schema.postgresql.prisma prisma\schema.prisma

# Build and run
docker compose -f docker-compose.prod.yml up -d --build
```

App runs at [http://localhost:3000](http://localhost:3000).

### Option B: PostgreSQL only (dev DB upgrade)

```bash
docker compose up -d
copy prisma\schema.postgresql.prisma prisma\schema.prisma
```

Set in `.env`:

```
DATABASE_URL="postgresql://docmind:docmind@localhost:5432/docmind"
USE_PGVECTOR="true"
```

Then `npx prisma db push && npm run build && npm start`.

### Option C: Vercel / Railway / Render

1. Connect this GitHub repo
2. Set environment variables from `.env.example`
3. Use PostgreSQL add-on; copy `schema.postgresql.prisma` → `schema.prisma`
4. Build command: `npx prisma generate && npx prisma db push && npm run build`
5. Start command: `npm start`
6. For file uploads in serverless, set `STORAGE_TYPE=s3`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite or PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | App URL (e.g. `https://your-domain.com`) |
| `NEXTAUTH_SECRET` | Yes | Random secret for sessions |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `USE_PGVECTOR` | No | `true` for PostgreSQL vector search |
| `STORAGE_TYPE` | No | `local` (default) or `s3` |
| `AWS_*` | If S3 | S3 credentials and bucket |

## RAG Pipeline (summary)

```
Upload:  Parse → Metadata → Chunk v5 → Embed
Query:   Analyze → Rewrite → BM25 + Vector → RRF(20) → Rerank(5) → Compress → GPT → Evaluate
```

See [Production RAG Pipeline](#production-rag-pipeline) above for full details on each stage.

## Limits

| Resource | Limit |
|----------|-------|
| Documents per user | 5 |
| File size | 20 MB |
| Formats | PDF, DOCX, DOC, XLSX, XLS, CSV |
| Saved conversations | 10 |
| Chunks per document | 400 (max) |
| Chunks per question | 5 (after reranking) |
| Chunk version | v5 (structure-aware) |

## License

Private — all rights reserved.
