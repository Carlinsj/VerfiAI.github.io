import json
import requests
import difflib
import os
from dotenv import load_dotenv
from transformers import GPT2LMHeadModel, GPT2Tokenizer, pipeline

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MODEL_REPO_ID = "carlinsj17/VerifAI"
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")  # Load from environment variable


# Load the model with authentication
try:
    model = GPT2LMHeadModel.from_pretrained(MODEL_REPO_ID, token=HF_TOKEN)
    tokenizer = GPT2Tokenizer.from_pretrained(MODEL_REPO_ID, token=HF_TOKEN)
    if tokenizer.eos_token is None:
        tokenizer.add_special_tokens({"eos_token": "</s>"})
    tokenizer.pad_token = tokenizer.eos_token
except Exception as e:
    print(f"Error loading model: {str(e)}")
    # Fallback to a simple citation generator when model loading fails
    def generate_citation_fallback(paper_info):
        """Generate a basic citation when model is unavailable"""
        authors = ", ".join(paper_info['authors'])
        return f"{authors}, \"{paper_info['title']},\" {paper_info['year']}. DOI: {paper_info['doi']}"
    model = None
    tokenizer = None

# The rest of your generate_citation_for_paper function needs to handle both cases
def generate_citation_for_paper(paper_info):
    """
    Generate citation using the model if available, otherwise fall back to a simple format
    """
    if model is None or tokenizer is None:
        # Use fallback citation format
        authors = ", ".join(paper_info['authors'])
        return f"{authors}, \"{paper_info['title']},\" {paper_info['year']}. DOI: {paper_info['doi']}"
    
    # Original model-based generation logic
    prompt = (
        f"Generate an IEEE citation for a paper with the following details:\n"
        f"Title: {paper_info['title']}\n"
        f"Authors: {', '.join(paper_info['authors'])}\n"
        f"Year: {paper_info['year']}\n"
        f"DOI: {paper_info['doi']}\n"
    )
    input_ids = tokenizer.encode(prompt, return_tensors="pt")
    output_ids = model.generate(input_ids, max_length=128, num_return_sequences=1)
    generated_text = tokenizer.decode(output_ids[0], skip_special_tokens=True)
    return generated_text.strip()

def rank_references(main_title, main_abstract, references):
    """
    Compute similarity between the combined main text (title + abstract)
    and each reference title using difflib. It stores both a raw score and a
    percentage value, then returns the references sorted in descending order.
    """
    main_text = main_title + " " + (main_abstract or "")
    for ref in references:
        ref_title = ref.get("title", "")
        # Compute similarity over just the title...
        title_sim = difflib.SequenceMatcher(None, main_title.lower(), ref_title.lower()).ratio()
        # ...and similarity over the combined title+abstract vs. reference title.
        content_sim = difflib.SequenceMatcher(None, main_text.lower(), ref_title.lower()).ratio() if ref_title else 0
        # Combine the two scores with chosen weights: 70% title, 30% content.
        final_score = (0.7 * title_sim + 0.3 * content_sim) *2
        ref["similarity_score"] = final_score
        ref["similarity_percentage"] = round(final_score * 100, 2)
    return sorted(references, key=lambda x: x.get("similarity_score", 0), reverse=True)

