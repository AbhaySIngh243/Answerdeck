from app import create_app
from models import Prompt
app = create_app()
with app.app_context():
    p = Prompt.query.first()
    if p:
        print(f"ID: {p.id} | Query: {p.prompt_text}")
    else:
        print("No prompts found.")
