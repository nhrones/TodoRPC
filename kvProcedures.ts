// deno-lint-ignore-file no-explicit-any

const RunningOnDeploy = !!Deno.env.get("DENO_REGION")
let db: Deno.Kv
async function initDB() { 
   db = (RunningOnDeploy) 
      ? await Deno.openKv()
      : await Deno.openKv("./data/db.db")
}   


/** delete a record */
export async function deleteRow(key: any[]) {
   if (!db) await initDB()
   const result = await db.delete(key);
   fireMutationEvent(key, "RowDeleted")
   return result
}

/** get a record */
export async function getRow(key: any[], _version: string) {
   if (!db) await initDB()
   const result = await db.get(key)
   return result
}

/** set a record */
export async function setRow(key: any[], value: any) {
   if (!db) await initDB()
   const result = await db.set(key, value);
   if (result.versionstamp) {
      fireMutationEvent(key, "SetRow")
   } else {
      console.error('kvdb.setRow failed!')
   }
   return result
}

/** bulk fetch - get record collection */
export async function getAll() {
   const  cache = new Map()
   if (!db) await initDB()
   // we'll just rebuild our cache for each new client
   const entries = db.list({ prefix: ['todo'] })
   for await (const entry of entries) {
      cache.set(entry.key, entry.value)
   }

   if (cache.size < 1) {
      await loadTestSet()
      const entries = db.list({ prefix: [] })
      for await (const entry of entries) {
         cache.set(entry.key, entry.value)
      }
   }
   return Array.from(cache.entries())
}

/** delete all rows from the db */
export async function clearAll() {
   if (!db) await initDB()
   getAllKeys()
      .then((keys) => {
         keys.forEach( (key) => {
            db.delete(key)
         })
      })
}

/**  bulk fetch */
export async function getAllKeys() {
   const allKeys = []
   if (!db) await initDB()
   const entries = db.list({ prefix: [] })
   for await (const entry of entries) {
      allKeys.push(entry.key)
   }
   return allKeys
}

export async function loadTestSet() {
   if (!db) await initDB()
   await db.set(["todo","app1"],`One`)
   await db.set(["todo","topics"],`{"Edit Topics": [
      { "name": "Todo App Topics", "value": "topics" }
   ]`)
}
 
/**
 * Fire an event reporting a DenoKv record mutation
 */
const fireMutationEvent = (key: any[], type: string) => {
   const bc = new BroadcastChannel("sse-rpc")
   bc.postMessage({ txID: -1, procedure: "MUTATION", params: { key, type } })
   bc.close();
}

// utility to bulk transfer kv rows
export async function copyDB(from ='data.db', to = '') {

   const fromDB = await Deno.openKv(from)
   const toDB = (to.length > 0) 
      ? await Deno.openKv(to) 
      : await Deno.openKv();

   const entries = fromDB.list({ prefix: [] })
   for await (const entry of entries) {
      await toDB.set(entry.key, entry.value);
   }

}