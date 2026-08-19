import json
import re

from Parsing_Cleaning import (
    useful_pages,
    clean_pages,
    toc_by_source
)

# 1. USER-FRIENDLY GUIDELINE NAMES
GUIDELINE_NAMES = {
    "Data/NG101.pdf":
        "NICE Guideline NG101 — Early and locally advanced breast cancer: "
        "diagnosis and management",

    "Data/CG81.pdf":
        "NICE Guideline CG81 — Advanced breast cancer: diagnosis and treatment"
}

# 2. BUILD SECTION MAP FROM TABLE OF CONTENTS
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
        # Main header
        if entry["number"] is None:
            current_header = entry["title"]
        # Numbered section
        else:
            sections.append({
                "header": current_header,
                "number": entry["number"],
                "subheader": entry["title"],
                "start_page": entry["start_page"]
            })

    # Calculate rough end page for every section
    for i in range(len(sections)):
        if i + 1 < len(sections):
            sections[i]["end_page"] = (
                sections[i + 1]["start_page"]
            )
        else:
            sections[i]["end_page"] = end_page
    return sections

# 3. BUILD SECTIONS FOR EVERY PDF
sections_by_source = {}

for source, entries in toc_by_source.items():
    start_page, end_page = useful_pages[source]
    sections_by_source[source] = build_section_map(
        entries,
        start_page,
        end_page
    )

# 4. FIND THE EXACT SECTION HEADING INSIDE A PAGE
def find_section_heading(text, section):
    number = section["number"]
    title = section["subheader"]
    # Make title matching flexible if PDF extraction
    # puts extra spaces or line breaks between words.
    title_pattern = r"\s+".join(
        re.escape(word)
        for word in title.split()
    )
    # The \s+ allows spaces OR line breaks.
    pattern = (
        rf"(?m)^\s*"
        rf"{re.escape(number)}"
        rf"\s+"
        rf"{title_pattern}"
    )
    match = re.search(
        pattern,
        text,
        flags=re.IGNORECASE
    )
    if match:
        return match.start()

    # Fallback
    # If the full heading was formatted differently in the
    # PDF, try locating the section number at the beginning
    # of a line.
    #
    # This will match:
    # 1.10 Hormone receptor...
    #
    # But will NOT match:
    # 1.10.1 Recommendation...
    #
    fallback_pattern = (
        rf"(?m)^\s*"
        rf"{re.escape(number)}"
        rf"\s+"
    )
    match = re.search(
        fallback_pattern,
        text
    )
    if match:
        return match.start()
    return -1

# 5. GET ONLY THE TEXT THAT BELONGS TO A SECTION
def get_section_pages(
    clean_pages,
    source,
    section,
    next_section=None
):
    section_pages = []
    for page in clean_pages:
        # Only pages belonging to this PDF and
        # inside the rough section page range
        if (
            page["source"] == source
            and
            section["start_page"]
            <= page["page"]
            <= section["end_page"]
        ):
            text = page["text"]

            # A. START AT THE CURRENT SECTION HEADING
            if page["page"] == section["start_page"]:
                start_position = find_section_heading(
                    text,
                    section
                )
                if start_position != -1:
                    text = text[
                        start_position:
                    ]

            # B. STOP BEFORE THE NEXT SECTION HEADING
            if (
                next_section is not None
                and
                page["page"]
                == next_section["start_page"]
            ):
                end_position = find_section_heading(
                    text,
                    next_section
                )
                if end_position != -1:
                    text = text[
                        :end_position
                    ]
            # Only save page if useful text remains
            if text.strip():
                section_pages.append({
                    "source": page["source"],
                    "page": page["page"],
                    "text": text.strip()
                })

    # Always keep pages in correct order
    section_pages.sort(
        key=lambda page: page["page"]
    )
    return section_pages

# 6. PAGE-AWARE CHUNKING
def chunk_pages(
    pages,
    chunk_size=300,
    overlap=45
):
    words_with_pages = []
    # Keep every word connected to the page
    # it originally came from
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
    for start in range(
        0,
        len(words_with_pages),
        step
    ):

        chunk_items = words_with_pages[
            start:start + chunk_size
        ]

        if not chunk_items:
            break
        # Create normal chunk text
        chunk_text = " ".join(
            item["word"]
            for item in chunk_items
        )
        # Find the REAL pages represented
        # inside this specific chunk
        pages_in_chunk = [
            item["page"]
            for item in chunk_items
        ]

        chunks.append({
            "text": chunk_text,
            "start_page": min(
                pages_in_chunk
            ),
            "end_page": max(
                pages_in_chunk
            )
        })
    return chunks

# 7. CREATE CHUNKS
chunks = []
chunk_id = 1
for source, sections in sections_by_source.items():
    for section_index, section in enumerate(sections):
        # Find the next section
        if section_index + 1 < len(sections):
            next_section = sections[
                section_index + 1
            ]
        else:
            next_section = None

        # Get ONLY text belonging to current section
        section_pages = get_section_pages(
            clean_pages,
            source,
            section,
            next_section
        )

        # Create page-aware chunks
        text_chunks = chunk_pages(
            section_pages,
            chunk_size=300,
            overlap=45
        )
        # Save each chunk
        for chunk_number, chunk in enumerate(
            text_chunks
        ):
            chunks.append({
                "chunk_id": chunk_id,
                # Internal PDF path
                "source": source,
                # User-friendly citation name
                "source_name": GUIDELINE_NAMES.get(
                    source,
                    source
                ),
                "header": section["header"],
                "number": section["number"],
                "subheader": section["subheader"],
                # REAL page range for THIS chunk
                "start_page": chunk["start_page"],
                "end_page": chunk["end_page"],
                "chunk_number": (
                    chunk_number + 1
                ),
                "text": chunk["text"]
            })
            chunk_id += 1

# 8. CONVERT TO DOCUMENT + METADATA FORMAT
documents = []
for chunk in chunks:

    documents.append({

        "text": chunk["text"],

        "metadata": {

            "chunk_id":
                chunk["chunk_id"],

            "source":
                chunk["source"],

            "source_name":
                chunk["source_name"],

            "header":
                chunk["header"],

            "number":
                chunk["number"],

            "subheader":
                chunk["subheader"],

            "start_page":
                chunk["start_page"],

            "end_page":
                chunk["end_page"],

            "chunk_number":
                chunk["chunk_number"]
        }
    })

# 9. SAVE CHUNK METADATA
with open(
    "Data/chunks_metadata.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        documents,
        file,
        ensure_ascii=False,
        indent=4
    )
print(
    f"Created {len(documents)} chunks."
)
print(
    "Saved to Data/chunks_metadata.json"
)