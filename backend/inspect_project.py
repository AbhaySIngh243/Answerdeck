import sys
import os
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import Project, Prompt, Response, Mention, VisibilityMetric, PromptMetric

app = create_app()
with app.app_context():
    project_id = 28
    project = Project.query.get(project_id)
    if not project:
        print("Project 28 not found in database!")
        sys.exit(0)
    
    print(f"Project ID: {project.id}")
    print(f"Name: {project.name}")
    print(f"Category: {project.category}")
    print(f"Region: {project.region}")
    print(f"User ID: {project.user_id}")
    print(f"Competitors: {project.competitors}")
    print(f"Onboarding Completed: {project.onboarding_completed}")
    
    prompts = Prompt.query.filter_by(project_id=project_id).all()
    print(f"\nTracked Prompts: {len(prompts)}")
    for p in prompts:
        print(f"  - Prompt ID {p.id}: {p.prompt_text} (models: {p.get_models()})")
        responses = Response.query.filter_by(prompt_id=p.id).all()
        print(f"    Total responses: {len(responses)}")
        for r in responses:
            print(f"      * Response ID {r.id}: {r.engine} (timestamp: {r.timestamp})")
            mentions = Mention.query.filter_by(response_id=r.id).all()
            print(f"        Mentions: {len(mentions)}")
            for m in mentions:
                print(f"          - Brand: {m.brand} (is_focus: {m.is_focus}, rank: {m.rank}, sentiment: {m.sentiment})")
    
    metrics = VisibilityMetric.query.filter_by(project_id=project_id).all()
    print(f"\nVisibility Metrics: {len(metrics)}")
    for m in metrics:
        print(f"  - Date {m.date}: Score {m.score}")

    prompt_metrics = PromptMetric.query.filter_by(project_id=project_id).all()
    print(f"\nPrompt Metrics: {len(prompt_metrics)}")
    for pm in prompt_metrics:
        print(f"  - Prompt ID {pm.prompt_id}: {pm.engine} (mentioned: {pm.mentioned}, rank: {pm.rank})")
