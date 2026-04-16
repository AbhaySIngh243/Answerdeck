from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class ProjectCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, description="Project name")
    category: Optional[str] = ""
    competitors: Optional[List[str]] = []
    region: Optional[str] = ""
    website_url: Optional[str] = ""
    collaborators: Optional[List[str]] = []


class ProjectUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = None
    competitors: Optional[List[str]] = None
    region: Optional[str] = None
    website_url: Optional[str] = None
    collaborators: Optional[List[str]] = None


class PromptCreateSchema(BaseModel):
    prompt_text: str = Field(..., min_length=1)
    prompt_type: Optional[str] = "Manual"
    country: Optional[str] = ""
    tags: Optional[List[str]] = []
    selected_models: Optional[List[str]] = []
    is_active: Optional[bool] = True


class PromptUpdateSchema(BaseModel):
    prompt_text: Optional[str] = Field(None, min_length=1)
    prompt_type: Optional[str] = None
    country: Optional[str] = None
    tags: Optional[List[str]] = None
    selected_models: Optional[List[str]] = None
    is_active: Optional[bool] = None


class OnboardingStepSchema(BaseModel):
    step: int = Field(..., ge=1, le=5)
    data: Dict[str, Any] = Field(default_factory=dict)


class OnboardingSuggestionSchema(BaseModel):
    hint: Optional[str] = ""
    brand_name: Optional[str] = ""
    domain: Optional[str] = ""
    industry: Optional[str] = ""
    region: Optional[str] = ""
    competitors: Optional[List[str]] = []


class OnboardingAssistantSchema(BaseModel):
    step: int = Field(..., ge=1, le=5)
    context: Dict[str, Any] = Field(default_factory=dict)
    question: Optional[str] = ""


class PromptAssistantSchema(BaseModel):
    prompt_text: Optional[str] = ""
    focus_brand: Optional[str] = ""
    industry: Optional[str] = ""
    funnel_stage: Optional[str] = ""
