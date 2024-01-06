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
   const cache = new Map()
   if (!db) await initDB()
   // we'll just rebuild our cache for each new client
   const entries = db.list({ prefix: ['todo'] })
   for await (const entry of entries) {
      cache.set(entry.key, entry.value)
   }

   if (cache.size < 1) {
      await loadInitialDataset()
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
         keys.forEach((key) => {
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

// when no data was found, just persist a `basic` todo dataset,
export async function loadInitialDataset() {
   // ensure db connected
   if (!db) await initDB()
   // an entry for the topic `My New Project` in the Select-Group `Projects` with key `proj1`
   await db.set(["todo", "proj1"], `[ { "text": "Document this repo.", "disabled": false } ]`)

   // an entry for the topic `This App` in the Select-Group `Todo App` with key `todoapp`  
   await db.set(["todo", "todoapp"], `[ { "text": "Add more topics.", "disabled": false } ]`)

   // Our `topics` record -  allows us to add new topics to the Select list when needed
   // please note the newline and spacing in this JSON template string
   await db.set(["todo", "topics"], 
   `[\n 
      {\n \"text\": \"Projects\\n   My New Project, key = proj1\",\n   \"disabled\": false\n  },\n  
      {\n \"text\": \"Todo App\\n   This App, key = todoapp\",\n   \"disabled\": false\n  },\n  
      {\n \"text\": \"Topics\\n   Todo App Topics,  key = topics\",\n   \"disabled\": false\n  }\n]`
   )
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
export async function copyDB(from = 'data.db', to = '') {

   const fromDB = await Deno.openKv(from)
   const toDB = (to.length > 0)
      ? await Deno.openKv(to)
      : await Deno.openKv();

   const entries = fromDB.list({ prefix: [] })
   for await (const entry of entries) {
      await toDB.set(entry.key, entry.value);
   }

}