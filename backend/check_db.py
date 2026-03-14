from app import create_app
from models import db, Response, Prompt
import json

app = create_app()
with app.app_context():
    research_responses = Response.query.filter_by(engine="perplexity_research").all()
    print(f"Total research responses: {len(research_responses)}")
    for resp in research_responses:
        prompt = Prompt.query.get(resp.prompt_id)
        print(f"Prompt: {prompt.prompt_text if prompt else 'Unknown'}")
        try:
            data = json.loads(resp.response_text)
            sources = data.get("sources", [])
            print(f"Sources found: {len(sources)}")
            for s in sources[:3]:
                print(f" - {s.get('title')} ({s.get('url')})")
        except Exception as e:
            print(f"Error parsing JSON: {e}")
        print("-" * 20)
