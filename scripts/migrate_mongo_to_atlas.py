#!/usr/bin/env python3
"""
Copy all collections from a SOURCE Mongo (default: local DB) to a
DESTINATION Mongo (Atlas).  Idempotent — drops the destination DB
first when --replace is passed.
Usage:
    cd /app && \
    python scripts/migrate_mongo_to_atlas.py \
        --src   mongodb://localhost:27017/test_database \
        --dest 'mongodb+srv://user:pwd@cluster0.xxxx.mongodb.net/enered_prod' \
        --replace
"""
import argparse
import sys
from pymongo import MongoClient
from urllib.parse import urlparse


def _split(uri: str) -> tuple[str, str]:
    # Returns (uri_without_dbname, dbname). Defaults to 'enered' if missing.
    p = urlparse(uri)
    db_name = (p.path.lstrip("/") or "enered").split("?", 1)[0]
    return uri, db_name


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src",  required=True, help="Source Mongo URI (with /dbname)")
    ap.add_argument("--dest", required=True, help="Destination Mongo URI (with /dbname)")
    ap.add_argument("--replace", action="store_true",
                    help="Drop dest DB before copying")
    args = ap.parse_args()

    src_uri,  src_db_name  = _split(args.src)
    dest_uri, dest_db_name = _split(args.dest)

    src_client  = MongoClient(src_uri)
    dest_client = MongoClient(dest_uri)
    src_db  = src_client[src_db_name]
    dest_db = dest_client[dest_db_name]

    print(f"src : {src_db_name}")
    print(f"dest: {dest_db_name}")
    print(f"server src : {src_client.server_info().get('version')}")
    print(f"server dest: {dest_client.server_info().get('version')}")

    if args.replace:
        print(f"[!] Dropping destination DB {dest_db_name!r} ...")
        dest_client.drop_database(dest_db_name)

    total = 0
    for coll_name in src_db.list_collection_names():
        docs = list(src_db[coll_name].find({}))
        if not docs:
            print(f"  -- {coll_name}: empty, skipped")
            continue
        for d in docs:
            d.pop("_id", None)
        dest_db[coll_name].insert_many(docs)
        total += len(docs)
        print(f"  ok {coll_name}: {len(docs)} docs")

    print()
    print(f"Done. Migrated {total} documents.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
