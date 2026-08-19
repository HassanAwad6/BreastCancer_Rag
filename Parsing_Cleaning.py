from pypdf import PdfReader
from pathlib import Path
import json
import re
from sentence_transformers import SentenceTransformer
import numpy as np
from rank_bm25 import BM25Okapi

#We first need to read the PDF file and extract the text from it
#We do this by using the PdfReader class from the pypdf library
#We choose PdfReader because it is a simple and easy to use library that can read PDF files and extract text from them

#Upload our 2 PDF files
pdf_files = ["Data/NG101.pdf","Data/CG81.pdf"]

#We read the PDF files (extract the text from it) and we store them in the array all_pages.
all_pages = []
for pdf_file in pdf_files:
    reader = PdfReader(pdf_file)
    for page_number, page in enumerate(reader.pages):
        text = page.extract_text() or ""

        all_pages.append({
            "source": pdf_file,
            "page": page_number + 1,
            "text": text
        })

#Next we clean the data from Table of content, Extra spaces, Repeated headers/footers, unnecessary URLs, Unwanted characters.
#This is our cleaning function
def clean_text(text):
    # Remove NICE copyright footer
    text = re.sub(
        r"© NICE \d{4}\.\s*All rights reserved\.\s*Subject to Notice of rights\s*"
        r"\(https://www\.nice\.org\.uk/terms-and-\s*conditions#notice-of-rights\)\.",
        "",
        text
    )
    # Remove page numbers like "Page 5 of 108 or "Page 5 of 38"
    
    # Remove extra spactext = re.sub(r"Page\s+\d+\s+of\s+\d+", "", text)es
    text = re.sub(r"[ \t]+", " ", text)
    # Remove too many blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    return text

#We define the pages that we want to extract from each PDF file.
toc_pages = {
    "Data/NG101.pdf": [3, 4, 5],
    "Data/CG81.pdf": [3, 4]
}
useful_pages = {
    "Data/NG101.pdf": (7, 58),
    "Data/CG81.pdf": (7, 32)
}

#We now use the clean_text function to clean the text from the useful pages we extracted from the PDF files
clean_pages = []
for page in all_pages:
    start_page, end_page = useful_pages[page["source"]]

    if page["page"] < start_page or page["page"] > end_page:
        continue
    cleaned = clean_text(page["text"])
    if cleaned:
        clean_pages.append({
            "source": page["source"],
            "page": page["page"],
            "text": cleaned
        })

#We want to start chuncking our data into smaller pieces.
#We want to chunck the data while having the table of content as our reference.
#We first extracted just the table of content from each PDF file and stored it in a dictionary called toc_texts.
toc_texts = {}
for source, pages in toc_pages.items():
    toc_text = ""
    for page in all_pages:
        if page["source"] == source and page["page"] in pages:
            toc_text += page["text"] + "\n"
    toc_texts[source] = clean_text(toc_text)


#We now define a function to parse the table of content text and extract the entries from it.
def parse_toc(toc_text):
    entries = []
    lines = toc_text.splitlines()
    merged_lines = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # If a numbered TOC entry is broken into multiple lines
        if re.match(r"^\d+(?:\.\d+)*\s+", line):
            while (
                not re.search(r"\.{2,}\s*\d+\s*$", line)
                and i + 1 < len(lines)
            ):
                i += 1
                line += " " + lines[i].strip()
        merged_lines.append(line)
        i += 1
    pattern = r"(?:(\d+(?:\.\d+)*)\s+)?(.+?)\s*\.{2,}\s*(\d+)"
    for line in merged_lines:
        for match in re.finditer(pattern, line):
            number = match.group(1)
            title = match.group(2).strip()
            page_number = int(match.group(3))
            entries.append({
                "number": number,
                "title": title,
                "start_page": page_number
            })
    return entries


#We now use the parse_toc function to parse the table of content text and extract the entries from it.
toc_by_source = {}
for source, toc_text in toc_texts.items():
    toc_by_source[source] = parse_toc(toc_text)


for page in clean_pages:
    print(f"Source: {page['source']}, Page: {page['page']}")

for source, toc_entries in toc_by_source.items():
    print(f"Source: {source}")
    for entry in toc_entries:
        print(f"  Number: {entry['number']}, Title: {entry['title']}, Start Page: {entry['start_page']}")