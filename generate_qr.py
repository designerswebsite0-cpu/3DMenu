import sys
import urllib.request
import urllib.parse
import os

def generate_qr(url):
    print(f"Generating QR code for: {url}...")
    encoded_url = urllib.parse.quote(url)
    # Using api.qrserver.com to generate a clean, premium 500x500 QR code
    api_url = f"https://api.qrserver.com/v1/create-qr-code/?size=500x500&data={encoded_url}&color=1a1917&margin=20"
    
    # Save directory
    target_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(target_dir, "menu-qr.png")
    
    try:
        # Request with headers to avoid user-agent blocks
        req = urllib.request.Request(
            api_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            with open(output_path, 'wb') as out_file:
                out_file.write(response.read())
        print(f"\nSuccess! QR code successfully generated and saved to:")
        print(f"  {output_path}")
        print("\nThis QR code image is ready to be printed inside restaurant menus.")
    except Exception as e:
        print(f"Error generating QR code: {e}")

if __name__ == "__main__":
    # If a URL is passed as an argument, use it. Otherwise, use a default prospective URL.
    target_url = sys.argv[1] if len(sys.argv) > 1 else "https://burger-ar-menu.vercel.app"
    generate_qr(target_url)
