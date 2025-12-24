"""
RADIANT Python Quick Start

Run: python quickstart.py
"""

import os
from radiant import RadiantClient

def main():
    print("🚀 RADIANT Python Quick Start\n")
    
    # Initialize client
    client = RadiantClient(api_key=os.environ.get("RADIANT_API_KEY"))
    
    # 1. List models
    print("📋 Available Models:")
    models = client.models.list()
    for model in models.data[:5]:
        print(f"  - {model.id}: {model.display_name}")
    print(f"  ... and {len(models.data) - 5} more\n")
    
    # 2. Check balance
    print("💰 Credit Balance:")
    balance = client.billing.get_credits()
    print(f"  Available: ${balance.available:.2f}\n")
    
    # 3. Chat completion
    print("💬 Chat Completion:")
    response = client.chat.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is RADIANT in one sentence?"}
        ],
        max_tokens=100
    )
    
    print(f"  Response: {response.choices[0].message.content}")
    print(f"  Tokens: {response.usage.total_tokens}\n")
    
    print("✅ Quick start complete!")


if __name__ == "__main__":
    main()
