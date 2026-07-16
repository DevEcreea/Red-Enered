import re
import pandas as pd

dates = ["2026/06/09", "2026/06/12", "06/12/2026"]
print("Testing dates...")

for d in dates:
    if re.match(r"^\d{4}[-/]", d):
        print(f"{d} matched regex. Result: {pd.to_datetime(d).date().isoformat()}")
    else:
        print(f"{d} did not match regex. Result: {pd.to_datetime(d, dayfirst=True).date().isoformat()}")
