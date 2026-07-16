import csv

def count_estarkos():
    count = 0
    with open(r"C:\Users\ceoem\.gemini\antigravity-ide\brain\86ebe149-c8b8-463e-b1b8-d91900ffde4f\.system_generated\steps\3092\content.md", "r", encoding="utf-8") as f:
        for line in f:
            if "ESTARKOS" in line:
                count += 1
                
    with open(r"c:\Users\ceoem\Downloads\Red-Enered-main (2)\Red-Enered\estarkos_count.txt", "w", encoding="utf-8") as f:
        f.write(f"ESTARKOS count in CSV: {count}\n")
                
if __name__ == "__main__":
    count_estarkos()
