import json
from Parsing_Cleaning import (
    useful_pages,
    clean_pages,
    toc_by_source
)

# User-friendly guideline names
GUIDELINE_NAMES = {
    "Data/NG101.pdf":
        "NICE Guideline NG101 — Early and locally advanced breast cancer: "
        "diagnosis and management",

    "Data/CG81.pdf":
        "NICE Guideline CG81 — Advanced breast cancer: diagnosis and treatment"
}

# Build section map from the Table of Contents
def build_section_map(entries, start_page, end_page):
    sections = []
    current_header = None
    useful_entries = []
    # Keep only TOC entries inside the useful page range
    for entry in entries:
        if start_page <= entry["start_page"] <= end_page:
            useful_entries.append(entry)
    # Assign main headers and numbered subheaders
    for entry in useful_entries:
        if entry["number"] is None:
            current_header = entry["title"]
        else:
            sections.append({
                "header": current_header,
                "number": entry["number"],
                "subheader": entry["title"],
                "start_page": entry["start_page"]
            })

    # Calculate section end pages
    for i in range(len(sections)):
        if i + 1 < len(sections):
            sections[i]["end_page"] = sections[i + 1]["start_page"]
        else:
            sections[i]["end_page"] = end_page
    return sections

# Build sections for every PDF
sections_by_source = {}
for source, entries in toc_by_source.items():
    start_page, end_page = useful_pages[source]
    sections_by_source[source] = build_section_map(
        entries,
        start_page,
        end_page
    )

# Page-aware chunking
def chunk_pages(pages, chunk_size=300, overlap=45):
    words_with_pages = []
    # Keep every word connected to the page it came from
    for page in pages:
        page_number = page["page"]
        words = page["text"].split()
        for word in words:
            words_with_pages.append({
                "word": word,
                "page": page_number
            })

    chunks = []
    step = chunk_size - overlap
    # Create overlapping chunks
    for start in range(0, len(words_with_pages), step):
        chunk_items = words_with_pages[
            start:start + chunk_size
        ]
        if not chunk_items:
            break
        # Build normal chunk text
        chunk_text = " ".join(
            item["word"]
            for item in chunk_items
        )
        # Get all page numbers represented inside this chunk
        pages_in_chunk = [
            item["page"]
            for item in chunk_items
        ]
        # Store the chunk together with its REAL page range
        chunks.append({
            "text": chunk_text,
            "start_page": min(pages_in_chunk),
            "end_page": max(pages_in_chunk)
        })
    return chunks

# Create chunks
chunks = []
chunk_id = 1
for source, sections in sections_by_source.items():
    for section in sections:
        # Instead of combining everything into one string,
        # keep the actual page objects.
        section_pages = []
        for page in clean_pages:
            if (
                page["source"] == source
                and
                section["start_page"]
                <= page["page"]
                <= section["end_page"]
            ):
                section_pages.append(page)
        # Make sure pages are always in the correct order
        section_pages.sort(key=lambda page: page["page"])

        # Create page-aware chunks
        text_chunks = chunk_pages(
            section_pages,
            chunk_size=300,
            overlap=45
        )
        for chunk_number, chunk in enumerate(text_chunks):
            chunks.append({
                "chunk_id": chunk_id,
                # Internal source path
                "source": source,
                # User-friendly guideline name
                "source_name": GUIDELINE_NAMES.get(
                    source,
                    source
                ),
                "header": section["header"],
                "number": section["number"],
                "subheader": section["subheader"],
                # IMPORTANT:
                # These now belong to THIS CHUNK,
                # not the entire section.
                "start_page": chunk["start_page"],
                "end_page": chunk["end_page"],
                "chunk_number": chunk_number + 1,
                "text": chunk["text"]
            })
            chunk_id += 1

# Convert chunks into document + metadata format
documents = []
for chunk in chunks:
    documents.append({
        "text": chunk["text"],
        "metadata": {
            "chunk_id": chunk["chunk_id"],
            "source": chunk["source"],
            "source_name": chunk["source_name"],
            "header": chunk["header"],
            "number": chunk["number"],
            "subheader": chunk["subheader"],
            "start_page": chunk["start_page"],
            "end_page": chunk["end_page"],
            "chunk_number": chunk["chunk_number"]
        }
    })

# Save chunk metadata
with open("Data/chunks_metadata.json","w",encoding="utf-8") as file:
    json.dump(documents,file,ensure_ascii=False,indent=4)
print(f"Created {len(documents)} chunks.")
print("Saved to chunks_metadata.json")