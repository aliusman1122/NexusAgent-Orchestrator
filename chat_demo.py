"""Interactive CLI chat demonstration for the A7 Logics Enterprise AI Chatbot.

Runs the compiled LangGraph agentic RAG workflow with grounding checks,
fallback logging, and automated admin escalations.
"""

import sys
from config.settings import settings
from core.graph.workflow import run_a7_agent


def main():
    print("=" * 70)
    print("   A7 LOGICS ENTERPRISE AI CHATBOT - INTERACTIVE CLIENT CONSOLE")
    print("=" * 70)
    print("Ask questions about A7 Logics services, technologies, processes, and pricing.")
    print("Type 'exit' or 'quit' to end the session.")
    print("-" * 70)

    while True:
        try:
            query = input("\n[Client Query] > ").strip()
            if not query:
                continue
            if query.lower() in ("exit", "quit", "q"):
                print("\nThank you for exploring A7 Logics! Goodbye.\n")
                break

            print("\nProcessing through LangGraph workflow (retrieve -> grade -> ground/fallback)...")
            result = run_a7_agent(query)

            print("\n[A7 Logics Response]:")
            print(result["generation"])

            print("\n[Metadata & State]:")
            print(f" - Grounded in Docs: {result['is_grounded']}")
            print(f" - Needs Admin Alert: {result['needs_alert']}")
            if result.get("alert_message"):
                print(f" - Active Escalation: {result['alert_message']}")

        except KeyboardInterrupt:
            print("\n\nSession terminated by user.")
            break
        except Exception as exc:
            print(f"\n[Error]: {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
