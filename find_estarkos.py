import csv

def find_estarkos():
    out = []
    with open(r"C:\Users\ceoem\.gemini\antigravity-ide\brain\86ebe149-c8b8-463e-b1b8-d91900ffde4f\.system_generated\steps\3092\content.md", "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if "ESTARKOS" in line:
                out.append(line.strip())
                
    with open(r"c:\Users\ceoem\Downloads\Red-Enered-main (2)\Red-Enered\estarkos_log.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(out))
                
if __name__ == "__main__":
    find_estarkos()
