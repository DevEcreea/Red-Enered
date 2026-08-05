import subprocess

def run(cmd):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print("Return code:", result.returncode)

run("git add backend/storage.py backend/subsidio.py")
run('git commit -m "Autodescubrimiento de facturas en R2"')
run("git push origin main")
