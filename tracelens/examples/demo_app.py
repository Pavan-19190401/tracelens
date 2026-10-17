"""TraceLens Demo LLM Application.

Demonstrates instrumenting a multi-step customer support agent with:
- Nested spans: agent -> retrieval -> tool -> llm
- Automatic token and cost calculation
- Non-blocking batch ingestion to TraceLens
"""

import os
import sys
import time

# Ensure tracelens can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tracelens", "sdk", "src")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import tracelens
from tracelens import trace


@trace(name="vector_search", kind="retrieval")
def search_knowledge_base(query: str):
    """Simulate retrieving relevant knowledge base articles."""
    time.sleep(0.04)
    return [
        {"id": "doc_101", "title": "Refund Policy", "text": "Customers can request refunds within 30 days."},
        {"id": "doc_102", "title": "Discount Codes", "text": "Use code SAVE10 for 10% off recurring subscriptions."},
    ]


@trace(name="calculate_discount", kind="tool")
def calculate_discount_tool(order_amount: float, discount_pct: float) -> float:
    """Simulate tool execution to calculate discounted price."""
    time.sleep(0.02)
    return round(order_amount * (1.0 - (discount_pct / 100.0)), 2)


@trace(name="gpt-4o-reasoning", kind="llm", model="gpt-4o")
def llm_generate_response(user_query: str, context: list) -> str:
    """Simulate calling OpenAI GPT-4o."""
    time.sleep(0.12)
    # Current active span automatically captures inputs, outputs, and token metrics
    current_span = tracelens.get_current_span()
    if current_span:
        current_span.set_token_usage(prompt_tokens=220, completion_tokens=75)
        current_span.set_metadata({
            "temperature": 0.7,
            "system_fingerprint": "fp_44589d",
        })

    return f"Based on our policy ({context[0]['title']}), you are eligible for a full refund within 30 days. Your new total with discount is $90.00."


@trace(name="support_copilot_pipeline", kind="agent")
def run_support_agent(user_id: str, query: str):
    """Top-level agent pipeline handling customer inquiry."""
    print(f"[TraceLens] Processing query from user {user_id}: '{query}'")

    # Step 1: Retrieval
    docs = search_knowledge_base(query)

    # Step 2: Tool execution
    _ = calculate_discount_tool(100.0, 10.0)

    # Step 3: LLM generation
    final_reply = llm_generate_response(query, docs)

    print(f"[TraceLens] Generated Agent Response: {final_reply}")
    return final_reply


def main():
    api_key = os.environ.get("TRACELENS_API_KEY", "tl_live_demo_test_key_12345")
    endpoint = os.environ.get("TRACELENS_ENDPOINT", "http://localhost:8000")

    print(f"[TraceLens] Initializing SDK -> Endpoint: {endpoint}")
    tracelens.init(
        api_key=api_key,
        endpoint=endpoint,
        batch_size=5,
        flush_interval_seconds=1.0,
    )

    # Execute agent pipeline
    run_support_agent(
        user_id="usr_prod_4920",
        query="Can I return my item and get the 10% holiday discount on a new one?",
    )

    # Flush all spans synchronously before exiting
    print("[TraceLens] Flushing traces to TraceLens backend...")
    tracelens.flush()
    print("[TraceLens] Done! Trace successfully captured.")


if __name__ == "__main__":
    main()
