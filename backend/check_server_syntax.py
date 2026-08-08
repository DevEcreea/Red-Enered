import sys
try:
    import server
    print("✅ SERVER SYNTAX IS PERFECT!")
except Exception as e:
    print("❌ ERROR:", e)
