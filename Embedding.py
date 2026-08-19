from pathlib import Path
import json
import numpy as np
from sentence_transformers import SentenceTransformer

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

# 3. Prepare texts that will be embedded
texts_to_embed = []
for document in documents:
    metadata = document["metadata"]
    header = metadata["header"] or ""
    subheader = metadata["subheader"] or ""
    chunk_text = document["text"]
    text = (
        header + "\n" +
        subheader + "\n" +
        chunk_text
    )
    texts_to_embed.append(text)

# 4. Load BGE embedding model
embedding_model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

# 5. Generate embeddings for all chunks
embeddings = embedding_model.encode_document(
    texts_to_embed,
    batch_size=32,
    normalize_embeddings=True,
    show_progress_bar=True
)

# 6. Make sure vectors are float32 NumPy arrays
embeddings = np.asarray(
    embeddings,
    dtype=np.float32
)

# 7. Save vectors
np.save(
    VECTORS_FILE,
    embeddings
)

# 8. Show information
print("\nEmbeddings created successfully.")
print("Number of chunks:", len(documents))
print("Vectors shape:", embeddings.shape)
print("Saved to:", VECTORS_FILE)