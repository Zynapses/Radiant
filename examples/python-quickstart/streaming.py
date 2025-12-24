"""
RADIANT Python Streaming Example

Run: python streaming.py
"""

import os
from radiant import RadiantClient

def main():
    print("🌊 RADIANT Streaming Example\n")
    print("Generating a story...\n")
    print("-" * 50)
    
    client = RadiantClient(api_key=os.environ.get("RADIANT_API_KEY"))
    
    for chunk in client.chat.create_stream(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "Write a short 3-paragraph story about a robot learning to paint."}
        ]
    ):
        content = chunk.choices[0].delta.content
        if content:
            print(content, end="", flush=True)
    
    print("\n" + "-" * 50)
    print("\n✅ Streaming complete!")


if __name__ == "__main__":
    main()
