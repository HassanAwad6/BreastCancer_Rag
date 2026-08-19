from pypdf import PdfReader
from pathlib import Path
import json
import re
from sentence_transformers import SentenceTransformer
import numpy as np
from rank_bm25 import BM25Okapi
from Parsing_Cleaning import clean_text, toc_texts, useful_pages, clean_pages, toc_by_source

#We now define a function to build a section map from the TOC entries and the useful page range.
#So we can make chunks out of it.
def build_section_map(entries, start_page, end_page):
    sections = []
    current_header = None
    # Keep only TOC entries inside the useful page range
    useful_entries = []
    for entry in entries:
        if start_page <= entry["start_page"] <= end_page:
            useful_entries.append(entry)
    # Assign headers and subheaders
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
    # Calculate the end page
    for i in range(len(sections)):
        if i + 1 < len(sections):
            sections[i]["end_page"] = sections[i + 1]["start_page"]
        else:
            sections[i]["end_page"] = end_page
    return sections


#We now use the build_section_map function to build a section map from the TOC entries and the useful page range.
sections_by_source = {}
for source, entries in toc_by_source.items():
    start_page, end_page = useful_pages[source]
    sections_by_source[source] = build_section_map(
        entries,
        start_page,
        end_page
    )

#We now define a function to chunk the text into smaller pieces with a specified chunk size and overlap.
def chunk_text(text, chunk_size=300, overlap=45):
    words = text.split()
    chunks = []
    step = chunk_size - overlap
    for start in range(0, len(words), step):
        chunk_words = words[start:start + chunk_size]
        if not chunk_words:
            break
        chunk = " ".join(chunk_words)
        chunks.append(chunk)
    return chunks

#We now use the chunk_text function to chunk the text into smaller pieces with a specified chunk size and overlap.
chunks = []
chunk_id = 1
for source, sections in sections_by_source.items():
    for section in sections:
        section_text = ""
        for page in clean_pages:
            if (
                page["source"] == source
                and section["start_page"] <= page["page"] <= section["end_page"]
            ):
                section_text += page["text"] + " "
        text_chunks = chunk_text(
            section_text,
            chunk_size=300,
            overlap=45
        )
        for chunk_number, text in enumerate(text_chunks):
            chunks.append({
                "chunk_id": chunk_id,
                "source": source,
                "header": section["header"],
                "number": section["number"],
                "subheader": section["subheader"],
                "start_page": section["start_page"],
                "end_page": section["end_page"],
                "chunk_number": chunk_number + 1,
                "text": text
            })
            chunk_id += 1

documents = []
for chunk in chunks:
    documents.append({
        "text": chunk["text"],
        "metadata": {
            "chunk_id": chunk["chunk_id"],
            "source": chunk["source"],
            "header": chunk["header"],
            "number": chunk["number"],
            "subheader": chunk["subheader"],
            "start_page": chunk["start_page"],
            "end_page": chunk["end_page"],
            "chunk_number": chunk["chunk_number"]
        }
    })
with open("chunks_metadata.json", "w", encoding="utf-8") as file:
    json.dump(documents, file, ensure_ascii=False, indent=4)