def get_paper_by_doi(doi):
    """
    Query CrossRef using the DOI to retrieve paper metadata.
    Extract references, rank them (using both title and abstract),
    and return a dictionary with the paper details.
    """
    doi = doi.replace("https://doi.org/", "").strip()
    
    url = f"https://api.crossref.org/works/{doi}"
    headers = {
        "User-Agent": "VerifAI/1.0"
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()["message"]
            references = []
            if "reference" in data:
                for ref in data.get("reference", []):
                    reference_item = {
                        "key": ref.get("key", ""),
                        "doi": ref.get("DOI", ""),
                        "title": ref.get("article-title", "") or ref.get("unstructured", ""),
                        "authors": ref.get("author", "").split(",") if "author" in ref else [],
                        "year": ref.get("year", "")
                    }
                    references.append(reference_item)
            main_title = data.get("title", [""])[0]
            main_abstract = data.get("abstract", "")
            if main_title and references:
                references = rank_references(main_title, main_abstract, references)
            return {
                "title": main_title,
                "authors": [
                    f"{author.get('given', '')} {author.get('family', '')}".strip()
                    for author in data.get("author", [])
                ],
                "year": str(data.get("published-print", {}).get("date-parts", [[""]])[0][0]),
                "doi": doi,
                "abstract": main_abstract,
                "references": references
            }
        else:
            return {"error": f"HTTP {response.status_code} error from CrossRef."}
    except Exception as e:
        return {"error": str(e)}

def get_paper_by_doi_semantic(doi):
    """
    Fallback method: Query Semantic Scholar using the DOI to retrieve metadata.
    """
    doi = doi.replace("https://doi.org/", "").strip()
    base_url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=title,authors,year,abstract"
    try:
        response = requests.get(base_url)
        if response.status_code == 200:
            data = response.json()
            authors = [author.get("name", "") for author in data.get("authors", [])]
            return {
                "title": data.get("title", ""),
                "authors": authors,
                "year": str(data.get("year", "")),
                "doi": doi,
                "abstract": data.get("abstract", ""),
                "references": []
            }
        else:
            return {"error": f"HTTP {response.status_code} error from Semantic Scholar."}
    except Exception as e:
        return {"error": str(e)}

def get_combined_metadata(doi):
    """
    Combine metadata from CrossRef and Semantic Scholar.
    If Semantic Scholar returns richer information (e.g. a longer title),
    that information replaces the CrossRef version.
    """
    crossref_data = get_paper_by_doi(doi)
    semantic_data = get_paper_by_doi_semantic(doi)
    if "error" in crossref_data:
        return semantic_data
    if semantic_data and "error" not in semantic_data:
        if semantic_data.get("title") and len(semantic_data.get("title")) > len(crossref_data.get("title", "")):
            crossref_data["title"] = semantic_data["title"]
        if semantic_data.get("authors") and len(semantic_data.get("authors")) >= len(crossref_data.get("authors", [])):
            crossref_data["authors"] = semantic_data["authors"]
        if semantic_data.get("abstract") and not crossref_data.get("abstract"):
            crossref_data["abstract"] = semantic_data["abstract"]
        if semantic_data.get("year"):
            crossref_data["year"] = semantic_data["year"]
    return crossref_data

def search_retracted_papers(title):
    """
    Use CrossRef to search for papers that have been retracted,
    matching approximately the given title.
    Returns a list of dictionaries with title and DOI.
    """
    base_url = "https://api.crossref.org/works"
    params = {"query.title": title, "filter": "type:retraction"}
    try:
        response = requests.get(base_url, params=params)
        if response.status_code == 200:
            data = response.json()
            items = data.get("message", {}).get("items", [])
            return [{"title": item["title"][0], "doi": item["DOI"]} for item in items if item.get("title")]
        else:
            return []
    except Exception as e:
        return []

def main(doi):
    """Fetch metadata, generate citation, check for retractions, and output as JSON."""
    paper_info = get_combined_metadata(doi)
    if not paper_info or "error" in paper_info:
        return {"success": False, "error": paper_info.get("error", "Paper not found")}
    
    citation = generate_citation_for_paper(paper_info)
    paper_info["citation"] = citation
    retracted_results = search_retracted_papers(paper_info["title"])
    paper_info["is_retracted"] = len(retracted_results) > 0
    if paper_info["is_retracted"]:
        paper_info["retraction_info"] = retracted_results
    return {"success": True, "paper": paper_info}

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = main(sys.argv[1])
        # Print the result as formatted JSON output.
        print(json.dumps(result, indent=4))
