import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import Project
from engine.analyzer import build_focus_brand_aliases

app = create_app()
with app.app_context():
    project = Project.query.get(28)
    print(f"Project 28 Name: {project.name}")
    print(f"Project 28 website_url: {project.website_url}")
    print(f"Generated Aliases: {build_focus_brand_aliases(project.name, project.website_url)}")
