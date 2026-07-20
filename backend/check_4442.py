import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb+srv://developer:fM7YqT1Xh0D77Y9q@cluster0.e8s4u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
    db = client.enered_db
    doc_id = '4442f0ad-fb6e-4558-a36b-3596365d56ac'
    
    print("Checking db.consumptions...")
    doc = await db.consumptions.find_one({"id": doc_id})
    if doc:
        print(f"FOUND in consumptions: id={doc.get('id')}, factura_key={doc.get('factura_key')}")
    else:
        print("Not found in consumptions by string id.")
        
    print("Checking db.consumos_subsidio...")
    sub_doc = await db.consumos_subsidio.find_one({"id": doc_id})
    if sub_doc:
        print(f"FOUND in consumos_subsidio by string id: id={sub_doc.get('id')}, factura_storage_key={sub_doc.get('factura_storage_key')}")
    else:
        print("Not found in consumos_subsidio by string id.")
        
    # Also check by ObjectId just in case
    from bson import ObjectId
    try:
        oid = ObjectId(doc_id)
        sub_doc_oid = await db.consumos_subsidio.find_one({"_id": oid})
        if sub_doc_oid:
            print(f"FOUND in consumos_subsidio by ObjectId: _id={sub_doc_oid.get('_id')}, factura_storage_key={sub_doc_oid.get('factura_storage_key')}")
    except:
        pass

asyncio.run(main())
