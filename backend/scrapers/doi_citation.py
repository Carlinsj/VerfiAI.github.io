#!/usr/bin/env python
import json
import os
import requests
from transformers import GPT2LMHeadModel, GPT2Tokenizer, pipeline

# If desired, compute a relative path based on this script's directory.
script_dir = os.path.dirname(os.path.abspath(__file__))
# Adjust the relative path based on your project structure. For example, if your model repository is in
# ../training/citation_gpt2_model relative to this script:
FINE_TUNED_MODEL_PATH = os.path.join(script_dir, "..", "training", "citation_gpt2_model")
FINE_TUNED_MODEL_PATH = os.path.abspath(FINE_TUNED_MODEL_PATH)
print("Loading model from:", FINE_TUNED_MODEL_PATH)

# Use Hugging Face's from_pretrained() to load the quantized model and tokenizer.
model = GPT2LMHeadModel.from_pretrained(FINE_TUNED_MODEL_PATH, local_files_only=True)
tokenizer = GPT2Tokenizer.from_pretrained(FINE_TUNED_MODEL_PATH, local_files_only=True)

# GPT-2 doesn't have a pad token by default; set the pad token to the EOS token.
tokenizer.pad_token = tokenizer.eos_token

# Create the text-generation pipeline using the loaded model and tokenizer.
citation_generator = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    pad_token_id=tokenizer.eos_token_id
)

def get_paper_by_doi(doi):
    """Fetch paper details from CrossRef using DOI."""
    doi = doi.replace("https://doi.org/", "").strip()
    url = f"https://api.crossref.org/works/{doi}"
    headers = {"User-Agent": "VerifAI/1.0"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()['message']
            # Extract references if available.
            references = []
            if 'reference' in data:
                for ref in data.get('reference', []):
                    reference_item = {
                        'key': ref.get('key', ''),
                        'doi': ref.get('DOI', ''),
                        'title': '',
                        'authors': [],
                        'year': '',
                        'unstructured': ref.get('unstructured', ''),
                        'verification_status': 'pending'
                    }
                    if 'article-title' in ref:
                        reference_item['title'] = ref['article-title']
                    elif 'unstructured' in ref:
                        reference_item['title'] = ref['unstructured']
                    
                    if 'author' in ref:
                        reference_item['authors'] = ref['author'].split(',')
                    
                    if 'year' in ref:
                        reference_item['year'] = ref['year']
                    
                    references.append(reference_item)
            
            return {
                'title': data.get('title', [''])[0],
                'authors': [
                    f"{author.get('given', '')} {author.get('family', '')}".strip() 
                    for author in data.get('author', [])
                ],
                'year': str(data.get('published-print', {}).get('date-parts', [['']])[0][0]),
                'doi': doi,
                'abstract': data.get('abstract', ''),
                'references': references
            }
    except Exception as e:
        print(f"Error fetching DOI from CrossRef: {e}")
    return None

def get_paper_by_doi_semantic(doi):
    """Fetch paper details from Semantic Scholar using DOI as a fallback."""
    doi = doi.replace("https://doi.org/", "").strip()
    base_url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=title,authors,year,abstract"
    try:
        response = requests.get(base_url)
        if response.status_code == 200:
            data = response.json()
            authors = [author.get("name", "") for author in data.get("authors", [])]
            year = str(data.get("year", ""))
            title = data.get("title", "")
            abstract = data.get("abstract", "")
            # Skip references from Semantic Scholar for now.
            references = []
            return {
                'title': title,
                'authors': authors,
                'year': year,
                'doi': doi,
                'abstract': abstract,
                'references': references
            }
    except Exception as e:
        print(f"Error fetching DOI from Semantic Scholar: {e}")
    return None

def get_combined_metadata(doi):
    """Combine metadata from CrossRef and Semantic Scholar for a DOI."""
    crossref_data = get_paper_by_doi(doi)
    semantic_data = get_paper_by_doi_semantic(doi)
    
    if crossref_data is None:
        return semantic_data
    if semantic_data:
        # Replace title if Semantic Scholar offers a longer title
        if semantic_data.get("title") and len(semantic_data.get("title")) > len(crossref_data.get("title", "")):
            crossref_data["title"] = semantic_data["title"]
        # Replace authors if Semantic Scholar provides the same or more information
        if semantic_data.get("authors") and len(semantic_data.get("authors")) >= len(crossref_data.get("authors", [])):
            crossref_data["authors"] = semantic_data["authors"]
        # Fill abstract from Semantic Scholar if missing
        if semantic_data.get("abstract") and not crossref_data.get("abstract"):
            crossref_data["abstract"] = semantic_data["abstract"]
        # Update year if available in Semantic Scholar
        if semantic_data.get("year"):
            crossref_data["year"] = semantic_data["year"]
    return crossref_data

def search_retracted_papers(title):
    """
    Check if a paper is retracted using CrossRef (Retraction Watch) by searching the paper title.
    Returns a list of retracted papers (with title and DOI) that match the title.
    """
    base_url = "https://api.crossref.org/works"
    params = {
        "query.title": title,
        "filter": "type:retraction"
    }
    try:
        response = requests.get(base_url, params=params)
        if response.status_code == 200:
            data = response.json()
            items = data.get("message", {}).get("items", [])
            return [{"title": item["title"][0], "doi": item["DOI"]} for item in items]
    except Exception as e:
        print(f"Retraction check error: {e}")
    return []

def generate_citation_for_paper(paper_info):
    """
    Generate a citation for the paper using the quantized GPT-2 model.
    Constructs a prompt including key metadata and generates an IEEE-formatted citation.
    """
    prompt = (
        f"Generate an IEEE citation for a paper with the following details:\n"
        f"Title: {paper_info['title']}\n"
        f"Authors: {', '.join(paper_info['authors'])}\n"
        f"Year: {paper_info['year']}\n"
        f"DOI: {paper_info['doi']}\n"
    )
    output = citation_generator(prompt, max_length=128, num_return_sequences=1)
    citation = output[0]["generated_text"].strip()
    return citation

def main(doi):
    """Main function to get paper details, check for retractions, and generate a citation."""
    try:
        paper_info = get_combined_metadata(doi)
        if not paper_info:
            return {'success': False, 'error': 'Paper not found'}
            
        citation = generate_citation_for_paper(paper_info)
        paper_info['citation'] = citation
        
        retracted_results = search_retracted_papers(paper_info['title'])
        is_retracted = len(retracted_results) > 0
        paper_info['is_retracted'] = is_retracted
        if is_retracted:
            paper_info['retraction_info'] = retracted_results
        
        return {
            'success': True,
            'paper': paper_info
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = main(sys.argv[1])
        print(json.dumps(result, indent=4))
