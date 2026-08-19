from pathlib import Path
import json
import re
import numpy as np
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

# 1. File paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "Data"
METADATA_FILE = DATA_DIR / "chunks_metadata.json"
VECTORS_FILE = DATA_DIR / "chunk_vectors.npy"

# 2. Load chunks + metadata
with open(
    METADATA_FILE,
    "r",
    encoding="utf-8"
) as file:
    documents = json.load(file)

chunks = []
for document in documents:
    metadata = document["metadata"]
    chunks.append({
        "chunk_id": metadata["chunk_id"],
        "source": metadata["source"],
        "header": metadata["header"],
        "number": metadata["number"],
        "subheader": metadata["subheader"],
        "start_page": metadata["start_page"],
        "end_page": metadata["end_page"],
        "chunk_number": metadata["chunk_number"],
        "text": document["text"]
    })

# 3. Load saved BGE chunk vectors
embeddings = np.load(
    VECTORS_FILE
)

# Make sure number of vectors matches number of chunks
if len(embeddings) != len(chunks):
    raise ValueError(
        "Number of embeddings does not match number of chunks. "
        "Run Embeddings.py again."
    )

# 4. Load BGE model
# We still need the model because every NEW user
# question must be converted into an embedding
embedding_model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

# 5. Prepare text for BM25
texts_for_bm25 = []
for chunk in chunks:
    header = chunk["header"] or ""
    subheader = chunk["subheader"] or ""
    chunk_text = chunk["text"]
    text = (
        header + "\n" +
        subheader + "\n" +
        chunk_text
    )
    texts_for_bm25.append(text)

# 6. Stop words
stop_words = {
    "the","is","a","an","what","of","to","for","with","how","should","be","in","on","and","or","are","was","were","do","does","did"}

# 7. BM25 tokenizer
def tokenize(text):
    # Convert to lowercase and extract words,
    # numbers and percentages.
    words = re.findall(
        r"\d+(?:\.\d+)?%|[a-z0-9]+",
        text.lower()
    )
    # Remove common stop words.
    words = [
        word
        for word in words
        if word not in stop_words
    ]
    return words

# 8. Tokenize all chunks
tokenized_chunks = []
for text in texts_for_bm25:
    tokenized_chunks.append(
        tokenize(text)
    )

# 9. Build BM25 index
bm25 = BM25Okapi(
    tokenized_chunks
)

# 10. Normalize scores
def normalize_scores(scores):
    minimum = np.min(scores)
    maximum = np.max(scores)
    # Prevent division by zero
    if maximum == minimum:
        return np.zeros_like(
            scores,
            dtype=np.float32
        )
    normalized = (
        (scores - minimum)
        /
        (maximum - minimum)
    )
    return normalized

SEMANTIC_THRESHOLD = 0.8
BM25_THRESHOLD = 1.5

# 11. Hybrid retrieval
def hybrid_query(
    question,
    top_k=3,
    semantic_weight=0.65,
    keyword_weight=0.35
):

    # A. SEMANTIC RETRIEVAL - BGE
    # Convert the user's question into an embedding.
    query_embedding = embedding_model.encode_query(
        question,
        normalize_embeddings=True
    )
    query_embedding = np.asarray(
        query_embedding,
        dtype=np.float32
    )
    # Compare question vector with all chunk vectors.
    semantic_scores = (
        embeddings @ query_embedding
    )
    # B. KEYWORD RETRIEVAL - BM25
    # Tokenize the user's question.
    query_tokens = tokenize(
        question
    )
    # BM25 gives one score for every chunk.
    keyword_scores = bm25.get_scores(
        query_tokens
    )
    best_semantic_score = np.max(
    semantic_scores
    )

    best_keyword_score = np.max(
    keyword_scores
    )

    if (
        best_semantic_score < SEMANTIC_THRESHOLD
        and
        best_keyword_score < BM25_THRESHOLD
    ):
        return []
    
    # C. NORMALIZE SCORES
    semantic_normalized = normalize_scores(
        semantic_scores
    )
    keyword_normalized = normalize_scores(
        keyword_scores
    )

    # D. HYBRID SCORE
    hybrid_scores = (
        semantic_weight * semantic_normalized
        +
        keyword_weight * keyword_normalized
    )

    # E. GET TOP K
    sorted_indices = np.argsort(
        hybrid_scores
    )[::-1]
    top_indices = sorted_indices[
        :top_k
    ]

    # F. BUILD RESULTS
    results = []
    for rank, index in enumerate(
        top_indices,
        start=1
    ):
        chunk = chunks[index]
        results.append({
            # Ranking
            "rank": rank,
            "chunk_id": chunk["chunk_id"],
            # Hybrid score
            "hybrid_score": float(
                hybrid_scores[index]
            ),
            # BGE scores
            "semantic_score": float(
                semantic_scores[index]
            ),
            "semantic_normalized": float(
                semantic_normalized[index]
            ),
            # BM25 scores
            "keyword_score": float(
                keyword_scores[index]
            ),
            "keyword_normalized": float(
                keyword_normalized[index]
            ),
            # Metadata
            "source": chunk["source"],
            "header": chunk["header"],
            "section": chunk["number"],
            "section_name": chunk["subheader"],
            "start_page": chunk["start_page"],
            "end_page": chunk["end_page"],
            "chunk_number": chunk["chunk_number"],
            # Actual retrieved evidence
            "text": chunk["text"]
        })
    return results